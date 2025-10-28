#!/usr/bin/env python3
"""
Scan each <project>/<state|message>/<child>/Runfiles for files whose names contain "MI_Input_".
Open those files, read the BusinessDate column, and compute missing WEEKDAY dates between
START_DATE and END_DATE (inclusive). Prints per-path results and optionally writes a CSV.

Output CSV columns (same structure as before):
  Project, Target, ChildFolder, RunfilesPath, RunfilesExists,
  PresentCount(Weekdays), MissingCount(Weekdays), MissingDates(Weekdays)

Notes:
- Only Monday–Friday dates are considered "expected".
- A Runfiles folder missing => all expected weekdays are missing.
- If a file lacks BusinessDate, it's ignored (with a warning). If all files lack it, all dates are missing.
- Supports CSV and Parquet out-of-the-box. Excel is best avoided (install openpyxl if needed).
"""

from __future__ import annotations
from pathlib import Path
from datetime import datetime, timedelta
import re
import csv
import sys
from typing import Set, List

import pandas as pd

# =========================
# HARD-CODED CONFIG
# =========================
ROOT            = Path(r"/path/to/root")  # <- CHANGE ME
START_DATE_STR  = "2025-10-01"            # <- inclusive
END_DATE_STR    = "2025-10-28"            # <- inclusive
TARGETS         = ["state", "message"]    # subfolders to check
RUNFILES_NAME   = "Runfiles"
PREFIX_TOKEN    = "MI_Input_"             # file name must CONTAIN this token
BUSINESS_DATE_COL = "BusinessDate"        # column to read inside MI_Input files (case-insensitive)
CSV_OUT         = None                    # e.g., Path("missing_weekdays_report.csv") or None to skip
# =========================

DATE_PREFIX_RE = re.compile(r'^(\d{4}-\d{2}-\d{2})')  # not required anymore, left for reference

def daterange(start: datetime, end: datetime):
    d = start
    one = timedelta(days=1)
    while d <= end:
        yield d
        d += one

def is_weekday(d: datetime) -> bool:
    # Monday=0 .. Sunday=6
    return d.weekday() < 5

def normalize_colnames(cols):
    return {c: c.lower() for c in cols}

def read_business_dates_from_file(p: Path, want_col_lower: str) -> Set[str]:
    """
    Read BusinessDate values from a single file.
    Returns a set of 'YYYY-MM-DD' strings observed in the file.
    Supports: .csv, .parquet (and tries .xlsx if openpyxl available).
    Any parsing errors or missing column => safely ignored with a warning.
    """
    present: Set[str] = set()
    suffix = p.suffix.lower()

    try:
        if suffix in (".csv", ".txt"):
            # Try reading only the needed column, but if it fails, fallback.
            try:
                df = pd.read_csv(p, usecols=[BUSINESS_DATE_COL], dtype=str)
            except Exception:
                df = pd.read_csv(p, dtype=str, low_memory=False)
        elif suffix in (".parquet",):
            try:
                df = pd.read_parquet(p, columns=[BUSINESS_DATE_COL])
            except Exception:
                df = pd.read_parquet(p)
        elif suffix in (".xlsx", ".xls"):
            try:
                df = pd.read_excel(p, dtype=str)
            except Exception as e:
                print(f"[WARN] Failed to read Excel {p}: {e}", file=sys.stderr)
                return present
        else:
            # Unsupported type; skip quietly
            return present

        # Case-insensitive pick of BusinessDate
        cols_lower = {c.lower(): c for c in df.columns}
        if want_col_lower not in cols_lower:
            print(f"[WARN] {p.name} missing '{BUSINESS_DATE_COL}' column; skipping.", file=sys.stderr)
            return present

        colname = cols_lower[want_col_lower]
        # Parse to datetime safely, drop invalids
        s = pd.to_datetime(df[colname], errors="coerce", utc=False).dropna()
        # Normalize to 'YYYY-MM-DD' strings
        present = set(dt.strftime("%Y-%m-%d") for dt in s.dt.to_pydatetime())
        return present

    except Exception as e:
        print(f"[WARN] Failed to read {p}: {e}", file=sys.stderr)
        return present

def collect_present_dates_from_runfiles(runfiles_dir: Path) -> Set[str]:
    """
    Iterate all files in Runfiles whose names contain PREFIX_TOKEN.
    Union all BusinessDate values found across files.
    """
    present: Set[str] = set()
    if not runfiles_dir.is_dir():
        return present

    for p in runfiles_dir.iterdir():
        if p.is_file() and (PREFIX_TOKEN in p.name):
            dates_in_file = read_business_dates_from_file(p, BUSINESS_DATE_COL.lower())
            present |= dates_in_file

    return present

