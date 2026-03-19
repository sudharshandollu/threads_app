“””
PGP File Decryptor
Decrypts PGP-encrypted files using a private key and passphrase.

Requirements:
pip install python-gnupg
“””

import gnupg
import os
import tempfile
import shutil

# ============================================================

# CONFIGURE THESE VALUES

# ============================================================

ENCRYPTED_FILE = “encrypted.pgp”       # Path to the encrypted file
OUTPUT_FILE = “decrypted.txt”           # Path for the decrypted output
PRIVATE_KEY_FILE = “private_key.key”    # Path to your .key / .asc private key
PASSPHRASE = “your_passphrase_here”     # Passphrase for the private key

# Path to gpg binary (set to None for auto-detect)

# Windows example: r”C:\Program Files (x86)\GnuPG\bin\gpg.exe”

# Mac/Linux example: “/usr/local/bin/gpg” or “/usr/bin/gpg”

GPG_BINARY = None

# If your key is a raw string (e.g. from env variable or config),

# paste it here instead of using a file. Set to None to use the file.

PRIVATE_KEY_STRING = None

# ============================================================

def fix_key_data(key_data):
“””
Fix common key formatting issues:
- Replace literal ‘\n’ with actual newlines
- Ensure proper PGP block structure
“””
# Replace literal \n with actual newlines
if “\n” in key_data:
key_data = key_data.replace(”\n”, “\n”)

```
# Replace literal \r\n as well
if "\\r\\n" in key_data:
    key_data = key_data.replace("\\r\\n", "\n")

# Remove any extra whitespace around lines
lines = [line.strip() for line in key_data.splitlines()]
key_data = "\n".join(lines)

# Ensure there's a blank line after headers (required by PGP format)
# PGP keys have headers like "Version: ..." after BEGIN block
fixed_lines = []
in_header = False
for i, line in enumerate(lines):
    fixed_lines.append(line)
    if line.startswith("-----BEGIN PGP"):
        in_header = True
    elif in_header and line == "":
        in_header = False
    elif in_header and ":" not in line and line != "":
        # We hit key data without a blank separator — insert one
        fixed_lines.insert(-1, "")
        in_header = False

key_data = "\n".join(fixed_lines)

return key_data
```

def decrypt_pgp_file(encrypted_file, output_file, key_file, passphrase,
gpg_binary=None, key_string=None):
“””
Decrypt a PGP-encrypted file using a private key and passphrase.

```
Args:
    encrypted_file: Path to the encrypted .pgp/.gpg file
    output_file:    Path to write the decrypted output
    key_file:       Path to the private key file (.key, .asc, .gpg)
    passphrase:     Passphrase for the private key
    gpg_binary:     Optional path to gpg binary
    key_string:     Optional raw key string (used instead of key_file)

Returns:
    True if decryption succeeded, False otherwise
"""
# Set up a temporary GnuPG home directory
gnupg_home = tempfile.mkdtemp(prefix="gnupg_")

try:
    if gpg_binary:
        gpg = gnupg.GPG(gnupghome=gnupg_home, gpgbinary=gpg_binary)
    else:
        gpg = gnupg.GPG(gnupghome=gnupg_home)

    gpg.encoding = "utf-8"

    # --- Step 1: Read the private key ---
    if key_string:
        key_data = key_string
        print("Using provided key string...")
    else:
        if not os.path.isfile(key_file):
            print(f"Error: Private key file not found: {key_file}")
            return False

        try:
            with open(key_file, "r", encoding="utf-8") as f:
                key_data = f.read()
        except UnicodeDecodeError:
            with open(key_file, "rb") as f:
                key_data = f.read()
                # Binary key — import directly without fixing
                import_result = gpg.import_keys(key_data, passphrase=passphrase)
                if import_result.count == 0:
                    print("Error: Failed to import binary key.")
                    print(f"  Details: {import_result.results}")
                    return False
                print(f"Imported {import_result.count} key(s) (binary format)")
                # Skip to decryption
                return _do_decrypt(gpg, encrypted_file, output_file, passphrase)

    # --- Step 2: Fix key formatting issues ---
    print(f"\nOriginal key preview (first 200 chars):")
    print(repr(key_data[:200]))

    key_data = fix_key_data(key_data)

    print(f"\nFixed key preview (first 200 chars):")
    print(key_data[:200])

    # Verify it looks like a PGP key
    if "-----BEGIN PGP PRIVATE KEY BLOCK-----" not in key_data:
        print("\nWarning: Key data does not contain PGP PRIVATE KEY BLOCK header.")
        print("Make sure you're using the correct key file.")

    # --- Step 3: Import the private key ---
    import_result = gpg.import_keys(key_data, passphrase=passphrase)

    print(f"\nImport results:")
    print(f"  Count: {import_result.count}")
    print(f"  Fingerprints: {import_result.fingerprints}")
    print(f"  Results: {import_result.results}")

    if import_result.count == 0:
        print("\nError: Failed to import private key.")
        print("Possible causes:")
        print("  - Key format is corrupted or not a valid PGP key")
        print("  - Wrong passphrase for a protected key")
        print("  - The .key file is not a PGP private key")
        return False

    # --- Step 4: Decrypt the file ---
    return _do_decrypt(gpg, encrypted_file, output_file, passphrase)

finally:
    # Clean up temp directory
    shutil.rmtree(gnupg_home, ignore_errors=True)
```

def _do_decrypt(gpg, encrypted_file, output_file, passphrase):
“”“Perform the actual decryption.”””
if not os.path.isfile(encrypted_file):
print(f”Error: Encrypted file not found: {encrypted_file}”)
return False

```
with open(encrypted_file, "rb") as f:
    decrypted = gpg.decrypt_file(f, passphrase=passphrase, output=output_file)

if decrypted.ok:
    print(f"\nDecryption successful!")
    print(f"  Output saved to: {output_file}")
    if decrypted.fingerprint:
        print(f"  Signed by: {decrypted.fingerprint}")
    return True
else:
    print(f"\nDecryption failed!")
    print(f"  Status: {decrypted.status}")
    print(f"  Details: {decrypted.stderr}")
    return False
```

# — Run —

if **name** == “**main**”:
success = decrypt_pgp_file(
encrypted_file=ENCRYPTED_FILE,
output_file=OUTPUT_FILE,
key_file=PRIVATE_KEY_FILE,
passphrase=PASSPHRASE,
gpg_binary=GPG_BINARY,
key_string=PRIVATE_KEY_STRING,
)

```
if success:
    print("\nDone! Check your output file.")
else:
    print("\nSomething went wrong. Check the errors above.")
```
