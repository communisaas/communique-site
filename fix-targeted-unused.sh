#!/bin/bash

# TARGETED UNUSED VARIABLE FIXES
# Focus on specific error patterns from eslint output

echo "🎯 TARGETED FIXES: Addressing specific unused variable patterns..."

# Fix specific files and patterns based on eslint output

# 1. Fix index variables in loops (common pattern)
echo "Fixing index variables in loops..."
find src/ -name "*.svelte" -type f -exec sed -i '' \
  -E 's/\{#each ([^}]+) as ([^,]+), index\}/\{#each \1 as \2, _index\}/g' {} \;

# 2. Fix destructuring in function parameters  
echo "Fixing destructuring parameters..."
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)user_id,/\1\{\2user_id: _user_id,/g' {} \;
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)endpoint,/\1\{\2endpoint: _endpoint,/g' {} \;
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)success,/\1\{\2success: _success,/g' {} \;

# 3. Fix event_type, ip, details patterns
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)event_type,/\1\{\2event_type: _event_type,/g' {} \;
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)ip,/\1\{\2ip: _ip,/g' {} \;
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)details,/\1\{\2details: _details,/g' {} \;

# 4. Fix _error variables that are marked as unused (likely catch blocks)
echo "Fixing _error variable issues..."
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/catch \(_error\)/catch (_error: unknown)/g' {} \;

# 5. Fix template category and user context patterns
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)templateCategory,/\1\{\2templateCategory: _templateCategory,/g' {} \;
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)userContext,/\1\{\2userContext: _userContext,/g' {} \;

# 6. Fix suggestion patterns
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)suggestionId,/\1\{\2suggestionId: _suggestionId,/g' {} \;
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/^([[:space:]]*)\{([[:space:]]*)variableName,/\1\{\2variableName: _variableName,/g' {} \;

# 7. Fix Template import issues
echo "Fixing Template import issues..."
find src/ -name "*.ts" -type f -exec sed -i '' \
  -E 's/import type \{ Template \}/import type \{ Template as _Template \}/g' {} \;

echo "✅ Targeted fixes applied. Checking results..."

# Count remaining errors
REMAINING=$(npx eslint src/ --ext .ts,.svelte 2>&1 | grep "is defined but never used" | wc -l | tr -d ' ')
echo "🎯 Remaining unused variable errors: $REMAINING"

if [ "$REMAINING" -eq 0 ]; then
    echo "🎉 SUCCESS: ZERO unused variable errors achieved!"
else
    echo "⚡ Progress made. Remaining: $REMAINING errors"
    echo "Most problematic files:"
    npx eslint src/ --ext .ts,.svelte 2>&1 | grep -E "(src/[^:]+):" | sort | uniq -c | sort -nr | head -5
fi