#!/usr/bin/env python3
"""
Build an inventory of all files under a source path and classify control type.

Rules (checked in order):
1) If filename contains 'comp' (case-insensitive) -> 'completeness'
2) Else if Excel file (.xlsx/.xlsm) contains a sheet named 'QARules' -> 'QA'
3) Else -> 'preprocess'

Usage:
  python build_control_inventory.py --src /path/to/root --out file_inventory.xlsx
"""

import argparse
import os
from pathlib import Path
import sys
import traceback
import pandas as pd

# Try to import openpyxl for Excel sheet detection
try:
    import openpyxl  # noqa: F401
    HAS_OPENPYXL = True
except Exception:
    HAS_OPENPYXL = False

EXCEL_EXTS = {".xlsx", ".xlsm"}  # keep to formats openpyxl handles reliably


def has_qarules_sheet(xl_path: Path) -> bool:
    """Return True if the Excel file contains a sheet named exactly 'QARules' (case-sensitive by default).
       Skips temporary files like '~$foo.xlsx'. Safely handles errors."""
    if not HAS_OPENPYXL:
        return False
    name = xl_path.name
    if name.startswith("~$"):
        return False
    try:
        # Read workbook sheet names without loading entire data
        with pd.ExcelFile(xl_path, engine="openpyxl") as xf:
            # Match exact sheet name 'QARules'; if you want case-insensitive, lower() both sides.
            return "QARules" in xf.sheet_names
    except Exception:
        # Corrupt or password-protected file, or not a real Excel -> treat as not having QARules
        return False


def control_type_for_file(path: Path) -> str:
    fname_lower = path.name.lower()

    # Rule 1: filename has 'comp'
    if "comp" in fname_lower:
        return "completeness"

    # Rule 2: Excel with sheet 'QARules'
    if path.suffix.lower() in EXCEL_EXTS:
        if has_qarules_sheet(path):
            return "QA"

    # Rule 3: default
    return "preprocess"


def build_inventory(src: Path):
    records = []
    for root, dirs, files in os.walk(src):
        for f in files:
            fp = Path(root) / f
            try:
                ctype = control_type_for_file(fp)
                records.append({
                    "file_path": str(fp.as_posix()),
                    "file_name": fp.name,
                    "ext": fp.suffix.lower(),
                    "control_type": ctype
                })
            except Exception as e:
                # Record the error but keep going
                records.append({
                    "file_path": str(fp.as_posix()),
                    "file_name": fp.name,
                    "ext": fp.suffix.lower(),
                    "control_type": "ERROR",
                    "error": f"{type(e).__name__}: {e}"
                })
    df = pd.DataFrame(records)
    # Stable ordering: by control_type then path
    df = df.sort_values(["control_type", "file_path"], kind="mergesort").reset_index(drop=True)
    return df


def main():
    parser = argparse.ArgumentParser(description="Create Excel inventory of files with control types.")
    parser.add_argument("--src", required=True, type=Path, help="Root folder to scan")
    parser.add_argument("--out", default="file_inventory.xlsx", type=Path, help="Output Excel file path")
    args = parser.parse_args()

    try:
        if not args.src.exists() or not args.src.is_dir():
            print(f"[ERROR] Source path does not exist or is not a directory: {args.src}", file=sys.stderr)
            sys.exit(2)

        df = build_inventory(args.src)

        # Write to Excel
        # Use engine openpyxl for broad compatibility
        with pd.ExcelWriter(args.out, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Inventory")
        print(f"[OK] Wrote {len(df):,} rows to {args.out}")
    except Exception:
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
