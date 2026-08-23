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
    return await asyncio.create_subprocess_shell(
        start_command,
        cwd=project_path or None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        preexec_fn=os.setsid if os.name != "nt" else None,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
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
