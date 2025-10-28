#!/usr/bin/env python3
"""
Compare a target file with a backup file and create a new merged output file
that includes all rows from the target + missing rows from backup.

Assumes both files have the same structure (same columns).
"""

import pandas as pd
from pathlib import Path

# ======================
# CONFIG — EDIT THESE
# ======================
BACKUP_FILE = Path(r"C:\Data\Backup\MI_Input_2025-10-23.csv")
TARGET_FILE = Path(r"C:\Data\Target\MI_Input_2025-10-23.csv")
OUTPUT_FILE = Path(r"C:\Data\Merged\MI_Input_2025-10-23_Merged.csv")

# Columns that uniquely identify a row (to detect missing data)
UNIQUE_KEYS = ["BusinessDate", "OrderID", "CustomerID"]  # adjust based on your schema

# ======================

def main():
    print(f"🔍 Reading target file: {TARGET_FILE}")
    target_df = pd.read_csv(TARGET_FILE)
    print(f"✅ Target file loaded with {len(target_df)} rows.")

    print(f"🔍 Reading backup file: {BACKUP_FILE}")
    backup_df = pd.read_csv(BACKUP_FILE)
    print(f"✅ Backup file loaded with {len(backup_df)} rows.")

    # Ensure both DataFrames have the same structure
    common_cols = [c for c in target_df.columns if c in backup_df.columns]
    target_df = target_df[common_cols]
    backup_df = backup_df[common_cols]

    print("🔎 Checking for missing rows in target...")
    # Merge on UNIQUE_KEYS to find which rows are missing from target
    merged = backup_df.merge(
        target_df,
        on=UNIQUE_KEYS,
        how="left",
        indicator=True
    )

    missing_rows = merged[merged["_merge"] == "left_only"][common_cols]
    print(f"🟡 Found {len(missing_rows)} missing rows in target.")

    # Combine target + missing rows from backup
    combined_df = pd.concat([target_df, missing_rows], ignore_index=True)
    combined_df = combined_df.drop_duplicates(subset=UNIQUE_KEYS)

    # Save result
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    combined_df.to_csv(OUTPUT_FILE, index=False)

    print(f"✅ Merged file created: {OUTPUT_FILE}")
    print(f"Total rows in merged file: {len(combined_df)}")

if __name__ == "__main__":
    main()
