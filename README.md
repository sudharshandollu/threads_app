# “””
Excel File Comparator (Content-Based Diff)

Compares two .xlsx files (file1 = baseline, file2 = updated) across all sheets.
Uses CONTENT-BASED matching so inserting a row in between does NOT cause
false positives — only truly new, removed, or modified rows are reported.

Detects:

- New sheets added / sheets removed
- New columns added / columns removed
- New rows added / rows removed  (by content, not position)
- Cell-level value changes        (matched via key column or row fingerprint)
  Outputs a comprehensive HTML report.

Usage:
python excel_compare.py file1.xlsx file2.xlsx -o report.html
python excel_compare.py file1.xlsx file2.xlsx -k “ID” -o report.html

Options:
-k / –key   Column name to use as a unique row identifier for matching.
If not provided, rows are matched by full content fingerprint.
“””

import argparse
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import OrderedDict

# ──────────────────────────────────────────────

# Comparison Logic

# ──────────────────────────────────────────────

def load_workbook(filepath):
“”“Load all sheets from an Excel file into an OrderedDict of DataFrames.”””
xls = pd.ExcelFile(filepath)
sheets = OrderedDict()
for name in xls.sheet_names:
df = pd.read_excel(xls, sheet_name=name, header=0, dtype=str)
df = df.fillna(””)
df.columns = [str(c).strip() for c in df.columns]
sheets[name] = df
return sheets

def compare_columns(df1, df2):
cols1 = list(df1.columns)
cols2 = list(df2.columns)
added = [c for c in cols2 if c not in cols1]
removed = [c for c in cols1 if c not in cols2]
common = [c for c in cols1 if c in cols2]
return added, removed, common

def row_to_tuple(row, cols):
return tuple(str(row.get(c, “”)).strip() for c in cols)

def compare_sheets_content_based(df1, df2, sheet_name, key_col=None):
“””
Content-based comparison.
- If key_col is given and exists in both: match rows by that key, detect changes.
- Otherwise: use full-row fingerprinting to find added/removed rows,
and attempt fuzzy matching for modified rows.
“””
result = {
“sheet”: sheet_name,
“columns_added”: [],
“columns_removed”: [],
“rows_added_count”: 0,
“rows_removed_count”: 0,
“rows_added”: [],
“rows_removed”: [],
“cell_changes”: [],
}

```
cols_added, cols_removed, common_cols = compare_columns(df1, df2)
result["columns_added"] = cols_added
result["columns_removed"] = cols_removed

# ── Key-based matching ──
use_key = key_col and key_col in df1.columns and key_col in df2.columns

if use_key:
    _compare_by_key(df1, df2, key_col, common_cols, cols_added, result)
else:
    _compare_by_content(df1, df2, common_cols, cols_added, result)

return result
```

def _compare_by_key(df1, df2, key_col, common_cols, cols_added, result):
“”“Match rows by a unique key column, then diff matched rows cell-by-cell.”””
keys1 = {}
for idx, row in df1.iterrows():
k = str(row[key_col]).strip()
if k:
keys1[k] = row

```
keys2 = {}
row_numbers2 = {}
for idx, row in df2.iterrows():
    k = str(row[key_col]).strip()
    if k:
        keys2[k] = row
        row_numbers2[k] = idx + 2  # 1-indexed + header

set1 = set(keys1.keys())
set2 = set(keys2.keys())

# Rows only in file2 → added
for k in sorted(set2 - set1):
    row = keys2[k]
    row_data = {col: str(row.get(col, "")).strip() for col in df2.columns}
    result["rows_added"].append({"row_number": row_numbers2[k], "data": row_data, "key": k})
result["rows_added_count"] = len(set2 - set1)

# Rows only in file1 → removed
for k in sorted(set1 - set2):
    row = keys1[k]
    row_data = {col: str(row.get(col, "")).strip() for col in df1.columns}
    result["rows_removed"].append({"row_number": "—", "data": row_data, "key": k})
result["rows_removed_count"] = len(set1 - set2)

# Common keys → cell-level diff
for k in sorted(set1 & set2):
    r1 = keys1[k]
    r2 = keys2[k]
    rn = row_numbers2[k]

    for col in common_cols:
        v1 = str(r1.get(col, "")).strip()
        v2 = str(r2.get(col, "")).strip()
        if v1 != v2:
            result["cell_changes"].append({
                "row": f'{rn} (key={k})',
                "column": col,
                "old": v1 if v1 else "(empty)",
                "new": v2 if v2 else "(empty)",
            })

    for col in cols_added:
        v2 = str(r2.get(col, "")).strip()
        if v2:
            result["cell_changes"].append({
                "row": f'{rn} (key={k})',
                "column": col,
                "old": "(column didn't exist)",
                "new": v2,
            })
```

