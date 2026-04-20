# “””
Jira Self-Healing Incremental Sync

CSVs are the source of truth — no state file, no cron dependency.

Each run:

1. Reads existing CSVs to find the latest timestamps
1. Fetches only what changed since then (with a safety buffer)
1. Upserts into the CSVs
1. If CSVs don’t exist → full fetch automatically

Run it whenever you want — after 5 minutes or 5 days. It always
figures out what’s missing and fills the gap.

Usage:
python jira_sync.py                    # Smart sync (incremental or full)
python jira_sync.py –full             # Force full reload
python jira_sync.py –project MYPROJ   # Override project

Requirements:
pip install requests pandas
“””

import requests
import pandas as pd
import re
import csv
import os
import argparse
from datetime import datetime, timedelta
from typing import Any

# ─── CONFIGURATION ──────────────────────────────────────────────────────────

JIRA_URL    = “https://your-jira-server.com”
USERNAME    = “your-service-account-username”
PASSWORD    = “your-password”
JQL_BASE    = “project = YOUR_PROJECT”  # Base filter (no time clause)
OUTPUT_DIR  = “.”
MAX_RESULTS = 100
BUFFER_MINUTES = 2  # Safety overlap to catch in-flight changes

# Output files

ISSUES_FILE     = “jira_issues.csv”
CHANGELOGS_FILE = “jira_changelogs.csv”
COMMENTS_FILE   = “jira_comments.csv”

# ─────────────────────────────────────────────────────────────────────────────

JIRA_TIME_FMT = “%Y-%m-%d %H:%M”

# ─── CSV HELPERS ─────────────────────────────────────────────────────────────

def read_csv(path: str) -> pd.DataFrame:
“”“Read CSV if it exists and is non-empty, else return empty DataFrame.”””
if os.path.exists(path) and os.path.getsize(path) > 0:
return pd.read_csv(path, dtype=str, keep_default_na=False)
return pd.DataFrame()

def write_csv(df: pd.DataFrame, path: str):
df.to_csv(path, index=False, quoting=csv.QUOTE_ALL)

def get_max_timestamp(df: pd.DataFrame, columns: list[str]) -> datetime | None:
“””
Find the latest timestamp across one or more columns in a DataFrame.
Returns None if no valid timestamps found (triggers full fetch).
“””
if df.empty:
return None

```
latest = None
for col in columns:
    if col not in df.columns:
        continue
    series = pd.to_datetime(df[col], errors="coerce", utc=True)
    col_max = series.dropna().max()
    if pd.notna(col_max) and (latest is None or col_max > latest):
        latest = col_max

if latest is None:
    return None

# Return as naive local time (Jira Server interprets JQL times in server tz)
return latest.astimezone(tz=None).replace(tzinfo=None)
```

# ─── TEXT CLEANING ───────────────────────────────────────────────────────────

