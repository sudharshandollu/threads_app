#!/usr/bin/env python3
"""
Scan a source directory recursively and build an Excel inventory of files
with classified control types.

Control Type Rules:
1) If filename contains 'comp' (case-insensitive) → 'completeness'
2) Else if Excel file (.xlsx/.xlsm) has a sheet named 'QARules' → 'QA'
3) Else → 'preprocess'
"""

import os
from pathlib import Path
import pandas as pd
import traceback

# --------------------------------------------------------------------
# Hardcoded paths — update these
# --------------------------------------------------------------------
SRC_DIR = Path(r"D:\Projects\DataControls")      # Change this to your root directory
OUT_FILE = Path(r"D:\Projects\file_inventory.xlsx")  # Output Excel file

# --------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------
EXCEL_EXTS = {".xlsx", ".xlsm"}

try:
    import openpyxl  # noqa
    HAS_OPENPYXL = True
except Exception:
    HAS_OPENPYXL = False


def has_qarules_sheet(xl_path: Path) -> bool:
    """Check if Excel file contains sheet 'QARules'."""
    if not HAS_OPENPYXL or xl_path.name.startswith("~$"):
        return False
    try:
        with pd.ExcelFile(xl_path, engine="openpyxl") as xf:
            return "QARules" in xf.sheet_names
    except Exception:
        return False


def control_type_for_file(path: Path) -> str:
    """Determine control type for a given file path."""
    name_lower = path.name.lower()
    if "comp" in name_lower:
        return "completeness"
    if path.suffix.lower() in EXCEL_EXTS and has_qarules_sheet(path):
        return "QA"
    return "preprocess"


def build_inventory(src: Path) -> pd.DataFrame:
    """Walk directory tree and collect file metadata."""
    records = []
    for root, _, files in os.walk(src):
        for file in files:
            fp = Path(root) / file
            try:
                ctrl_type = control_type_for_file(fp)
                records.append({
                    "file_path": str(fp),
                    "file_name": fp.name,
                    "extension": fp.suffix.lower(),
                    "control_type": ctrl_type
                })
            except Exception as e:
                records.append({
                    "file_path": str(fp),
                    "file_name": fp.name,
                    "extension": fp.suffix.lower(),
                    "control_type": "ERROR",
                    "error": f"{type(e).__name__}: {e}"
                })
    df = pd.DataFrame(records)
    return df.sort_values(["control_type", "file_path"], kind="mergesort").reset_index(drop=True)


def main():
    try:
        if not SRC_DIR.exists() or not SRC_DIR.is_dir():
            print(f"[ERROR] Source path invalid: {SRC_DIR}")
            return
        df = build_inventory(SRC_DIR)
        with pd.ExcelWriter(OUT_FILE, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Inventory")
        print(f"[OK] Inventory written to {OUT_FILE} ({len(df)} rows)")
    except Exception:
        traceback.print_exc()


if __name__ == "__main__":
    main()
