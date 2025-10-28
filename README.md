import os, sys, shutil, pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Set, Tuple, Optional

# ======================
# CONFIG
# ======================
RUNFILES_PATH = r"Y:\ProjectA\state\foo\RunFiles"    # your live Runfiles folder
TARGET_DATES  = ["2025-10-23"]                       # BusinessDate(s) to recover
OUT_DIR       = Path(r"C:\Recovered\Runfiles")       # where to copy recovered files
FILENAME_TOKEN = "MI_Input_"
BUSINESS_DATE_COL = "BusinessDate"
SCAN_FILE_TYPES = {".csv", ".parquet"}
# ======================

def find_gmt_snapshots_inside_parent(runfiles_path: str) -> List[str]:
    """List all @GMT-* folders inside the parent of Runfiles."""
    parent = os.path.dirname(runfiles_path.rstrip("\\/"))
    pattern = os.path.join(parent, "@GMT-*")
    cmd = f'cmd /c dir /b "{pattern}"'
    from subprocess import run
    proc = run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr or "Could not list @GMT snapshots")
    snaps = [os.path.join(parent, line.strip()) for line in proc.stdout.splitlines() if line.strip()]
    snaps.sort(reverse=True)
    return snaps

def read_business_dates(file_path: str) -> Set[str]:
    ext = os.path.splitext(file_path)[1].lower()
    dates: Set[str] = set()
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path, dtype=str, low_memory=False)
        elif ext == ".parquet":
            df = pd.read_parquet(file_path)
        else:
            return set()
        cols = {c.lower(): c for c in df.columns}
        if BUSINESS_DATE_COL.lower() not in cols:
            return set()
        s = pd.to_datetime(df[cols[BUSINESS_DATE_COL.lower()]], errors="coerce").dropna()
        for dt in s.dt.to_pydatetime():
            dates.add(dt.strftime("%Y-%m-%d"))
    except Exception:
        pass
    return dates

def copy_files_for_date(snapshot_runfiles: str, target_date: str, out_dir: Path) -> int:
    count = 0
    if not os.path.isdir(snapshot_runfiles):
        return 0
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in os.listdir(snapshot_runfiles):
        if FILENAME_TOKEN not in name:
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext not in SCAN_FILE_TYPES:
            continue
        src = os.path.join(snapshot_runfiles, name)
        dates = read_business_dates(src)
        if target_date in dates:
            dest = out_dir / name
            if dest.exists():
                base, suf = os.path.splitext(name)
                dest = out_dir / f"{base}__from_{os.path.basename(os.path.dirname(snapshot_runfiles))}{suf}"
            shutil.copy2(src, dest)
            print(f"  Copied {dest}")
            count += 1
    return count

def find_nearest_less_date(all_dates: Set[str], target: str) -> Optional[str]:
    less = [d for d in all_dates if d < target]
    return max(less) if less else None

def main():
    snaps = find_gmt_snapshots_inside_parent(RUNFILES_PATH)
    if not snaps:
        sys.exit("No @GMT snapshots found under Runfiles’ parent folder.")
    print(f"Found {len(snaps)} snapshots under {os.path.dirname(RUNFILES_PATH)}")

    total = 0
    for target_date in TARGET_DATES:
        print(f"\n== Checking for BusinessDate {target_date} ==")
        found = False
        fallback_date = None
        fallback_snap = None
        all_seen_dates: Set[str] = set()

        for snap in snaps:
            snap_runfiles = os.path.join(snap, "RunFiles")
            print(f"  Checking {snap_runfiles} ...")
            if not os.path.isdir(snap_runfiles):
                continue

            snap_dates: Set[str] = set()
            for name in os.listdir(snap_runfiles):
                if FILENAME_TOKEN not in name:
                    continue
                path = os.path.join(snap_runfiles, name)
                snap_dates |= read_business_dates(path)

            all_seen_dates |= snap_dates
            if target_date in snap_dates:
                print(f"    Found exact {target_date} in {snap}")
                copied = copy_files_for_date(snap_runfiles, target_date, OUT_DIR / target_date)
                total += copied
                found = True
                break
            else:
                less = find_nearest_less_date(snap_dates, target_date)
                if less and (fallback_date is None or less > fallback_date):
                    fallback_date = less
                    fallback_snap = snap

        if not found and fallback_date and fallback_snap:
            print(f"    No exact match; using previous BusinessDate {fallback_date} from {fallback_snap}")
            snap_runfiles = os.path.join(fallback_snap, "RunFiles")
            copied = copy_files_for_date(
                snap_runfiles,
                fallback_date,
                OUT_DIR / f"{target_date}_backfill_{fallback_date}"
            )
            total += copied

    print(f"\nDone. Total files copied: {total}\nDestination: {OUT_DIR.resolve()}")

if __name__ == "__main__":
    main()