def clean(text: Any) -> str:
“”“Remove Jira wiki markup, ADF, HTML, normalize whitespace.”””
if text is None:
return “”
if isinstance(text, dict):
return *extract_adf(text)
if not isinstance(text, str):
return str(text)
s = text
s = re.sub(r”h[1-6].\s*”, “”, s)
s = re.sub(r”*([^*]+)*”, r”\1”, s)
s = re.sub(r”*([^*]+)*”, r”\1”, s)
s = re.sub(r”+([^+]+)+”, r”\1”, s)
s = re.sub(r”-([^-]+)-”, r”\1”, s)
s = re.sub(r”{noformat[^}]*}”, “”, s)
s = re.sub(r”{code[^}]*}”, “”, s)
s = re.sub(r”{quote}”, “”, s)
s = re.sub(r”{color[^}]*}”, “”, s)
s = re.sub(r”[([^|]+)|[^]]+]”, r”\1”, s)
s = re.sub(r”[([^]]+)]”, r”\1”, s)
s = re.sub(r”![^!|]+(|[^!]*)?!”, “”, s)
s = re.sub(r”<[^>]+>”, “ “, s)
s = re.sub(r”^[\s]*[*#]+\s*”, “”, s, flags=re.MULTILINE)
s = re.sub(r”||”, “|”, s)
s = re.sub(r”[\r\n]+”, “ | “, s)
s = re.sub(r”\s{2,}”, “ “, s)
return s.strip()

def _extract_adf(adf: dict) -> str:
if not isinstance(adf, dict):
return str(adf) if adf else “”
texts = []
if adf.get(“type”) == “text”:
texts.append(adf.get(“text”, “”))
for child in adf.get(“content”, []):
texts.append(_extract_adf(child))
return “ “.join(t for t in texts if t).strip()

def safe_get(d, *keys, default=””):
current = d
for key in keys:
if isinstance(current, dict):
current = current.get(key)
elif isinstance(current, list) and isinstance(key, int) and key < len(current):
current = current[key]
else:
return default
if current is None:
return default
return current

# ─── FLATTEN FUNCTIONS ───────────────────────────────────────────────────────

def flatten_issue(issue: dict, base_url: str) -> dict:
f = issue.get(“fields”, {})
row = {
“issue_key”:        issue.get(“key”, “”),
“issue_id”:         issue.get(“id”, “”),
“issue_url”:        f”{base_url}/browse/{issue.get(‘key’, ‘’)}”,
“project_key”:      safe_get(f, “project”, “key”),
“project_name”:     safe_get(f, “project”, “name”),
“issue_type”:       safe_get(f, “issuetype”, “name”),
“status”:           safe_get(f, “status”, “name”),
“status_category”:  safe_get(f, “status”, “statusCategory”, “name”),
“priority”:         safe_get(f, “priority”, “name”),
“resolution”:       safe_get(f, “resolution”, “name”),
“summary”:          clean(f.get(“summary”, “”)),
“description”:      clean(f.get(“description”, “”)),
“creator”:          safe_get(f, “creator”, “displayName”),
“creator_email”:    safe_get(f, “creator”, “emailAddress”),
“reporter”:         safe_get(f, “reporter”, “displayName”),
“reporter_email”:   safe_get(f, “reporter”, “emailAddress”),
“assignee”:         safe_get(f, “assignee”, “displayName”),
“assignee_email”:   safe_get(f, “assignee”, “emailAddress”),
“created”:          f.get(“created”, “”),
“updated”:          f.get(“updated”, “”),
“resolved”:         f.get(“resolutiondate”, “”),
“due_date”:         f.get(“duedate”, “”),
“labels”:           “, “.join(f.get(“labels”, [])),
“components”:       “, “.join(x.get(“name”, “”) for x in (f.get(“components”) or [])),
“fix_versions”:     “, “.join(v.get(“name”, “”) for v in (f.get(“fixVersions”) or [])),
“affected_versions”: “, “.join(v.get(“name”, “”) for v in (f.get(“versions”) or [])),
“story_points”:     f.get(“story_points”) or f.get(“customfield_10028”, “”),
“sprint”:           _extract_sprint(f),
“epic_key”:         f.get(“customfield_10014”, “”) or safe_get(f, “parent”, “key”),
“epic_name”:        safe_get(f, “parent”, “fields”, “summary”),
“parent_key”:       safe_get(f, “parent”, “key”),
“subtasks_count”:   len(f.get(“subtasks”, [])),
“attachment_count”: len(f.get(“attachment”, [])),
“comment_count”:    safe_get(f, “comment”, “total”, default=0),
“watches”:          safe_get(f, “watches”, “watchCount”, default=0),
“votes”:            safe_get(f, “votes”, “votes”, default=0),
“time_estimate_s”:  f.get(“timeoriginalestimate”, “”),
“time_spent_s”:     f.get(“timespent”, “”),
“changelog_count”:  safe_get(issue, “changelog”, “total”, default=0),
}

```
links = f.get("issuelinks", [])
link_strs = []
for link in links:
    lt = safe_get(link, "type", "name")
    if "outwardIssue" in link:
        link_strs.append(f"{lt} -> {link['outwardIssue']['key']}")
    elif "inwardIssue" in link:
        link_strs.append(f"{lt} <- {link['inwardIssue']['key']}")
row["linked_issues"] = "; ".join(link_strs)
return row
```

def _extract_sprint(fields: dict) -> str:
sf = fields.get(“sprint”) or fields.get(“customfield_10020”)
if not sf:
return “”
if isinstance(sf, list):
names = []
for s in sf:
if isinstance(s, dict):
names.append(s.get(“name”, “”))
elif isinstance(s, str):
m = re.search(r”name=([^,]]+)”, s)
if m:
names.append(m.group(1))
return “, “.join(n for n in names if n)
if isinstance(sf, dict):
return sf.get(“name”, “”)
if isinstance(sf, str):
m = re.search(r”name=([^,]]+)”, sf)
return m.group(1) if m else sf
return str(sf)

