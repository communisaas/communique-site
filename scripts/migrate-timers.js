#!/usr/bin/env node

/**
 * TIMER MIGRATION SCRIPT
 * Migrates all setTimeout/setInterval to coordinated timer system
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob').sync;

// Patterns to replace
const replacements = [
	// Copy feedback pattern
	{
		pattern: /copyTimeout = setTimeout\(\(\) => \{([\s\S]*?)\}, (\d+)\)/g,
		replacement: 'copyTimeout = coordinated.feedback(() => {$1}, $2, componentId)'
	},
	// Modal auto-close
	{
		pattern: /setTimeout\(\(\) => \{[\s]*showEmailLoadingModal = false;?[\s]*\}, (\d+)\)/g,
		replacement: 'coordinated.autoClose(() => { showEmailLoadingModal = false; }, $1, componentId)'
	},
	// Transition delays
	{
		pattern: /setTimeout\(\(\) => [\s]*([a-zA-Z_$][\w$]*) = (true|false);?\s*\), (\d+)\)/g,
		replacement: 'coordinated.transition(() => $1 = $2, $3, componentId)'
	},
	// DOM updates (nextTick)
	{
		pattern: /setTimeout\(([^,]+), 0\)/g,
		replacement: 'coordinated.nextTick($1, componentId)'
	},
	// Generic setTimeout
	{
		pattern: /setTimeout\(/g,
		replacement: 'coordinated.setTimeout('
	},
	// Touch/gesture timers
	{
		pattern: /touchTimeout = window\.setTimeout\(/g,
		replacement: 'touchTimeout = coordinated.gesture('
	}
];

// Files to add imports to
const componentImport =
	"import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';";
const storeImport = "import { coordinated } from '$lib/utils/timerCoordinator';";

async function processFile(filePath) {
	let content = await fs.readFile(filePath, 'utf8');
	let modified = false;

	// Check if file uses timers
	if (!content.includes('setTimeout') && !content.includes('setInterval')) {
		return false;
	}

	// Add import if needed
	const isComponent = filePath.endsWith('.svelte');
	const importToAdd = isComponent ? componentImport : storeImport;

	if (!content.includes('timerCoordinator')) {
		// Add import after script tag or at beginning
		if (isComponent) {
			content = content.replace(/<script([^>]*)>/, `<script$1>\n\t${importToAdd}`);
		} else {
			// Add after other imports
			const importMatch = content.match(/import[^;]+;/g);
			if (importMatch) {
				const lastImport = importMatch[importMatch.length - 1];
				content = content.replace(lastImport, lastImport + '\n' + importToAdd);
			} else {
				content = importToAdd + '\n\n' + content;
			}
		}
		modified = true;
	}

	// Apply replacements
	for (const { pattern, replacement } of replacements) {
		const before = content;
		content = content.replace(pattern, replacement);
		if (before !== content) modified = true;
	}

	// Add component ID for Svelte components
	if (isComponent && modified && content.includes('coordinated.')) {
		// Generate component ID from filename
		const componentName = path.basename(filePath, '.svelte');
		const componentId = `const componentId = '${componentName}_' + Math.random().toString(36).substr(2, 9);`;

		// Add after imports
		if (!content.includes('const componentId =')) {
			content = content.replace(
				/(<script[^>]*>[\s\S]*?)([\s]*let|[\s]*const|[\s]*function|[\s]*export)/,
				`$1\n\t${componentId}\n$2`
			);
		}

		// Add cleanup in onDestroy
		if (!content.includes('useTimerCleanup')) {
			const hasOnDestroy = content.includes('onDestroy');
			if (hasOnDestroy) {
				content = content.replace(
					/onDestroy\(\(\) => \{/,
					'onDestroy(() => {\n\t\tuseTimerCleanup(componentId)();'
				);
			} else {
				// Add onDestroy
				content = content.replace(/(import \{[^}]*)\}/, '$1, onDestroy }');
				content = content.replace(
					/(const componentId[^;]+;)/,
					'$1\n\n\tonDestroy(useTimerCleanup(componentId));'
				);
			}
		}
	}

	if (modified) {
		await fs.writeFile(filePath, content);
		console.log(`✅ Migrated: ${filePath}`);
		return true;
	}

	return false;
}

async function main() {
	console.log('🔄 Starting timer migration...\n');

	// Find all TypeScript and Svelte files
	const files = [
		...glob('src/**/*.ts', { ignore: ['**/node_modules/**', '**/timerCoordinator.ts'] }),
		...glob('src/**/*.svelte', { ignore: '**/node_modules/**' })
	];

	let migrated = 0;

	for (const file of files) {
		if (await processFile(file)) {
			migrated++;
		}
	}

	console.log(`\n✅ Migration complete! ${migrated} files updated.`);
}

main().catch(console.error);
