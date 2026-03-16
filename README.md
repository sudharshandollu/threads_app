import psutil
import smtplib
import socket
import time
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
hostname = socket.gethostname()
current_gb = get_memory_used_gb()
total_gb = round(psutil.virtual_memory().total / (1024 ** 3), 2)
usage_pct = round((avg_memory_gb / total_gb) * 100, 1)
timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

subject = f"⚠️ Memory Alert: Avg usage {avg_memory_gb} GB (last {AVERAGING_WINDOW_MIN} min)"
html_body = f"""
<html>
<body style="margin:0; padding:0; font-family:Arial, sans-serif; background-color:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff; border-radius:8px; overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#d32f2f,#b71c1c); padding:24px 30px;">
              <h2 style="margin:0; color:#ffffff; font-size:20px;">
                ⚠️ High Memory Usage Alert
              </h2>
              <p style="margin:6px 0 0; color:#ffcdd2; font-size:13px;">
                Server: <strong>{hostname}</strong> &nbsp;|&nbsp; {timestamp}
              </p>
            </td>
          </tr>
          <!-- Summary Bar -->
          <tr>
            <td style="padding:20px 30px 10px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center; padding:10px;">
                    <p style="margin:0; font-size:12px; color:#888;">AVG MEMORY USED</p>
                    <p style="margin:4px 0 0; font-size:28px; font-weight:bold; color:#d32f2f;">
                      {avg_memory_gb} GB
                    </p>
                  </td>
                  <td style="text-align:center; padding:10px;">
                    <p style="margin:0; font-size:12px; color:#888;">THRESHOLD</p>
                    <p style="margin:4px 0 0; font-size:28px; font-weight:bold; color:#333;">
                      {MEMORY_THRESHOLD_GB} GB
                    </p>
                  </td>
                  <td style="text-align:center; padding:10px;">
                    <p style="margin:0; font-size:12px; color:#888;">USAGE</p>
                    <p style="margin:4px 0 0; font-size:28px; font-weight:bold; color:#d32f2f;">
                      {usage_pct}%
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Progress Bar -->
          <tr>
            <td style="padding:0 30px 20px;">
              <div style="background:#eee; border-radius:6px; height:12px; overflow:hidden;">
                <div style="background:{'#d32f2f' if usage_pct > 80 else '#fb8c00'};
                            width:{min(usage_pct, 100)}%; height:100%; border-radius:6px;">
                </div>
              </div>
            </td>
          </tr>
          <!-- Detail Table -->
          <tr>
            <td style="padding:0 30px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #e0e0e0; border-radius:6px; overflow:hidden;">
                <tr style="background:#f9f9f9;">
                  <td style="padding:10px 16px; font-size:13px; color:#555; border-bottom:1px solid #e0e0e0;">
                    Metric
                  </td>
                  <td style="padding:10px 16px; font-size:13px; color:#555; border-bottom:1px solid #e0e0e0;
                             text-align:right;">
                    Value
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; border-bottom:1px solid #f0f0f0;">
                    Avg Memory ({AVERAGING_WINDOW_MIN} min)
                  </td>
                  <td style="padding:10px 16px; font-size:14px; text-align:right; font-weight:bold;
                             color:#d32f2f; border-bottom:1px solid #f0f0f0;">
                    {avg_memory_gb} GB
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; border-bottom:1px solid #f0f0f0;">
                    Current Memory Used
                  </td>
                  <td style="padding:10px 16px; font-size:14px; text-align:right;
                             border-bottom:1px solid #f0f0f0;">
                    {current_gb} GB
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px; border-bottom:1px solid #f0f0f0;">
                    Total System Memory
                  </td>
                  <td style="padding:10px 16px; font-size:14px; text-align:right;
                             border-bottom:1px solid #f0f0f0;">
                    {total_gb} GB
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px; font-size:14px;">
                    Threshold
                  </td>
                  <td style="padding:10px 16px; font-size:14px; text-align:right;">
                    {MEMORY_THRESHOLD_GB} GB
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#fafafa; padding:16px 30px; border-top:1px solid #eee;">
              <p style="margin:0; font-size:12px; color:#999; text-align:center;">
                This is an automated alert from the Memory Monitor service on
                <strong>{hostname}</strong>.<br>
                Next alert will be suppressed for {EMAIL_COOLDOWN_MIN} minutes.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

msg = MIMEMultipart("alternative")
msg["From"] = SENDER_EMAIL
msg["To"] = RECIPIENT_EMAIL
msg["Subject"] = subject
msg.attach(MIMEText(html_body, "html"))

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
