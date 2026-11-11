#!/usr/bin/env python3
"""Create local secrets once; never print them or overwrite an existing environment."""

from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[2]
path = root / ".env"
if path.exists():
    print(".env already exists; retained without modification.")
else:
    values = {
        "POSTGRES_USER": "nexus",
        "POSTGRES_PASSWORD": secrets.token_urlsafe(32),
        "NEO4J_PASSWORD": secrets.token_urlsafe(32),
        "AI_SERVICE_TOKEN": secrets.token_urlsafe(40),
        "BOOTSTRAP_ADMIN_EMAIL": "admin@nexus.local",
        "BOOTSTRAP_ADMIN_PASSWORD": secrets.token_urlsafe(24),
        "FRONTEND_ORIGIN": "http://localhost:3000,http://127.0.0.1:3000",
        "COOKIE_SECURE": "false",
    }
    path.write_text("".join(k + "=" + v + "\n" for k, v in values.items()))
    path.chmod(0o600)
    print(
        "Created private .env with random credentials. Open it locally for the bootstrap admin login."
    )
