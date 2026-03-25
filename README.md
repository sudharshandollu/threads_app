# “””
Excel File Comparator (Content-Based Diff, Email-Compatible HTML)

Compares two .xlsx files (file1 = baseline, file2 = updated) across all sheets.
Uses CONTENT-BASED matching so inserting a row in between does NOT cause
false positives — only truly new, removed, or modified rows are reported.

Generates EMAIL-SAFE HTML using:

- Inline styles only (no <style> blocks or CSS variables)
- Table-based layout (no grid/flexbox)
- Web-safe fonts, no JavaScript
- Compatible with Gmail, Outlook, Apple Mail, Yahoo Mail

Usage:
python excel_compare.py file1.xlsx file2.xlsx -o report.html
python excel_compare.py file1.xlsx file2.xlsx -k “ID” -o report.html
“””

import argparse
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import OrderedDict

# ──────────────────────────────────────────────

# Color / Style Constants (inline-ready)

# ──────────────────────────────────────────────

C = {
“bg”:        “#0f172a”,
“card”:      “#1e293b”,
“border”:    “#334155”,
“text”:      “#e2e8f0”,
“muted”:     “#94a3b8”,
“accent”:    “#38bdf8”,
“green”:     “#4ade80”,
“red”:       “#f87171”,
“yellow”:    “#fbbf24”,
“green_bg”:  “#0b2e1a”,
“red_bg”:    “#2e0b0b”,
“yellow_bg”: “#2e2a0b”,
“white”:     “#ffffff”,
“font”:      “Segoe UI, Helvetica, Arial, sans-serif”,
}

# ──────────────────────────────────────────────

# Comparison Logic (unchanged from previous)

# ──────────────────────────────────────────────

def load_workbook(filepath):
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

use_key = key_col and key_col in df1.columns and key_col in df2.columns

if use_key:
    _compare_by_key(df1, df2, key_col, common_cols, cols_added, result)
else:
    _compare_by_content(df1, df2, common_cols, cols_added, result)

return result
```

def _compare_by_key(df1, df2, key_col, common_cols, cols_added, result):
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
        row_numbers2[k] = idx + 2

set1 = set(keys1.keys())
set2 = set(keys2.keys())

for k in sorted(set2 - set1):
    row = keys2[k]
    row_data = {col: str(row.get(col, "")).strip() for col in df2.columns}
    result["rows_added"].append({"row_number": row_numbers2[k], "data": row_data, "key": k})
result["rows_added_count"] = len(set2 - set1)

for k in sorted(set1 - set2):
    row = keys1[k]
    row_data = {col: str(row.get(col, "")).strip() for col in df1.columns}
    result["rows_removed"].append({"row_number": "—", "data": row_data, "key": k})
result["rows_removed_count"] = len(set1 - set2)

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
fp1 = {}
for idx, row in df1.iterrows():
fp = row_to_tuple(row, common_cols)
fp1.setdefault(fp, []).append((idx, row))

```
fp2 = {}
for idx, row in df2.iterrows():
    fp = row_to_tuple(row, common_cols)
    fp2.setdefault(fp, []).append((idx, row))

unmatched1 = []
unmatched2 = []

all_fps = set(list(fp1.keys()) + list(fp2.keys()))
for fp in all_fps:
    list1 = fp1.get(fp, [])
    list2 = fp2.get(fp, [])
    matched = min(len(list1), len(list2))
    unmatched1.extend(list1[matched:])
    unmatched2.extend(list2[matched:])

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

for i2, (idx2, row2) in enumerate(unmatched2):
    if i2 in used2:
        continue
    row_data = {col: str(row2.get(col, "")).strip() for col in df2.columns}
    result["rows_added"].append({"row_number": idx2 + 2, "data": row_data})
result["rows_added_count"] = sum(1 for i in range(len(unmatched2)) if i not in used2)

for i1, (idx1, row1) in enumerate(unmatched1):
    if i1 in used1:
        continue
    row_data = {col: str(row1.get(col, "")).strip() for col in df1.columns}
    result["rows_removed"].append({"row_number": idx1 + 2, "data": row_data})
