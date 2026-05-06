#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building dist/ for npm publish..."

rm -rf dist/
mkdir -p dist/

# Copy source files (bun can run them, but for npm publish we want
# consumers to be able to import without ts extension resolution issues)
cp -r src/*.ts dist/

# Rename .ts to .js — bun handles .ts but npm consumers expect .js
for f in dist/*.ts; do
  mv "$f" "${f%.ts}.js"
done

echo "dist/ ready."
ls -la dist/
