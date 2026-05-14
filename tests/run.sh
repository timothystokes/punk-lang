#!/usr/bin/env bash
# Run every tests/*.punk. Tests are self-checking with `assert!`, which is
# silent on success. A test passes iff node exits 0 and produces no output.
set -u
cd "$(dirname "$0")/.."

pass=0
fail=0
failed=()

for src in tests/*.punk; do
    actual="$(node src/index.js "$src" 2>&1)"
    status=$?
    if [ $status -eq 0 ] && [ -z "$actual" ]; then
        echo "PASS $src"
        pass=$((pass+1))
    else
        echo "FAIL $src"
        if [ -n "$actual" ]; then
            echo "$actual" | sed 's/^/    /'
        fi
        fail=$((fail+1))
        failed+=("$src")
    fi
done

echo
echo "Result: $pass passed, $fail failed"
[ $fail -eq 0 ]
