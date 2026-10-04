#!/usr/bin/env bash
# Local CI — mirrors GitHub Actions lint + security checks.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> npm ci"
npm ci

echo "==> lint"
npm run lint

echo "==> typecheck"
npm run typecheck

echo "==> format"
npm run format

echo "==> audit"
npm run audit

echo "==> unit tests"
npm run test:unit

echo "✓ CI passed"
