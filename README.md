# “””
Excel File Comparator

Compares two .xlsx files (file1 = baseline, file2 = updated) across all sheets.
Detects:

- New sheets added / sheets removed
- New columns added / columns removed
- New rows added / rows removed
- Cell-level value changes
  Outputs a comprehensive HTML report.

Usage:
python excel_compare.py file1.xlsx file2.xlsx -o report.html
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
“”“Compare columns between two DataFrames.”””
cols1 = list(df1.columns)
cols2 = list(df2.columns)
added = [c for c in cols2 if c not in cols1]
removed = [c for c in cols1 if c not in cols2]
common = [c for c in cols1 if c in cols2]
return added, removed, common

def compare_sheets(df1, df2, sheet_name):
“””
Compare two DataFrames representing the same sheet.
Returns a dict with all detected changes.
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

min_rows = min(len(df1), len(df2))

# Cell-level changes on overlapping region
for row_idx in range(min_rows):
    for col in common_cols:
        val1 = str(df1.at[row_idx, col]).strip()
        val2 = str(df2.at[row_idx, col]).strip()
        if val1 != val2:
            result["cell_changes"].append({
                "row": row_idx + 2,  # +2 for 1-indexed + header
                "column": col,
                "old": val1 if val1 != "" else "(empty)",
                "new": val2 if val2 != "" else "(empty)",
            })

# New values in added columns (within overlapping rows)
for row_idx in range(min_rows):
    for col in cols_added:
        val = str(df2.at[row_idx, col]).strip()
        if val != "":
            result["cell_changes"].append({
                "row": row_idx + 2,
                "column": col,
                "old": "(column didn't exist)",
                "new": val,
            })

# Extra rows in file2
if len(df2) > len(df1):
    result["rows_added_count"] = len(df2) - len(df1)
    for row_idx in range(len(df1), len(df2)):
        row_data = {col: str(df2.at[row_idx, col]).strip() for col in df2.columns}
        result["rows_added"].append({"row_number": row_idx + 2, "data": row_data})

# Removed rows (present in file1 but not file2)
if len(df1) > len(df2):
    result["rows_removed_count"] = len(df1) - len(df2)
    for row_idx in range(len(df2), len(df1)):
        row_data = {col: str(df1.at[row_idx, col]).strip() for col in df1.columns}
        result["rows_removed"].append({"row_number": row_idx + 2, "data": row_data})

return result
```

def compare_workbooks(file1, file2):
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

# Store full data for brand-new sheets
for s in diff["sheets_added"]:
    diff["new_sheet_data"][s] = sheets2[s]

# Compare common sheets
common_sheets = [s for s in sheets1 if s in sheets2]
for sheet_name in common_sheets:
    sheet_diff = compare_sheets(sheets1[sheet_name], sheets2[sheet_name], sheet_name)
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
“”“Escape HTML entities.”””
return (
str(text)
.replace(”&”, “&”)
.replace(”<”, “<”)
.replace(”>”, “>”)
.replace(’”’, “"”)
)

def generate_html(diff):
“”“Generate a comprehensive HTML report from the diff structure.”””

```
total_changes = (
    len(diff["sheets_added"])
    + len(diff["sheets_removed"])
    + sum(
        len(d["columns_added"])
        + len(d["columns_removed"])
        + d["rows_added_count"]
        + d["rows_removed_count"]
        + len(d["cell_changes"])
        for d in diff["sheet_diffs"]
    )
)

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
# ── No changes ──
if total_changes == 0:
    html += '    <div class="no-changes">No differences found between the two files.</div>\n'

# ── Sheets Added ──
if diff["sheets_added"]:
    html += '    <div class="section">\n'
    html += '        <h2>New Sheets Added <span class="badge green">'
    html += f'{len(diff["sheets_added"])} added</span></h2>\n'
    for s in diff["sheets_added"]:
        html += f'        <span class="tag green">+ {escape(s)}</span>\n'

    # Show data for new sheets
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

    # Columns added/removed
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
            html += f'            <td>{ch["row"]}</td>\n'
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
            html += f'            <td>{ra["row_number"]}</td>\n'
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
            html += f'            <td>{rr["row_number"]}</td>\n'
            for c in cols:
                html += f'            <td class="old-val">{escape(rr["data"].get(c, ""))}</td>\n'
            html += '        </tr>\n'
        html += '        </table>\n'
        html += '        </div>\n'

    html += '    </div>\n'

# ── Footer & JS ──
html += """
<p style="text-align:center;color:var(--muted);font-size:0.8rem;margin-top:2rem;">
    Generated by Excel Comparator
</p>
```

</div>

<script>
function toggleCollapse(el) {
    el.classList.toggle('open');
    const content = el.nextElementSibling;
    if (content) content.classList.toggle('open');
}
// Auto-open all sections on load
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
args = parser.parse_args()

```
f1, f2 = Path(args.file1), Path(args.file2)
if not f1.exists():
    print(f"Error: '{f1}' not found."); return
if not f2.exists():
    print(f"Error: '{f2}' not found."); return

print(f"Comparing:\n  Baseline: {f1}\n  Updated:  {f2}\n")

diff = compare_workbooks(f1, f2)
html = generate_html(diff)

out = Path(args.output)
out.write_text(html, encoding="utf-8")

# Summary
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
