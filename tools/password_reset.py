# usage 
# python3 set_auth.py user "my-user-pass"
# python3 set_auth.py superuser "my-super-pass"

#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

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
    data["_auth"][key] = sha256_hex(args.password)

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
