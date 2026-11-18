"""Start the configured complete lab. No provisioning, data reset, test or detector activation."""
from run_week6 import main

if __name__ == '__main__':
    main(require_directory=True, require_audit=True)
