# “””
Jira Incremental Sync

First run  → Full extraction of all issues, changelogs, comments → CSV
Next runs  → Fetches only what changed since last run, upserts into existing CSVs

Tracks last sync time in a small .sync_state.json file.

Usage:
python jira_sync.py                          # Auto: full if first run, incremental otherwise
python jira_sync.py –full                    # Force full reload
python jira_sync.py –since “2026-04-20 14:00”  # Incremental from a specific time

Requirements:
pip install requests pandas
“””

import requests
import pandas as pd
import re
import csv
import json
import os
import argparse
from datetime import datetime, timedelta
from typing import Any
from pathlib import Path

# ─── CONFIGURATION ──────────────────────────────────────────────────────────

JIRA_URL    = “https://your-jira-server.com”
USERNAME    = “your-service-account-username”
PASSWORD    = “your-password”
JQL_BASE    = “project = YOUR_PROJECT”  # Base filter (without time clause)
OUTPUT_DIR  = “.”
MAX_RESULTS = 100

# Output file names

ISSUES_FILE     = “jira_issues.csv”
CHANGELOGS_FILE = “jira_changelogs.csv”
COMMENTS_FILE   = “jira_comments.csv”
SYNC_STATE_FILE = “.sync_state.json”

# ─────────────────────────────────────────────────────────────────────────────

JIRA_TIME_FMT = “%Y-%m-%d %H:%M”

class SyncState:
“”“Tracks last successful sync time and run metadata.”””

```
def __init__(self, state_path: str):
    self.path = state_path
    self.data = self._load()

def _load(self) -> dict:
    if os.path.exists(self.path):
        with open(self.path, "r") as f:
            return json.load(f)
    return {}

def save(self, last_sync: str, mode: str, issues_synced: int, changes_synced: int, comments_synced: int):
    self.data = {
        "last_sync": last_sync,
        "last_mode": mode,
        "last_run_at": datetime.now().isoformat(),
        "issues_synced": issues_synced,
        "changes_synced": changes_synced,
        "comments_synced": comments_synced,
    }
    with open(self.path, "w") as f:
        json.dump(self.data, f, indent=2)

@property
def last_sync(self) -> str | None:
    return self.data.get("last_sync")

@property
def is_first_run(self) -> bool:
    return self.last_sync is None
```

class JiraSyncer:
def **init**(self, base_url: str, username: str, password: str, output_dir: str = “.”):
self.base_url = base_url.rstrip(”/”)
self.api = f”{self.base_url}/rest/api/2”
self.output_dir = output_dir
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
    self.issues_path     = os.path.join(output_dir, ISSUES_FILE)
    self.changelogs_path = os.path.join(output_dir, CHANGELOGS_FILE)
    self.comments_path   = os.path.join(output_dir, COMMENTS_FILE)
    self.state = SyncState(os.path.join(output_dir, SYNC_STATE_FILE))

# ── API Calls ────────────────────────────────────────────────────────

def fetch_issues(self, jql: str) -> list[dict]:
    """Fetch all issues matching JQL with changelogs expanded."""
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
        print(f"    Fetching issues from offset {start_at}...")
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

    # Fetch full changelog if truncated (>100 entries)
    for issue in all_issues:
        cl = issue.get("changelog", {})
        if len(cl.get("histories", [])) < cl.get("total", 0):
            print(f"    Full changelog fetch for {issue['key']}...")
            issue["changelog"]["histories"] = self._fetch_full_changelog(issue["key"])

    return all_issues

def _fetch_full_changelog(self, issue_key: str) -> list[dict]:
    all_histories = []
    start_at = 0
    while True:
        resp = self.session.get(
            f"{self.api}/issue/{issue_key}/changelog",
            params={"startAt": start_at, "maxResults": 100},
        )
        resp.raise_for_status()
        data = resp.json()
        values = data.get("values", [])
        all_histories.extend(values)
        if start_at + len(values) >= data.get("total", 0) or not values:
            break
        start_at += len(values)
    return all_histories