def _compare_by_content(df1, df2, common_cols, cols_added, result):
“””
Fingerprint-based comparison. Steps:
1. Build fingerprints for all rows using common columns.
2. Find exact matches (accounting for duplicates).
3. Remaining unmatched rows in file1 → removed.
4. Remaining unmatched rows in file2 → added.
5. Attempt to pair up removed/added rows that share most values → modified.
“””
# Build fingerprint → list of (original_index, row) for both files
fp1 = {}
for idx, row in df1.iterrows():
fp = row_to_tuple(row, common_cols)
fp1.setdefault(fp, []).append((idx, row))

```
fp2 = {}
for idx, row in df2.iterrows():
    fp = row_to_tuple(row, common_cols)
    fp2.setdefault(fp, []).append((idx, row))

# Match identical fingerprints, consuming from both sides
unmatched1 = []  # (idx, row) from file1 with no exact match
unmatched2 = []  # (idx, row) from file2 with no exact match

all_fps = set(list(fp1.keys()) + list(fp2.keys()))
for fp in all_fps:
    list1 = fp1.get(fp, [])
    list2 = fp2.get(fp, [])
    matched = min(len(list1), len(list2))
    unmatched1.extend(list1[matched:])
    unmatched2.extend(list2[matched:])

# Also check new-column data on unmatched file2 rows with identical common-col fingerprints
# (handled below in fuzzy matching)

# ── Fuzzy match: pair unmatched rows that are similar ──
used1 = set()
used2 = set()

if common_cols:
    for i2, (idx2, row2) in enumerate(unmatched2):
        best_score = 0
        best_i1 = None
        for i1, (idx1, row1) in enumerate(unmatched1):
            if i1 in used1:
                continue
            score = sum(
                1 for c in common_cols
                if str(row1.get(c, "")).strip() == str(row2.get(c, "")).strip()
            )
            if score > best_score:
                best_score = score
                best_i1 = i1

        # Require at least 50% of columns to match to consider it a "modified" row
        threshold = max(1, len(common_cols) * 0.5)
        if best_i1 is not None and best_score >= threshold:
            used1.add(best_i1)
            used2.add(i2)
            idx1, row1 = unmatched1[best_i1]
            rn2 = idx2 + 2

            for col in common_cols:
                v1 = str(row1.get(col, "")).strip()
                v2 = str(row2.get(col, "")).strip()
                if v1 != v2:
                    result["cell_changes"].append({
                        "row": rn2,
                        "column": col,
                        "old": v1 if v1 else "(empty)",
                        "new": v2 if v2 else "(empty)",
                    })
            for col in cols_added:
                v2 = str(row2.get(col, "")).strip()
                if v2:
                    result["cell_changes"].append({
                        "row": rn2,
                        "column": col,
                        "old": "(column didn't exist)",
                        "new": v2,
                    })

# Remaining unmatched in file2 → truly added
for i2, (idx2, row2) in enumerate(unmatched2):
    if i2 in used2:
        continue
    row_data = {col: str(row2.get(col, "")).strip() for col in df2.columns}
    result["rows_added"].append({"row_number": idx2 + 2, "data": row_data})
result["rows_added_count"] = sum(1 for i in range(len(unmatched2)) if i not in used2)

# Remaining unmatched in file1 → truly removed
for i1, (idx1, row1) in enumerate(unmatched1):
    if i1 in used1:
        continue
    row_data = {col: str(row1.get(col, "")).strip() for col in df1.columns}
    result["rows_removed"].append({"row_number": idx1 + 2, "data": row_data})
result["rows_removed_count"] = sum(1 for i in range(len(unmatched1)) if i not in used1)
```

