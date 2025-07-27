#!/bin/bash

# IMPORT STRUCTURE CANCER ELIMINATION
# Converts all relative imports to absolute $lib imports

echo "🔄 Converting relative imports to absolute $lib imports..."

# Function to convert imports in a file
fix_imports() {
    local file="$1"
    echo "Processing: $file"
    
    # Convert ../../../lib/ to $lib/
    sed -i '' "s|from '[\.\/]*\.\./\.\./\.\./lib/|from '\$lib/|g" "$file"
    
    # Convert ../../lib/ to $lib/
    sed -i '' "s|from '[\.\/]*\.\./\.\./lib/|from '\$lib/|g" "$file"
    
    # Convert ../lib/ to $lib/
    sed -i '' "s|from '[\.\/]*\.\./lib/|from '\$lib/|g" "$file"
    
    # Convert ./lib/ to $lib/ (from root components)
    sed -i '' "s|from '[\.\/]*\./lib/|from '\$lib/|g" "$file"
    
    # Handle dynamic imports too
    sed -i '' "s|import('[\.\/]*\.\./\.\./\.\./lib/|import('\$lib/|g" "$file"
    sed -i '' "s|import('[\.\/]*\.\./\.\./lib/|import('\$lib/|g" "$file"
    sed -i '' "s|import('[\.\/]*\.\./lib/|import('\$lib/|g" "$file"
    sed -i '' "s|import('[\.\/]*\./lib/|import('\$lib/|g" "$file"
    
    # Fix specific patterns for components directory
    # Convert relative paths like '../components/' to absolute
    sed -i '' "s|from '[\.\/]*\.\./components/|from '\$lib/components/|g" "$file"
    sed -i '' "s|from '[\.\/]*\.\./\.\./components/|from '\$lib/components/|g" "$file"
    
    # Fix any remaining ../ patterns that should be $lib/
    # Only if they're importing from what should be lib directory
    sed -i '' "s|from '\.\./\.\./types/|from '\$lib/types/|g" "$file"
    sed -i '' "s|from '\.\./types/|from '\$lib/types/|g" "$file"
    sed -i '' "s|from '\.\./\.\./stores/|from '\$lib/stores/|g" "$file"
    sed -i '' "s|from '\.\./stores/|from '\$lib/stores/|g" "$file"
    sed -i '' "s|from '\.\./\.\./utils/|from '\$lib/utils/|g" "$file"
    sed -i '' "s|from '\.\./utils/|from '\$lib/utils/|g" "$file"
    sed -i '' "s|from '\.\./\.\./server/|from '\$lib/server/|g" "$file"
    sed -i '' "s|from '\.\./server/|from '\$lib/server/|g" "$file"
}

# Find all TypeScript and Svelte files with relative imports
files=$(find src -name "*.svelte" -o -name "*.ts" | xargs grep -l "\.\.\/" 2>/dev/null)

for file in $files; do
    fix_imports "$file"
done

echo "✅ Import structure fixed!"

# Count remaining relative imports
remaining=$(find src -name "*.svelte" -o -name "*.ts" | xargs grep -c "\.\.\/" 2>/dev/null | grep -v ":0" | wc -l)
echo "📊 Remaining relative imports: $remaining"

if [ "$remaining" -eq 0 ]; then
    echo "🎉 ALL RELATIVE IMPORTS ELIMINATED!"
else
    echo "🔍 Files still with relative imports:"
    find src -name "*.svelte" -o -name "*.ts" | xargs grep -l "\.\.\/" 2>/dev/null
fi