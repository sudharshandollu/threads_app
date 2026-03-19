“””
PGP File Decryptor
Decrypts PGP-encrypted files using a private key and passphrase.

Requirements:
pip install python-gnupg
“””

import gnupg
import os
import tempfile

# ============================================================

# CONFIGURE THESE VALUES

# ============================================================

ENCRYPTED_FILE = “encrypted.pgp”       # Path to the encrypted file
OUTPUT_FILE = “decrypted.txt”           # Path for the decrypted output
PRIVATE_KEY_FILE = “private_key.key”    # Path to your .key / .asc private key
PASSPHRASE = “your_passphrase_here”     # Passphrase for the private key

# ============================================================

def decrypt_pgp_file(encrypted_file, output_file, key_file, passphrase):
“””
Decrypt a PGP-encrypted file using a private key and passphrase.

```
Args:
    encrypted_file: Path to the encrypted .pgp/.gpg file
    output_file:    Path to write the decrypted output
    key_file:       Path to the private key file (.key, .asc, .gpg)
    passphrase:     Passphrase for the private key

Returns:
    True if decryption succeeded, False otherwise
"""
# Set up a temporary GnuPG home directory
gnupg_home = tempfile.mkdtemp(prefix="gnupg_")
gpg = gnupg.GPG(gnupghome=gnupg_home)
gpg.encoding = "utf-8"

# --- Step 1: Import the private key ---
if not os.path.isfile(key_file):
    print(f"Error: Private key file not found: {key_file}")
    return False

# Read key file (handles both ASCII-armored and binary formats)
try:
    with open(key_file, "r") as f:
        key_data = f.read()
except UnicodeDecodeError:
    with open(key_file, "rb") as f:
        key_data = f.read()

import_result = gpg.import_keys(key_data, passphrase=passphrase)

if import_result.count == 0:
    print(f"Error: Failed to import private key.")
    print(f"  Details: {import_result.results}")
    return False

print(f"Imported {import_result.count} key(s)")
print(f"  Fingerprints: {import_result.fingerprints}")

# --- Step 2: Decrypt the file ---
if not os.path.isfile(encrypted_file):
    print(f"Error: Encrypted file not found: {encrypted_file}")
    return False

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
)

```
if success:
    print("\nDone! Check your output file.")
else:
    print("\nSomething went wrong. Check the errors above.")
```
