# “””
Jira Full Data Extractor (Issues + Changelogs → CSV)

Pulls all issue data including full changelogs from Jira Server REST API v2,
cleans markup, flattens nested structures, and exports to CSV.

Requirements:
pip install requests pandas

Usage:
1. Fill in your JIRA_URL, USERNAME, and PASSWORD below
2. Set your JQL query
3. Run: python jira_extractor.py
4. Output: jira_issues.csv, jira_changelogs.csv, jira_comments.csv
“””

import requests
import pandas as pd
import re
import csv
import json
from datetime import datetime
from typing import Any

# ─── CONFIGURATION ──────────────────────────────────────────────────────────

JIRA_URL    = “https://your-jira-server.com”  # Your Jira Server URL
JQL_QUERY   = “project = YOUR_PROJECT ORDER BY created DESC”  # Your JQL filter
MAX_RESULTS = 100   # Per-page limit
OUTPUT_DIR  = “.”   # Output directory for CSV files

# ─── AUTHENTICATION ─────────────────────────────────────────────────────────

USERNAME    = “your-service-account-username”
PASSWORD    = “your-password”

# ─────────────────────────────────────────────────────────────────────────────

class JiraExtractor:
def **init**(self, base_url: str, username: str, password: str):
self.base_url = base_url.rstrip(”/”)
self.api = f”{self.base_url}/rest/api/2”
self.session = requests.Session()
self.session.auth = (username, password)
self.session.headers.update({
“Accept”: “application/json”,
“Content-Type”: “application/json”,
})
# Disable SSL warnings if using self-signed certs (common in enterprise)
# self.session.verify = False
# import urllib3; urllib3.disable_warnings()

