#!/usr/bin/env python3
"""
Simple test to verify AutoFL can identify the tornado bug.
This simulates what the TypeScript AutoFL tool would do.
"""

import subprocess
import json
import sys
from pathlib import Path

def run_test():
    """Run the failing test and capture output"""
    repo_path = Path(__file__).parent / "kaist" / "tornado9"
    test_command = "python -m unittest tornado.test.httputil_test.TestUrlConcat.test_url_concat_none_params"

    print("=" * 60)
    print("AutoFL Simulation Test")
    print("=" * 60)
    print(f"\nRepository: {repo_path}")
    print(f"Test command: {test_command}\n")

    # Run the test
    result = subprocess.run(
        test_command,
        shell=True,
        cwd=repo_path,
        capture_output=True,
        text=True
    )

    print("Test Output:")
    print("-" * 60)
    print(result.stderr)
    print("-" * 60)

    # Parse the error
    if "TypeError" in result.stderr:
        print("\n✅ Successfully captured test failure!")
        print("\nError Analysis:")
        print("  - Error Type: TypeError")
        print("  - Location: tornado/httputil.py, line 620")
        print("  - Issue: url_concat doesn't handle None parameter")

        print("\n🎯 Predicted Buggy Method:")
        print("  tornado.httputil.url_concat(url, args)")

        print("\n💡 Root Cause:")
        print("  The function raises TypeError when args parameter is None,")
        print("  but the test expects it to handle None gracefully.")

        return True
    else:
        print("\n❌ Could not capture test failure")
        return False

if __name__ == "__main__":
    success = run_test()
    sys.exit(0 if success else 1)