def flatten_changelogs(issue: dict) -> list[dict]:
rows = []
key = issue.get(“key”, “”)
histories = safe_get(issue, “changelog”, “histories”, default=[])

```
for history in histories:
    hist_id = history.get("id", "")
    author = safe_get(history, "author", "displayName")
    author_email = safe_get(history, "author", "emailAddress")
    change_date = history.get("created", "")

    for item in history.get("items", []):
        rows.append({
            "issue_key":      key,
            "history_id":     hist_id,
            "change_date":    change_date,
            "author":         author,
            "author_email":   author_email,
            "field":          item.get("field", ""),
            "field_type":     item.get("fieldtype", ""),
            "from_value":     clean(item.get("fromString", "")),
            "to_value":       clean(item.get("toString", "")),
            "from_id":        item.get("from", ""),
            "to_id":          item.get("to", ""),
        })
return rows
```

def flatten_comments(issue_key: str, comments: list[dict]) -> list[dict]:
rows = []
for comment in comments:
rows.append({
“issue_key”:     issue_key,
“comment_id”:    comment.get(“id”, “”),
“author”:        safe_get(comment, “author”, “displayName”),
“author_email”:  safe_get(comment, “author”, “emailAddress”),
“created”:       comment.get(“created”, “”),
“updated”:       comment.get(“updated”, “”),
“body”:          clean(comment.get(“body”, “”)),
})
return rows

# ─── UPSERT FUNCTIONS ───────────────────────────────────────────────────────

def upsert_issues(existing: pd.DataFrame, incoming: pd.DataFrame) -> pd.DataFrame:
“””
Upsert by issue_key:
- New issue_key → append
- Existing issue_key → replace entire row with latest
“””
if existing.empty:
return incoming

```
updated_keys = set(incoming["issue_key"])
kept = existing[~existing["issue_key"].isin(updated_keys)]
merged = pd.concat([kept, incoming], ignore_index=True)
merged.sort_values("issue_key", inplace=True)

new_count = len(updated_keys - set(existing["issue_key"]))
upd_count = len(updated_keys) - new_count
print(f"    Issues: {new_count} new, {upd_count} updated, {len(merged)} total")
return merged
```

def upsert_changelogs(existing: pd.DataFrame, incoming: pd.DataFrame) -> pd.DataFrame:
“””
Append-only, deduplicated by (issue_key, history_id, field).
Changelogs are immutable in Jira.
“””
if existing.empty:
return incoming

```
dedup_cols = ["issue_key", "history_id", "field"]
combined = pd.concat([existing, incoming], ignore_index=True)
combined.drop_duplicates(subset=dedup_cols, keep="last", inplace=True)
combined.sort_values(["issue_key", "change_date"], inplace=True)

added = len(combined) - len(existing)
print(f"    Changelogs: {added} new entries, {len(combined)} total")
return combined
```

def upsert_comments(existing: pd.DataFrame, incoming: pd.DataFrame) -> pd.DataFrame:
“””
Upsert by comment_id (comments can be edited in Jira).
“””
if existing.empty:
return incoming

```
updated_ids = set(incoming["comment_id"])
kept = existing[~existing["comment_id"].isin(updated_ids)]
merged = pd.concat([kept, incoming], ignore_index=True)
merged.sort_values(["issue_key", "created"], inplace=True)

new_count = len(updated_ids - set(existing["comment_id"]))
upd_count = len(updated_ids) - new_count
print(f"    Comments: {new_count} new, {upd_count} updated, {len(merged)} total")
return merged
```

