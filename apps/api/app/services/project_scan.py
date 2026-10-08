"""
Project scan
============
Reads a target's project folder and suggests its profile: the chat route, the
port, the request field, the system prompt, secrets inside that prompt, and
tool names. Nothing is executed; files are only read.

The results are suggestions. Heuristics can be wrong, so the caller decides
what to apply.
"""

from __future__ import annotations

import ast
import json
import re
from collections import Counter
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "env", "__pycache__", ".next", "dist", "build", ".turbo", "site-packages"}
CODE_SUFFIXES = {".py", ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs"}
DATA_SUFFIXES = {".json", ".yaml", ".yml", ".toml", ".txt", ".md"}
MAX_FILES = 400
MAX_FILE_BYTES = 200_000

CHAT_WORDS = ("chat", "ask", "message", "complet", "generate", "query", "prompt", "converse", "answer")
PROMPT_NAME = re.compile(r"(system|sys)[_-]?(prompt|message|instruction)|^instructions?$|^prompt$|persona", re.I)
KNOWN_FIELDS = ("messages", "message", "prompt", "question", "query", "input", "text", "user_input", "q")

ROUTE_PATTERNS = (
    re.compile(r"""@\w+\.(?:post|route|api_route)\(\s*['"]([^'"]+)['"]"""),           # Flask / FastAPI
    re.compile(r"""\b(?:app|router|server)\.post\(\s*['"`]([^'"`]+)['"`]"""),         # Express / Hono
    re.compile(r"""self\.path\s*(?:==|!=)\s*['"]([^'"]+)['"]"""),                     # http.server
    re.compile(r"""\bpath\s*(?:==|===)\s*['"`](/[^'"`]*)['"`]"""),
)
PORT_PATTERNS = (
    re.compile(r"""\bport\s*[=:]\s*(\d{2,5})\b""", re.I),
    re.compile(r"""\.listen\(\s*(\d{2,5})\b"""),
    re.compile(r"""--port[= ](\d{2,5})\b"""),
)
FIELD_PATTERNS = (
    re.compile(r"""\.get\(\s*['"](\w+)['"]"""),
    re.compile(r"""\b(?:body|data|payload|json|req\.body|request\.json)\[\s*['"](\w+)['"]\s*\]"""),
    re.compile(r"""\breq\.body\.(\w+)"""),
    re.compile(r"""\bconst\s*\{\s*(\w+)[\s,}]"""),
)
TOOL_PATTERNS = (
    re.compile(r"""["']name["']\s*:\s*["']([A-Za-z_]\w{2,40})["']\s*,\s*["']description["']"""),
    re.compile(r"""@(?:tool|function_tool)\b[^\n]*\n\s*(?:async\s+)?def\s+(\w+)"""),
)
# Things inside a prompt that look like credentials or codes worth protecting.
SECRET_PATTERNS = (
    re.compile(r"\b(?:sk|pk|rk|ghp|xox[bap])[-_][A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\b[A-Z][A-Z0-9]{1,}(?:[-_][A-Z0-9]{2,}){1,}\b"),
    re.compile(r"\b[A-Za-z0-9+/]{24,}={0,2}\b"),
)


def _files(root: Path):
    count = 0
    for path in sorted(root.rglob("*")):
        if count >= MAX_FILES:
            return
        if not path.is_file() or any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        if path.suffix.lower() not in CODE_SUFFIXES | DATA_SUFFIXES or path.name.startswith(".env"):
            continue
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        count += 1
        yield path, text


def _python_prompts(text: str) -> list[str]:
    """String constants assigned to prompt-like names, and system-role message contents."""
    found = []
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return found
    for node in ast.walk(tree):
        if isinstance(node, (ast.Assign, ast.AnnAssign)) and isinstance(getattr(node, "value", None), ast.Constant):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            names = [t.id if isinstance(t, ast.Name) else getattr(t, "attr", "") for t in targets]
            if isinstance(node.value.value, str) and any(PROMPT_NAME.search(n or "") for n in names):
                found.append(node.value.value)
        elif isinstance(node, ast.Dict):
            pairs = {
                k.value: v for k, v in zip(node.keys, node.values)
                if isinstance(k, ast.Constant) and isinstance(k.value, str)
            }
            role, content = pairs.get("role"), pairs.get("content")
            if (
                isinstance(role, ast.Constant) and role.value == "system"
                and isinstance(content, ast.Constant) and isinstance(content.value, str)
            ):
                found.append(content.value)
    return found


def _json_prompts(value, key: str = "") -> list[str]:
    if isinstance(value, dict):
        return [p for k, v in value.items() for p in _json_prompts(v, str(k))]
    if isinstance(value, list):
        return [p for item in value for p in _json_prompts(item, key)]
    if isinstance(value, str) and PROMPT_NAME.search(key):
        return [value]
    return []


JS_PROMPT = re.compile(
    r"""(?:const|let|var)\s+(\w+)\s*=\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')""", re.S
)
JS_SYSTEM_ROLE = re.compile(
    r"""role\s*:\s*['"]system['"]\s*,\s*content\s*:\s*(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')""", re.S
)


def _js_prompts(text: str) -> list[str]:
    found = [m.group(2)[1:-1] for m in JS_PROMPT.finditer(text) if PROMPT_NAME.search(m.group(1))]
    found += [m.group(1)[1:-1] for m in JS_SYSTEM_ROLE.finditer(text)]
    return found


def _chat_score(path: str) -> int:
    lowered = path.lower()
    return sum(word in lowered for word in CHAT_WORDS)


def find_secrets(prompt: str) -> list[str]:
    """Strings in a prompt that look like keys or codes, most distinctive first."""
    seen: list[str] = []
    for pattern in SECRET_PATTERNS:
        for match in pattern.findall(prompt or ""):
            has_digit = any(c.isdigit() for c in match)
            if len(match) >= 6 and has_digit and match not in seen:
                seen.append(match)
    return seen[:10]


def scan_project(project_path: str) -> dict:
    """
    Returns suggestions:
      chat_paths, ports, request_fields  (best guess first)
      system_prompts: [{file, text}]     (longest first)
      canaries                           (codes found inside those prompts)
      tools                              (names of functions offered to the model)
    """
    root = Path(project_path)
    routes: Counter = Counter()
    ports: Counter = Counter()
    fields: Counter = Counter()
    tools: list[str] = []
    prompts: list[dict] = []
    scanned = 0

    for path, text in _files(root):
        scanned += 1
        rel = str(path.relative_to(root)).replace("\\", "/")
        suffix = path.suffix.lower()

        if suffix in CODE_SUFFIXES:
            for pattern in ROUTE_PATTERNS:
                for route in pattern.findall(text):
                    if route.startswith("/") and len(route) <= 120:
                        routes[route] += 1
            for pattern in PORT_PATTERNS:
                for port in pattern.findall(text):
                    if 1024 <= int(port) <= 65535:
                        ports[int(port)] += 1
            for pattern in FIELD_PATTERNS:
                for field in pattern.findall(text):
                    if field in KNOWN_FIELDS:
                        fields[field] += 1
            for pattern in TOOL_PATTERNS:
                tools += [t for t in pattern.findall(text) if t not in tools]
            # Next.js route handlers: app/api/chat/route.ts -> /api/chat
            match = re.search(r"(?:^|/)app(/api/.+)/route\.[jt]sx?$", rel)
            if match and re.search(r"export\s+(?:async\s+)?function\s+POST", text):
                routes[match.group(1)] += 2

        found = []
        if suffix == ".py":
            found = _python_prompts(text)
        elif suffix in CODE_SUFFIXES:
            found = _js_prompts(text)
        elif suffix == ".json":
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                parsed = None
            found = _json_prompts(parsed)
            if isinstance(parsed, dict):
                for port in _json_ports(parsed):
                    ports[port] += 1
        prompts += [{"file": rel, "text": p.strip()} for p in found if len(p.strip()) >= 40]

    # The same prompt is often referenced twice; keep each text once, longest first.
    unique: dict[str, dict] = {}
    for item in prompts:
        unique.setdefault(item["text"], item)
    system_prompts = sorted(unique.values(), key=lambda item: len(item["text"]), reverse=True)[:5]

    canaries: list[str] = []
    for item in system_prompts:
        canaries += [s for s in find_secrets(item["text"]) if s not in canaries]

    ranked_routes = sorted(routes, key=lambda r: (_chat_score(r), routes[r]), reverse=True)
    return {
        "files_scanned": scanned,
        "chat_paths": ranked_routes[:5],
        "ports": [port for port, _ in ports.most_common(5)],
        "request_fields": [field for field, _ in fields.most_common(5)],
        "system_prompts": system_prompts,
        "canaries": canaries[:10],
        "tools": tools[:20],
    }


def _json_ports(value) -> list[int]:
    if isinstance(value, dict):
        out = []
        for key, item in value.items():
            if str(key).lower() == "port" and isinstance(item, int) and 1024 <= item <= 65535:
                out.append(item)
            else:
                out += _json_ports(item)
        return out
    if isinstance(value, list):
        return [p for item in value for p in _json_ports(item)]
    return []
