Project Preview link: http://threads-app-pink-five.vercel.app/



#!/usr/bin/env python3
"""
Hardcoded scan for MI_Input_ files; only count missing dates on weekdays (Mon–Fri).

Folder pattern under ROOT:
  <ROOT>/<PROJECT>/
      state/<ANY_SUBFOLDER>/Runfiles/<FILES...>
      message/<ANY_SUBFOLDER>/Runfiles/<FILES...>

Files of interest: filename must START with YYYY-MM-DD and contain "MI_Input_".
Example: 2025-10-23-xyz-MI_Input_foo.csv  ✅
"""

from __future__ import annotations
from pathlib import Path
from datetime import datetime, timedelta
import re
import csv

# =========================
# HARD-CODED CONFIG
# =========================
ROOT            = Path(r"/path/to/root")  # <- CHANGE ME
START_DATE_STR  = "2025-10-01"            # <- inclusive
END_DATE_STR    = "2025-10-28"            # <- inclusive
TARGETS         = ["state", "message"]    # subfolders to check
RUNFILES_NAME   = "Runfiles"
PREFIX_TOKEN    = "MI_Input_"
CSV_OUT         = None                    # e.g., Path("missing_weekdays_report.csv") or None to skip
# =========================

DATE_RE = re.compile(r'^(\d{4}-\d{2}-\d{2})')

def daterange(start: datetime, end: datetime):
    d = start
    one = timedelta(days=1)
    while d <= end:
        yield d
        d += one

def is_weekday(d: datetime) -> bool:
    # Monday=0 .. Sunday=6
    return d.weekday() < 5

def is_mi_input(name: str) -> bool:
    return bool(DATE_RE.match(name)) and (PREFIX_TOKEN in name)

def collect_present_dates(runfiles_dir: Path) -> set[str]:
    present = set()
    if not runfiles_dir.is_dir():
        return present
    for p in runfiles_dir.iterdir():
        if p.is_file():
            n = p.name
            if is_mi_input(n):
                m = DATE_RE.match(n)
                if m:
                    present.add(m.group(1))
    return present

def main():
    start_dt = datetime.strptime(START_DATE_STR, "%Y-%m-%d")
    end_dt   = datetime.strptime(END_DATE_STR,   "%Y-%m-%d")

    if not ROOT.is_dir():
        raise SystemExit(f"ERROR: Root not found or not a directory: {ROOT}")

    # Only expect weekdays (Mon–Fri)
    expected_dates = [d.strftime("%Y-%m-%d") for d in daterange(start_dt, end_dt) if is_weekday(d)]

    print(f"\nScanning: {ROOT}")
    print(f"Targets: {TARGETS}")
    print(f"Date range (weekdays only): {START_DATE_STR} .. {END_DATE_STR} (inclusive)")
    print(f"Runfiles folder: {RUNFILES_NAME}")
    print(f"Match token: {PREFIX_TOKEN}\n")

    projects = sorted([p for p in ROOT.iterdir() if p.is_dir()], key=lambda x: x.name)
    if not projects:
        print("No project folders under root. Done.")
        return

    rows_for_csv = []
    total_expected = 0
    total_missing  = 0

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
                present = collect_present_dates(run_dir)

                # Only consider expected weekday dates
                missing = [d for d in expected_dates if d not in present]

                total_expected += len(expected_dates)
                total_missing  += len(missing)

                print(f"{project_name} / {target} / {child.name}")
                print(f"  Runfiles: {run_dir} {'(OK)' if run_dir.is_dir() else '(MISSING)'}")
                print(f"  Present (weekday dates only): {len(present & set(expected_dates))} / {len(expected_dates)}")

                if missing:
                    preview = ", ".join(missing[:10])
                    more = f" (+{len(missing)-10} more)" if len(missing) > 10 else ""
                    print(f"  MISSING weekdays ({len(missing)}): {preview}{more}")
                else:
                    print("  MISSING weekdays: None")
                print()

                rows_for_csv.append((
                    project_name,
                    target,
                    child.name,
                    len(present & set(expected_dates)),
                    len(missing),
                    ";".join(missing)
                ))

    coverage = 0.0 if total_expected == 0 else (1 - total_missing / total_expected) * 100
    print("====== SUMMARY (Weekdays Only) ======")
    print(f"Expected weekday date-slots overall: {total_expected}")
    print(f"Missing overall:                    {total_missing}")
    print(f"Coverage:                           {coverage:.2f}%")

    if CSV_OUT:
        CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
        with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["Project", "Target", "ChildFolder", "PresentCount(Weekdays)", "MissingCount(Weekdays)", "MissingDates(Weekdays)"])
            w.writerows(rows_for_csv)
        print(f"\nCSV written: {CSV_OUT}")

if __name__ == "__main__":
    main()
