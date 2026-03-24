“””
PGP File Processor
Picks up latest PGP files from a source folder, decrypts them,
unzips the contents, and renames the extracted files.

Requirements:
- pgp_decrypt.py (the decryptor script) in the same directory
“””

import os
import glob
import zipfile
import shutil
from datetime import datetime

from pgp_decrypt import decrypt_pgp_file

# ============================================================

# CONFIGURE THESE VALUES

# ============================================================

SOURCE_FOLDER = r”C:\data\pgp_files”        # Folder containing .pgp files
DECRYPTED_FOLDER = r”C:\data\decrypted”      # Folder for decrypted output
UNZIPPED_FOLDER = r”C:\data\unzipped”        # Folder for unzipped files
PRIVATE_KEY_FILE = r”C:\keys\private.key”    # Path to your private key
PASSPHRASE = “your_passphrase_here”          # Passphrase for the private key

# File extensions to pick up (add more if needed)

PGP_EXTENSIONS = [”*.pgp”, “*.gpg”, “*.asc”, “*.enc”]

# How many latest files to process (set to None for all files)

LATEST_N_FILES = None

# Rename pattern for extracted files

# Available placeholders: {original}, {date}, {timestamp}, {index}

RENAME_PATTERN = “{date}_{original}”

# ============================================================

def ensure_folders():
“”“Create output folders if they don’t exist.”””
for folder in [DECRYPTED_FOLDER, UNZIPPED_FOLDER]:
os.makedirs(folder, exist_ok=True)
print(f”Output folder ready: {folder}”)

def get_latest_pgp_files(source_folder, extensions, n=None):
“””
Get PGP files from source folder, sorted by modification time (newest first).

```
Args:
    source_folder: Path to the folder containing PGP files
    extensions:    List of glob patterns (e.g., ["*.pgp", "*.gpg"])
    n:             Number of latest files to return (None = all)

Returns:
    List of file paths sorted newest first
"""
all_files = []
for ext in extensions:
    pattern = os.path.join(source_folder, ext)
    all_files.extend(glob.glob(pattern))

# Remove duplicates and sort by modification time (newest first)
all_files = list(set(all_files))
all_files.sort(key=os.path.getmtime, reverse=True)

if n is not None:
    all_files = all_files[:n]

return all_files
```

def unzip_file(zip_path, output_folder):
“””
Unzip a file to the output folder.

```
Args:
    zip_path:      Path to the zip file
    output_folder: Folder to extract contents into

Returns:
    List of extracted file paths
"""
extracted_files = []

if not zipfile.is_zipfile(zip_path):
    print(f"  Not a zip file: {zip_path}")
    # If it's not a zip, just copy it to the output folder
    dest = os.path.join(output_folder, os.path.basename(zip_path))
    shutil.copy2(zip_path, dest)
    extracted_files.append(dest)
    return extracted_files

with zipfile.ZipFile(zip_path, "r") as zf:
    print(f"  Zip contents: {zf.namelist()}")
    zf.extractall(output_folder)
    for name in zf.namelist():
        full_path = os.path.join(output_folder, name)
        if os.path.isfile(full_path):
            extracted_files.append(full_path)

return extracted_files
```

def rename_files(file_paths, pattern):
“””
Rename files using the given pattern.

```
Args:
    file_paths: List of file paths to rename
    pattern:    Rename pattern with placeholders:
                {original} - original filename (without extension)
                {ext}      - original extension
                {date}     - current date (YYYYMMDD)
                {timestamp}- current timestamp (YYYYMMDD_HHMMSS)
                {index}    - file index (1, 2, 3...)

Returns:
    List of renamed file paths
"""
renamed = []
now = datetime.now()
date_str = now.strftime("%Y%m%d")
timestamp_str = now.strftime("%Y%m%d_%H%M%S")

for i, filepath in enumerate(file_paths, start=1):
    directory = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    name, ext = os.path.splitext(filename)

    new_name = pattern.format(
        original=name,
        ext=ext,
        date=date_str,
        timestamp=timestamp_str,
        index=i
    )

    # Keep the original extension if not included in pattern
    if not os.path.splitext(new_name)[1]:
        new_name += ext

    new_path = os.path.join(directory, new_name)

    # Avoid overwriting — add suffix if file exists
    if os.path.isfile(new_path):
        base, ext2 = os.path.splitext(new_path)
        new_path = f"{base}_{i}{ext2}"

    os.rename(filepath, new_path)
    print(f"  Renamed: {filename} -> {os.path.basename(new_path)}")
    renamed.append(new_path)

return renamed
```

def process_pgp_files():
“””
Main processing pipeline:
1. Find latest PGP files from source folder
2. Decrypt each file
3. Unzip decrypted files
4. Rename extracted files
“””
print(”=” * 60)
print(“PGP File Processor”)
print(”=” * 60)

```
ensure_folders()

# --- Step 1: Get latest PGP files ---
print(f"\n--- Finding PGP files in: {SOURCE_FOLDER} ---")
pgp_files = get_latest_pgp_files(SOURCE_FOLDER, PGP_EXTENSIONS, LATEST_N_FILES)

if not pgp_files:
    print("No PGP files found in source folder.")
    return

print(f"Found {len(pgp_files)} file(s):")
for f in pgp_files:
    mod_time = datetime.fromtimestamp(os.path.getmtime(f)).strftime("%Y-%m-%d %H:%M:%S")
    print(f"  {os.path.basename(f)} (modified: {mod_time})")

# --- Process each file ---
all_final_files = []

for pgp_file in pgp_files:
    print(f"\n{'=' * 60}")
    print(f"Processing: {os.path.basename(pgp_file)}")
    print("=" * 60)

    # Step 2: Decrypt
    base_name = os.path.splitext(os.path.basename(pgp_file))[0]
    decrypted_path = os.path.join(DECRYPTED_FOLDER, base_name)

    print(f"\n  [1/3] Decrypting...")
    success = decrypt_pgp_file(
        encrypted_file=pgp_file,
        output_file=decrypted_path,
        key_file=PRIVATE_KEY_FILE,
        passphrase=PASSPHRASE,
    )

    if not success:
        print(f"  SKIPPED: Decryption failed for {os.path.basename(pgp_file)}")
        continue

    # Step 3: Unzip
    print(f"\n  [2/3] Unzipping...")
    # Create a subfolder per file to avoid conflicts
    unzip_dest = os.path.join(UNZIPPED_FOLDER, base_name)
    os.makedirs(unzip_dest, exist_ok=True)

    extracted = unzip_file(decrypted_path, unzip_dest)
    print(f"  Extracted {len(extracted)} file(s)")

    # Step 4: Rename
    print(f"\n  [3/3] Renaming...")
    renamed = rename_files(extracted, RENAME_PATTERN)
    all_final_files.extend(renamed)

# --- Summary ---
print(f"\n{'=' * 60}")
print("PROCESSING COMPLETE")
print("=" * 60)
print(f"  PGP files processed: {len(pgp_files)}")
print(f"  Final files: {len(all_final_files)}")
for f in all_final_files:
    print(f"    {f}")
```

# — Run —

if **name** == “**main**”:
process_pgp_files()
