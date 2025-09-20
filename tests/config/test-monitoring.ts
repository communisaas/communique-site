import { afterAll, afterEach, beforeAll } from 'vitest';
import { mockDriftDetector } from './mock-drift-detection';
import fs from 'fs/promises';
import path from 'path';

/**
 * Test Monitoring and Health Tracking System
 * 
 * Monitors test execution health, performance, and failure patterns
 * to provide insights for maintenance and optimization.
 */

interface TestMetrics {
	testName: string;
	suite: string;
	duration: number;
	status: 'passed' | 'failed' | 'skipped';
	timestamp: string;
	memoryUsage?: NodeJS.MemoryUsage;
	errorMessage?: string;
	retryCount?: number;
}

interface TestSuiteReport {
	timestamp: string;
	totalTests: number;
	passed: number;
	failed: number;
	skipped: number;
	totalDuration: number;
	averageDuration: number;
	slowestTests: TestMetrics[];
	failurePatterns: FailurePattern[];
	memoryLeaks: MemoryLeak[];
	recommendations: string[];
}

interface FailurePattern {
	pattern: string;
	frequency: number;
	affectedTests: string[];
	category: 'oauth' | 'database' | 'api' | 'environment' | 'timeout' | 'mock' | 'other';
}

interface MemoryLeak {
	testName: string;
	startMemory: number;
	endMemory: number;
	leakSize: number;
	severity: 'low' | 'medium' | 'high';
}

export class TestMonitor {
	private static instance: TestMonitor;
	private testMetrics: TestMetrics[] = [];
	private suiteStartTime: number = 0;
	private initialMemory: NodeJS.MemoryUsage | null = null;

	static getInstance(): TestMonitor {
		if (!TestMonitor.instance) {
			TestMonitor.instance = new TestMonitor();
		}
		return TestMonitor.instance;
	}

	/**
	 * Initialize monitoring for test suite
	 */
	startMonitoring(): void {
		this.suiteStartTime = Date.now();
		this.initialMemory = process.memoryUsage();
		this.testMetrics = [];
	}

	/**
	 * Record test execution metrics
	 */
	recordTest(
		testName: string,
		suite: string,
		duration: number,
		status: 'passed' | 'failed' | 'skipped',
		errorMessage?: string,
		retryCount?: number
	): void {
		this.testMetrics.push({
			testName,
			suite,
			duration,
			status,
			timestamp: new Date().toISOString(),
			memoryUsage: process.memoryUsage(),
			errorMessage,
			retryCount
		});
	}

	/**
	 * Analyze failure patterns to identify systemic issues
	 */
	analyzeFailurePatterns(): FailurePattern[] {
		const failures = this.testMetrics.filter(m => m.status === 'failed');
		const patterns = new Map<string, FailurePattern>();

		for (const failure of failures) {
			if (!failure.errorMessage) continue;

			const category = this.categorizeFailure(failure.errorMessage);
			const pattern = this.extractFailurePattern(failure.errorMessage);

			if (!patterns.has(pattern)) {
				patterns.set(pattern, {
					pattern,
					frequency: 0,
					affectedTests: [],
					category
				});
			}

			const existing = patterns.get(pattern)!;
			existing.frequency++;
			existing.affectedTests.push(`${failure.suite} > ${failure.testName}`);
		}

		return Array.from(patterns.values())
			.filter(p => p.frequency >= 2) // Only patterns affecting 2+ tests
			.sort((a, b) => b.frequency - a.frequency);
	}

	/**
	 * Detect potential memory leaks in tests
	 */
	detectMemoryLeaks(): MemoryLeak[] {
		const leaks: MemoryLeak[] = [];
		
		if (!this.initialMemory) return leaks;

		const memoryThreshold = 50 * 1024 * 1024; // 50MB threshold
		let previousMemory = this.initialMemory.heapUsed;

		for (const metric of this.testMetrics) {
			if (!metric.memoryUsage) continue;

			const currentMemory = metric.memoryUsage.heapUsed;
			const memoryDelta = currentMemory - previousMemory;

			if (memoryDelta > memoryThreshold) {
				leaks.push({
					testName: `${metric.suite} > ${metric.testName}`,
					startMemory: previousMemory,
					endMemory: currentMemory,
					leakSize: memoryDelta,
					severity: memoryDelta > 100 * 1024 * 1024 ? 'high' : 
					         memoryDelta > 75 * 1024 * 1024 ? 'medium' : 'low'
				});
			}

			previousMemory = currentMemory;
		}

		return leaks;
	}

