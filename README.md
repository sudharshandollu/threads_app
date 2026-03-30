“””
PGP File Processor
Picks up latest PGP files (by modified date) from a source folder,
decrypts them to a temp folder, unzips the contents, and renames
the extracted files with sequential suffixes.

Requirements:
- pgp_decrypt.py (the decryptor script) in the same directory
“””

import os
import glob
import zipfile
import shutil
import tempfile
from datetime import datetime

from pgp_decrypt import decrypt_pgp_file

# ============================================================

# CONFIGURE THESE VALUES

# ============================================================

SOURCE_FOLDER = r”C:\data\pgp_files”        # Folder containing .pgp files
UNZIPPED_FOLDER = r”C:\data\unzipped”        # Folder for final unzipped files
PRIVATE_KEY_FILE = r”C:\keys\private.key”    # Path to your private key
PASSPHRASE = “your_passphrase_here”          # Passphrase for the private key

# File extensions to pick up

PGP_EXTENSIONS = [”*.pgp”, “*.gpg”, “*.asc”, “*.enc”]

# Rename pattern for extracted files

# Available placeholders: {original}, {date}, {timestamp}

# Sequential suffix (_01, _02…) is auto-appended when multiple files in a zip

RENAME_PATTERN = “{date}_{original}”

# ============================================================

def get_latest_pgp_files(source_folder, extensions):
“””
Get all PGP files whose modified date matches the most recent one.

```
Returns:
    List of file paths that share the latest modified date
"""
all_files = []
for ext in extensions:
    pattern = os.path.join(source_folder, ext)
    all_files.extend(glob.glob(pattern))

all_files = list(set(all_files))

if not all_files:
    return []

# Get modification date (date only, not time) for each file
def mod_date(f):
    return datetime.fromtimestamp(os.path.getmtime(f)).date()

# Find the latest date
latest_date = max(mod_date(f) for f in all_files)

# Return all files matching that date
latest_files = [f for f in all_files if mod_date(f) == latest_date]
latest_files.sort(key=os.path.getmtime, reverse=True)

return latest_files, latest_date
```

def unzip_file(zip_path, output_folder):
“””
Unzip a file to the output folder.

```
Returns:
    List of extracted file paths
"""
extracted_files = []

if not zipfile.is_zipfile(zip_path):
    print(f"  Not a zip file, copying as-is: {os.path.basename(zip_path)}")
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
If multiple files, appends _01, _02, … at the end.

```
Returns:
    List of renamed file paths
"""
renamed = []
now = datetime.now()
date_str = now.strftime("%Y%m%d")
timestamp_str = now.strftime("%Y%m%d_%H%M%S")
multiple = len(file_paths) > 1

for i, filepath in enumerate(file_paths, start=1):
    directory = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    name, ext = os.path.splitext(filename)

    new_name = pattern.format(
        original=name,
        date=date_str,
        timestamp=timestamp_str,
    )

    # Append sequential suffix if multiple files
    if multiple:
        new_name = f"{new_name}_{i:02d}"

    new_name += ext

    new_path = os.path.join(directory, new_name)

    # Avoid overwriting
    if os.path.isfile(new_path):
        base, ext2 = os.path.splitext(new_path)
        counter = 1
        while os.path.isfile(f"{base}_{counter}{ext2}"):
            counter += 1
        new_path = f"{base}_{counter}{ext2}"

    os.rename(filepath, new_path)
    print(f"  Renamed: {filename} -> {os.path.basename(new_path)}")
    renamed.append(new_path)

return renamed
```

def process_pgp_files():
“””
Main processing pipeline:
1. Find all PGP files with the latest modified date
2. Decrypt each file (using temp folder)
3. Unzip decrypted files
4. Rename extracted files with _01, _02 suffix
“””
print(”=” * 60)
print(“PGP File Processor”)
print(”=” * 60)

```
os.makedirs(UNZIPPED_FOLDER, exist_ok=True)

# --- Step 1: Get latest PGP files ---
print(f"\n--- Scanning: {SOURCE_FOLDER} ---")
result = get_latest_pgp_files(SOURCE_FOLDER, PGP_EXTENSIONS)

if not result or not result[0]:
    print("No PGP files found in source folder.")
    return

pgp_files, latest_date = result

print(f"Latest modified date: {latest_date}")
print(f"Found {len(pgp_files)} file(s):")
for f in pgp_files:
    mod_time = datetime.fromtimestamp(os.path.getmtime(f)).strftime("%Y-%m-%d %H:%M:%S")
    print(f"  {os.path.basename(f)} (modified: {mod_time})")

# --- Process each file using a temp folder for decryption ---
all_final_files = []
temp_dir = tempfile.mkdtemp(prefix="pgp_decrypt_")
print(f"\nTemp decrypt folder: {temp_dir}")

try:
    for pgp_file in pgp_files:
        print(f"\n{'=' * 60}")
        print(f"Processing: {os.path.basename(pgp_file)}")
        print("=" * 60)

        # Step 2: Decrypt to temp folder
        base_name = os.path.splitext(os.path.basename(pgp_file))[0]
        decrypted_path = os.path.join(temp_dir, base_name)

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
        unzip_dest = os.path.join(UNZIPPED_FOLDER, base_name)
        os.makedirs(unzip_dest, exist_ok=True)

        extracted = unzip_file(decrypted_path, unzip_dest)
        print(f"  Extracted {len(extracted)} file(s)")

        # Step 4: Rename
        print(f"\n  [3/3] Renaming...")
        renamed = rename_files(extracted, RENAME_PATTERN)
        all_final_files.extend(renamed)

finally:
    # Clean up temp folder
    shutil.rmtree(temp_dir, ignore_errors=True)
    print(f"\nCleaned up temp folder: {temp_dir}")

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
