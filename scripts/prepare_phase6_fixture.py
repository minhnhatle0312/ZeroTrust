"""Reuse audited fixture creation/inspection with separate metadata; never touch phase 4 output."""
from pathlib import Path
import prepare_phase4_fixture as fixture

fixture.BASE = Path(__file__).resolve().parents[1] / '.runtime/phase6-tests'
if __name__ == '__main__':
    fixture.main()
