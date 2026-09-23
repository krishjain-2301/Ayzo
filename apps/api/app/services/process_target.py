"""Boot, wait-for-port, and tear down a local target process."""

from __future__ import annotations

import asyncio
import os
import signal
import subprocess
from typing import Optional

SKIP_BOOT_COMMANDS = {
    "",
    "-",
    "none",
    "skip",
    "skip-boot",
    "already running",
    "echo already running",
}


def should_skip_boot(start_command: Optional[str]) -> bool:
    cmd = (start_command or "").strip().lower()
    if cmd in SKIP_BOOT_COMMANDS:
        return True
    return cmd.startswith("#skip")


async def wait_for_port(port: int, timeout: int = 30) -> bool:
    loop = asyncio.get_event_loop()
    start = loop.time()
    while loop.time() - start < timeout:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection("127.0.0.1", port),
                timeout=1.0,
            )
            writer.close()
            await writer.wait_closed()
            return True
        except (ConnectionRefusedError, asyncio.TimeoutError, OSError):
            await asyncio.sleep(1)
    return False


async def boot_target(start_command: str, project_path: str):
    """Start the target without a shell, so the command cannot chain extra programs."""
    from app.services.safety import safe_argv

    argv = safe_argv(start_command)
    cwd = project_path or None
    kwargs = dict(
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    if os.name != "nt":
        kwargs["preexec_fn"] = os.setsid
    else:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        return await asyncio.create_subprocess_exec(*argv, **kwargs)
    except FileNotFoundError:
        # Windows launches npm/pnpm through .cmd, which exec cannot see.
        # The command was already rejected if it contained shell operators.
        if os.name != "nt":
            raise
        return await asyncio.create_subprocess_shell(
            start_command,
            **kwargs,
        )


def kill_process(pid: int) -> None:
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
    except Exception:
        pass
