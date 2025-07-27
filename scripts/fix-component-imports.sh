#!/bin/bash

# COMPONENT IMPORT STRUCTURE FIX
# Convert cross-directory component imports to $lib/ absolute imports

echo "🔄 Fixing cross-directory component imports..."

# Function to fix component imports
fix_component_imports() {
    local file="$1"
    echo "Processing: $file"
    
    # Fix imports from ui components (most common pattern)
    sed -i '' "s|from '\.\./\.\./ui/|from '\$lib/components/ui/|g" "$file"
    sed -i '' "s|from '\.\./ui/|from '\$lib/components/ui/|g" "$file"
    
    # Fix imports from other component directories
    sed -i '' "s|from '\.\./\.\./auth/|from '\$lib/components/auth/|g" "$file"
    sed -i '' "s|from '\.\./auth/|from '\$lib/components/auth/|g" "$file"
    
    sed -i '' "s|from '\.\./\.\./template/|from '\$lib/components/template/|g" "$file"
    sed -i '' "s|from '\.\./template/|from '\$lib/components/template/|g" "$file"
    
    sed -i '' "s|from '\.\./\.\./landing/|from '\$lib/components/landing/|g" "$file"
    sed -i '' "s|from '\.\./landing/|from '\$lib/components/landing/|g" "$file"
    
    sed -i '' "s|from '\.\./\.\./verification/|from '\$lib/components/verification/|g" "$file"
    sed -i '' "s|from '\.\./verification/|from '\$lib/components/verification/|g" "$file"
    
    # Fix deeper nested imports
    sed -i '' "s|from '\.\./\.\./\.\./ui/|from '\$lib/components/ui/|g" "$file"
    sed -i '' "s|from '\.\./\.\./\.\./auth/|from '\$lib/components/auth/|g" "$file"
    sed -i '' "s|from '\.\./\.\./\.\./template/|from '\$lib/components/template/|g" "$file"
    sed -i '' "s|from '\.\./\.\./\.\./landing/|from '\$lib/components/landing/|g" "$file"
    sed -i '' "s|from '\.\./\.\./\.\./verification/|from '\$lib/components/verification/|g" "$file"
}

# Find all component files with relative imports
files=$(find src/lib/components -name "*.svelte" | xargs grep -l "\.\.\/" 2>/dev/null)

for file in $files; do
    fix_component_imports "$file"
done

echo "✅ Component imports fixed!"

# Count remaining
remaining=$(find src -name "*.svelte" -o -name "*.ts" | xargs grep -c "\.\.\/" 2>/dev/null | grep -v ":0" | wc -l)
echo "📊 Remaining relative imports: $remaining"

if [ "$remaining" -eq 0 ]; then
    echo "🎉 ALL PROBLEMATIC RELATIVE IMPORTS ELIMINATED!"
else
    echo "🔍 Files still with relative imports (checking if legitimate):"
    find src -name "*.svelte" -o -name "*.ts" | xargs grep -l "\.\.\/" 2>/dev/null | head -5
fi