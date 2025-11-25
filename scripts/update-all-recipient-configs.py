#!/usr/bin/env python3
"""
Update all templates to use perceptual recipient_config structure
Converts legacy target_type format to new decision-maker based format
"""

import re

# Read the seed file
with open('/Users/noot/Documents/communique/scripts/seed-database.ts', 'r') as f:
    content = f.read()

# Pattern 1: Congressional templates with target_type
# Replace: recipient_config: { chambers: [...], committees: [...], target_type: 'congressional' }
# With: recipient_config: { reach: 'district-based', cwcRouting: true, chambers: [...], committees: [...] }

congressional_pattern = r"recipient_config: \{\s*chambers: (\[[^\]]+\]),\s*committees: (\[[^\]]+\]),\s*target_type: 'congressional'\s*\}"
congressional_replacement = r"recipient_config: {\n\t\t\treach: 'district-based',\n\t\t\tcwcRouting: true,\n\t\t\tchambers: \1,\n\t\t\tcommittees: \2\n\t\t}"

content = re.sub(congressional_pattern, congressional_replacement, content)

# Pattern 2: Municipal templates - need manual decision-maker names
# Find all remaining municipal templates and print them for manual update

print("=== Templates still needing manual decision-maker updates ===\n")

# Find templates with target_type: 'municipal' that don't have decisionMakers yet
municipal_pattern = r"title: '([^']+)',[\s\S]*?recipient_config: \{[^}]*emails: (\[[^\]]+\]),[^}]*target_type: 'municipal'[^}]*\}"

for match in re.finditer(municipal_pattern, content):
    title = match.group(1)
    emails = match.group(2)
    print(f"Template: {title}")
    print(f"Emails: {emails}")
    print()

print("\n=== Applying congressional template updates ===")

# Write updated content
with open('/Users/noot/Documents/communique/scripts/seed-database.ts', 'w') as f:
    f.write(content)

print("✅ Updated all congressional templates to use perceptual structure")
print("⚠️  Municipal templates with emails need manual decision-maker names")
