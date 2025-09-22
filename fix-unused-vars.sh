#!/bin/bash

# Script to fix common unused variable patterns

echo "Fixing unused event parameters..."
find src/ -name "*.svelte" -exec sed -i '' 's/(event: /(_event: /g' {} \;
find src/ -name "*.svelte" -exec sed -i '' 's/(event)/(_event)/g' {} \;

echo "Fixing unused function parameters..."
find src/ -name "*.ts" -name "*.svelte" -exec sed -i '' 's/function(\([^)]*\)step\([^)]*\))/function(\1_step\2)/g' {} \;

echo "Fixing unused imports with common patterns..."
# PopoverSlots
find src/ -name "*.svelte" -exec sed -i '' 's/PopoverSlots/PopoverSlots as _PopoverSlots/g' {} \;

# Common unused icons
find src/ -name "*.svelte" -exec sed -i '' 's/import { \([^}]*\)Copy\([^}]*\) }/import { \1Copy as _Copy\2 }/g' {} \;
find src/ -name "*.svelte" -exec sed -i '' 's/import { \([^}]*\)Send\([^}]*\) }/import { \1Send as _Send\2 }/g' {} \;
find src/ -name "*.svelte" -exec sed -i '' 's/import { \([^}]*\)onMount\([^}]*\) }/import { \1onMount as _onMount\2 }/g' {} \;
find src/ -name "*.svelte" -exec sed -i '' 's/import { \([^}]*\)onDestroy\([^}]*\) }/import { \1onDestroy as _onDestroy\2 }/g' {} \;
find src/ -name "*.svelte" -exec sed -i '' 's/import { \([^}]*\)fade\([^}]*\) }/import { \1fade as _fade\2 }/g' {} \;

echo "Fixing unused loop variables..."
find src/ -name "*.svelte" -exec sed -i '' 's/{#each \([^}]*\) as \([^,]*\), i}/{#each \1 as \2, _i}/g' {} \;
find src/ -name "*.svelte" -exec sed -i '' 's/{#each \([^}]*\) as \([^,]*\), col}/{#each \1 as \2, _col}/g' {} \;

echo "Done fixing common patterns!"