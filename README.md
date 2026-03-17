import subprocess
from dataclasses import dataclass, field

# =====================================================================

# Server Configuration

# =====================================================================

@dataclass
class ServerConfig:
hostname: str
user: str
port: int = 22
ssh_key: str | None = None  # Optional path to SSH private key

# Map friendly server names → connection details (use hostnames, not IPs)

UAT_SERVERS: dict[str, ServerConfig] = {
“uat-server-1”: ServerConfig(hostname=“uat-app-node01.company.com”, user=“deploy”),
“uat-server-2”: ServerConfig(hostname=“uat-app-node02.company.com”, user=“deploy”),
“uat-server-3”: ServerConfig(hostname=“uat-app-node03.company.com”, user=“deploy”, port=2222),
}

# =====================================================================

# Application Configuration

# =====================================================================

@dataclass
class AppConfig:
name: str                          # Friendly display name
process_name: str                  # Process name as seen in `ps` / `pgrep`
work_dir: str                      # Working directory on the server
start_cmd: str                     # Command to start the app
stop_cmd: str = “”                 # Command to stop the app
health_check_cmd: str = “”         # Command to verify app is running
allowed_servers: list[str] = field(default_factory=list)  # Restrict to specific servers

# Map custom app names → process and run details

APPLICATIONS: dict[str, AppConfig] = {
“order-service”: AppConfig(
name=“Order Service”,
process_name=“java”,
work_dir=”/opt/apps/order-service”,
start_cmd=”./start.sh”,
stop_cmd=”./stop.sh”,
health_check_cmd=“curl -sf http://localhost:8080/health”,
allowed_servers=[“uat-server-1”, “uat-server-2”],
),
“payment-gateway”: AppConfig(
name=“Payment Gateway”,
process_name=“python3”,
work_dir=”/opt/apps/payment-gateway”,
start_cmd=”./run.sh”,
stop_cmd=”./stop.sh”,
health_check_cmd=“curl -sf http://localhost:9090/ping”,
allowed_servers=[“uat-server-1”],
),
“notification-worker”: AppConfig(
name=“Notification Worker”,
process_name=“node”,
work_dir=”/opt/apps/notification-worker”,
start_cmd=“npm run start:prod”,
stop_cmd=“npm run stop”,
health_check_cmd=“pgrep -f ‘notification-worker’”,
allowed_servers=[“uat-server-2”, “uat-server-3”],
),
}

# =====================================================================

# Remote Execution via SSH

# =====================================================================

class RemoteExecutionError(Exception):
“”“Raised when a remote SSH command fails.”””
pass

def _build_ssh_cmd(server: ServerConfig) -> list[str]:
“”“Build the base SSH command list for a server.”””
cmd = [
“ssh”,
“-o”, “StrictHostKeyChecking=no”,
“-o”, “ConnectTimeout=10”,
“-p”, str(server.port),
]
if server.ssh_key:
cmd += [”-i”, server.ssh_key]
cmd.append(f”{server.user}@{server.hostname}”)
return cmd

def run_remote_command(server_name: str, command: str, timeout: int = 60) -> str:
“””
Execute a command on a remote server via SSH.
Returns stdout on success, raises RemoteExecutionError on failure.
“””
if server_name not in UAT_SERVERS:
raise RemoteExecutionError(
f”Unknown server ‘{server_name}’. “
f”Available: {’, ’.join(UAT_SERVERS.keys())}”
)

```
server = UAT_SERVERS[server_name]
ssh_cmd = _build_ssh_cmd(server) + [command]

try:
    result = subprocess.run(
        ssh_cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RemoteExecutionError(
            f"Command failed on {server_name} ({server.hostname}) "
            f"[exit {result.returncode}]: {result.stderr.strip()}"
        )
    return result.stdout.strip()

except subprocess.TimeoutExpired:
    raise RemoteExecutionError(
        f"Command timed out after {timeout}s on {server_name} ({server.hostname})"
    )
except FileNotFoundError:
    raise RemoteExecutionError("SSH client not found. Ensure 'ssh' is installed and in PATH.")
```

def validate_server_app(server_name: str, app_name: str) -> tuple[ServerConfig, AppConfig]:
“””
Validate that the server and app exist, and that the app is allowed
to run on the given server. Returns (ServerConfig, AppConfig).
“””
if server_name not in UAT_SERVERS:
raise RemoteExecutionError(
f”Unknown server ‘{server_name}’. “
f”Available: {’, ‘.join(UAT_SERVERS.keys())}”
)
if app_name not in APPLICATIONS:
raise RemoteExecutionError(
f”Unknown application ‘{app_name}’. “
f”Available: {’, ’.join(APPLICATIONS.keys())}”
)

```
server_cfg = UAT_SERVERS[server_name]
app_cfg = APPLICATIONS[app_name]

if app_cfg.allowed_servers and server_name not in app_cfg.allowed_servers:
    raise RemoteExecutionError(
        f"'{app_cfg.name}' is not allowed on '{server_name}'. "
        f"Allowed servers: {', '.join(app_cfg.allowed_servers)}"
    )

return server_cfg, app_cfg
```






