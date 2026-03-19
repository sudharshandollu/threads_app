“””
PGP File Decryptor
Decrypts PGP-encrypted files using a private key and passphrase.

Requirements:
pip install python-gnupg

Usage:
python pgp_decrypt.py –input encrypted.pgp –output decrypted.txt –keyfile private_key.asc –passphrase “your_passphrase”
“””

import gnupg
import argparse
import sys
import os
import getpass
import tempfile

class PGPDecryptor:
def **init**(self, gnupg_home=None):
“”“Initialize the PGP decryptor with a GnuPG home directory.”””
self.gnupg_home = gnupg_home or tempfile.mkdtemp(prefix=“gnupg_”)
self.gpg = gnupg.GPG(gnupghome=self.gnupg_home)
self.gpg.encoding = “utf-8”

```
def import_private_key(self, key_path: str, passphrase: str = None) -> dict:
    """Import a private key from a file."""
    if not os.path.isfile(key_path):
        raise FileNotFoundError(f"Private key file not found: {key_path}")

    with open(key_path, "r") as f:
        key_data = f.read()

    result = self.gpg.import_keys(key_data, passphrase=passphrase)

    if result.count == 0:
        raise ValueError(
            f"Failed to import key. Results: {result.results}"
        )

    print(f"Successfully imported {result.count} key(s).")
    print(f"  Fingerprints: {result.fingerprints}")
    return {
        "count": result.count,
        "fingerprints": result.fingerprints,
    }

def import_private_key_from_string(self, key_data: str, passphrase: str = None) -> dict:
    """Import a private key directly from a string."""
    result = self.gpg.import_keys(key_data, passphrase=passphrase)

    if result.count == 0:
        raise ValueError(
            f"Failed to import key. Results: {result.results}"
        )

    print(f"Successfully imported {result.count} key(s).")
    return {
        "count": result.count,
        "fingerprints": result.fingerprints,
    }

def decrypt_file(self, input_path: str, output_path: str, passphrase: str) -> bool:
    """
    Decrypt a PGP-encrypted file.

    Args:
        input_path:  Path to the encrypted .pgp/.gpg file
        output_path: Path to write the decrypted output
        passphrase:  Passphrase for the private key

    Returns:
        True if decryption succeeded, False otherwise
    """
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Encrypted file not found: {input_path}")

    with open(input_path, "rb") as f:
        decrypted = self.gpg.decrypt_file(f, passphrase=passphrase, output=output_path)

    if decrypted.ok:
        print(f"Decryption successful!")
        print(f"  Output: {output_path}")
        print(f"  Status: {decrypted.status}")
        if decrypted.fingerprint:
            print(f"  Signed by fingerprint: {decrypted.fingerprint}")
        return True
    else:
        print(f"Decryption failed!")
        print(f"  Status: {decrypted.status}")
        print(f"  Stderr: {decrypted.stderr}")
        return False

def decrypt_bytes(self, encrypted_data: bytes, passphrase: str) -> bytes | None:
    """
    Decrypt PGP-encrypted bytes in memory.

    Args:
        encrypted_data: The encrypted content as bytes
        passphrase:     Passphrase for the private key

    Returns:
        Decrypted bytes, or None if decryption failed
    """
    decrypted = self.gpg.decrypt(encrypted_data, passphrase=passphrase)

    if decrypted.ok:
        return decrypted.data
    else:
        print(f"Decryption failed: {decrypted.status}")
        return None

def list_keys(self, secret=True):
    """List keys in the keyring."""
    keys = self.gpg.list_keys(secret=secret)
    key_type = "Private" if secret else "Public"
    print(f"\n{key_type} keys in keyring:")
    if not keys:
        print("  (none)")
    for k in keys:
        print(f"  UID:         {', '.join(k['uids'])}")
        print(f"  Fingerprint: {k['fingerprint']}")
        print(f"  Created:     {k['date']}")
        print(f"  Expires:     {k.get('expires', 'never')}")
        print()
    return keys
```

def main():
parser = argparse.ArgumentParser(
description=“Decrypt PGP-encrypted files using a private key and passphrase.”
)
parser.add_argument(
“-i”, “–input”, required=True,
help=“Path to the encrypted PGP file”
)
parser.add_argument(
“-o”, “–output”, required=True,
help=“Path for the decrypted output file”
)
parser.add_argument(
“-k”, “–keyfile”, required=True,
help=“Path to the ASCII-armored private key file (.asc)”
)
parser.add_argument(
“-p”, “–passphrase”, default=None,
help=“Passphrase for the private key (prompted if not provided)”
)
parser.add_argument(
“–gnupg-home”, default=None,
help=“Custom GnuPG home directory (default: temp directory)”
)
parser.add_argument(
“–list-keys”, action=“store_true”,
help=“List imported keys after import”
)

```
args = parser.parse_args()

# Prompt for passphrase securely if not provided
passphrase = args.passphrase
if passphrase is None:
    passphrase = getpass.getpass("Enter private key passphrase: ")

try:
    decryptor = PGPDecryptor(gnupg_home=args.gnupg_home)

    # Step 1: Import the private key
    print(f"Importing private key from: {args.keyfile}")
    decryptor.import_private_key(args.keyfile, passphrase=passphrase)

    # Step 2 (optional): List keys
    if args.list_keys:
        decryptor.list_keys(secret=True)

    # Step 3: Decrypt the file
    print(f"\nDecrypting: {args.input}")
    success = decryptor.decrypt_file(args.input, args.output, passphrase)

    sys.exit(0 if success else 1)

except FileNotFoundError as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
except ValueError as e:
    print(f"Key import error: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Unexpected error: {e}", file=sys.stderr)
    sys.exit(1)
```

if **name** == “**main**”:
main()
