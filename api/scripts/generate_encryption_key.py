#!/usr/bin/env python3
"""Generate a Fernet key for ENCRYPTION_KEY.

api/app/core/security.py uses this key to encrypt Discord OAuth tokens and event content
at rest — it must be a real Fernet key, not an arbitrary string (see docs/deployment.md).
Losing or rotating it makes existing encrypted rows unreadable.

Usage:
    uv run python scripts/generate_encryption_key.py
"""

from __future__ import annotations

from cryptography.fernet import Fernet


def main() -> None:
    print(Fernet.generate_key().decode())


if __name__ == "__main__":
    main()
