import psutil
import smtplib
import time
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from collections import deque
from datetime import datetime, timedelta

# — Configuration —

MEMORY_THRESHOLD_GB = 40
CHECK_INTERVAL_SEC = 60          # How often to sample memory (seconds)
AVERAGING_WINDOW_MIN = 60        # Window for computing average (minutes)
EMAIL_COOLDOWN_MIN = 60          # Don’t re-send within this many minutes

SMTP_SERVER = “smtp.gmail.com”
SMTP_PORT = 587
SENDER_EMAIL = “your_email@gmail.com”
SENDER_PASSWORD = “your_app_password”   # Use an App Password, not your real password
RECIPIENT_EMAIL = “recipient@example.com”

# Each sample: (timestamp, memory_used_gb)

memory_samples: deque[tuple[datetime, float]] = deque()
last_email_sent: datetime | None = None

def get_memory_used_gb() -> float:
“”“Return current used memory in GB.”””
mem = psutil.virtual_memory()
used_gb = mem.used / (1024 ** 3)
return round(used_gb, 2)

def prune_old_samples(window_minutes: int = AVERAGING_WINDOW_MIN) -> None:
“”“Remove samples older than the averaging window.”””
cutoff = datetime.now() - timedelta(minutes=window_minutes)
while memory_samples and memory_samples[0][0] < cutoff:
memory_samples.popleft()

def get_average_memory_gb() -> float | None:
“”“Return average memory usage (GB) over the stored samples.”””
if not memory_samples:
return None
total = sum(sample[1] for sample in memory_samples)
return round(total / len(memory_samples), 2)

def can_send_email() -> bool:
“”“Return True if no email was sent in the last EMAIL_COOLDOWN_MIN minutes.”””
if last_email_sent is None:
return True
return datetime.now() - last_email_sent > timedelta(minutes=EMAIL_COOLDOWN_MIN)

def send_alert_email(avg_memory_gb: float) -> bool:
“”“Send an alert email and return True on success.”””
global last_email_sent

```
subject = f"⚠️ Memory Alert: Avg usage {avg_memory_gb} GB (last {AVERAGING_WINDOW_MIN} min)"
body = (
    f"Memory usage alert on {os.uname().nodename}\n"
    f"-------------------------------------------\n"
    f"Average memory used (last {AVERAGING_WINDOW_MIN} min): {avg_memory_gb} GB\n"
    f"Threshold: {MEMORY_THRESHOLD_GB} GB\n"
    f"Current memory used: {get_memory_used_gb()} GB\n"
    f"Total system memory: {round(psutil.virtual_memory().total / (1024**3), 2)} GB\n"
    f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
)

msg = MIMEMultipart()
msg["From"] = SENDER_EMAIL
msg["To"] = RECIPIENT_EMAIL
msg["Subject"] = subject
msg.attach(MIMEText(body, "plain"))

try:
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
    last_email_sent = datetime.now()
    print(f"[{last_email_sent}] Alert email sent — avg memory: {avg_memory_gb} GB")
    return True
except Exception as e:
    print(f"Failed to send email: {e}")
    return False
```

def check_memory_and_alert() -> None:
“”“Sample memory, compute rolling average, and alert if needed.”””
now = datetime.now()
used_gb = get_memory_used_gb()
memory_samples.append((now, used_gb))

```
prune_old_samples()

avg_gb = get_average_memory_gb()
sample_count = len(memory_samples)
print(f"[{now:%H:%M:%S}] Used: {used_gb} GB | "
      f"Avg ({sample_count} samples): {avg_gb} GB | "
      f"Threshold: {MEMORY_THRESHOLD_GB} GB")

if avg_gb is not None and avg_gb > MEMORY_THRESHOLD_GB:
    if can_send_email():
        send_alert_email(avg_gb)
    else:
        remaining = EMAIL_COOLDOWN_MIN - (now - last_email_sent).seconds // 60
        print(f"  → Threshold exceeded but email cooldown active ({remaining} min remaining)")
```

def run_monitor() -> None:
“”“Main loop — runs indefinitely, sampling every CHECK_INTERVAL_SEC.”””
print(f”Memory monitor started (threshold: {MEMORY_THRESHOLD_GB} GB, “
f”interval: {CHECK_INTERVAL_SEC}s, window: {AVERAGING_WINDOW_MIN} min)”)
print(f”Total system memory: {round(psutil.virtual_memory().total / (1024**3), 2)} GB\n”)

```
try:
    while True:
        check_memory_and_alert()
        time.sleep(CHECK_INTERVAL_SEC)
except KeyboardInterrupt:
    print("\nMonitor stopped.")
```

if **name** == “**main**”:
run_monitor()