```
# ── API Calls ────────────────────────────────────────────────────────

def fetch_issues_with_changelogs(self, jql: str, max_results: int = 100) -> list[dict]:
    """Fetch all issues matching JQL with full changelog expansion."""
    all_issues = []
    start_at = 0

    while True:
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": max_results,
            "expand": "changelog,renderedFields,names",
            "fields": "*all",
        }
        print(f"  Fetching issues {start_at} to {start_at + max_results}...")
        resp = self.session.get(f"{self.api}/search", params=params)
        resp.raise_for_status()
        data = resp.json()

        issues = data.get("issues", [])
        all_issues.extend(issues)

        total = data.get("total", 0)
        start_at += len(issues)
        print(f"  Retrieved {start_at}/{total} issues")

        if start_at >= total or not issues:
            break

    # For issues with more than 100 changelog entries, fetch remaining
    for issue in all_issues:
        changelog = issue.get("changelog", {})
        total_histories = changelog.get("total", 0)
        fetched_histories = len(changelog.get("histories", []))

        if fetched_histories < total_histories:
            print(f"  Fetching full changelog for {issue['key']} ({total_histories} entries)...")
            issue["changelog"]["histories"] = self._fetch_full_changelog(issue["key"])

    return all_issues

def _fetch_full_changelog(self, issue_key: str) -> list[dict]:
    """Fetch complete changelog for a single issue (handles pagination)."""
    all_histories = []
    start_at = 0

    while True:
        params = {"startAt": start_at, "maxResults": 100}
        resp = self.session.get(
            f"{self.api}/issue/{issue_key}/changelog", params=params
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
    """Fetch all comments for an issue."""
    all_comments = []
    start_at = 0

    while True:
        params = {"startAt": start_at, "maxResults": 100}
        resp = self.session.get(
            f"{self.api}/issue/{issue_key}/comment", params=params
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
def clean_text(text: Any) -> str:
    """Remove Jira wiki markup, HTML tags, and normalize whitespace."""
    if text is None:
        return ""
    if not isinstance(text, str):
        if isinstance(text, dict):
            return JiraExtractor._extract_adf_text(text)
        return str(text)

    s = text
    # Remove Jira wiki headings: h1. h2. h3. etc.
    s = re.sub(r"h[1-6]\.\s*", "", s)
    # Remove bold/italic/underline/strikethrough markup
    s = re.sub(r"\*([^*]+)\*", r"\1", s)       # *bold*
    s = re.sub(r"_([^_]+)_", r"\1", s)          # _italic_
    s = re.sub(r"\+([^+]+)\+", r"\1", s)        # +underline+
    s = re.sub(r"-([^-]+)-", r"\1", s)           # -strikethrough-
    # Remove {noformat}, {code}, {quote}, {color} blocks
    s = re.sub(r"\{noformat[^}]*\}", "", s)
    s = re.sub(r"\{code[^}]*\}", "", s)
    s = re.sub(r"\{quote\}", "", s)
    s = re.sub(r"\{color[^}]*\}", "", s)
    # Remove [links|url] → keep link text
    s = re.sub(r"\[([^|]+)\|[^\]]+\]", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]", r"\1", s)
    # Remove !image.png|...! attachments
    s = re.sub(r"![^!|]+(\|[^!]*)?!", "", s)
    # Remove HTML tags (renderedFields may have HTML)
    s = re.sub(r"<[^>]+>", " ", s)
    # Remove bullet/numbered list markers
    s = re.sub(r"^[\s]*[*#]+\s*", "", s, flags=re.MULTILINE)
    # Remove table markup
    s = re.sub(r"\|\|", "|", s)
    # Normalize whitespace: replace \r\n, \n, \r, multiple spaces
    s = re.sub(r"[\r\n]+", " | ", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()

@staticmethod
def _extract_adf_text(adf: dict) -> str:
    """Recursively extract plain text from Atlassian Document Format (ADF)."""
    if not isinstance(adf, dict):
        return str(adf) if adf else ""
    texts = []
    if adf.get("type") == "text":
        texts.append(adf.get("text", ""))
    for child in adf.get("content", []):
        texts.append(JiraExtractor._extract_adf_text(child))
    return " ".join(t for t in texts if t).strip()

# ── Safe nested access ───────────────────────────────────────────────

@staticmethod
def safe_get(d: dict, *keys, default="") -> Any:
    """Safely navigate nested dicts/lists."""
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

# ── Flatten Issues ───────────────────────────────────────────────────

def flatten_issue(self, issue: dict) -> dict:
    """Flatten a single Jira issue into a flat dict for CSV."""
    f = issue.get("fields", {})
    clean = self.clean_text

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
        "summary":          clean(f.get("summary", "")),
        "description":      clean(f.get("description", "")),
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
        "components":       ", ".join(c.get("name", "") for c in (f.get("components") or [])),
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

    # Extract linked issues
    links = f.get("issuelinks", [])
    link_strs = []
    for link in links:
        link_type = self.safe_get(link, "type", "name")
        if "outwardIssue" in link:
            link_strs.append(f"{link_type} -> {link['outwardIssue']['key']}")
        elif "inwardIssue" in link:
            link_strs.append(f"{link_type} <- {link['inwardIssue']['key']}")
    row["linked_issues"] = "; ".join(link_strs)

    return row

def _extract_sprint(self, fields: dict) -> str:
    """Extract sprint name(s) from various field formats."""
    # Jira Server often stores sprint in customfield_10020 as a string
    sprint_field = fields.get("sprint") or fields.get("customfield_10020")
    if not sprint_field:
        return ""
    if isinstance(sprint_field, list):
        names = []
        for s in sprint_field:
            if isinstance(s, dict):
                names.append(s.get("name", ""))
            elif isinstance(s, str):
                # Jira Server format: "com.atlassian.greenhopper...[@...][name=Sprint 1,...]"
                match = re.search(r"name=([^,\]]+)", s)
                if match:
                    names.append(match.group(1))
        return ", ".join(n for n in names if n)
    if isinstance(sprint_field, dict):
        return sprint_field.get("name", "")
    if isinstance(sprint_field, str):
        match = re.search(r"name=([^,\]]+)", sprint_field)
        return match.group(1) if match else sprint_field
    return str(sprint_field)

# ── Flatten Changelogs ───────────────────────────────────────────────

def flatten_changelogs(self, issue: dict) -> list[dict]:
    """Flatten all changelog histories for a single issue into rows."""
    rows = []
    issue_key = issue.get("key", "")
    histories = self.safe_get(issue, "changelog", "histories", default=[])
    clean = self.clean_text

    for history in histories:
        author = self.safe_get(history, "author", "displayName")
        author_email = self.safe_get(history, "author", "emailAddress")
        change_date = history.get("created", "")

        for item in history.get("items", []):
            rows.append({
                "issue_key":      issue_key,
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

# ── Flatten Comments ─────────────────────────────────────────────────

def flatten_comments(self, issue_key: str, comments: list[dict]) -> list[dict]:
    """Flatten comments for an issue into rows."""
    rows = []
    clean = self.clean_text

    for comment in comments:
        rows.append({
            "issue_key":     issue_key,
            "comment_id":    comment.get("id", ""),
            "author":        self.safe_get(comment, "author", "displayName"),
            "author_email":  self.safe_get(comment, "author", "emailAddress"),
            "created":       comment.get("created", ""),
            "updated":       comment.get("updated", ""),
            "body":          clean(comment.get("body", "")),
        })

    return rows

# ── Main Export ──────────────────────────────────────────────────────

def export_to_csv(self, jql: str, output_dir: str = "."):
    """Full pipeline: fetch → flatten → clean → CSV."""
    print("\n[1/4] Fetching issues with changelogs...")
    issues = self.fetch_issues_with_changelogs(jql, max_results=MAX_RESULTS)
    print(f"  Total issues fetched: {len(issues)}")

    all_issue_rows = []
    all_changelog_rows = []
    all_comment_rows = []

    print("\n[2/4] Flattening issue data...")
    for i, issue in enumerate(issues):
        all_issue_rows.append(self.flatten_issue(issue))
        all_changelog_rows.extend(self.flatten_changelogs(issue))

        issue_key = issue.get("key", "")
        comments = self.fetch_comments(issue_key)
        all_comment_rows.extend(self.flatten_comments(issue_key, comments))

        if (i + 1) % 25 == 0:
            print(f"  Processed {i + 1}/{len(issues)} issues...")

    print(f"\n  Issues:     {len(all_issue_rows)} rows")
    print(f"  Changelogs: {len(all_changelog_rows)} rows")
    print(f"  Comments:   {len(all_comment_rows)} rows")

    print("\n[3/4] Building DataFrames...")
    df_issues = pd.DataFrame(all_issue_rows)
    df_changelogs = pd.DataFrame(all_changelog_rows)
    df_comments = pd.DataFrame(all_comment_rows)

    # Parse dates
    for df in [df_issues]:
        for col in ["created", "updated", "resolved"]:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")

    for df, col in [(df_changelogs, "change_date"), (df_comments, "created")]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    print("\n[4/4] Writing CSV files...")
    issues_path     = f"{output_dir}/jira_issues.csv"
    changelogs_path = f"{output_dir}/jira_changelogs.csv"
    comments_path   = f"{output_dir}/jira_comments.csv"

    df_issues.to_csv(issues_path, index=False, quoting=csv.QUOTE_ALL)
    df_changelogs.to_csv(changelogs_path, index=False, quoting=csv.QUOTE_ALL)
    df_comments.to_csv(comments_path, index=False, quoting=csv.QUOTE_ALL)

    print(f"\n  Done! {issues_path}     ({len(df_issues)} rows x {len(df_issues.columns)} cols)")
    print(f"  Done! {changelogs_path} ({len(df_changelogs)} rows x {len(df_changelogs.columns)} cols)")
    print(f"  Done! {comments_path}   ({len(df_comments)} rows x {len(df_comments.columns)} cols)")

    # Quick summary
    print("\n── Summary ──")
    if not df_changelogs.empty:
        print(f"  Top changed fields: {df_changelogs['field'].value_counts().head(5).to_dict()}")
    if not df_issues.empty:
        print(f"  Status distribution: {df_issues['status'].value_counts().to_dict()}")
        print(f"  Issue types: {df_issues['issue_type'].value_counts().to_dict()}")

    return df_issues, df_changelogs, df_comments
```

# ─── RUN ─────────────────────────────────────────────────────────────────────

if **name** == “**main**”:
extractor = JiraExtractor(JIRA_URL, USERNAME, PASSWORD)
df_issues, df_changelogs, df_comments = extractor.export_to_csv(JQL_QUERY, OUTPUT_DIR)

```
# ── Example analyses you can do with the output ──
#
# 1. Average time to resolve by issue type:
#    df_issues["cycle_time"] = df_issues["resolved"] - df_issues["created"]
#    df_issues.groupby("issue_type")["cycle_time"].mean()
#
# 2. How many times each issue changed status:
#    df_changelogs[df_changelogs["field"] == "status"].groupby("issue_key").size()
#
# 3. Who makes the most changes:
#    df_changelogs.groupby("author").size().sort_values(ascending=False)
#
# 4. Status transition matrix:
#    status_changes = df_changelogs[df_changelogs["field"] == "status"]
#    pd.crosstab(status_changes["from_value"], status_changes["to_value"])
#
# 5. Average comments per issue:
#    df_comments.groupby("issue_key").size().mean()
```


