“””
All configurable values in one place.
Update lock_file and cookie_name to match your setup.
“””

import os
from dataclasses import dataclass

@dataclass
class ThrottleConfig:
# Path to the shared JSON lock file (all Gunicorn workers read/write this)
lock_file: str = os.environ.get(
“USER_LOCK_FILE”, “/your/custom/path/user_locks.json”
)

```
# Cookie key that holds the unique user ID
cookie_name: str = "user_id"

# If a lock is older than this, assume it's stale and auto-release
stale_timeout_seconds: int = 3600  # 1 hour
```







“””
Core lock manager.

Uses a single JSON file + fcntl for cross-worker safety.
Each active user = one entry in the file. That’s the whole idea.
“””

import os
import json
import time
import fcntl
import psutil
from pathlib import Path
from contextlib import contextmanager
import logging

from config import ThrottleConfig

logger = logging.getLogger(**name**)

class UserRequestGuard:

```
def __init__(self, config: ThrottleConfig):
    self.config = config
    self._lock_path = Path(config.lock_file)

    # Ensure the file and its parent directories exist
    self._lock_path.parent.mkdir(parents=True, exist_ok=True)
    if not self._lock_path.exists():
        self._lock_path.write_text("{}")

# ── File locking (OS-level, safe across all Gunicorn workers) ─

@contextmanager
def _locked_file(self, write: bool = False):
    """
    Opens the lock file with an exclusive OS lock.
    Only one process (worker) can hold this lock at a time.
    Other workers wait until the lock is released.
    """
    mode = "r+" if self._lock_path.exists() else "w+"
    f = open(self._lock_path, mode)
    try:
        fcntl.flock(f, fcntl.LOCK_EX)  # acquire exclusive lock (blocks)
        f.seek(0)
        raw = f.read().strip()
        data = json.loads(raw) if raw else {}

        # Clean dead entries on every access
        self._cleanup_stale(data)

        yield data

        # Write back only if requested
        if write:
            f.seek(0)
            f.truncate()
            json.dump(data, f, indent=2)
            f.flush()
    finally:
        fcntl.flock(f, fcntl.LOCK_UN)  # release lock
        f.close()

# ── Stale cleanup ────────────────────────────────────────────

def _cleanup_stale(self, data: dict):
    """
    Remove entries where:
      - The Gunicorn worker that created it is dead (crashed)
      - The lock has been held longer than stale_timeout_seconds
    """
    now = time.time()
    stale = [
        uid for uid, info in data.items()
        if now - info.get("started_at_ts", 0) > self.config.stale_timeout_seconds
        or not psutil.pid_exists(info.get("worker_pid", 0))
    ]
    for uid in stale:
        logger.info(f"Auto-releasing stale lock for user '{uid}'")
        del data[uid]

# ── Public API ───────────────────────────────────────────────

def acquire(self, user_id: str, endpoint: str) -> bool:
    """
    Try to lock a slot for this user.
    Returns True if acquired, False if user already has a running request.
    """
    with self._locked_file(write=True) as data:
        if user_id in data:
            return False

        data[user_id] = {
            "endpoint": endpoint,
            "worker_pid": os.getpid(),
            "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "started_at_ts": time.time(),
        }
        return True

def release(self, user_id: str):
    """Remove the user's lock. Call this when the subprocess finishes."""
    with self._locked_file(write=True) as data:
        if user_id in data:
            del data[user_id]
            logger.info(f"Lock released for user '{user_id}'")

def get_active(self, user_id: str) -> dict | None:
    """Check what a specific user is currently running (if anything)."""
    with self._locked_file(write=False) as data:
        return data.get(user_id)

def get_all_active(self) -> dict:
    """Return all currently active user locks. Used for monitoring."""
    with self._locked_file(write=False) as data:
        return dict(data)
```










“””
FastAPI dependencies.

throttle_user:

- Reads user_id from cookies
- Acquires a lock before the endpoint runs
- Releases the lock after the endpoint finishes (via yield)
- Add Depends(throttle_user) to any endpoint you want throttled
  “””

from fastapi import Request, HTTPException

from config import ThrottleConfig
from guard import UserRequestGuard

# ── Singleton guard instance (shared across the app) ─────────────

config = ThrottleConfig()
guard = UserRequestGuard(config)

# ── Extract user ID from cookies ────────────────────────────────

def get_user_id(request: Request) -> str:
user_id = request.cookies.get(config.cookie_name)
if not user_id:
raise HTTPException(
status_code=401,
detail=“Missing user identification cookie”,
)
return user_id

# ── Throttle dependency (use with Depends) ───────────────────────

def throttle_user(request: Request):
“””
Yield dependency that wraps the entire request lifecycle:

```
    acquire lock
        ↓
    yield  ──→  your endpoint code runs here
        ↓
    release lock  (always, even on errors)

Usage:
    @app.post("/api/heavy")
    async def my_endpoint(user_id: str = Depends(throttle_user)):
        ...
"""
user_id = get_user_id(request)
endpoint = request.url.path

# Acquire — reject if user already has a running request
if not guard.acquire(user_id, endpoint):
    existing = guard.get_active(user_id)
    raise HTTPException(
        status_code=429,
        detail={
            "error": "request_in_progress",
            "message": "You already have a request running. "
                       "Please wait for it to complete.",
            "current_request": existing,
        },
    )

# Hand control to the endpoint
yield user_id

# Release — runs after the endpoint finishes (success or failure)
guard.release(user_id)
```








“””
Heavy endpoints — throttled to 1 concurrent request per user.

To throttle any endpoint, just add:
user_id: str = Depends(throttle_user)

That’s it. The lock is acquired before your code runs,
and released after your code finishes (even on errors).
“””

import asyncio
import subprocess

from fastapi import APIRouter, Depends

from dependencies import throttle_user

router = APIRouter(prefix=”/api”, tags=[“heavy”])

# ── Example 1: Heavy report ─────────────────────────────────────

@router.post(”/heavy-report”)
async def heavy_report(user_id: str = Depends(throttle_user)):
“””
Replace the Popen command with your actual script.
process.communicate() blocks until the script finishes or dies.
run_in_executor keeps the event loop free for other requests.
“””
process = subprocess.Popen(
[“python”, “/path/to/your/report_script.py”],
stdout=subprocess.PIPE,
stderr=subprocess.PIPE,
)

```
loop = asyncio.get_event_loop()
stdout, stderr = await loop.run_in_executor(None, process.communicate)

return {
    "status": "completed",
    "exit_code": process.returncode,
    "output": stdout.decode().strip(),
    "errors": stderr.decode().strip() or None,
}
```

# ── Example 2: Heavy analysis ───────────────────────────────────

@router.post(”/heavy-analysis”)
async def heavy_analysis(user_id: str = Depends(throttle_user)):
process = subprocess.Popen(
[“python”, “/path/to/your/analysis_script.py”],
stdout=subprocess.PIPE,
stderr=subprocess.PIPE,
)

```
loop = asyncio.get_event_loop()
stdout, stderr = await loop.run_in_executor(None, process.communicate)

return {
    "status": "completed",
    "exit_code": process.returncode,
    "output": stdout.decode().strip(),
}
```

# ── Example 3: Heavy export ─────────────────────────────────────

@router.post(”/heavy-export”)
async def heavy_export(user_id: str = Depends(throttle_user)):
process = subprocess.Popen(
[“python”, “/path/to/your/export_script.py”],
stdout=subprocess.PIPE,
stderr=subprocess.PIPE,
)

```
loop = asyncio.get_event_loop()
stdout, stderr = await loop.run_in_executor(None, process.communicate)

return {
    "status": "completed",
    "exit_code": process.returncode,
    "output": stdout.decode().strip(),
}
```