def compare_workbooks(file1, file2, key_col=None):
“”“Main comparison: returns full diff structure.”””
sheets1 = load_workbook(file1)
sheets2 = load_workbook(file2)

```
diff = {
    "file1": str(file1),
    "file2": str(file2),
    "sheets_added": [],
    "sheets_removed": [],
    "sheet_diffs": [],
    "new_sheet_data": {},
}

names1 = set(sheets1.keys())
names2 = set(sheets2.keys())

diff["sheets_added"] = sorted(names2 - names1)
diff["sheets_removed"] = sorted(names1 - names2)

for s in diff["sheets_added"]:
    diff["new_sheet_data"][s] = sheets2[s]

common_sheets = [s for s in sheets1 if s in sheets2]
for sheet_name in common_sheets:
    sheet_diff = compare_sheets_content_based(
        sheets1[sheet_name], sheets2[sheet_name], sheet_name, key_col
    )
    has_changes = (
        sheet_diff["columns_added"]
        or sheet_diff["columns_removed"]
        or sheet_diff["rows_added_count"] > 0
        or sheet_diff["rows_removed_count"] > 0
        or sheet_diff["cell_changes"]
    )
    if has_changes:
        diff["sheet_diffs"].append(sheet_diff)

return diff
```

# ──────────────────────────────────────────────

# HTML Report Generation

# ──────────────────────────────────────────────