def fetch_comments(self, issue_key: str) -> list[dict]:
    all_comments = []
    start_at = 0
    while True:
        resp = self.session.get(
            f"{self.api}/issue/{issue_key}/comment",
            params={"startAt": start_at, "maxResults": 100},
        )
        resp.raise_for_status()
        data = resp.json()
        comments = data.get("comments", [])
        all_comments.extend(comments)
        if start_at + len(comments) >= data.get("total", 0) or not comments:
            break
        start_at += len(comments)
    return all_comments

# ── Text Cleaning ────────────────────────────────────────────────────

@staticmethod
def clean(text: Any) -> str:
    if text is None:
        return ""
    if isinstance(text, dict):
        return JiraSyncer._extract_adf(text)
    if not isinstance(text, str):
        return str(text)
    s = text
    s = re.sub(r"h[1-6]\.\s*", "", s)
    s = re.sub(r"\*([^*]+)\*", r"\1", s)
    s = re.sub(r"_([^_]+)_", r"\1", s)
    s = re.sub(r"\+([^+]+)\+", r"\1", s)
    s = re.sub(r"-([^-]+)-", r"\1", s)
    s = re.sub(r"\{noformat[^}]*\}", "", s)
    s = re.sub(r"\{code[^}]*\}", "", s)
    s = re.sub(r"\{quote\}", "", s)
    s = re.sub(r"\{color[^}]*\}", "", s)
    s = re.sub(r"\[([^|]+)\|[^\]]+\]", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]", r"\1", s)
    s = re.sub(r"![^!|]+(\|[^!]*)?!", "", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"^[\s]*[*#]+\s*", "", s, flags=re.MULTILINE)
    s = re.sub(r"\|\|", "|", s)
    s = re.sub(r"[\r\n]+", " | ", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()

@staticmethod
def _extract_adf(adf: dict) -> str:
    if not isinstance(adf, dict):
        return str(adf) if adf else ""
    texts = []
    if adf.get("type") == "text":
        texts.append(adf.get("text", ""))
    for child in adf.get("content", []):
        texts.append(JiraSyncer._extract_adf(child))
    return " ".join(t for t in texts if t).strip()

@staticmethod
def safe_get(d, *keys, default=""):
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

# ── Flatten Functions ────────────────────────────────────────────────

def flatten_issue(self, issue: dict) -> dict:
    f = issue.get("fields", {})
    c = self.clean

    row = {
        "issue_key":        issue.get("key", ""),
        "issue_id":         issue.get("id", ""),
        "issue_url":        f"{self.base_url}/browse/{issue.get('key', '')}",
        "project_key":      self.safe_get(f, "project", "key"),
        "project_name":     self.safe_get(f, "project", "name"),
        "issue_type":       self.safe_get(f, "issuetype", "name"),
        "status":           self.safe_get(f, "status", "name"),
        "status_category":  self.safe_get(f, "status", "statusCategory", "name"),
        "priority":         self.safe_get(f, "priority", "name"),
        "resolution":       self.safe_get(f, "resolution", "name"),
        "summary":          c(f.get("summary", "")),
        "description":      c(f.get("description", "")),
        "creator":          self.safe_get(f, "creator", "displayName"),
        "creator_email":    self.safe_get(f, "creator", "emailAddress"),
        "reporter":         self.safe_get(f, "reporter", "displayName"),
        "reporter_email":   self.safe_get(f, "reporter", "emailAddress"),
        "assignee":         self.safe_get(f, "assignee", "displayName"),
        "assignee_email":   self.safe_get(f, "assignee", "emailAddress"),
        "created":          f.get("created", ""),
        "updated":          f.get("updated", ""),
        "resolved":         f.get("resolutiondate", ""),
        "due_date":         f.get("duedate", ""),
        "labels":           ", ".join(f.get("labels", [])),
        "components":       ", ".join(x.get("name", "") for x in (f.get("components") or [])),
        "fix_versions":     ", ".join(v.get("name", "") for v in (f.get("fixVersions") or [])),
        "affected_versions": ", ".join(v.get("name", "") for v in (f.get("versions") or [])),
        "story_points":     f.get("story_points") or f.get("customfield_10028", ""),
        "sprint":           self._extract_sprint(f),
        "epic_key":         f.get("customfield_10014", "") or self.safe_get(f, "parent", "key"),
        "epic_name":        self.safe_get(f, "parent", "fields", "summary"),
        "parent_key":       self.safe_get(f, "parent", "key"),
        "subtasks_count":   len(f.get("subtasks", [])),
        "attachment_count": len(f.get("attachment", [])),
        "comment_count":    self.safe_get(f, "comment", "total", default=0),
        "watches":          self.safe_get(f, "watches", "watchCount", default=0),
        "votes":            self.safe_get(f, "votes", "votes", default=0),
        "time_estimate_s":  f.get("timeoriginalestimate", ""),
        "time_spent_s":     f.get("timespent", ""),
        "changelog_count":  self.safe_get(issue, "changelog", "total", default=0),
    }

    links = f.get("issuelinks", [])
    link_strs = []
    for link in links:
        lt = self.safe_get(link, "type", "name")
        if "outwardIssue" in link:
            link_strs.append(f"{lt} -> {link['outwardIssue']['key']}")
        elif "inwardIssue" in link:
            link_strs.append(f"{lt} <- {link['inwardIssue']['key']}")
    row["linked_issues"] = "; ".join(link_strs)

    return row

def _extract_sprint(self, fields: dict) -> str:
    sf = fields.get("sprint") or fields.get("customfield_10020")
    if not sf:
        return ""
    if isinstance(sf, list):
        names = []
        for s in sf:
            if isinstance(s, dict):
                names.append(s.get("name", ""))
            elif isinstance(s, str):
                m = re.search(r"name=([^,\]]+)", s)
                if m:
                    names.append(m.group(1))
        return ", ".join(n for n in names if n)
    if isinstance(sf, dict):
        return sf.get("name", "")
    if isinstance(sf, str):
        m = re.search(r"name=([^,\]]+)", sf)
        return m.group(1) if m else sf
    return str(sf)

def flatten_changelogs(self, issue: dict) -> list[dict]:
    rows = []
    key = issue.get("key", "")
    histories = self.safe_get(issue, "changelog", "histories", default=[])
    c = self.clean

    for history in histories:
        hist_id = history.get("id", "")
        author = self.safe_get(history, "author", "displayName")
        author_email = self.safe_get(history, "author", "emailAddress")
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
                "from_value":     c(item.get("fromString", "")),
                "to_value":       c(item.get("toString", "")),
                "from_id":        item.get("from", ""),
                "to_id":          item.get("to", ""),
            })
    return rows

