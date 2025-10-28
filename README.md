def _read_any_df(p: Path) -> pd.DataFrame:
    suf = p.suffix.lower()
    if suf == ".csv":
        return pd.read_csv(p, dtype=str, low_memory=False)
    if suf == ".parquet":
        return pd.read_parquet(p)
    raise ValueError(f"Unsupported file type: {p}")

def _case_insensitive_col(df: pd.DataFrame, wanted_lower: str) -> str | None:
    return {c.lower(): c for c in df.columns}.get(wanted_lower)

def _read_live_concat(run_dir: Path) -> pd.DataFrame:
    frames = []
    for p in run_dir.iterdir():
        if p.is_file() and FILENAME_TOKEN in p.name and p.suffix.lower() in SCAN_TYPES:
            try:
                frames.append(_read_any_df(p))
            except Exception as e:
                print(f"[WARN] Skipping live {p.name}: {e}")
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

def _glob_all_backups_for_path(project: str, target: str, child: str) -> list[Path]:
    """
    Find ALL backup files for this Runfiles path, regardless of date.
    Pattern: **/*{project}_{target}_{child}_MI_Input_*.{csv|parquet}
    """
    base = f"{project}_{target}_{child}_MI_Input_"
    hits = []
    for ext in (".csv", ".parquet"):
        for p in BACKUP_ROOT.rglob(f"**/*{base}*{ext}"):
            if p.is_file():
                hits.append(p)
    return hits

def _append_missing_from_backups_bulk(live_df: pd.DataFrame,
                                      project: str, target: str, child: str,
                                      missing_dates: list[str]) -> pd.DataFrame:
    """
    ONE-SHOT bulk merge:
      - read ALL backups for (project/target/child)
      - filter backup rows where BusinessDate ∈ missing_dates
      - combine with ALL live rows
      - align columns, drop duplicates, return merged df
    """
    if not missing_dates:
        return live_df.copy()

    missing_set = set(missing_dates)

    # --- live data (may be empty)
    live = live_df.copy() if live_df is not None else pd.DataFrame()

    # --- read all backups for this path
    backups = _glob_all_backups_for_path(project, target, child)
    if not backups:
        print(f"[MISS] No backup files found for {project}/{target}/{child}")
        return live if not live.empty else pd.DataFrame()

    # union of all matching backup rows (only missing dates)
    b_frames = []
    for bp in backups:
        try:
            df = _read_any_df(bp)
        except Exception as e:
            print(f"[WARN] Failed to read backup {bp}: {e}")
            continue
        bcol = _case_insensitive_col(df, BUSINESS_DATE_COL.lower())
        if not bcol:
            print(f"[WARN] Backup {bp.name} missing '{BUSINESS_DATE_COL}'")
            continue
        # normalize to YYYY-MM-DD and keep only missing dates
        ser = pd.to_datetime(df[bcol], errors="coerce").dt.strftime("%Y-%m-%d")
        mask = ser.isin(missing_set)
        if mask.any():
            add = df.loc[mask].copy()
            # normalize column to canonical name if casing differs
            if bcol != BUSINESS_DATE_COL:
                add.rename(columns={bcol: BUSINESS_DATE_COL}, inplace=True)
            b_frames.append(add)

    # nothing to add? return live as-is
    if not b_frames:
        print(f"[NOTE] No rows in backups for missing dates ({project}/{target}/{child})")
        return live if not live.empty else pd.DataFrame()

    back_missing = pd.concat(b_frames, ignore_index=True)

    # --- align schemas: union columns, same order
    if live.empty:
        merged = back_missing
    else:
        # add any missing columns on both sides
        for col in back_missing.columns:
            if col not in live.columns:
                live[col] = pd.NA
        for col in live.columns:
            if col not in back_missing.columns:
                back_missing[col] = pd.NA
        back_missing = back_missing[live.columns]
        merged = pd.concat([live, back_missing], ignore_index=True)

    # dedupe across all columns (change 'subset=[...]' if you prefer a key)
    merged = merged.drop_duplicates()
    return merged

def _write_merged(project: str, target: str, child: str, merged_df: pd.DataFrame, run_dir: Path):
    """
    Write to OUTPUT_ROOT/<project>/<target>/<child>/Runfiles/merged_MI_Input.csv
    (mirrors the live subtree).
    """
    parts = list(run_dir.parts)
    try:
        anchor = parts.index(project)
        rel_tail = Path(*parts[anchor:])  # project/target/child/Runfiles
    except ValueError:
        rel_tail = Path(project) / target / child / "Runfiles"
    out_dir = OUTPUT_ROOT / rel_tail
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "merged_MI_Input.csv"
    merged_df.to_csv(out_file, index=False)
    print(f"[WRITE] {out_file} (rows={len(merged_df)})")
