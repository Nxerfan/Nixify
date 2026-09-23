#!/usr/bin/env bash
#
# Build config regression guard — fails if:
#   1. ignoreBuildErrors: true is re-enabled in next.config.ts
#   2. tsconfig.json uses broad globs (**/*.ts, **/*.tsx) in include
#   3. src/ is not included in tsconfig.json
#   4. non-production directories are not excluded
#
# Run: bun run verify:config  (or: bash scripts/verify-build-config.sh)
#
set -euo pipefail
cd "$(dirname "$0")/.."

ERRORS=0

# ─── 1. Check next.config.ts does NOT contain ignoreBuildErrors ───────────
if grep -q "ignoreBuildErrors:\s*true" next.config.ts 2>/dev/null; then
  echo "❌ FAIL: ignoreBuildErrors: true is present in next.config.ts"
  echo "   This silences TypeScript errors during the production build."
  echo "   Remove the 'typescript.ignoreBuildErrors' option."
  ERRORS=$((ERRORS + 1))
else
  echo "✓ next.config.ts does not enable ignoreBuildErrors"
fi

# ─── 2. Check tsconfig.json does NOT use broad globs ──────────────────────
if grep -q '"\*\*/\*\.ts"' tsconfig.json 2>/dev/null || grep -q '"\*\*/\*\.tsx"' tsconfig.json 2>/dev/null; then
  echo "❌ FAIL: tsconfig.json uses broad glob patterns (**/*.ts or **/*.tsx)"
  echo "   These pull non-production files (examples/, skills/, etc.) into the build."
  echo "   Use scoped patterns like 'src/**/*.ts' instead."
  ERRORS=$((ERRORS + 1))
else
  echo "✓ tsconfig.json does not use broad glob patterns"
fi

# ─── 3. Check src/ IS included ────────────────────────────────────────────
if grep -q '"src/\*\*/\*\.ts"' tsconfig.json 2>/dev/null && grep -q '"src/\*\*/\*\.tsx"' tsconfig.json 2>/dev/null; then
  echo "✓ tsconfig.json includes src/**/*.ts and src/**/*.tsx"
else
  echo "❌ FAIL: tsconfig.json does not include src/**/*.ts and src/**/*.tsx"
  echo "   Production application code must be type-checked."
  ERRORS=$((ERRORS + 1))
fi

# ─── 4. Check non-production directories are excluded ─────────────────────
NON_PROD_DIRS=("examples" "skills" "sdk" "cli" "tool-results" "download" "agent-ctx" "mini-services")
for dir in "${NON_PROD_DIRS[@]}"; do
  if grep -q "\"$dir\"" tsconfig.json 2>/dev/null; then
    echo "✓ tsconfig.json excludes: $dir"
  else
    echo "⚠ WARN: tsconfig.json does not explicitly exclude: $dir"
    echo "  (not blocking — but recommended to prevent accidental inclusion)"
  fi
done

# ─── 5. Check no committed git conflict markers ───────────────────────────
CONFLICT_MARKERS=$(git grep -nP '^<<<<<<<\s|^=======$|^>>>>>>>\s' 2>/dev/null || true)
if [ -n "$CONFLICT_MARKERS" ]; then
  echo "❌ FAIL: git conflict markers found in tracked files:"
  echo "$CONFLICT_MARKERS"
  ERRORS=$((ERRORS + 1))
else
  echo "✓ No git conflict markers in tracked files"
fi

# ─── Summary ──────────────────────────────────────────────────────────────
if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS error(s) found. Build config regression guard failed."
  exit 1
else
  echo ""
  echo "✅ Build config regression guard passed."
  exit 0
fi
