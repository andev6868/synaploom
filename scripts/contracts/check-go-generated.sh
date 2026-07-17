#!/usr/bin/env bash
set -euo pipefail
before="$(sha256sum generated/go/contracts/generated.go internal/contracts/schemas.go)"
bash scripts/contracts/generate-go.sh
after="$(sha256sum generated/go/contracts/generated.go internal/contracts/schemas.go)"
[[ "$before" == "$after" ]] || { echo "generated Go contracts are stale" >&2; exit 1; }
