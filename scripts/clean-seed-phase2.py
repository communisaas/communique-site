#!/usr/bin/env python3
"""
Clean Phase 2+ fields from seed-database.ts

Removes all Phase 2+ fields that were deleted from the Template model schema.
"""

import re

# Fields to remove from SeedTemplateData interface
INTERFACE_FIELDS_TO_REMOVE = [
    'applicable_countries',
    'jurisdiction_level',
    'specific_locations',
    'agent_votes',
    'consensus_score',
    'severity_level',
    'correction_log',
    'original_content',
    'corrected_at',
]

# Fields to remove from template data objects
TEMPLATE_FIELDS_TO_REMOVE = [
    'applicable_countries',
    'jurisdiction_level',
    'specific_locations',
    'agent_votes',
    'consensus_score',
    'severity_level',
    'correction_log',
    'original_content',
    'corrected_at',
    'quality_score',  # Not in Prisma schema
    'grammar_score',  # Not in Prisma schema
    'clarity_score',  # Not in Prisma schema
    'completeness_score',  # Not in Prisma schema
]

# Template creation fields to remove (lines in create call)
CREATE_FIELDS_TO_REMOVE = [
    'applicable_countries',
    'jurisdiction_level',
    'specific_locations',
    'agent_votes',
    'consensus_score',
    'severity_level',
    'correction_log',
    'original_content',
    'corrected_at',
    'submitted_at',  # Also Phase 2
]

def clean_seed_file():
    with open('/Users/noot/Documents/communique/scripts/seed-database.ts', 'r') as f:
        content = f.read()

    lines = content.split('\n')
    cleaned_lines = []
    skip_next = False
    in_interface = False
    in_template_object = False
    brace_depth = 0

    i = 0
    while i < len(lines):
        line = lines[i]

        # Track if we're in the SeedTemplateData interface
        if 'interface SeedTemplateData' in line:
            in_interface = True
            brace_depth = 0

        if in_interface:
            if '{' in line:
                brace_depth += line.count('{')
            if '}' in line:
                brace_depth -= line.count('}')
                if brace_depth == 0:
                    in_interface = False

            # Remove fields from interface
            if any(f'{field}:' in line or f'{field}?' in line for field in INTERFACE_FIELDS_TO_REMOVE):
                i += 1
                continue

        # Remove fields from template objects and template creation
        if any(f'{field}:' in line for field in TEMPLATE_FIELDS_TO_REMOVE + CREATE_FIELDS_TO_REMOVE):
            # Check if this is a multi-line field (like agent_votes with nested object)
            if '{' in line and '}' not in line:
                # Multi-line field, skip until closing brace
                depth = line.count('{') - line.count('}')
                i += 1
                while i < len(lines) and depth > 0:
                    depth += lines[i].count('{') - lines[i].count('}')
                    i += 1
                continue
            else:
                # Single line field
                i += 1
                continue

        cleaned_lines.append(line)
        i += 1

    # Write back
    with open('/Users/noot/Documents/communique/scripts/seed-database.ts', 'w') as f:
        f.write('\n'.join(cleaned_lines))

    print(f"✅ Cleaned seed file: removed {len(lines) - len(cleaned_lines)} lines")
    print(f"   Original: {len(lines)} lines")
    print(f"   Cleaned: {len(cleaned_lines)} lines")

if __name__ == '__main__':
    clean_seed_file()
