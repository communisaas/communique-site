#!/usr/bin/env tsx
/**
 * Real Coverage Analyzer
 * Analyzes actual test coverage by examining test files and their imports
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface CoverageStats {
	totalFiles: number;
	testedFiles: number;
	coveragePercent: number;
	testedPaths: Set<string>;
	untestedPaths: Set<string>;
	criticalUntested: string[];
}

// Parse imports from test files to see what's actually being tested
function extractTestedFiles(testContent: string, testPath: string): Set<string> {
	const tested = new Set<string>();
	const importRegex = /import\s+(?:{[^}]*}|[\w$]+|\*\s+as\s+[\w$]+)\s+from\s+['"]([^'"]+)['"]/g;

	let match;
	while ((match = importRegex.exec(testContent)) !== null) {
		const importPath = match[1];

		// Skip external modules and test utilities
		if (importPath.startsWith('.') || importPath.startsWith('$')) {
			// Resolve relative imports
			const resolvedPath = importPath.startsWith('.')
				? path.resolve(path.dirname(testPath), importPath)
				: importPath.replace(/^\$lib/, 'src/lib').replace(/^\$app/, '.svelte-kit/runtime/app');

			// Add various possible extensions
			const extensions = ['', '.ts', '.js', '.svelte', '/index.ts', '/index.js'];
			for (const ext of extensions) {
				tested.add(resolvedPath + ext);
			}
		}
	}

	return tested;
}

async function analyzeRealCoverage(): Promise<CoverageStats> {
	// Find all source files
	const sourceFiles = await glob('src/**/*.{ts,js,svelte}', {
		ignore: ['**/*.test.ts', '**/*.spec.ts', '**/test-*.ts', '**/*.d.ts']
	});

	// Find all test files
	const testFiles = await glob('src/**/*.{test,spec}.{ts,js}');

	const testedPaths = new Set<string>();

	// Analyze each test file
	for (const testFile of testFiles) {
		const content = fs.readFileSync(testFile, 'utf-8');
		const tested = extractTestedFiles(content, testFile);
		tested.forEach((path) => testedPaths.add(path));

		// Also check for dynamic imports and mocked modules
		const mockRegex = /vi\.mock\(['"]([^'"]+)['"]/g;
		let mockMatch;
		while ((mockMatch = mockRegex.exec(content)) !== null) {
			const mockedPath = mockMatch[1];
			if (mockedPath.startsWith('.') || mockedPath.startsWith('$')) {
				const resolvedPath = mockedPath.startsWith('.')
					? path.resolve(path.dirname(testFile), mockedPath)
					: mockedPath.replace(/^\$lib/, 'src/lib');
				testedPaths.add(resolvedPath);
			}
		}
	}

	// Normalize paths for comparison
	const normalizedSourceFiles = sourceFiles.map((f) => path.resolve(f));
	const normalizedTestedPaths = new Set<string>();

	testedPaths.forEach((p) => {
		const normalized = path.resolve(p);
		normalizedTestedPaths.add(normalized);
	});

	// Calculate coverage
	const coveredFiles = normalizedSourceFiles.filter((f) => {
		return Array.from(normalizedTestedPaths).some((tested) =>
			tested.includes(f.replace(/\.(ts|js|svelte)$/, ''))
		);
	});

	const untestedFiles = normalizedSourceFiles.filter((f) => !coveredFiles.includes(f));

	// Identify critical untested files
	const criticalPatterns = [
		/routes\/api\//, // API endpoints
		/stores\//, // State management
		/services\//, // Business logic
		/auth\//, // Authentication
		/congress\// // Congressional features
	];

	const criticalUntested = untestedFiles.filter((f) =>
		criticalPatterns.some((pattern) => pattern.test(f))
	);

	return {
		totalFiles: sourceFiles.length,
		testedFiles: coveredFiles.length,
		coveragePercent: (coveredFiles.length / sourceFiles.length) * 100,
		testedPaths: new Set(coveredFiles),
		untestedPaths: new Set(untestedFiles),
		criticalUntested
	};
}

// Generate detailed report
async function generateReport() {
	console.log('🔍 Analyzing Real Test Coverage...\n');

	const stats = await analyzeRealCoverage();

	console.log('📊 Coverage Summary:');
	console.log(`Total Source Files: ${stats.totalFiles}`);
	console.log(`Files with Tests: ${stats.testedFiles}`);
	console.log(`Coverage: ${stats.coveragePercent.toFixed(1)}%\n`);

	console.log('🚨 Critical Untested Files:');
	stats.criticalUntested
		.sort()
		.slice(0, 20)
		.forEach((file) => {
			const relative = path.relative(process.cwd(), file);
			console.log(`  - ${relative}`);
		});

	console.log('\n📁 Coverage by Directory:');
	const dirStats = new Map<string, { total: number; tested: number }>();

	// Calculate directory stats
	const sourceFiles = await glob('src/**/*.{ts,js,svelte}', {
		ignore: ['**/*.test.ts', '**/*.spec.ts', '**/test-*.ts', '**/*.d.ts']
	});

	sourceFiles.forEach((file) => {
		const dir = path.dirname(file).split('/').slice(0, 3).join('/');
		if (!dirStats.has(dir)) {
			dirStats.set(dir, { total: 0, tested: 0 });
		}
		dirStats.get(dir)!.total++;

		if (stats.testedPaths.has(path.resolve(file))) {
			dirStats.get(dir)!.tested++;
		}
	});

	// Display directory stats
	Array.from(dirStats.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.forEach(([dir, stat]) => {
			const percent = ((stat.tested / stat.total) * 100).toFixed(0);
			const bar = '█'.repeat(Math.floor(parseInt(percent) / 10));
			const empty = '░'.repeat(10 - bar.length);
			console.log(`  ${dir.padEnd(40)} ${bar}${empty} ${percent}% (${stat.tested}/${stat.total})`);
		});

	// Export JSON report
	const report = {
		timestamp: new Date().toISOString(),
		summary: {
			totalFiles: stats.totalFiles,
			testedFiles: stats.testedFiles,
			coveragePercent: stats.coveragePercent,
			criticalUntestedCount: stats.criticalUntested.length
		},
		criticalUntested: stats.criticalUntested.map((f) => path.relative(process.cwd(), f)),
		directoryStats: Object.fromEntries(dirStats)
	};

	fs.writeFileSync('real-coverage-report.json', JSON.stringify(report, null, 2));
	console.log('\n✅ Report saved to real-coverage-report.json');
}

generateReport().catch(console.error);
