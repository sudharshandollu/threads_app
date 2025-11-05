#!/usr/bin/env python3
"""
Hardcoded configuration:
- Scans SOURCE_DIR for files.
- For each item prefix in ITEMS, reads all files starting with that prefix.
- Keeps only common columns across matched files (per item).
- Drops exact duplicates, then (if composite key is configured) dedups by that key.
- Writes one Excel sheet per item to OUTPUT_XLSX, plus a Summary sheet.

Supported file types: .csv, .xlsx/.xls (first sheet), .parquet
"""

from pathlib import Path
from typing import Dict, List, Tuple
import sys
import pandas as pd

# ========= EDIT THIS CONFIG BLOCK =========
SOURCE_DIR   = "/path/to/input/folder"            # e.g., "C:/data" or "/home/user/data"
OUTPUT_XLSX  = "/path/to/output/merged_per_item.xlsx"
KEEP_WHICH   = "last"  # 'first' or 'last' when duplicate rows share a key

# Items mapping: item prefix -> list of columns forming the composite key.
# Use [] (or leave key out) to skip key-based de-dup (row-level de-dup still runs).
ITEMS: Dict[str, List[str]] = {
    "ITEMA": ["id", "date"],
    "ITEMB": ["order_id", "sku"],
    "ITEMC": []  # no composite key; only exact-row de-dup
}
# =========================================

SUPPORTED_EXTS = {".csv", ".xlsx", ".xls", ".parquet"}

def find_files_for_item(root: Path, item: str) -> List[Path]:
    files = []
    for p in root.iterdir():
        if p.is_file() and p.name.startswith(item) and p.suffix.lower() in SUPPORTED_EXTS:
            files.append(p)
    return sorted(files)

def load_df(path: Path) -> pd.DataFrame:
    ext = path.suffix.lower()
    if ext == ".csv":
        return pd.read_csv(path)
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(path)  # first sheet
    elif ext == ".parquet":
        return pd.read_parquet(path)
    else:
        raise ValueError(f"Unsupported file type: {path}")

def normalize_sheet_name(name: str) -> str:
    # Excel sheet limit 31 chars; replace forbidden chars
    forbidden = '[]:*?/\\'
    for ch in forbidden:
        name = name.replace(ch, "_")
    return name[:31]

def common_columns(dfs: List[pd.DataFrame]) -> List[str]:
    if not dfs:
        return []
    common = set(dfs[0].columns)
    for df in dfs[1:]:
        common &= set(df.columns)
    # preserve first DF's order
    return [c for c in dfs[0].columns if c in common]

def merge_for_item(files: List[Path], keep: str) -> Tuple[pd.DataFrame, List[str]]:
    dfs = []
    for f in files:
        try:
            df = load_df(f)
            dfs.append(df)
        except Exception as e:
            print(f"[WARN] Failed to read {f}: {e}", file=sys.stderr)
    if not dfs:
        return pd.DataFrame(), []

    cols = common_columns(dfs)
    if not cols:
        print("[WARN] No common columns across files; skipping concat.", file=sys.stderr)
        return pd.DataFrame(), []

    merged = pd.concat([df[cols] for df in dfs], ignore_index=True)
    merged.columns = [str(c).strip() for c in merged.columns]
    merged = merged.drop_duplicates(keep=keep)
    return merged, cols

def main():
    src = Path(SOURCE_DIR)
    out = Path(OUTPUT_XLSX)
    keep = KEEP_WHICH

    if not src.exists() or not src.is_dir():
        print(f"[ERROR] SOURCE_DIR not found or not a directory: {src}", file=sys.stderr)
        sys.exit(2)

    out.parent.mkdir(parents=True, exist_ok=True)

    writer = pd.ExcelWriter(out, engine="xlsxwriter")
    summary_rows = []

    for item, key_cols in ITEMS.items():
        files = find_files_for_item(src, item)
        print(f"[INFO] Item={item}: {len(files)} file(s) matched in {src}")
        if not files:
            pd.DataFrame().to_excel(writer, sheet_name=normalize_sheet_name(item), index=False)
            summary_rows.append({"item": item, "files": 0, "rows_in": 0, "rows_out": 0, "common_cols": ""})
            continue

        merged, cols = merge_for_item(files, keep=keep)
        rows_in = int(merged.shape[0])

        # If composite key provided for this item, drop duplicates on those key columns
        if key_cols:
            missing = [c for c in key_cols if c not in merged.columns]
            if missing:
                print(f"[WARN] Item={item}: key columns missing from common columns: {missing}; skipping key-based de-dup.", file=sys.stderr)
            else:
                before = merged.shape[0]
                merged = merged.drop_duplicates(subset=key_cols, keep=keep)
                after = merged.shape[0]
                print(f"[INFO] Item={item}: key de-dup on {key_cols}: {before}->{after}")

        # Write per-item sheet
        merged.to_excel(writer, sheet_name=normalize_sheet_name(item), index=False)

        summary_rows.append({
            "item": item,
            "files": len(files),
            "rows_in": rows_in,
            "rows_out": int(merged.shape[0]),
            "common_cols": ",".join(cols)
        })

    if summary_rows:
        pd.DataFrame(summary_rows).to_excel(writer, sheet_name=normalize_sheet_name("Summary"), index=False)

    writer.close()
    print(f"[OK] Wrote Excel: {out}")

if __name__ == "__main__":
    main()
