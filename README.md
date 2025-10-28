#!/usr/bin/env python3
"""
1️⃣  Discover all Runfiles folders.
2️⃣  For each Runfiles folder, find missing BusinessDates (weekdays only).
3️⃣  For each missing date:
      • Find backup file for that date (in BACKUP_ROOT)
      • Append those rows to the target file for that Runfiles path
4️⃣  Write merged CSV into OUTPUT_ROOT/<folder>_merged.csv
"""

import os, sys, pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

# ============================
# CONFIG – EDIT THESE PATHS
# ============================
RUNFILES_ROOT = Path(r"Y:\ProjectA")        # your live data root
BACKUP_ROOT   = Path(r"C:\Backups")         # where backup files live
OUTPUT_ROOT   = Path(r"C:\Recovered")       # where merged output will go
BUSINESS_DATE_COL = "BusinessDate"
FILENAME_TOKEN = "MI_Input_"
DATE_FMT = "%Y-%m-%d"

# ============================

def is_weekday(date_str: str) -> bool:
    try:
        d = datetime.strptime(date_str, DATE_FMT)
        return d.weekday() < 5  # 0-4 = Mon–Fri
    except Exception:
        return False

def find_all_runfiles_folders(root: Path):
    """Return all folders containing MI_Input_ files."""
    run_dirs = []
    for dirpath, _, files in os.walk(root):
        if any(FILENAME_TOKEN in f for f in files):
            run_dirs.append(Path(dirpath))
    return run_dirs

def get_all_dates_in_files(folder: Path):
    """Collect all BusinessDates present in MI_Input_ files in this folder."""
    dates = set()
    for file in folder.glob(f"*{FILENAME_TOKEN}*"):
        if file.suffix.lower() != ".csv":
            continue
        try:
            df = pd.read_csv(file, usecols=[BUSINESS_DATE_COL])
            s = pd.to_datetime(df[BUSINESS_DATE_COL], errors="coerce").dropna()
            for d in s.dt.strftime(DATE_FMT):
                dates.add(d)
        except Exception:
            continue
    return sorted(dates)

def date_range(start: str, end: str):
    """All weekdays between two ISO dates inclusive."""
    s, e = datetime.strptime(start, DATE_FMT), datetime.strptime(end, DATE_FMT)
    cur = s
    out = []
    while cur <= e:
        if cur.weekday() < 5:
            out.append(cur.strftime(DATE_FMT))
        cur += timedelta(days=1)
    return out

def merge_missing_from_backup(run_dir: Path, missing_dates: list[str]):
    out_dir = OUTPUT_ROOT / run_dir.relative_to(RUNFILES_ROOT)
    out_dir.mkdir(parents=True, exist_ok=True)
    merged_file = out_dir / "merged_MI_Input.csv"

    # Combine all live + backup data
    combined = []
    # live files first
    for f in run_dir.glob(f"*{FILENAME_TOKEN}*.csv"):
        try:
            combined.append(pd.read_csv(f))
        except Exception as e:
            print(f"⚠️ Skipping {f.name}: {e}")
    # backup for missing
    for date_str in missing_dates:
        backup_file = BACKUP_ROOT / f"MI_Input_{date_str}.csv"
        if backup_file.exists():
            try:
                df = pd.read_csv(backup_file)
                combined.append(df)
                print(f"  🟢 Added backup rows from {backup_file.name}")
            except Exception as e:
                print(f"  ⚠️ Could not read {backup_file.name}: {e}")
        else:
            print(f"  🔴 Backup missing for {date_str}")

    if not combined:
        print("  ⚠️ No data combined.")
        return

    merged = pd.concat(combined, ignore_index=True).drop_duplicates()
    merged.to_csv(merged_file, index=False)
    print(f"✅ Merged file written: {merged_file}")

def main():
    run_dirs = find_all_runfiles_folders(RUNFILES_ROOT)
    print(f"Found {len(run_dirs)} Runfiles folders.")
    for run_dir in run_dirs:
        print(f"\n📂 Checking {run_dir}")
        dates = get_all_dates_in_files(run_dir)
        if not dates:
            print("  ⚠️ No dates found in files here.")
            continue

        all_weekdays = date_range(min(dates), max(dates))
        missing = [d for d in all_weekdays if d not in dates and is_weekday(d)]
        if missing:
            print(f"  Missing {len(missing)} weekday(s): {', '.join(missing)}")
            merge_missing_from_backup(run_dir, missing)
        else:
            print("  ✅ No missing weekdays.")

if __name__ == "__main__":
    main()
