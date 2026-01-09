#!/usr/bin/env python3
import argparse
import json
import shutil
import subprocess
from typing import Optional
from pathlib import Path

# usage
# python3 tools/password_reset.py user "my-user-pass"
# python3 tools/password_reset.py superuser "my-super-pass"

def php_password_hash(password: str) -> Optional[str]:
    php = shutil.which("php")
    if not php:
        return None
    code = (
        '$pw=$argv[1];'
        '$algo=defined("PASSWORD_ARGON2ID")?PASSWORD_ARGON2ID:PASSWORD_BCRYPT;'
        '$options=[];'
        'if ($algo===PASSWORD_BCRYPT){$options["cost"]=12;}'
        '$hash=password_hash($pw,$algo,$options);'
        'if ($hash===false){fwrite(STDERR,"hash_failed");exit(2);}echo $hash;'
    )
    result = subprocess.run(
        [php, "-r", code, password],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None

def bcrypt_hash(password: str) -> Optional[str]:
    try:
        import crypt
    except ImportError:
        return None
    if not hasattr(crypt, "METHOD_BLOWFISH"):
        return None
    try:
        salt = crypt.mksalt(crypt.METHOD_BLOWFISH, rounds=12)
    except TypeError:
        salt = crypt.mksalt(crypt.METHOD_BLOWFISH)
    hashed = crypt.crypt(password, salt)
    if not hashed or hashed in {"*0", "*1"}:
        return None
    return hashed

def hash_password(password: str) -> str:
    for fn in (php_password_hash, bcrypt_hash):
        hashed = fn(password)
        if hashed:
            return hashed
    raise SystemExit(
        "No password hashing backend available. Install PHP CLI or enable bcrypt in Python's crypt module."
    )

def main():
    p = argparse.ArgumentParser()
    p.add_argument("role", choices=["user", "superuser"])
    p.add_argument("password")
    p.add_argument("--file", default="metadata_config.json")
    args = p.parse_args()

    path = Path(args.file)
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("_auth", {})
    key = "user_hash" if args.role == "user" else "superuser_hash"
    data["_auth"][key] = hash_password(args.password)

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
