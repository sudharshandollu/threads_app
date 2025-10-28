#!/usr/bin/env python3
# SMB Previous Versions (@GMT snapshots) copier — NO ADMIN REQUIRED.
# Copies MI_Input_ files for given BusinessDate(s) from the newest server snapshot
# into your custom folder. Works for CSV/Parquet. Requires snapshot support on the SMB share.

import subprocess, shlex, sys, os, shutil
from pathlib import Path
from typing import List, Set
import pandas as pd

# =======================
# CONFIG — EDIT THESE
# =======================
SHARE_ROOT       = r"\\SERVER\Share"                      # e.g. r"\\filesrv01\deptdata"
RUNFILES_REL     = r"ProjectA\state\foo\Runfiles"         # path inside the share to Runfiles
TARGET_DATES     = ["2025-10-23"]                         # missing BusinessDate(s), YYYY-MM-DD
OUT_DIR          = Path(r"C:\Recovered\Runfiles")         # your custom destination
FILENAME_TOKEN   = "MI_Input_"                             # only consider files containing this token
BUSINESS_DATE_COL= "BusinessDate"                          # case-insensitive
SCAN_FILE_TYPES  = {".csv", ".parquet"}                    # extend if needed
STOP_AT_FIRST_SNAPSHOT_WITH_MATCHES = True                 # True = only the newest snapshot per date
# =======================

def _run_cmd(cmd: str) -> str:
    proc = subprocess.run(shlex.split(cmd), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"Command failed: {cmd}")
    return proc.stdout

def list_gmt_snapshots(share_root: str) -> List[str]:
    """
    Returns the list of @GMT-YYYY.MM.DD-HH.MM.SS snapshot names (newest → oldest)
    from the SMB share root. Works without admin if server exposes snapshots.
    """
    # Use cmd /c dir so Windows resolves the virtual @GMT-* dirs on the share
    pattern = fr'{share_root}\@GMT-*'
    out = _run_cmd(f'cmd /c dir /b "{pattern}"')
    # Each line is a full UNC path like \\SERVER\Share\@GMT-2025.10.23-12.00.03
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    # Sort descending by their string (works because format is lexicographically sortable by date-time)
    lines.sort(reverse=True)
    return lines

def snapshot_runfiles_path(gmt_path: str, runfiles_rel: str) -> Path:
    return Path(gmt_path) / runfiles_rel

def read_business_dates_from_file(p: Path, want_col_lower: str) -> Set[str]:
    dates: Set[str] = set()
    try:
        if p.suffix.lower() == ".csv":
            df = pd.read_csv(p, dtype=str, low_memory=False)
        elif p.suffix.lower() == ".parquet":
            df = pd.read_parquet(p)
        else:
            return dates
        cols_lower = {c.lower(): c for c in df.columns}
        if want_col_lower not in cols_lower:
            return dates
        col = cols_lower[want_col_lower]
        s = pd.to_datetime(df[col], errors="coerce").dropna()
        for dt in s.dt.to_pydatetime():
            dates.add(dt.strftime("%Y-%m-%d"))
    except Exception:
        # Swallow read errors; just treat as no dates.
        pass
    return dates

def copy_matches_for_date_from_snapshot(snapshot_runfiles: Path, target_date: str, out_dir: Path) -> List[Path]:
    """
    Scan snapshot Runfiles; copy files whose BusinessDate contains target_date into out_dir/target_date.
    """
    copied: List[Path] = []
    if not snapshot_runfiles.is_dir():
        return copied

    for f in snapshot_runfiles.iterdir():
        if not f.is_file():
            continue
        if FILENAME_TOKEN not in f.name:
            continue
        if f.suffix.lower() not in SCAN_FILE_TYPES:
            continue

        dates_in_file = read_business_dates_from_file(f, BUSINESS_DATE_COL.lower())
        if target_date in dates_in_file:
            dest_dir = out_dir / target_date
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / f.name
            # Avoid overwrite collisions
            if dest.exists():
                stem, suf = os.path.splitext(f.name)
                dest = dest_dir / f"{stem}__from_{snapshot_runfiles.parent.name}{suf}"
            shutil.copy2(f, dest)
            copied.append(dest)
    return copied

def main():
    # Validate share path
    live_runfiles = Path(SHARE_ROOT) / RUNFILES_REL
    print(f"Live path: {live_runfiles}")
    if not Path(SHARE_ROOT).exists():
        sys.exit(f"ERROR: Share root not accessible: {SHARE_ROOT}")
    # Listing snapshots
    try:
        gmt_paths = list_gmt_snapshots(SHARE_ROOT)
    except RuntimeError as e:
        sys.exit(
            f"ERROR: Could not enumerate @GMT snapshots. Details: {e}\n"
            f"- Ensure the file server has Shadow Copies enabled for this share.\n"
            f"- You must point SHARE_ROOT at the **share root** (e.g., \\\\SERVER\\Share)."
        )

    if not gmt_paths:
        sys.exit("No @GMT snapshots found on this share. Ask your admin to enable Shadow Copies for the share.")

    print(f"Found {len(gmt_paths)} snapshot(s) on {SHARE_ROOT}. Scanning newest → oldest...\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    grand_total = 0

    for date in TARGET_DATES:
        print(f"== Target BusinessDate: {date} ==")
        date_total = 0
        for idx, gmt in enumerate(gmt_paths, start=1):
            snap_runfiles = snapshot_runfiles_path(gmt, RUNFILES_REL)
            print(f"  [{idx}/{len(gmt_paths)}] {snap_runfiles}")
            copied = copy_matches_for_date_from_snapshot(snap_runfiles, date, OUT_DIR)
            if copied:
                for p in copied:
                    print(f"    Copied: {p}")
                date_total += len(copied)
                grand_total += len(copied)
                if STOP_AT_FIRST_SNAPSHOT_WITH_MATCHES:
                    print("    (Stopping at first snapshot with matches for this date)")
                    break
        if date_total == 0:
            print("    No matching files in any snapshot for this date.")
        print()

    print(f"Done. Total files copied: {grand_total}")
    print(f"Destination: {OUT_DIR.resolve()}")

if __name__ == "__main__":
    main()
