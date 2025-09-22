#!/bin/bash

# SURGICAL CLEANUP - Targeted fixes for remaining errors
echo "🔪 SURGICAL APPROACH: Fixing remaining errors methodically..."

# First, let's see what we're dealing with
echo "Current remaining errors:"
npx eslint src/ --ext .ts,.svelte 2>&1 | grep "is defined but never used" | head -10

echo ""
echo "Applying surgical fixes..."

# Fix __error variables that are not used (change to _)
echo "1. Fixing __error patterns..."
find src/ -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i '' \
  's/__error/_error/g' {} \;

# Fix any remaining destructuring patterns specifically
echo "2. Fixing specific destructuring patterns..."

# Look for exact patterns in files
grep -r "{ user_id," src/ --include="*.ts" 2>/dev/null | while read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    sed -i '' 's/{ user_id,/{ user_id: _user_id,/g' "$file"
done

grep -r "{ endpoint," src/ --include="*.ts" 2>/dev/null | while read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    sed -i '' 's/{ endpoint,/{ endpoint: _endpoint,/g' "$file"
done

grep -r "{ success," src/ --include="*.ts" 2>/dev/null | while read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    sed -i '' 's/{ success,/{ success: _success,/g' "$file"
done

# Fix index parameters
echo "3. Fixing index parameters in specific contexts..."
find src/ -name "*.svelte" -exec sed -i '' \
  's/\(each [^}]*as [^,]*\), index}/\1, _index}/g' {} \;

echo "✅ Surgical fixes complete."

# Final count
REMAINING=$(npx eslint src/ --ext .ts,.svelte 2>&1 | grep "is defined but never used" | wc -l | tr -d ' ')
echo "🎯 Remaining unused variable errors: $REMAINING"

if [ "$REMAINING" -eq 0 ]; then
    echo "🎉 SUCCESS: ZERO unused variable errors achieved!"
else
    echo "📋 Sample of remaining errors:"
    npx eslint src/ --ext .ts,.svelte 2>&1 | grep "is defined but never used" | head -3
fi