def escape(text):
return (
str(text)
.replace(”&”, “&”)
.replace(”<”, “<”)
.replace(”>”, “>”)
.replace(’”’, “"”)
)

def generate_html(diff):
total_changes = (
len(diff[“sheets_added”])
+ len(diff[“sheets_removed”])
+ sum(
len(d[“columns_added”])
+ len(d[“columns_removed”])
+ d[“rows_added_count”]
+ d[“rows_removed_count”]
+ len(d[“cell_changes”])
for d in diff[“sheet_diffs”]
)
)

```
html = f"""<!DOCTYPE html>
```

<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Excel Comparison Report</title>
<style>
    :root {{
        --bg: #0f172a;
        --card: #1e293b;
        --border: #334155;
        --text: #e2e8f0;
        --muted: #94a3b8;
        --accent: #38bdf8;
        --green: #4ade80;
        --red: #f87171;
        --yellow: #fbbf24;
        --green-bg: rgba(74, 222, 128, 0.1);
        --red-bg: rgba(248, 113, 113, 0.1);
        --yellow-bg: rgba(251, 191, 36, 0.1);
    }}
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
        padding: 2rem;
    }}
    .container {{ max-width: 1200px; margin: 0 auto; }}
    h1 {{
        font-size: 1.8rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
        color: #fff;
    }}
    .subtitle {{ color: var(--muted); margin-bottom: 2rem; font-size: 0.9rem; }}
    .method-note {{
        background: rgba(56, 189, 248, 0.08);
        border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin-bottom: 1.5rem;
        font-size: 0.85rem;
        color: var(--accent);
    }}
    .summary-grid {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
    }}
    .summary-card {{
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 1.25rem;
    }}
    .summary-card .label {{ color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }}
    .summary-card .value {{ font-size: 1.8rem; font-weight: 700; margin-top: 0.25rem; }}
    .summary-card .value.green {{ color: var(--green); }}
    .summary-card .value.red {{ color: var(--red); }}
    .summary-card .value.yellow {{ color: var(--yellow); }}
    .summary-card .value.accent {{ color: var(--accent); }}
    .section {{
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
    }}
    .section h2 {{
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }}
    .badge {{
        display: inline-block;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
    }}
    .badge.green {{ background: var(--green-bg); color: var(--green); border: 1px solid rgba(74,222,128,0.3); }}
    .badge.red {{ background: var(--red-bg); color: var(--red); border: 1px solid rgba(248,113,113,0.3); }}
    .badge.yellow {{ background: var(--yellow-bg); color: var(--yellow); border: 1px solid rgba(251,191,36,0.3); }}
    .tag {{
        display: inline-block;
        padding: 0.2rem 0.7rem;
        border-radius: 6px;
        font-size: 0.85rem;
        margin: 0.2rem;
    }}
    .tag.green {{ background: var(--green-bg); color: var(--green); }}
    .tag.red {{ background: var(--red-bg); color: var(--red); }}
    table {{
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        margin-top: 0.75rem;
    }}
    th {{
        text-align: left;
        padding: 0.6rem 0.8rem;
        background: rgba(56, 189, 248, 0.08);
        color: var(--accent);
        font-weight: 600;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
    }}
    td {{
        padding: 0.5rem 0.8rem;
        border-bottom: 1px solid var(--border);
        vertical-align: top;
        max-width: 300px;
        word-wrap: break-word;
    }}
    tr:hover td {{ background: rgba(255,255,255,0.02); }}
    .old-val {{ color: var(--red); text-decoration: line-through; opacity: 0.8; }}
    .new-val {{ color: var(--green); font-weight: 500; }}
    .arrow {{ color: var(--muted); margin: 0 0.3rem; }}
    .sheet-header {{
        font-size: 1.05rem;
        font-weight: 600;
        color: var(--accent);
        margin: 1.25rem 0 0.5rem 0;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid var(--border);
    }}
    .no-changes {{
        text-align: center;
        padding: 3rem;
        color: var(--muted);
        font-size: 1.1rem;
    }}
    .collapsible {{ cursor: pointer; user-select: none; }}
    .collapsible::before {{ content: "▸ "; transition: transform 0.2s; }}
    .collapsible.open::before {{ content: "▾ "; }}
    .collapsible-content {{ display: none; }}
    .collapsible-content.open {{ display: block; }}
    .file-info {{ color: var(--muted); font-size: 0.82rem; margin-bottom: 0.15rem; }}
    .file-info strong {{ color: var(--text); }}
</style>
</head>
<body>
<div class="container">
    <h1>Excel Comparison Report</h1>
    <p class="file-info"><strong>Baseline:</strong> {escape(diff["file1"])}</p>
    <p class="file-info"><strong>Updated:</strong> {escape(diff["file2"])}</p>
    <p class="subtitle">Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</p>

```
<div class="method-note">
    Matching method: <strong>{escape(diff.get("match_method", "content fingerprint"))}</strong>
    — rows are compared by content, not position. Inserting or reordering rows does not cause false diffs.
</div>

<div class="summary-grid">
    <div class="summary-card">
        <div class="label">Total Changes</div>
        <div class="value accent">{total_changes}</div>
    </div>
    <div class="summary-card">
        <div class="label">Sheets Added</div>
        <div class="value green">{len(diff["sheets_added"])}</div>
    </div>
    <div class="summary-card">
        <div class="label">Sheets Removed</div>
        <div class="value red">{len(diff["sheets_removed"])}</div>
    </div>
    <div class="summary-card">
        <div class="label">Sheets Modified</div>
        <div class="value yellow">{len(diff["sheet_diffs"])}</div>
    </div>
</div>
```

“””

