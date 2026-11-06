"""Start the week-5 application without running tests or silently changing MFA."""
import argparse
import subprocess
import sys
from common import ROOT


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--network', action='store_true')
    args = parser.parse_args()
    print('Starting week 5 source. MFA setup is explicit: python scripts/setup_week5.py', flush=True)
    command = [sys.executable, str(ROOT / 'scripts/run_week3.py')]
    if args.network:
        command.append('--network')
    raise SystemExit(subprocess.run(command, cwd=ROOT).returncode)