def flatten_comments(self, issue_key: str, comments: list[dict]) -> list[dict]:
    rows = []
    c = self.clean
    for comment in comments:
        rows.append({
            "issue_key":     issue_key,
            "comment_id":    comment.get("id", ""),
            "author":        self.safe_get(comment, "author", "displayName"),
            "author_email":  self.safe_get(comment, "author", "emailAddress"),
            "created":       comment.get("created", ""),
            "updated":       comment.get("updated", ""),
            "body":          c(comment.get("body", "")),
        })
    return rows

# ── CSV Read/Write Helpers ───────────────────────────────────────────

@staticmethod
def read_csv_safe(path: str) -> pd.DataFrame:
    """Read existing CSV or return empty DataFrame."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return pd.read_csv(path, dtype=str, keep_default_na=False)
    return pd.DataFrame()

@staticmethod
def write_csv(df: pd.DataFrame, path: str):
    df.to_csv(path, index=False, quoting=csv.QUOTE_ALL)

# ── Upsert Logic ────────────────────────────────────────────────────

def upsert_issues(self, new_rows: list[dict]) -> int:
    """
    Issues CSV: upsert by issue_key.
    - New issue_key → append
    - Existing issue_key → overwrite entire row with latest data
    """
    existing = self.read_csv_safe(self.issues_path)
    incoming = pd.DataFrame(new_rows, dtype=str).fillna("")

    if existing.empty:
        self.write_csv(incoming, self.issues_path)
        return len(incoming)

    # Remove old rows for issue_keys that are in the incoming batch
    updated_keys = set(incoming["issue_key"])
    kept = existing[~existing["issue_key"].isin(updated_keys)]

    # Concat: kept old rows + all incoming (which includes both new and updated)
    merged = pd.concat([kept, incoming], ignore_index=True)
    merged.sort_values("issue_key", inplace=True)
    self.write_csv(merged, self.issues_path)

    new_count = len(updated_keys - set(existing["issue_key"]))
    update_count = len(updated_keys) - new_count
    print(f"    Issues: {new_count} new, {update_count} updated, {len(merged)} total")
    return len(incoming)

def upsert_changelogs(self, new_rows: list[dict]) -> int:
    """
    Changelogs CSV: append-only deduplicated by (issue_key, history_id, field).
    Changelogs are immutable — a change entry never gets edited.
    """
    existing = self.read_csv_safe(self.changelogs_path)
    incoming = pd.DataFrame(new_rows, dtype=str).fillna("")

    if existing.empty:
        self.write_csv(incoming, self.changelogs_path)
        return len(incoming)

    dedup_cols = ["issue_key", "history_id", "field"]
    combined = pd.concat([existing, incoming], ignore_index=True)
    before = len(combined)
    combined.drop_duplicates(subset=dedup_cols, keep="last", inplace=True)
    combined.sort_values(["issue_key", "change_date"], inplace=True)
    self.write_csv(combined, self.changelogs_path)

    added = len(combined) - len(existing)
    print(f"    Changelogs: {added} new entries, {len(combined)} total")
    return added

def upsert_comments(self, new_rows: list[dict]) -> int:
    """
    Comments CSV: upsert by comment_id.
    Comments can be edited, so we overwrite if comment_id already exists.
    """
    existing = self.read_csv_safe(self.comments_path)
    incoming = pd.DataFrame(new_rows, dtype=str).fillna("")

    if existing.empty:
        self.write_csv(incoming, self.comments_path)
        return len(incoming)

    updated_ids = set(incoming["comment_id"])
    kept = existing[~existing["comment_id"].isin(updated_ids)]
    merged = pd.concat([kept, incoming], ignore_index=True)
    merged.sort_values(["issue_key", "created"], inplace=True)
    self.write_csv(merged, self.comments_path)

    new_count = len(updated_ids - set(existing["comment_id"]))
    update_count = len(updated_ids) - new_count
    print(f"    Comments: {new_count} new, {update_count} updated, {len(merged)} total")
    return len(incoming)

# ── Main Sync ────────────────────────────────────────────────────────

def sync(self, mode: str = "auto", since: str | None = None):
    """
    mode='auto'  → full if first run, incremental otherwise
    mode='full'  → force full reload
    since=<time> → incremental from specific time
    """
    now_str = datetime.now().strftime(JIRA_TIME_FMT)

    # Determine sync mode
    if mode == "full" or (mode == "auto" and self.state.is_first_run):
        return self._full_sync(now_str)
    else:
        since_time = since or self.state.last_sync
        if not since_time:
            print("No previous sync found. Running full sync...")
            return self._full_sync(now_str)
        return self._incremental_sync(since_time, now_str)

def _full_sync(self, now_str: str):
    print("=" * 60)
    print("  FULL SYNC")
    print("=" * 60)

    jql = f"{JQL_BASE} ORDER BY created ASC"
    print(f"\n[1/4] JQL: {jql}")

    print("\n[2/4] Fetching all issues...")
    issues = self.fetch_issues(jql)
    print(f"    Total: {len(issues)} issues")

    print("\n[3/4] Processing...")
    issue_rows = []
    changelog_rows = []
    comment_rows = []

    for i, issue in enumerate(issues):
        issue_rows.append(self.flatten_issue(issue))
        changelog_rows.extend(self.flatten_changelogs(issue))

        key = issue.get("key", "")
        comments = self.fetch_comments(key)
        comment_rows.extend(self.flatten_comments(key, comments))

        if (i + 1) % 50 == 0:
            print(f"    Processed {i + 1}/{len(issues)}...")

    print(f"\n    Flattened: {len(issue_rows)} issues, "
          f"{len(changelog_rows)} changelog entries, "
          f"{len(comment_rows)} comments")

    # Full sync = overwrite everything
    print("\n[4/4] Writing CSVs (full overwrite)...")
    self.write_csv(pd.DataFrame(issue_rows).fillna(""), self.issues_path)
    self.write_csv(pd.DataFrame(changelog_rows).fillna(""), self.changelogs_path)
    self.write_csv(pd.DataFrame(comment_rows).fillna(""), self.comments_path)

    print(f"    ✓ {self.issues_path}     ({len(issue_rows)} rows)")
    print(f"    ✓ {self.changelogs_path} ({len(changelog_rows)} rows)")
    print(f"    ✓ {self.comments_path}   ({len(comment_rows)} rows)")

    self.state.save(now_str, "full", len(issue_rows), len(changelog_rows), len(comment_rows))
    self._print_summary(issue_rows, changelog_rows, comment_rows)

def _incremental_sync(self, since: str, now_str: str):
    # Subtract 1 min buffer to avoid edge-case misses
    try:
        since_dt = datetime.strptime(since, JIRA_TIME_FMT)
        since_buffered = (since_dt - timedelta(minutes=1)).strftime(JIRA_TIME_FMT)
    except ValueError:
        since_buffered = since

    print("=" * 60)
    print(f"  INCREMENTAL SYNC  ({since_buffered} → {now_str})")
    print("=" * 60)

    jql = f'{JQL_BASE} AND updated >= "{since_buffered}" ORDER BY updated ASC'
    print(f"\n[1/4] JQL: {jql}")

    print("\n[2/4] Fetching updated issues...")
    issues = self.fetch_issues(jql)
    print(f"    Found: {len(issues)} issues changed since {since_buffered}")

    if not issues:
        print("\n    Nothing changed. All CSVs are up to date.")
        self.state.save(now_str, "incremental", 0, 0, 0)
        return

    print("\n[3/4] Processing...")
    issue_rows = []
    changelog_rows = []
    comment_rows = []

    for i, issue in enumerate(issues):
        issue_rows.append(self.flatten_issue(issue))
        changelog_rows.extend(self.flatten_changelogs(issue))

        key = issue.get("key", "")
        comments = self.fetch_comments(key)
        comment_rows.extend(self.flatten_comments(key, comments))

        if (i + 1) % 50 == 0:
            print(f"    Processed {i + 1}/{len(issues)}...")

    print(f"\n    Incoming: {len(issue_rows)} issues, "
          f"{len(changelog_rows)} changelog entries, "
          f"{len(comment_rows)} comments")

    # Upsert into existing CSVs
    print("\n[4/4] Upserting into CSVs...")
    n_issues = self.upsert_issues(issue_rows)
    n_changes = self.upsert_changelogs(changelog_rows)
    n_comments = self.upsert_comments(comment_rows)

    self.state.save(now_str, "incremental", n_issues, n_changes, n_comments)
    self._print_summary(issue_rows, changelog_rows, comment_rows)

def _print_summary(self, issues, changelogs, comments):
    print("\n── Summary ──")
    if changelogs:
        df = pd.DataFrame(changelogs)
        print(f"  Fields changed: {df['field'].value_counts().head(5).to_dict()}")
    if issues:
        df = pd.DataFrame(issues)
        print(f"  Statuses: {df['status'].value_counts().to_dict()}")
        print(f"  Types: {df['issue_type'].value_counts().to_dict()}")
    print(f"\n  Sync state saved to {SYNC_STATE_FILE}")
    print(f"  Next run will pick up from: {datetime.now().strftime(JIRA_TIME_FMT)}")
```

# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
parser = argparse.ArgumentParser(description=“Jira Incremental Sync → CSV”)
parser.add_argument(”–full”, action=“store_true”, help=“Force full reload (overwrite CSVs)”)
parser.add_argument(”–since”, help=‘Incremental from specific time: “2026-04-20 14:00”’)
args = parser.parse_args()

```
syncer = JiraSyncer(JIRA_URL, USERNAME, PASSWORD, OUTPUT_DIR)

if args.full:
    syncer.sync(mode="full")
elif args.since:
    syncer.sync(mode="incremental", since=args.since)
else:
    syncer.sync(mode="auto")
```

if **name** == “**main**”:
main()