def main():
    start_dt = datetime.strptime(START_DATE_STR, "%Y-%m-%d")
    end_dt   = datetime.strptime(END_DATE_STR,   "%Y-%m-%d")

    if not ROOT.is_dir():
        raise SystemExit(f"ERROR: Root not found or not a directory: {ROOT}")

    # Only expected weekdays
    expected_dates: List[str] = [d.strftime("%Y-%m-%d") for d in daterange(start_dt, end_dt) if is_weekday(d)]
    expected_set = set(expected_dates)

    print(f"\nScanning: {ROOT}")
    print(f"Targets: {TARGETS}")
    print(f"Date range (weekdays only): {START_DATE_STR} .. {END_DATE_STR} (inclusive)")
    print(f"Runfiles folder: {RUNFILES_NAME}")
    print(f"Match token in filename: {PREFIX_TOKEN}")
    print(f"Reading column: {BUSINESS_DATE_COL}\n")

    projects = sorted([p for p in ROOT.iterdir() if p.is_dir()], key=lambda x: x.name)
    if not projects:
        print("No project folders under root. Done.")
        return

    rows_for_csv = []
    total_expected = 0
    total_missing  = 0
    runfiles_missing_rows = []  # list of (full_path, missing_count, missing_dates_str)

    for project in projects:
        project_name = project.name
        for target in TARGETS:
            target_dir = project / target
            if not target_dir.is_dir():
                print(f"[WARN] Missing target dir: {target_dir}")
                continue

            child_dirs = sorted([c for c in target_dir.iterdir() if c.is_dir()], key=lambda x: x.name)
            if not child_dirs:
                print(f"[WARN] No child folders inside: {target_dir}")
                continue

            for child in child_dirs:
                run_dir = child / RUNFILES_NAME
                run_dir_path = run_dir.absolute()
                runfiles_exists = run_dir.is_dir()

                if runfiles_exists:
                    present_all = collect_present_dates_from_runfiles(run_dir)
                    # Only count dates falling within expected weekdays
                    present_weekdays = present_all & expected_set
                    missing = [d for d in expected_dates if d not in present_weekdays]
                else:
                    present_weekdays = set()
                    missing = expected_dates[:]

                total_expected += len(expected_dates)
                total_missing  += len(missing)

                print(f"Path: {run_dir_path}")
                print(f"  Runfiles exists: {'YES' if runfiles_exists else 'NO'}")
                print(f"  Present BusinessDate (weekday range): {len(present_weekdays)} / {len(expected_dates)}")

                if missing:
                    preview = ", ".join(missing[:10])
                    more = f" (+{len(missing)-10} more)" if len(missing) > 10 else ""
                    print(f"  TOTAL MISSING (weekdays): {len(missing)}")
                    print(f"  MISSING DATES (weekdays): {preview}{more}")
                else:
                    print("  TOTAL MISSING (weekdays): 0")
                    print("  MISSING DATES (weekdays): None")
                print()

                rows_for_csv.append((
                    project_name,
                    target,
                    child.name,
                    str(run_dir_path),
                    'YES' if runfiles_exists else 'NO',
                    len(present_weekdays),
                    len(missing),
                    ";".join(missing)
                ))

                if not runfiles_exists:
                    runfiles_missing_rows.append((
                        str(run_dir_path),
                        len(missing),
                        ";".join(missing)
                    ))

    coverage = 0.0 if total_expected == 0 else (1 - total_missing / total_expected) * 100
    print("====== SUMMARY (Weekdays Only, from BusinessDate) ======")
    print(f"Expected weekday date-slots overall: {total_expected}")
    print(f"Missing overall:                    {total_missing}")
    print(f"Coverage:                           {coverage:.2f}%")

    if runfiles_missing_rows:
        print("\n====== RUNFILES MISSING SUMMARY ======")
        for full_path, miss_count, miss_dates in runfiles_missing_rows:
            dates_list = miss_dates.split(";") if miss_dates else []
            preview = ", ".join(dates_list[:10])
            more = f" (+{len(dates_list)-10} more)" if len(dates_list) > 10 else ""
            print(f"{full_path}")
            print(f"  TOTAL MISSING (weekdays): {miss_count}")
            print(f"  MISSING DATES (weekdays): {preview}{more}\n")

    if CSV_OUT:
        CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
        with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow([
                "Project",
                "Target",
                "ChildFolder",
                "RunfilesPath",
                "RunfilesExists",
                "PresentCount(Weekdays)",
                "MissingCount(Weekdays)",
                "MissingDates(Weekdays)"
            ])
            w.writerows(rows_for_csv)
        print(f"\nCSV written: {CSV_OUT}")

if __name__ == "__main__":
    main()
