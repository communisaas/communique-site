#!/usr/bin/env tsx

/**
 * COMPREHENSIVE TEST COVERAGE ANALYZER
 *
 * Analyzes codebase for test coverage gaps without requiring database connections.
 * Provides actionable insights for systematic test improvement.
 */

import { glob } from 'glob';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, basename } from 'path';

interface SourceFile {
	path: string;
	lines: number;
	type: 'component' | 'service' | 'api' | 'store' | 'util' | 'type';
	hasTest: boolean;
	testPath?: string;
	complexity: 'low' | 'medium' | 'high';
	businessCriticality: 'low' | 'medium' | 'high' | 'critical';
}

interface CoverageReport {
	totalFiles: number;
	testedFiles: number;
	coveragePercentage: number;
	gapsByType: Record<string, number>;
	criticalGaps: SourceFile[];
	recommendations: string[];
}

async function analyzeTestCoverage(): Promise<CoverageReport> {
	console.log('🔍 ANALYZING TEST COVERAGE...');

	// Find all source files
	const sourceFiles = await glob('src/**/*.{ts,js,svelte}', {
		ignore: [
			'src/**/*.test.ts',
			'src/**/*.spec.ts',
			'src/**/*.d.ts',
			'src/app.html',
			'src/hooks.server.ts',
			'src/hooks.client.ts'
		]
	});

	// Find all test files
	const testFiles = await glob('src/**/*.{test,spec}.{ts,js}');
	const e2eFiles = await glob('e2e/**/*.spec.ts');

	console.log(`📁 Found ${sourceFiles.length} source files`);
	console.log(`🧪 Found ${testFiles.length} unit tests + ${e2eFiles.length} E2E tests`);

	const sourceAnalysis: SourceFile[] = [];

	for (const filePath of sourceFiles) {
		const content = readFileSync(filePath, 'utf-8');
		const lines = content.split('\n').length;

		// Determine file type
		const type = getFileType(filePath);

		// Check if test exists
		const testPath = findTestFile(filePath, testFiles);
		const hasTest = !!testPath;

		// Analyze complexity
		const complexity = analyzeComplexity(content, filePath);

		// Determine business criticality
		const businessCriticality = analyzeCriticality(filePath, content);

		sourceAnalysis.push({
			path: filePath,
			lines,
			type,
			hasTest,
			testPath,
			complexity,
			businessCriticality
		});
	}

	// Generate coverage report
	const testedFiles = sourceAnalysis.filter((f) => f.hasTest).length;
	const coveragePercentage = Math.round((testedFiles / sourceAnalysis.length) * 100);

	const gapsByType: Record<string, number> = {};
	sourceAnalysis.forEach((file) => {
		if (!file.hasTest) {
			gapsByType[file.type] = (gapsByType[file.type] || 0) + 1;
		}
	});

	// Identify critical gaps
	const criticalGaps = sourceAnalysis
		.filter(
			(f) =>
				!f.hasTest &&
				(f.businessCriticality === 'critical' || f.businessCriticality === 'high') &&
				f.complexity !== 'low'
		)
		.sort((a, b) => {
			const criticalityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
			const complexityWeight = { high: 3, medium: 2, low: 1 };

			const aWeight = criticalityWeight[a.businessCriticality] * complexityWeight[a.complexity];
			const bWeight = criticalityWeight[b.businessCriticality] * complexityWeight[b.complexity];

			return bWeight - aWeight;
		});

	// Generate recommendations
	const recommendations = generateRecommendations(sourceAnalysis, criticalGaps);

	return {
		totalFiles: sourceAnalysis.length,
		testedFiles,
		coveragePercentage,
		gapsByType,
		criticalGaps,
		recommendations
	};
}

function getFileType(filePath: string): SourceFile['type'] {
	if (filePath.includes('/api/')) return 'api';
	if (filePath.includes('/stores/')) return 'store';
	if (filePath.includes('/services/')) return 'service';
	if (filePath.includes('/components/')) return 'component';
	if (filePath.includes('/lib/') && filePath.includes('/types')) return 'type';
	if (filePath.endsWith('.svelte')) return 'component';
	return 'util';
}

function findTestFile(sourcePath: string, testFiles: string[]): string | undefined {
	const baseName = basename(sourcePath, '.ts').replace('.svelte', '');
	const dirName = dirname(sourcePath);

	return testFiles.find((testPath) => {
		const testBaseName = basename(testPath).replace(/\.(test|spec)\.ts$/, '');
		const testDirName = dirname(testPath);

		return testBaseName === baseName && testDirName === dirName;
	});
}