result["rows_removed_count"] = sum(1 for i in range(len(unmatched1)) if i not in used1)
```

def compare_workbooks(file1, file2, key_col=None):
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

# EMAIL-SAFE HTML Report Generation

# All styles are inline. Layout uses tables only.

# No CSS variables, no <style>, no JS, no grid/flex.

# ──────────────────────────────────────────────

def esc(text):
return (
str(text)
.replace(”&”, “&”)
.replace(”<”, “<”)
.replace(”>”, “>”)
.replace(’”’, “"”)
)

def _summary_card(label, value, color):
return f’’’<td style="width:25%;padding:8px;">

  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:{C['card']};border:1px solid {C['border']};border-radius:8px;">
    <tr><td style="padding:16px;font-family:{C['font']};">
      <div style="color:{C['muted']};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">{label}</div>
      <div style="color:{color};font-size:28px;font-weight:700;margin-top:4px;">{value}</div>
    </td></tr>
  </table>
</td>'''

def _badge(text, color, bg_color):
return (
f’<span style="display:inline-block;padding:2px 10px;border-radius:99px;'
f'font-size:12px;font-weight:600;color:{color};background:{bg_color};'
f'border:1px solid {color};">{text}</span>’
)

def _tag(text, color, bg_color):
return (
f’<span style="display:inline-block;padding:3px 10px;border-radius:5px;'
f'font-size:13px;color:{color};background:{bg_color};margin:3px 3px 3px 0;">{text}</span>’
)

def _section_start():
return (
f’<table cellpadding=“0” cellspacing=“0” border=“0” width=“100%”’
f’ style=“background:{C[“card”]};border:1px solid {C[“border”]};’
f’border-radius:8px;margin-bottom:16px;”>’
f’<tr><td style=“padding:20px;font-family:{C[“font”]};”>’
)

def _section_end():
return ‘</td></tr></table>’

def _section_title(title, badge_html=””):
return (
f’<div style=“font-size:17px;font-weight:600;color:{C[“text”]};’
f’margin-bottom:12px;”>{title} {badge_html}</div>’
)

def _sub_header(title):
return (
f’<div style=“font-size:15px;font-weight:600;color:{C[“accent”]};’
f’margin:16px 0 8px 0;padding-bottom:6px;’
f’border-bottom:1px solid {C[“border”]};”>{title}</div>’
)

def _data_table_start(headers):
“”“Start a data table with header row.”””
hdr_style = (
f’padding:8px 10px;text-align:left;font-size:12px;font-weight:600;’
f’color:{C[“accent”]};background:rgba(56,189,248,0.08);’
f’border-bottom:2px solid {C[“border”]};font-family:{C[“font”]};’
)
h = (
f’<table cellpadding=“0” cellspacing=“0” border=“0” width=“100%”’
f’ style=“border-collapse:collapse;font-size:13px;font-family:{C[“font”]};”>’
f’<tr>’
)
for header in headers:
h += f’<th style="{hdr_style}">{esc(header)}</th>’
h += ‘</tr>’
return h

def _data_table_row(cells, cell_styles=None):
“”“Add a row. cells = list of strings, cell_styles = optional list of extra style strings.”””
base = (
f’padding:7px 10px;border-bottom:1px solid {C[“border”]};’
f’font-family:{C[“font”]};color:{C[“text”]};vertical-align:top;’
f’max-width:250px;word-wrap:break-word;’
)
r = ‘<tr>’
for i, cell in enumerate(cells):
extra = cell_styles[i] if cell_styles and i < len(cell_styles) else “”
r += f’<td style="{base}{extra}">{cell}</td>’
r += ‘</tr>’
return r

def _data_table_end():
return ‘</table>’

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
match_method = diff.get("match_method", "content fingerprint")
ts = datetime.now().strftime("%B %d, %Y at %I:%M %p")

html = f'''<!DOCTYPE html>
```

<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Excel Comparison Report</title></head>
<body style="margin:0;padding:0;background:{C['bg']};font-family:{C['font']};">

<!-- Outer wrapper -->

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:{C['bg']};">
<tr><td align="center" style="padding:24px 16px;">

<!-- Inner container -->

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:900px;">

<!-- Header -->

<tr><td style="padding-bottom:20px;">
  <div style="font-size:24px;font-weight:700;color:{C['white']};font-family:{C['font']};">Excel Comparison Report</div>
  <div style="font-size:13px;color:{C['muted']};font-family:{C['font']};margin-top:4px;">
    <strong style="color:{C['text']};">Baseline:</strong> {esc(diff["file1"])}</div>
  <div style="font-size:13px;color:{C['muted']};font-family:{C['font']};">
    <strong style="color:{C['text']};">Updated:</strong> {esc(diff["file2"])}</div>
  <div style="font-size:13px;color:{C['muted']};font-family:{C['font']};margin-top:2px;">
    Generated on {ts}</div>
</td></tr>

<!-- Method note -->

<tr><td style="padding-bottom:16px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%"
    style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);border-radius:6px;">
    <tr><td style="padding:10px 14px;font-size:13px;color:{C['accent']};font-family:{C['font']};">
      Matching method: <strong>{esc(match_method)}</strong>
      &mdash; rows compared by content, not position.
    </td></tr>
  </table>
</td></tr>

<!-- Summary Cards -->

<tr><td style="padding-bottom:20px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      {_summary_card("Total Changes", total_changes, C['accent'])}
      {_summary_card("Sheets Added", len(diff['sheets_added']), C['green'])}
      {_summary_card("Sheets Removed", len(diff['sheets_removed']), C['red'])}
      {_summary_card("Sheets Modified", len(diff['sheet_diffs']), C['yellow'])}
    </tr>
  </table>
</td></tr>
'''

```
# ── No Changes ──
if total_changes == 0:
    html += f'''<tr><td>
