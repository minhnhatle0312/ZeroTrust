"""Read-only guard for legacy writers that assume staff.id == Keycloak UUID."""
import sqlite3
from contextlib import closing
from pathlib import Path


def require_legacy_identity_schema(database):
    path = Path(database)
    if not path.exists():
        return
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        db.execute('PRAGMA query_only=ON')
        if db.execute("SELECT 1 FROM sqlite_schema WHERE name IN ('staff_identity_bindings','identity_link_batches') LIMIT 1").fetchone():
            raise RuntimeError('IDENTITY_BINDING_TOOL_UNSUPPORTED: this legacy writer cannot safely target linked identities. No remote or local writes started.')


def require_legacy_workspace(root, env):
    database = Path(env.get('ATTENDANCE_DB', 'data/attendance.sqlite'))
    if not database.is_absolute():
        database = Path(root) / 'backend' / database
    require_legacy_identity_schema(database)
