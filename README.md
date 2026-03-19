“””
PGP File Decryptor
Decrypts PGP-encrypted files using a private key and passphrase.

Requirements:
pip install python-gnupg
“””

import gnupg
import os
import subprocess
import tempfile
import shutil

# ============================================================

# CONFIGURE THESE VALUES

# ============================================================

ENCRYPTED_FILE = “encrypted.pgp”       # Path to the encrypted file
OUTPUT_FILE = “decrypted.txt”           # Path for the decrypted output
PRIVATE_KEY_FILE = “private.key”        # Path to your .key / .asc private key
PASSPHRASE = “your_passphrase_here”     # Passphrase for the private key

# Path to gpg binary — find yours by running: where gpg (Windows) or which gpg (Mac/Linux)

# Examples:

# Windows: r”C:\Program Files (x86)\GnuPG\bin\gpg.exe”

# Mac:     “/usr/local/bin/gpg”

# Linux:   “/usr/bin/gpg”

GPG_BINARY = r”C:\Program Files (x86)\GnuPG\bin\gpg.exe”

# ============================================================

def find_gpg_binary():
“”“Try to find the gpg binary automatically.”””
try:
result = subprocess.run(
[“where”, “gpg”] if os.name == “nt” else [“which”, “gpg”],
capture_output=True, text=True
)
if result.returncode == 0:
path = result.stdout.strip().splitlines()[0]
print(f”Found gpg at: {path}”)
return path
except Exception:
pass
return None

def decrypt_pgp_file(encrypted_file, output_file, key_file, passphrase, gpg_binary=None):
“””
Decrypt a PGP-encrypted file using a private key and passphrase.
Uses subprocess for key import (more reliable) and python-gnupg for decryption.
“””
# Find gpg binary
gpg_path = gpg_binary or find_gpg_binary()
if not gpg_path or not os.path.isfile(gpg_path):
print(f”Error: gpg binary not found at: {gpg_path}”)
print(“Run ‘where gpg’ (Windows) or ‘which gpg’ (Mac/Linux) and set GPG_BINARY.”)
return False

```
print(f"Using gpg: {gpg_path}")

# Create a temporary gnupg home
gnupg_home = tempfile.mkdtemp(prefix="gnupg_")
print(f"Temp keyring: {gnupg_home}")

try:
    # --- Step 1: Import key using subprocess (same as running gpg --import) ---
    key_file = os.path.abspath(key_file)
    if not os.path.isfile(key_file):
        print(f"Error: Key file not found: {key_file}")
        return False

    print(f"\nImporting key from: {key_file}")

    import_cmd = [
        gpg_path,
        "--homedir", gnupg_home,
        "--batch",
        "--yes",
        "--passphrase", passphrase,
        "--pinentry-mode", "loopback",
        "--import", key_file
    ]

    result = subprocess.run(import_cmd, capture_output=True, text=True)

    print(f"  Import stdout: {result.stdout}")
    print(f"  Import stderr: {result.stderr}")

    if result.returncode != 0:
        # Some gpg versions print success info on stderr, so check content
        if "secret key imported" not in result.stderr.lower() and \
           "imported:" not in result.stderr.lower():
            print("Error: Key import failed.")
            return False

    print("Key imported successfully!")

    # --- Step 2: Decrypt using python-gnupg (pointed at same homedir) ---
    gpg = gnupg.GPG(gnupghome=gnupg_home, gpgbinary=gpg_path)
    gpg.encoding = "utf-8"

    # Verify key is in the keyring
    keys = gpg.list_keys(secret=True)
    print(f"\nPrivate keys in keyring: {len(keys)}")
    for k in keys:
        print(f"  UID: {', '.join(k['uids'])}")
        print(f"  Fingerprint: {k['fingerprint']}")

    if not keys:
        print("Warning: No private keys found after import.")

    # Decrypt
    encrypted_file = os.path.abspath(encrypted_file)
    output_file = os.path.abspath(output_file)

    if not os.path.isfile(encrypted_file):
        print(f"Error: Encrypted file not found: {encrypted_file}")
        return False

    print(f"\nDecrypting: {encrypted_file}")

    with open(encrypted_file, "rb") as f:
        decrypted = gpg.decrypt_file(
            f,
            passphrase=passphrase,
            output=output_file,
            extra_args=["--pinentry-mode", "loopback"]
        )

    if decrypted.ok:
        print(f"\nDecryption successful!")
        print(f"  Output saved to: {output_file}")
        return True
    else:
        print(f"\nDecryption via python-gnupg failed: {decrypted.status}")
        print("Trying direct subprocess decryption as fallback...")

        # --- Fallback: Decrypt entirely via subprocess ---
        return decrypt_via_subprocess(
            gpg_path, gnupg_home, encrypted_file, output_file, passphrase
        )

finally:
    shutil.rmtree(gnupg_home, ignore_errors=True)
```

def decrypt_via_subprocess(gpg_path, gnupg_home, encrypted_file, output_file, passphrase):
“”“Fallback: decrypt using gpg command directly.”””
decrypt_cmd = [
gpg_path,
“–homedir”, gnupg_home,
“–batch”,
“–yes”,
“–passphrase”, passphrase,
“–pinentry-mode”, “loopback”,
“–output”, output_file,
“–decrypt”, encrypted_file
]

```
result = subprocess.run(decrypt_cmd, capture_output=True, text=True)

print(f"  Decrypt stdout: {result.stdout}")
print(f"  Decrypt stderr: {result.stderr}")

if result.returncode == 0 and os.path.isfile(output_file):
    print(f"\nDecryption successful (subprocess fallback)!")
    print(f"  Output saved to: {output_file}")
    return True
else:
    print(f"\nDecryption failed!")
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
)

```
if success:
    print("\nDone! Check your output file.")
else:
    print("\nSomething went wrong. Check the errors above.")
```