```

{_section_start()}

  <div style="text-align:center;padding:30px;color:{C['muted']};font-size:16px;">
    No differences found between the two files.</div>
  {_section_end()}
</td></tr>'''

```
# ── Sheets Added ──
if diff["sheets_added"]:
    html += f'<tr><td>{_section_start()}'
    html += _section_title(
        "New Sheets Added",
        _badge(f'{len(diff["sheets_added"])} added', C['green'], C['green_bg'])
    )
    for s in diff["sheets_added"]:
        html += _tag(f"+ {esc(s)}", C['green'], C['green_bg'])

    for sheet_name in diff["sheets_added"]:
        df = diff["new_sheet_data"][sheet_name]
        html += _sub_header(f'Data in &quot;{esc(sheet_name)}&quot; ({len(df)} rows)')
        html += _data_table_start(list(df.columns))
        for _, row in df.head(50).iterrows():
            cells = [esc(row[col]) for col in df.columns]
            html += _data_table_row(cells)
        if len(df) > 50:
            html += (
                f'<tr><td colspan="{len(df.columns)}" style="text-align:center;'
                f'padding:10px;color:{C["muted"]};font-family:{C["font"]};">'
                f'... and {len(df) - 50} more rows</td></tr>'
            )
        html += _data_table_end()

    html += f'{_section_end()}</td></tr>'

# ── Sheets Removed ──
if diff["sheets_removed"]:
    html += f'<tr><td>{_section_start()}'
    html += _section_title(
        "Sheets Removed",
        _badge(f'{len(diff["sheets_removed"])} removed', C['red'], C['red_bg'])
    )
    for s in diff["sheets_removed"]:
        html += _tag(f"- {esc(s)}", C['red'], C['red_bg'])
    html += f'{_section_end()}</td></tr>'

# ── Per-Sheet Diffs ──
for sd in diff["sheet_diffs"]:
    change_count = (
        len(sd["columns_added"])
        + len(sd["columns_removed"])
        + sd["rows_added_count"]
        + sd["rows_removed_count"]
        + len(sd["cell_changes"])
    )

    html += f'<tr><td>{_section_start()}'
    html += _section_title(
        f'Sheet: &quot;{esc(sd["sheet"])}&quot;',
        _badge(f'{change_count} changes', C['yellow'], C['yellow_bg'])
    )

    # Columns added / removed
    if sd["columns_added"]:
        html += f'<div style="margin:6px 0;">Columns added: '
        for c in sd["columns_added"]:
            html += _tag(f"+ {esc(c)}", C['green'], C['green_bg'])
        html += '</div>'
    if sd["columns_removed"]:
        html += f'<div style="margin:6px 0;">Columns removed: '
        for c in sd["columns_removed"]:
            html += _tag(f"- {esc(c)}", C['red'], C['red_bg'])
        html += '</div>'

    # Cell changes
    if sd["cell_changes"]:
        html += _sub_header(f'Cell Changes ({len(sd["cell_changes"])})')
        html += _data_table_start(["Row", "Column", "Old Value", "", "New Value"])
        for ch in sd["cell_changes"]:
            cells = [
                esc(str(ch["row"])),
                esc(ch["column"]),
                esc(ch["old"]),
                "&rarr;",
                esc(ch["new"]),
            ]
            styles = [
                "",
                "",
                f"color:{C['red']};text-decoration:line-through;",
                f"color:{C['muted']};text-align:center;width:30px;",
                f"color:{C['green']};font-weight:600;",
            ]
            html += _data_table_row(cells, styles)
        html += _data_table_end()

    # Rows added
    if sd["rows_added"]:
        html += _sub_header(f'Rows Added ({sd["rows_added_count"]})')
        cols = list(sd["rows_added"][0]["data"].keys())
        html += _data_table_start(["Row #"] + cols)
        for ra in sd["rows_added"]:
            cells = [esc(str(ra["row_number"]))] + [esc(ra["data"].get(c, "")) for c in cols]
            styles = [""] + [f"color:{C['green']};" for _ in cols]
            html += _data_table_row(cells, styles)
        html += _data_table_end()

    # Rows removed
    if sd["rows_removed"]:
        html += _sub_header(f'Rows Removed ({sd["rows_removed_count"]})')
        cols = list(sd["rows_removed"][0]["data"].keys())
        html += _data_table_start(["Row #"] + cols)
        for rr in sd["rows_removed"]:
            cells = [esc(str(rr["row_number"]))] + [esc(rr["data"].get(c, "")) for c in cols]
            styles = [""] + [f"color:{C['red']};text-decoration:line-through;" for _ in cols]
            html += _data_table_row(cells, styles)
        html += _data_table_end()

    html += f'{_section_end()}</td></tr>'

# ── Footer ──
html += f'''
```

<!-- Footer -->

<tr><td style="text-align:center;padding:20px;color:{C['muted']};font-size:12px;font-family:{C['font']};">
  Generated by Excel Comparator (Content-Based, Email-Safe)
</td></tr>

</table><!-- /inner -->
</td></tr>
</table><!-- /outer -->
</body>
</html>'''

```
return html
```

# ──────────────────────────────────────────────

# Main

# ──────────────────────────────────────────────

def main():
parser = argparse.ArgumentParser(
description=“Compare two Excel (.xlsx) files and generate an email-safe HTML diff report.”
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