function analyzeComplexity(content: string, _filePath: string): SourceFile['complexity'] {
	// Simple heuristic based on code patterns
	const lines = content.split('\n').length;
	const functions = (content.match(/function |const \w+ = |async |await /g) || []).length;
	const conditionals = (content.match(/if |else |switch |case |try |catch /g) || []).length;
	const loops = (content.match(/for |while |forEach |map |filter /g) || []).length;

	const complexityScore = functions + conditionals * 2 + loops + lines / 50;

	if (complexityScore > 20) return 'high';
	if (complexityScore > 10) return 'medium';
	return 'low';
}

function analyzeCriticality(filePath: string, content: string): SourceFile['businessCriticality'] {
	// Critical business paths
	if (filePath.includes('/auth/') || content.includes('auth') || content.includes('session')) {
		return 'critical';
	}

	if (
		filePath.includes('/api/') ||
		filePath.includes('/stores/templates') ||
		filePath.includes('/congress/')
	) {
		return 'high';
	}

	if (filePath.includes('/services/') || filePath.includes('/components/')) {
		return 'medium';
	}

	return 'low';
}

function generateRecommendations(
	sourceAnalysis: SourceFile[],
	criticalGaps: SourceFile[]
): string[] {
	const recommendations: string[] = [];

	// Priority 1: Critical gaps
	if (criticalGaps.length > 0) {
		recommendations.push(`🚨 CRITICAL: ${criticalGaps.length} high-priority files lack tests:`);
		criticalGaps.slice(0, 5).forEach((file) => {
			recommendations.push(
				`   • ${file.path} (${file.businessCriticality} criticality, ${file.complexity} complexity)`
			);
		});
	}

	// Priority 2: API coverage
	const untestedApis = sourceAnalysis.filter((f) => f.type === 'api' && !f.hasTest);
	if (untestedApis.length > 0) {
		recommendations.push(`🔌 API COVERAGE: ${untestedApis.length} API endpoints lack tests`);
	}

	// Priority 3: Store coverage
	const untestedStores = sourceAnalysis.filter((f) => f.type === 'store' && !f.hasTest);
	if (untestedStores.length > 0) {
		recommendations.push(`📦 STORE COVERAGE: ${untestedStores.length} stores lack tests`);
	}

	// Priority 4: Service coverage
	const untestedServices = sourceAnalysis.filter((f) => f.type === 'service' && !f.hasTest);
	if (untestedServices.length > 0) {
		recommendations.push(`⚙️  SERVICE COVERAGE: ${untestedServices.length} services lack tests`);
	}

	return recommendations;
}

async function main() {
	try {
		const report = await analyzeTestCoverage();

		console.log('\n' + '='.repeat(50));
		console.log('📊 TEST COVERAGE ANALYSIS REPORT');
		console.log('='.repeat(50));

		console.log(`\n📈 OVERALL COVERAGE:`);
		console.log(
			`   Files Tested: ${report.testedFiles}/${report.totalFiles} (${report.coveragePercentage}%)`
		);

		console.log(`\n📂 GAPS BY TYPE:`);
		Object.entries(report.gapsByType).forEach(([type, count]) => {
			console.log(`   ${type}: ${count} untested files`);
		});

		console.log(`\n🎯 CRITICAL GAPS (${report.criticalGaps.length}):`);
		report.criticalGaps.slice(0, 10).forEach((file) => {
			console.log(`   • ${file.path}`);
			console.log(
				`     └─ ${file.businessCriticality} business impact, ${file.complexity} complexity`
			);
		});

		console.log(`\n💡 RECOMMENDATIONS:`);
		report.recommendations.forEach((rec) => {
			console.log(`   ${rec}`);
		});

		// Write detailed report
		const detailedReport = {
			timestamp: new Date().toISOString(),
			summary: {
				totalFiles: report.totalFiles,
				testedFiles: report.testedFiles,
				coveragePercentage: report.coveragePercentage
			},
			gaps: report.gapsByType,
			criticalGaps: report.criticalGaps,
			recommendations: report.recommendations
		};

		writeFileSync('test-coverage-report.json', JSON.stringify(detailedReport, null, 2));
		console.log(`\n📄 Detailed report saved to test-coverage-report.json`);
	} catch (error) {
		console.error('❌ Analysis failed:', error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