	/**
	 * Generate comprehensive test health report
	 */
	generateHealthReport(): TestSuiteReport {
		const totalTests = this.testMetrics.length;
		const passed = this.testMetrics.filter(m => m.status === 'passed').length;
		const failed = this.testMetrics.filter(m => m.status === 'failed').length;
		const skipped = this.testMetrics.filter(m => m.status === 'skipped').length;
		
		const totalDuration = this.testMetrics.reduce((sum, m) => sum + m.duration, 0);
		const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;

		const slowestTests = this.testMetrics
			.filter(m => m.status === 'passed' || m.status === 'failed')
			.sort((a, b) => b.duration - a.duration)
			.slice(0, 10);

		const failurePatterns = this.analyzeFailurePatterns();
		const memoryLeaks = this.detectMemoryLeaks();
		const recommendations = this.generateRecommendations(failurePatterns, memoryLeaks, averageDuration);

		return {
			timestamp: new Date().toISOString(),
			totalTests,
			passed,
			failed,
			skipped,
			totalDuration,
			averageDuration,
			slowestTests,
			failurePatterns,
			memoryLeaks,
			recommendations
		};
	}

	/**
	 * Export monitoring results for CI analysis
	 */
	async exportHealthReport(): Promise<void> {
		const report = this.generateHealthReport();
		const outputPath = path.resolve(process.cwd(), 'coverage/test-health-report.json');
		
		try {
			await fs.mkdir(path.dirname(outputPath), { recursive: true });
			await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
			
			// Also generate human-readable summary
			await this.exportHealthSummary(report);
			
			console.log(`📊 Test health report saved to: ${outputPath}`);
		} catch (error) {
			console.warn('Failed to save test health report:', error);
		}
	}

	/**
	 * Generate actionable maintenance tasks
	 */
	generateMaintenanceTasks(): string[] {
		const tasks: string[] = [];
		const report = this.generateHealthReport();

		// High-frequency failure patterns
		const criticalPatterns = report.failurePatterns.filter(p => p.frequency >= 5);
		if (criticalPatterns.length > 0) {
			tasks.push(`🚨 CRITICAL: Address high-frequency failure patterns: ${criticalPatterns.map(p => p.category).join(', ')}`);
		}

		// Memory leaks
		const severleLeaks = report.memoryLeaks.filter(l => l.severity === 'high');
		if (severleLeaks.length > 0) {
			tasks.push(`🧠 MEMORY: Fix memory leaks in: ${severleLeaks.map(l => l.testName).join(', ')}`);
		}

		// Slow tests
		const slowTests = report.slowestTests.filter(t => t.duration > 5000);
		if (slowTests.length > 0) {
			tasks.push(`⏱️ PERFORMANCE: Optimize slow tests (>${(5000/1000)}s): ${slowTests.length} tests`);
		}

		// OAuth-specific issues
		const oauthIssues = report.failurePatterns.filter(p => p.category === 'oauth');
		if (oauthIssues.length > 0) {
			tasks.push(`🔐 OAUTH: Review OAuth test configuration and mocks`);
		}

		// Mock drift
		tasks.push(`🎭 MOCKS: Run mock drift detection weekly`);
		tasks.push(`📊 MONITORING: Review test health reports monthly`);

		return tasks;
	}

	// Private helper methods