```
if total_changes == 0:
    html += '    <div class="no-changes">No differences found between the two files.</div>\n'

# ── Sheets Added ──
if diff["sheets_added"]:
    html += '    <div class="section">\n'
    html += '        <h2>New Sheets Added <span class="badge green">'
    html += f'{len(diff["sheets_added"])} added</span></h2>\n'
    for s in diff["sheets_added"]:
        html += f'        <span class="tag green">+ {escape(s)}</span>\n'
    for sheet_name in diff["sheets_added"]:
        df = diff["new_sheet_data"][sheet_name]
        html += f'        <div class="sheet-header collapsible" onclick="toggleCollapse(this)">'
        html += f'Data in "{escape(sheet_name)}" ({len(df)} rows)</div>\n'
        html += '        <div class="collapsible-content">\n'
        html += '        <table><tr>\n'
        for col in df.columns:
            html += f'            <th>{escape(col)}</th>\n'
        html += '        </tr>\n'
        for _, row in df.head(50).iterrows():
            html += '        <tr>\n'
            for col in df.columns:
                html += f'            <td>{escape(row[col])}</td>\n'
            html += '        </tr>\n'
        if len(df) > 50:
            html += f'        <tr><td colspan="{len(df.columns)}" style="text-align:center;color:var(--muted);">'
            html += f'... and {len(df) - 50} more rows</td></tr>\n'
        html += '        </table>\n'
        html += '        </div>\n'
    html += '    </div>\n'

# ── Sheets Removed ──
if diff["sheets_removed"]:
    html += '    <div class="section">\n'
    html += '        <h2>Sheets Removed <span class="badge red">'
    html += f'{len(diff["sheets_removed"])} removed</span></h2>\n'
    for s in diff["sheets_removed"]:
        html += f'        <span class="tag red">- {escape(s)}</span>\n'
    html += '    </div>\n'

# ── Per-Sheet Diffs ──
for sd in diff["sheet_diffs"]:
    change_count = (
        len(sd["columns_added"])
        + len(sd["columns_removed"])
        + sd["rows_added_count"]
        + sd["rows_removed_count"]
        + len(sd["cell_changes"])
    )
    html += '    <div class="section">\n'
    html += f'        <h2>Sheet: "{escape(sd["sheet"])}" '
    html += f'<span class="badge yellow">{change_count} changes</span></h2>\n'

    if sd["columns_added"]:
        html += '        <p style="margin:0.5rem 0;">Columns added: '
        for c in sd["columns_added"]:
            html += f'<span class="tag green">+ {escape(c)}</span> '
        html += '</p>\n'
    if sd["columns_removed"]:
        html += '        <p style="margin:0.5rem 0;">Columns removed: '
        for c in sd["columns_removed"]:
            html += f'<span class="tag red">- {escape(c)}</span> '
        html += '</p>\n'

    # Cell changes
    if sd["cell_changes"]:
        html += f'        <div class="sheet-header collapsible" onclick="toggleCollapse(this)">'
        html += f'Cell Changes ({len(sd["cell_changes"])})</div>\n'
        html += '        <div class="collapsible-content">\n'
        html += '        <table>\n'
        html += '        <tr><th>Row</th><th>Column</th><th>Old Value</th><th></th><th>New Value</th></tr>\n'
        for ch in sd["cell_changes"]:
            html += '        <tr>\n'
            html += f'            <td>{escape(str(ch["row"]))}</td>\n'
            html += f'            <td>{escape(ch["column"])}</td>\n'
            html += f'            <td class="old-val">{escape(ch["old"])}</td>\n'
            html += '            <td class="arrow">→</td>\n'
            html += f'            <td class="new-val">{escape(ch["new"])}</td>\n'
            html += '        </tr>\n'
        html += '        </table>\n'
        html += '        </div>\n'

    # Rows added
    if sd["rows_added"]:
        html += f'        <div class="sheet-header collapsible" onclick="toggleCollapse(this)">'
        html += f'Rows Added ({sd["rows_added_count"]})</div>\n'
        html += '        <div class="collapsible-content">\n'
        cols = list(sd["rows_added"][0]["data"].keys())
        html += '        <table><tr><th>Row #</th>\n'
        for c in cols:
            html += f'            <th>{escape(c)}</th>\n'
        html += '        </tr>\n'
        for ra in sd["rows_added"]:
            html += '        <tr>\n'
            html += f'            <td>{escape(str(ra["row_number"]))}</td>\n'
            for c in cols:
                html += f'            <td class="new-val">{escape(ra["data"].get(c, ""))}</td>\n'
            html += '        </tr>\n'
        html += '        </table>\n'
        html += '        </div>\n'

    # Rows removed
    if sd["rows_removed"]:
        html += f'        <div class="sheet-header collapsible" onclick="toggleCollapse(this)">'
        html += f'Rows Removed ({sd["rows_removed_count"]})</div>\n'
        html += '        <div class="collapsible-content">\n'
        cols = list(sd["rows_removed"][0]["data"].keys())
        html += '        <table><tr><th>Row #</th>\n'
        for c in cols:
            html += f'            <th>{escape(c)}</th>\n'
        html += '        </tr>\n'
        for rr in sd["rows_removed"]:
            html += '        <tr>\n'
            html += f'            <td>{escape(str(rr["row_number"]))}</td>\n'
            for c in cols:
                html += f'            <td class="old-val">{escape(rr["data"].get(c, ""))}</td>\n'
            html += '        </tr>\n'
        html += '        </table>\n'
        html += '        </div>\n'

    html += '    </div>\n'

html += """
<p style="text-align:center;color:var(--muted);font-size:0.8rem;margin-top:2rem;">
    Generated by Excel Comparator (Content-Based)
</p>
```

