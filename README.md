# ---- Merge/Backfill config ----
BACKUP_ROOT       = Path(r"C:\Backups")      # <— change to your backup root (searched recursively)
OUTPUT_ROOT       = Path(r"C:\Recovered")    # <— where merged files will be written
BUSINESS_DATE_COL = "BusinessDate"           # case-insensitive
FILENAME_TOKEN    = "MI_Input_"              # live/backup files contain this token
SCAN_TYPES        = {".csv", ".parquet"}     # extend if needed (xlsx needs openpyxl)


def _read_any_df(p: Path) -> pd.DataFrame:
    """Read CSV or Parquet into a DataFrame (dtype=str where possible)."""
    suf = p.suffix.lower()
    if suf == ".csv":
        return pd.read_csv(p, dtype=str, low_memory=False)
    if suf == ".parquet":
        return pd.read_parquet(p)
    raise ValueError(f"Unsupported file type: {p}")

def _case_insensitive_col(df: pd.DataFrame, wanted_lower: str) -> str | None:
    mapping = {c.lower(): c for c in df.columns}
    return mapping.get(wanted_lower)

def _glob_backup_for(project: str, target: str, child: str, date_str: str) -> Path | None:
    """
    Look under BACKUP_ROOT (recursively) for a file whose name ends with:
       {project}_{target}_{child}_MI_Input_{date}.{csv|parquet}
    Returns the FIRST match found (depth-first). If multiple exist, the first wins.
    """
    base = f"{project}_{target}_{child}_MI_Input_{date_str}"
    # try both types
    for ext in (".csv", ".parquet"):
        pattern = f"**/*{base}{ext}"  # allow prefixes before the base, but enforce the exact suffix
        for p in BACKUP_ROOT.rglob(pattern):
            if p.is_file():
                return p
    return None

def _read_live_concat(run_dir: Path) -> pd.DataFrame:
    """Concat every live MI_Input_* file in run_dir (csv/parquet). If none, return empty df."""
    frames = []
    for p in run_dir.iterdir():
        if not p.is_file():
            continue
        if FILENAME_TOKEN not in p.name:
            continue
        if p.suffix.lower() not in SCAN_TYPES:
            continue
        try:
            frames.append(_read_any_df(p))
        except Exception as e:
            print(f"[WARN] Skipping live file {p.name}: {e}")
    if not frames:
        return pd.DataFrame()
    # keep string types to avoid dtype chaos; drop dup rows
    live = pd.concat(frames, ignore_index=True)
    return live

def _append_missing_from_backups(live_df: pd.DataFrame,
                                 project: str, target: str, child: str,
                                 missing_dates: list[str]) -> pd.DataFrame:
    """
    For each missing date, read the matching backup file and append ONLY rows
    where BusinessDate == that date.
    """
    if live_df is None:
        live_df = pd.DataFrame()

    combined = [live_df] if not live_df.empty else []
    # we’ll learn BusinessDate column casing from either live or backup
    live_bcol = _case_insensitive_col(live_df, BUSINESS_DATE_COL.lower()) if not live_df.empty else None

    for d in missing_dates:
        bp = _glob_backup_for(project, target, child, d)
        if not bp:
            print(f"[MISS] No backup file for {project}/{target}/{child} on {d}")
            continue
        try:
            bdf = _read_any_df(bp)
        except Exception as e:
            print(f"[WARN] Failed to read backup {bp}: {e}")
            continue

        # find BusinessDate column (case-insensitive)
        bcol = _case_insensitive_col(bdf, BUSINESS_DATE_COL.lower())
        if not bcol:
            print(f"[WARN] Backup {bp.name} missing '{BUSINESS_DATE_COL}' column")
            continue

        # filter exactly that date
        bdf[bcol] = pd.to_datetime(bdf[bcol], errors="coerce").dt.strftime("%Y-%m-%d")
        add = bdf[bdf[bcol] == d]

        if add.empty:
            print(f"[NOTE] Backup {bp.name} has no rows for BusinessDate {d}")
            continue

        # If live has different column order, align on common superset
        if not live_df.empty:
            # union columns
            for col in add.columns:
                if col not in live_df.columns:
                    live_df[col] = pd.NA
            for col in live_df.columns:
                if col not in add.columns:
                    add[col] = pd.NA
            add = add[live_df.columns]  # align order
        combined.append(add)
        print(f"[OK] Appended {len(add)} rows from backup {bp.name} for {d}")

    if not combined:
        return pd.DataFrame()

    out = pd.concat(combined, ignore_index=True)

    # Drop exact-duplicate rows (all columns). If you prefer a key, replace with drop_duplicates(subset=[...])
    out = out.drop_duplicates()

    return out

def _write_merged(project: str, target: str, child: str, merged_df: pd.DataFrame, run_dir: Path):
    """
    Write merged file to OUTPUT_ROOT/<project>/<target>/<child>/Runfiles/merged_MI_Input.csv
    (preserves the same subtree as the live run_dir)
    """
    rel = run_dir  # run_dir is .../<project>/<target>/<child>/Runfiles
    # rebuild relative path starting at project
    # find project anchor inside run_dir.parts
    parts = list(run_dir.parts)
    try:
        anchor_idx = parts.index(project)
        rel_tail = Path(*parts[anchor_idx:])  # project/target/child/Runfiles
    except ValueError:
        # If we can't find project token, just stick to project/target/child/Runfiles
        rel_tail = Path(project) / target / child / "Runfiles"

    out_dir = OUTPUT_ROOT / rel_tail
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "merged_MI_Input.csv"
    merged_df.to_csv(out_file, index=False)
    print(f"[WRITE] {out_file}  (rows={len(merged_df)})")




# === Backfill & merge for this Runfiles path (only if there are missing weekday dates) ===
if missing:
    try:
        live_df = _read_live_concat(run_dir)  # reads all current MI_Input_* in this Runfiles
        merged_df = _append_missing_from_backups(
            live_df=live_df,
            project=project_name,
            target=target,
            child=child.name,
            missing_dates=missing
        )
        if not merged_df.empty:
            _write_merged(project_name, target, child.name, merged_df, run_dir)
        else:
            print(f"[NOTE] Nothing to write for {project_name}/{target}/{child.name} (no live+backup rows).")
    except Exception as e:
        print(f"[ERROR] Merge failed for {project_name}/{target}/{child.name}: {e}")


