#!/usr/bin/env python3
# Windows-only: Copy MI_Input_ files for a target BusinessDate from VSS (Previous Versions) into a custom folder.
# Run as Administrator.

import subprocess, shlex, sys, shutil, os
from pathlib import Path
from datetime import datetime
from typing import List, Set
import pandas as pd

# =======================
# CONFIG (EDIT THESE)
# =======================
RUNFILES_DIR      = Path(r"C:\Data\ProjectA\state\foo\Runfiles")   # the live Runfiles folder to mirror path from
TARGET_DATES      = ["2025-10-23"]                                  # list of missing BusinessDate(s), YYYY-MM-DD
OUT_DIR           = Path(r"C:\Recovered\Runfiles")                  # your custom destination folder
BUSINESS_DATE_COL = "BusinessDate"                                  # column name (case-insensitive)
FILENAME_TOKEN    = "MI_Input_"                                     # only scan files containing this token
DRIVE_LETTER      = "C:"                                            # drive containing RUNFILES_DIR (e.g., "C:")
SCAN_FILE_TYPES   = {".csv", ".parquet"}                            # which file types to consider
STOP_AT_FIRST_SNAPSHOT_WITH_MATCHES = True                          # True = copy from newest snapshot only

# =======================
# UTILITIES
# =======================

def _run_ps(cmd: str) -> str:
    proc = subprocess.run(["powershell", "-NoProfile", "-Command", cmd],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"PowerShell failed: {cmd}")
    return proc.stdout

def _run_cmd(cmd: str) -> str:
    proc = subprocess.run(shlex.split(cmd), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"Command failed: {cmd}")
    return proc.stdout

def list_shadow_roots_for_drive(drive_letter: str) -> List[str]:
    """
    Returns a list of Device roots like:
      \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy42\
    for the specified drive (e.g., "C:").
    Newest first.
    """
    out = _run_cmd("vssadmin list shadows")
    # We’ll collect Shadow Copy Volume lines and filter by drive using exposed OriginatingMachine/Volume info
    # Simpler approach: gather all Device paths in order, newest first (vssadmin prints newest first).
    lines = [l.strip() for l in out.splitlines()]
    roots = []
    cur_device = None
    cur_vol = None
    for line in lines:
        if line.startswith("Shadow Copy Volume:"):
            # E.g., Shadow Copy Volume: \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy42
            part = line.split(":", 1)[1].strip()
            cur_device = part if part.endswith("\\") else part + "\\"
        elif line.startswith("Original Volume:"):
            # E.g., Original Volume: (C:)\\?\Volume{...}\
            cur_vol = line
            if cur_device:
                if f"({drive_letter.upper()})" in cur_vol.upper():
                    roots.append(cur_device)
                cur_device = None
                cur_vol = None

    # vssadmin prints newest first already; keep as-is
    return roots

def snapshot_path_for(runfiles_dir: Path, shadow_root: str, drive_letter: str) -> Path:
    """
    Map a live path like C:\Data\X\Runfiles to a snapshot path like:
      \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy42\Data\X\Runfiles
    """
    drive = (drive_letter.upper() + "\\")
    p_str = str(runfiles_dir)
    if not p_str.upper().startswith(drive):
        raise ValueError(f"RUNFILES_DIR is not on {drive_letter}: {runfiles_dir}")
    rel = p_str[len(drive):]  # strip 'C:\'
    return Path(shadow_root) / rel

def read_business_dates_from_file(p: Path, want_col_lower: str) -> Set[str]:
    suffix = p.suffix.lower()
    dates: Set[str] = set()
    try:
        if suffix == ".csv":
            try:
                df = pd.read_csv(p, dtype=str, low_memory=False)
            except Exception:
                return dates
        elif suffix == ".parquet":
            try:
                df = pd.read_parquet(p)
            except Exception:
                return dates
        else:
            return dates

        # Case-insensitive column
        cols_lower = {c.lower(): c for c in df.columns}
        if want_col_lower not in cols_lower:
            return dates

        col = cols_lower[want_col_lower]
        s = pd.to_datetime(df[col], errors="coerce").dropna()
        for dt in s.dt.to_pydatetime():
            dates.add(dt.strftime("%Y-%m-%d"))
        return dates
    except Exception:
        return dates

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def copy_matches_from_snapshot_for_date(snapshot_runfiles: Path, target_date: str, out_dir: Path) -> List[Path]:
    """
    Scan snapshot Runfiles; copy files whose BusinessDate includes target_date into out_dir.
    Returns list of copied paths.
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
            ensure_dir(out_dir)
            dest = out_dir / f.name
            # If name clash, add suffix with snapshot id or date
            if dest.exists():
                stem, suffix = os.path.splitext(f.name)
                alt = out_dir / f"{stem}__from_snapshot__{target_date}{suffix}"
                shutil.copy2(f, alt)
                copied.append(alt)
            else:
                shutil.copy2(f, dest)
                copied.append(dest)
    return copied

# =======================
# MAIN
# =======================

def main():
    if not RUNFILES_DIR.exists():
        print(f"ERROR: RUNFILES_DIR not found: {RUNFILES_DIR}", file=sys.stderr)
        sys.exit(2)

    try:
        shadow_roots = list_shadow_roots_for_drive(DRIVE_LETTER)
    except Exception as e:
        print(f"ERROR: Could not list shadow copies. Are you running as Administrator? {e}", file=sys.stderr)
        sys.exit(2)

    if not shadow_roots:
        print("No Volume Shadow Copies found for this drive. Enable System Protection / Previous Versions.", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(shadow_roots)} snapshot(s). Scanning newest → oldest…\n")

    total_copied = 0
    for target_date in TARGET_DATES:
        print(f"== Target BusinessDate: {target_date} ==")
        date_copied = 0

        for idx, root in enumerate(shadow_roots, start=1):
            snap_path = snapshot_path_for(RUNFILES_DIR, root, DRIVE_LETTER)
            print(f"  [{idx}/{len(shadow_roots)}] Snapshot path: {snap_path}")
            copied = copy_matches_from_snapshot_for_date(
                snap_path,
                target_date,
                OUT_DIR / target_date  # put files per-date under your custom folder
            )
            if copied:
                for c in copied:
                    print(f"    Copied: {c}")
                date_copied += len(copied)
                total_copied += len(copied)
                if STOP_AT_FIRST_SNAPSHOT_WITH_MATCHES:
                    print("    (Stopping at first snapshot with matches for this date)")
                    break

        if date_copied == 0:
            print("    No matching files found in any snapshot for this date.")
        print()

    print(f"Done. Total files copied: {total_copied}")
    print(f"Destination root: {OUT_DIR.resolve()}")

if __name__ == "__main__":
    main()
