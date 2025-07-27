#!/bin/bash

# COMPLETE TIMER MIGRATION SCRIPT
# Finishes migrating all remaining setTimeout/setInterval calls

echo "🔄 Completing timer migration..."

# Function to add import to file if not present
add_import() {
    local file="$1"
    local import_line="$2"
    
    if ! grep -q "timerCoordinator" "$file"; then
        # For .svelte files, add after <script> tag
        if [[ "$file" == *.svelte ]]; then
            sed -i '' "/<script[^>]*>/a\\
\\	$import_line
" "$file"
        # For .ts files, add after imports
        else
            # Find last import line and add after it
            if grep -q "^import" "$file"; then
                sed -i '' "/^import.*$/a\\
$import_line
" "$file"
            else
                # No imports, add at top
                sed -i '' "1i\\
$import_line\\

" "$file"
            fi
        fi
        echo "  ✅ Added import to $file"
    fi
}

# Function to replace patterns in file
replace_patterns() {
    local file="$1"
    
    # Skip if no timers
    if ! grep -q "setTimeout\|setInterval" "$file"; then
        return
    fi
    
    # Determine if it's a component file
    if [[ "$file" == *.svelte ]]; then
        add_import "$file" "import { coordinated, useTimerCleanup } from '\$lib/utils/timerCoordinator';"
        
        # Add component ID if not present
        if ! grep -q "const componentId" "$file" && grep -q "coordinated\." "$file"; then
            # Get component name from filename
            local component_name=$(basename "$file" .svelte)
            sed -i '' "/<script[^>]*>/a\\
\\	const componentId = '${component_name}_' + Math.random().toString(36).substr(2, 9);
" "$file"
        fi
    else
        add_import "$file" "import { coordinated } from '\$lib/utils/timerCoordinator';"
    fi
    
    # Replace common patterns
    sed -i '' 's/setTimeout(\([^,]*\), 0)/coordinated.nextTick(\1, componentId)/g' "$file"
    sed -i '' 's/setTimeout(\([^,]*\), \([0-9]*\))/coordinated.setTimeout(\1, \2, "dom", componentId)/g' "$file"
    sed -i '' 's/setInterval(\([^,]*\), \([0-9]*\))/coordinated.setInterval(\1, \2, "polling", componentId)/g' "$file"
    
    echo "  ✅ Updated patterns in $file"
}

# Find all files with timers
files=$(find /Users/noot/Documents/communique/src -type f \( -name "*.ts" -o -name "*.svelte" \) | xargs grep -l "setTimeout\|setInterval" 2>/dev/null | grep -v "timerCoordinator")

for file in $files; do
    echo "Processing: $file"
    replace_patterns "$file"
done

echo "✅ Timer migration completed!"

# Count remaining
remaining=$(find /Users/noot/Documents/communique/src -type f \( -name "*.ts" -o -name "*.svelte" \) | xargs grep -c "setTimeout\|setInterval" 2>/dev/null | grep -v ":0" | grep -v "timerCoordinator" | wc -l)
echo "📊 Remaining timer files: $remaining"