# ─── JIRA API CLIENT ────────────────────────────────────────────────────────

class JiraClient:
def **init**(self, base_url: str, username: str, password: str):
self.base_url = base_url.rstrip(”/”)
self.api = f”{self.base_url}/rest/api/2”
self.session = requests.Session()
self.session.auth = (username, password)
self.session.headers.update({
“Accept”: “application/json”,
“Content-Type”: “application/json”,
})
# Uncomment for self-signed certs:
# self.session.verify = False
# import urllib3; urllib3.disable_warnings()

```
def search(self, jql: str) -> list[dict]:
    all_issues = []
    start_at = 0
    while True:
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": MAX_RESULTS,
            "expand": "changelog",
            "fields": "*all",
        }
        print(f"    Fetching from offset {start_at}...")
        resp = self.session.get(f"{self.api}/search", params=params)
        resp.raise_for_status()
        data = resp.json()

        issues = data.get("issues", [])
        all_issues.extend(issues)
        total = data.get("total", 0)
        start_at += len(issues)
        print(f"    {start_at}/{total}")

        if start_at >= total or not issues:
            break

    # Fetch full changelog if truncated
    for issue in all_issues:
        cl = issue.get("changelog", {})
        if len(cl.get("histories", [])) < cl.get("total", 0):
            print(f"    Full changelog for {issue['key']}...")
            issue["changelog"]["histories"] = self._full_changelog(issue["key"])

    return all_issues

def _full_changelog(self, key: str) -> list[dict]:
    all_h = []
    start = 0
    while True:
        resp = self.session.get(
            f"{self.api}/issue/{key}/changelog",
            params={"startAt": start, "maxResults": 100},
        )
        resp.raise_for_status()
        data = resp.json()
        vals = data.get("values", [])
        all_h.extend(vals)
        if start + len(vals) >= data.get("total", 0) or not vals:
            break
        start += len(vals)
    return all_h

def comments(self, key: str) -> list[dict]:
    all_c = []
    start = 0
    while True:
        resp = self.session.get(
            f"{self.api}/issue/{key}/comment",
            params={"startAt": start, "maxResults": 100},
        )
        resp.raise_for_status()
        data = resp.json()
        comments = data.get("comments", [])
        all_c.extend(comments)
        if start + len(comments) >= data.get("total", 0) or not comments:
            break
        start += len(comments)
    return all_c
```

# ─── MAIN SYNC LOGIC ────────────────────────────────────────────────────────

def sync(jql_base: str, output_dir: str, force_full: bool = False):
client = JiraClient(JIRA_URL, USERNAME, PASSWORD)