</div>

<script>
function toggleCollapse(el) {
    el.classList.toggle('open');
    const content = el.nextElementSibling;
    if (content) content.classList.toggle('open');
}
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.collapsible').forEach(el => {
        el.classList.add('open');
        const content = el.nextElementSibling;
        if (content && content.classList.contains('collapsible-content')) {
            content.classList.add('open');
        }
    });
});
</script>

</body>
</html>"""

```
return html
```

# ──────────────────────────────────────────────

# Main

# ──────────────────────────────────────────────

def main():
parser = argparse.ArgumentParser(
description=“Compare two Excel (.xlsx) files and generate an HTML diff report.”
)
parser.add_argument(“file1”, help=“Baseline Excel file (original)”)
parser.add_argument(“file2”, help=“Updated Excel file (new version)”)
parser.add_argument(
“-o”, “–output”,
default=“comparison_report.html”,
help=“Output HTML file path (default: comparison_report.html)”,
)
parser.add_argument(
“-k”, “–key”,
default=None,
help=“Column name to use as unique row identifier (e.g. ‘ID’, ‘Employee_ID’). “
“If omitted, rows are matched by full content fingerprint.”,
)
args = parser.parse_args()

```
f1, f2 = Path(args.file1), Path(args.file2)
if not f1.exists():
    print(f"Error: '{f1}' not found."); return
if not f2.exists():
    print(f"Error: '{f2}' not found."); return

print(f"Comparing:\n  Baseline: {f1}\n  Updated:  {f2}")
if args.key:
    print(f"  Key column: {args.key}")
else:
    print(f"  Matching: content-based (no key column)")
print()

diff = compare_workbooks(f1, f2, key_col=args.key)
diff["match_method"] = f"Key column: {args.key}" if args.key else "Content fingerprint (position-independent)"
html = generate_html(diff)

out = Path(args.output)
out.write_text(html, encoding="utf-8")

total = (
    len(diff["sheets_added"]) + len(diff["sheets_removed"])
    + sum(
        len(d["columns_added"]) + len(d["columns_removed"])
        + d["rows_added_count"] + d["rows_removed_count"]
        + len(d["cell_changes"])
        for d in diff["sheet_diffs"]
    )
)
print(f"Done! {total} total changes detected.")
print(f"  Sheets added:    {len(diff['sheets_added'])}")
print(f"  Sheets removed:  {len(diff['sheets_removed'])}")
print(f"  Sheets modified: {len(diff['sheet_diffs'])}")
print(f"\nReport saved to: {out.resolve()}")
```

if **name** == “**main**”:
main()