import argparse
import sys
from datetime import datetime
from config import (
APPLICATIONS,
UAT_SERVERS,
RemoteExecutionError,
run_remote_command,
validate_server_app,
)

def check_app_status(server_name: str, app_name: str) -> bool:
“”“Check if the application is currently running on the server.”””
_, app_cfg = validate_server_app(server_name, app_name)

```
if not app_cfg.health_check_cmd:
    print(f"  No health check configured for '{app_cfg.name}', skipping.")
    return False

try:
    run_remote_command(server_name, app_cfg.health_check_cmd, timeout=15)
    return True
except RemoteExecutionError:
    return False
```

def start_app(server_name: str, app_name: str) -> str:
“”“Start the application on the server.”””
_, app_cfg = validate_server_app(server_name, app_name)
command = f”cd {app_cfg.work_dir} && {app_cfg.start_cmd}”
return run_remote_command(server_name, command)

def stop_app(server_name: str, app_name: str) -> str:
“”“Stop the application on the server.”””
_, app_cfg = validate_server_app(server_name, app_name)

```
if not app_cfg.stop_cmd:
    raise RemoteExecutionError(f"No stop command configured for '{app_cfg.name}'")

command = f"cd {app_cfg.work_dir} && {app_cfg.stop_cmd}"
return run_remote_command(server_name, command)
```

def restart_app(server_name: str, app_name: str) -> str:
“”“Stop then start the application.”””
_, app_cfg = validate_server_app(server_name, app_name)

```
print(f"  Stopping '{app_cfg.name}'...")
try:
    stop_app(server_name, app_name)
except RemoteExecutionError as e:
    print(f"  Warning during stop: {e}")

print(f"  Starting '{app_cfg.name}'...")
return start_app(server_name, app_name)
```

def run_custom_command(server_name: str, app_name: str, command: str) -> str:
“”“Run a custom command in the application’s working directory.”””
_, app_cfg = validate_server_app(server_name, app_name)
full_cmd = f”cd {app_cfg.work_dir} && {command}”
return run_remote_command(server_name, full_cmd)

# =====================================================================

# Main

# =====================================================================

ACTIONS = {
“start”:   start_app,
“stop”:    stop_app,
“restart”: restart_app,
“status”:  check_app_status,
}

def main(monitor_id: str, server_name: str, app_name: str, action: str, custom_cmd: str | None = None):
timestamp = datetime.now().strftime(”%Y-%m-%d %H:%M:%S”)
print(f”{’=’ * 60}”)
print(f”  Run ID     : {monitor_id}”)
print(f”  Server     : {server_name} ({UAT_SERVERS[server_name].hostname})”)
print(f”  Application: {APPLICATIONS[app_name].name}”)
print(f”  Action     : {action}”)
print(f”  Timestamp  : {timestamp}”)
print(f”{’=’ * 60}\n”)

```
try:
    if action == "run-cmd":
        if not custom_cmd:
            print("[ERROR] --cmd is required when action is 'run-cmd'")
            sys.exit(1)
        print(f"  Running custom command: {custom_cmd}\n")
        output = run_custom_command(server_name, app_name, custom_cmd)

    elif action == "status":
        is_running = check_app_status(server_name, app_name)
        status = "RUNNING ✓" if is_running else "NOT RUNNING ✗"
        print(f"  Status: {status}\n")
        return

    else:
        output = ACTIONS[action](server_name, app_name)

    if output:
        print(f"  Output:\n{output}\n")
    print(f"[SUCCESS] Action '{action}' completed on {server_name}.")

except RemoteExecutionError as e:
    print(f"[FAILED] {e}")
    sys.exit(1)
```

# =====================================================================

# CLI

# =====================================================================

def parse_args() -> argparse.Namespace:
parser = argparse.ArgumentParser(
description=“Run an application action on a UAT server.”,
formatter_class=argparse.RawTextHelpFormatter,
)
parser.add_argument(
“–id”, required=True,
help=“Unique run/task identifier (e.g. TASK-101)”
)
parser.add_argument(
“–server”, required=True,
choices=list(UAT_SERVERS.keys()),
help=f”Target UAT server.\nAvailable: {’, ‘.join(UAT_SERVERS.keys())}”
)
parser.add_argument(
“–app”, required=True,
choices=list(APPLICATIONS.keys()),
help=f”Application to target.\nAvailable: {’, ’.join(APPLICATIONS.keys())}”
)
parser.add_argument(
“–action”, required=True,
choices=[“start”, “stop”, “restart”, “status”, “run-cmd”],
help=“Action to perform on the application.”
)
parser.add_argument(
“–cmd”, required=False, default=None,
help=“Custom command to run (only with –action run-cmd).”
)
return parser.parse_args()

if **name** == “**main**”:
args = parse_args()
main(
monitor_id=args.id,
server_name=args.server,
app_name=args.app,
action=args.action,
custom_cmd=args.cmd,
)