```
issues_path     = os.path.join(output_dir, ISSUES_FILE)
changelogs_path = os.path.join(output_dir, CHANGELOGS_FILE)
comments_path   = os.path.join(output_dir, COMMENTS_FILE)

# ── Step 1: Read existing CSVs and derive last known time ────────
print("\n[1/5] Reading existing CSVs...")
existing_issues     = read_csv(issues_path)
existing_changelogs = read_csv(changelogs_path)
existing_comments   = read_csv(comments_path)

print(f"    Issues:     {len(existing_issues)} rows")
print(f"    Changelogs: {len(existing_changelogs)} rows")
print(f"    Comments:   {len(existing_comments)} rows")

# ── Step 2: Determine sync boundary from CSV data ────────────────
# Use the latest timestamp across all 3 CSVs as the sync point
ts_issues     = get_max_timestamp(existing_issues, ["updated"])
ts_changelogs = get_max_timestamp(existing_changelogs, ["change_date"])
ts_comments   = get_max_timestamp(existing_comments, ["created", "updated"])

candidates = [t for t in [ts_issues, ts_changelogs, ts_comments] if t is not None]
last_known = max(candidates) if candidates else None

is_full = force_full or last_known is None

if is_full:
    reason = "forced" if force_full else "no existing data found"
    print(f"\n[2/5] Mode: FULL SYNC ({reason})")
    jql = f"{jql_base} ORDER BY created ASC"
else:
    # Apply safety buffer
    since = last_known - timedelta(minutes=BUFFER_MINUTES)
    since_str = since.strftime(JIRA_TIME_FMT)
    print(f"\n[2/5] Mode: INCREMENTAL")
    print(f"    Latest timestamp in CSVs: {last_known.strftime(JIRA_TIME_FMT)}")
    print(f"    Fetching from (with {BUFFER_MINUTES}min buffer): {since_str}")
    jql = f'{jql_base} AND updated >= "{since_str}" ORDER BY updated ASC'

print(f"    JQL: {jql}")

# ── Step 3: Fetch from Jira ──────────────────────────────────────
print(f"\n[3/5] Fetching issues from Jira...")
issues = client.search(jql)
print(f"    Found: {len(issues)} issues")

if not issues and not is_full:
    print("\n    Nothing changed since last sync. CSVs are up to date.")
    return

# ── Step 4: Flatten everything ───────────────────────────────────
print(f"\n[4/5] Flattening data...")
issue_rows = []
changelog_rows = []
comment_rows = []

for i, issue in enumerate(issues):
    issue_rows.append(flatten_issue(issue, client.base_url))
    changelog_rows.extend(flatten_changelogs(issue))

    key = issue.get("key", "")
    comms = client.comments(key)
    comment_rows.extend(flatten_comments(key, comms))

    if (i + 1) % 50 == 0:
        print(f"    Processed {i + 1}/{len(issues)}...")

print(f"    Flattened: {len(issue_rows)} issues, "
      f"{len(changelog_rows)} changelogs, "
      f"{len(comment_rows)} comments")

df_issues_new     = pd.DataFrame(issue_rows, dtype=str).fillna("")
df_changelogs_new = pd.DataFrame(changelog_rows, dtype=str).fillna("")
df_comments_new   = pd.DataFrame(comment_rows, dtype=str).fillna("")

# ── Step 5: Upsert and write ─────────────────────────────────────
print(f"\n[5/5] Upserting into CSVs...")

if is_full:
    # Full sync: just write fresh
    final_issues     = df_issues_new
    final_changelogs = df_changelogs_new
    final_comments   = df_comments_new
    print(f"    Full overwrite: {len(final_issues)} issues, "
          f"{len(final_changelogs)} changelogs, "
          f"{len(final_comments)} comments")
else:
    # Incremental: upsert into existing
    final_issues     = upsert_issues(existing_issues, df_issues_new)
    final_changelogs = upsert_changelogs(existing_changelogs, df_changelogs_new)
    final_comments   = upsert_comments(existing_comments, df_comments_new)

write_csv(final_issues, issues_path)
write_csv(final_changelogs, changelogs_path)
write_csv(final_comments, comments_path)

print(f"\n    ✓ {issues_path}     ({len(final_issues)} rows)")
print(f"    ✓ {changelogs_path} ({len(final_changelogs)} rows)")
print(f"    ✓ {comments_path}   ({len(final_comments)} rows)")

# ── Summary ──────────────────────────────────────────────────────
print("\n── Summary ──")
if not final_changelogs.empty:
    top = final_changelogs["field"].value_counts().head(5).to_dict()
    print(f"  Top changed fields: {top}")
if not final_issues.empty:
    print(f"  Statuses: {final_issues['status'].value_counts().to_dict()}")
    print(f"  Types: {final_issues['issue_type'].value_counts().to_dict()}")
```

# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
parser = argparse.ArgumentParser(description=“Jira Self-Healing Sync → CSV”)
parser.add_argument(”–full”, action=“store_true”, help=“Force full reload”)
parser.add_argument(”–project”, help=“Override project key in JQL”)
args = parser.parse_args()

```
jql_base = f"project = {args.project}" if args.project else JQL_BASE
sync(jql_base, OUTPUT_DIR, force_full=args.full)
```

if **name** == “**main**”:
main()
