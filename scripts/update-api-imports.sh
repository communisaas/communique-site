#!/bin/bash

# Script to update API client imports to use the new unified client

echo "Updating API client imports..."

# Update imports from old utils/apiClient to new core/api/client
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i '' 's|lib/utils/apiClient|lib/core/api/client|g'
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i '' 's|lib/services/apiClient|lib/core/api/client|g'

# Update specialized API imports to use the unified client
# (templatesApi, analyticsApi, etc. -> just 'api')
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i '' 's|{ templatesApi }|{ api }|g'
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i '' 's|{ analyticsApi }|{ api }|g'
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i '' 's|templatesApi\.|api.|g'
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i '' 's|analyticsApi\.|api.|g'

echo "API client imports updated!"
echo "Please review and test the changes."