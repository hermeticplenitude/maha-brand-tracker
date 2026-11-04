#!/usr/bin/env python3
"""War Room vault: AES-256-GCM, key = PBKDF2-HMAC-SHA256(password, salt, 600000).
Format matches the browser gate in war-room/index.html.
Usage (password from env WR_PASSWORD):
  python3 collect/vault.py encrypt <plain_in> <enc_out.json>
  python3 collect/vault.py decrypt <enc_in.json> <plain_out>
Plaintext working copies belong in .vault/ (git-ignored). Never commit them."""
import base64, json, os, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
ITER = 600000
def key(pw, salt):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode())
def main():
    pw = os.environ.get("WR_PASSWORD")
    if not pw: sys.exit("Set WR_PASSWORD")
    mode, src, dst = sys.argv[1:4]
    if mode == "encrypt":
        data = open(src, "rb").read(); salt, iv = os.urandom(16), os.urandom(12)
        ct = AESGCM(key(pw, salt)).encrypt(iv, data, None)
        b = lambda x: base64.b64encode(x).decode()
        json.dump({"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "salt": b(salt), "iv": b(iv), "ct": b(ct)}, open(dst, "w"))
    elif mode == "decrypt":
        e = json.load(open(src)); d = base64.b64decode
        open(dst, "wb").write(AESGCM(key(pw, d(e["salt"]))).decrypt(d(e["iv"]), d(e["ct"]), None))
    else: sys.exit(__doc__)
if __name__ == "__main__": main()