	private categorizeFailure(errorMessage: string): FailurePattern['category'] {
		const msg = errorMessage.toLowerCase();
		
		if (msg.includes('oauth') || msg.includes('authorization') || msg.includes('token')) {
			return 'oauth';
		}
		if (msg.includes('database') || msg.includes('prisma') || msg.includes('sql')) {
			return 'database';
		}
		if (msg.includes('timeout') || msg.includes('timed out')) {
			return 'timeout';
		}
		if (msg.includes('mock') || msg.includes('stub') || msg.includes('spy')) {
			return 'mock';
		}
		if (msg.includes('api') || msg.includes('request') || msg.includes('response')) {
			return 'api';
		}
		if (msg.includes('environment') || msg.includes('env') || msg.includes('variable')) {
			return 'environment';
		}
		
		return 'other';
	}

	private extractFailurePattern(errorMessage: string): string {
		// Simplify error messages to patterns
		return errorMessage
			.replace(/\d+/g, 'N') // Replace numbers with N
			.replace(/['"`][^'"`]*['"`]/g, 'STRING') // Replace strings
			.replace(/\/[^\/\s]+/g, '/PATH') // Replace paths
			.substring(0, 100); // Limit length
	}

	private generateRecommendations(
		patterns: FailurePattern[],
		leaks: MemoryLeak[],
		avgDuration: number
	): string[] {
		const recommendations: string[] = [];

		// Failure pattern recommendations
		if (patterns.length > 0) {
			const topCategory = patterns[0].category;
			switch (topCategory) {
				case 'oauth':
					recommendations.push('Review OAuth test setup and consider using more stable mock implementations');
					break;
				case 'database':
					recommendations.push('Check database connection stability and consider test isolation improvements');
					break;
				case 'timeout':
					recommendations.push('Increase test timeouts for CI environment or optimize slow operations');
					break;
				case 'mock':
					recommendations.push('Review mock implementations for consistency with real services');
					break;
			}
		}

		// Memory recommendations
		if (leaks.length > 0) {
			recommendations.push('Implement proper cleanup in test teardown to prevent memory leaks');
			recommendations.push('Consider using beforeEach/afterEach for test isolation');
		}

		// Performance recommendations
		if (avgDuration > 2000) {
			recommendations.push('Consider parallelizing slow tests or optimizing test setup');
		}

		// General maintenance
		recommendations.push('Run mock drift detection regularly to catch API changes');
		recommendations.push('Monitor test health reports for trends and early warning signs');

		return recommendations;
	}

	private async exportHealthSummary(report: TestSuiteReport): Promise<void> {
		const summary = `# Test Health Summary

Generated: ${report.timestamp}

## Overview
- Total Tests: ${report.totalTests}
- Passed: ${report.passed} (${((report.passed / report.totalTests) * 100).toFixed(1)}%)
- Failed: ${report.failed}
- Skipped: ${report.skipped}
- Average Duration: ${report.averageDuration.toFixed(2)}ms

## Issues Found
${report.failurePatterns.length > 0 ? `
### Failure Patterns
${report.failurePatterns.map(p => `- ${p.category.toUpperCase()}: ${p.pattern} (${p.frequency} occurrences)`).join('\n')}
` : '✅ No failure patterns detected'}

${report.memoryLeaks.length > 0 ? `
### Memory Leaks
${report.memoryLeaks.map(l => `- ${l.testName}: +${(l.leakSize / 1024 / 1024).toFixed(1)}MB (${l.severity})`).join('\n')}
` : '✅ No memory leaks detected'}

## Maintenance Tasks
${this.generateMaintenanceTasks().join('\n')}

## Slowest Tests
${report.slowestTests.slice(0, 5).map(t => `- ${t.suite} > ${t.testName}: ${t.duration}ms`).join('\n')}
`;

		const summaryPath = path.resolve(process.cwd(), 'coverage/test-health-summary.md');
		await fs.writeFile(summaryPath, summary);
	}
}

// Global test monitoring setup
const monitor = TestMonitor.getInstance();

// Initialize monitoring before all tests
beforeAll(() => {
	monitor.startMonitoring();
});

// Export reports after all tests complete
afterAll(async () => {
	await monitor.exportHealthReport();
	await mockDriftDetector.exportDriftReport();
});

export default TestMonitor;