import { vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

/**
 * Mock-Reality Drift Detection System
 * 
 * Monitors changes in real implementations to detect when mocks
 * need updates to stay synchronized with actual code behavior.
 */

interface MockSignature {
	name: string;
	type: 'function' | 'class' | 'module';
	signature: string;
	lastUpdated: string;
	sourceFile: string;
	checksum: string;
}

interface DriftReport {
	timestamp: string;
	driftsDetected: DriftItem[];
	suggestions: string[];
	severity: 'low' | 'medium' | 'high' | 'critical';
}

interface DriftItem {
	mockName: string;
	sourceFile: string;
	type: 'signature_change' | 'new_method' | 'removed_method' | 'behavioral_change';
	description: string;
	impact: 'low' | 'medium' | 'high';
}

export class MockDriftDetector {
	private static instance: MockDriftDetector;
	private mockRegistry: Map<string, MockSignature> = new Map();
	private driftHistory: DriftReport[] = [];

	static getInstance(): MockDriftDetector {
		if (!MockDriftDetector.instance) {
			MockDriftDetector.instance = new MockDriftDetector();
		}
		return MockDriftDetector.instance;
	}

	/**
	 * Register a mock for drift detection
	 */
	registerMock(
		name: string,
		type: 'function' | 'class' | 'module',
		sourceFile: string,
		mockImplementation: any
	): void {
		const signature = this.generateSignature(mockImplementation, type);
		const checksum = this.generateChecksum(signature);

		this.mockRegistry.set(name, {
			name,
			type,
			signature,
			lastUpdated: new Date().toISOString(),
			sourceFile,
			checksum
		});
	}

	/**
	 * Check for drift in database-related mocks
	 */
	async checkDatabaseMockDrift(): Promise<DriftItem[]> {
		const drifts: DriftItem[] = [];

		try {
			// Check Prisma schema changes
			const schemaPath = path.resolve(process.cwd(), 'prisma/core.prisma');
			const schemaContent = await fs.readFile(schemaPath, 'utf-8');
			
			// Extract model definitions
			const models = this.extractPrismaModels(schemaContent);
			
			// Check if our database mock covers all models
			const registeredMock = this.mockRegistry.get('DatabaseMock');
			if (registeredMock) {
				const mockMethods = this.extractMockMethods(registeredMock.signature);
				const missingModels = models.filter(model => 
					!mockMethods.includes(model.toLowerCase())
				);
				
				if (missingModels.length > 0) {
					drifts.push({
						mockName: 'DatabaseMock',
						sourceFile: 'prisma/core.prisma',
						type: 'new_method',
						description: `Missing database mock methods for models: ${missingModels.join(', ')}`,
						impact: 'medium'
					});
				}
			}
		} catch (error) {
			console.warn('Unable to check database schema drift:', error);
		}

		return drifts;
	}

	/**
	 * Check for drift in API route handlers
	 */
	async checkApiRouteDrift(): Promise<DriftItem[]> {
		const drifts: DriftItem[] = [];

		try {
			// Check src/routes/api directory for new endpoints
			const apiDir = path.resolve(process.cwd(), 'src/routes/api');
			const endpoints = await this.scanApiEndpoints(apiDir);
			
			// Check if we have test coverage for all endpoints
			const testDir = path.resolve(process.cwd(), 'tests/integration');
			const testFiles = await fs.readdir(testDir);
			
			const untestedEndpoints = endpoints.filter(endpoint => {
				const testFileName = `${endpoint.replace(/\//g, '-')}.test.ts`;
				return !testFiles.includes(testFileName) && 
				       !testFiles.some(file => file.includes(endpoint.split('/')[0]));
			});

			if (untestedEndpoints.length > 0) {
				drifts.push({
					mockName: 'API Coverage',
					sourceFile: 'src/routes/api',
					type: 'new_method',
					description: `Untested API endpoints detected: ${untestedEndpoints.join(', ')}`,
					impact: 'high'
				});
			}
		} catch (error) {
			console.warn('Unable to check API route drift:', error);
		}

		return drifts;
	}

	/**
	 * Check for drift in external service integrations
	 */
	checkServiceIntegrationDrift(): DriftItem[] {
		const drifts: DriftItem[] = [];

		// Check if OAuth providers match what we're mocking
		const expectedProviders = ['google', 'facebook', 'discord', 'linkedin', 'twitter'];
		const mockedProviders = Array.from(this.mockRegistry.keys())
			.filter(key => key.toLowerCase().includes('oauth'))
			.map(key => key.toLowerCase());

		const unmockedProviders = expectedProviders.filter(provider => 
			!mockedProviders.some(mock => mock.includes(provider))
		);

		if (unmockedProviders.length > 0) {
			drifts.push({
				mockName: 'OAuth Providers',
				sourceFile: 'src/lib/auth',
				type: 'new_method',
				description: `OAuth providers without mock coverage: ${unmockedProviders.join(', ')}`,
				impact: 'medium'
			});
		}

		return drifts;
	}

	/**
	 * Generate comprehensive drift report
	 */
	async generateDriftReport(): Promise<DriftReport> {
		const allDrifts: DriftItem[] = [
			...(await this.checkDatabaseMockDrift()),
			...(await this.checkApiRouteDrift()),
			...this.checkServiceIntegrationDrift()
		];

		const severity = this.calculateSeverity(allDrifts);
		const suggestions = this.generateSuggestions(allDrifts);

		const report: DriftReport = {
			timestamp: new Date().toISOString(),
			driftsDetected: allDrifts,
			suggestions,
			severity
		};

		this.driftHistory.push(report);
		
		// Keep only last 10 reports
		if (this.driftHistory.length > 10) {
			this.driftHistory = this.driftHistory.slice(-10);
		}

		return report;
	}

	/**
	 * Export drift detection results for CI
	 */
	async exportDriftReport(): Promise<void> {
		const report = await this.generateDriftReport();
		const outputPath = path.resolve(process.cwd(), 'coverage/mock-drift-report.json');
		
		try {
			await fs.mkdir(path.dirname(outputPath), { recursive: true });
			await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
			console.log(`📊 Mock drift report saved to: ${outputPath}`);
		} catch (error) {
			console.warn('Failed to save drift report:', error);
		}
	}

	/**
	 * Automated mock update suggestions
	 */
	generateMockUpdateCode(drifts: DriftItem[]): string {
		const suggestions: string[] = [];

		for (const drift of drifts) {
			switch (drift.type) {
				case 'new_method':
					if (drift.mockName === 'DatabaseMock') {
						suggestions.push(this.generateDatabaseMockUpdate(drift.description));
					}
					break;
				case 'signature_change':
					suggestions.push(`// Update ${drift.mockName} signature in ${drift.sourceFile}`);
					break;
			}
		}

		return suggestions.join('\n\n');
	}

	// Private helper methods

	private generateSignature(implementation: any, type: string): string {
		if (type === 'function') {
			return implementation.toString();
		} else if (type === 'class') {
			return Object.getOwnPropertyNames(implementation.prototype).join(',');
		} else {
			return JSON.stringify(Object.keys(implementation).sort());
		}
	}

	private generateChecksum(signature: string): string {
		// Simple checksum - in production, use a proper hashing algorithm
		return signature.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(16);
	}

	private extractPrismaModels(schemaContent: string): string[] {
		const modelRegex = /model\s+(\w+)\s*{/g;
		const models: string[] = [];
		let match;
		
		while ((match = modelRegex.exec(schemaContent)) !== null) {
			models.push(match[1]);
		}
		
		return models;
	}

	private extractMockMethods(signature: string): string[] {
		// Extract method names from mock signature
		const methodRegex = /(\w+):/g;
		const methods: string[] = [];
		let match;
		
		while ((match = methodRegex.exec(signature)) !== null) {
			methods.push(match[1]);
		}
		
		return methods;
	}

	private async scanApiEndpoints(dir: string): Promise<string[]> {
		const endpoints: string[] = [];
		
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			
			for (const entry of entries) {
				if (entry.isDirectory()) {
					const subEndpoints = await this.scanApiEndpoints(path.join(dir, entry.name));
					endpoints.push(...subEndpoints.map(ep => `${entry.name}/${ep}`));
				} else if (entry.name === '+server.ts' || entry.name === '+server.js') {
					const relativePath = path.relative(path.resolve(process.cwd(), 'src/routes/api'), dir);
					endpoints.push(relativePath || '/');
				}
			}
		} catch (error) {
			// Directory doesn't exist or is not accessible
		}
		
		return endpoints;
	}

	private calculateSeverity(drifts: DriftItem[]): 'low' | 'medium' | 'high' | 'critical' {
		if (drifts.length === 0) return 'low';
		
		const highImpactDrifts = drifts.filter(d => d.impact === 'high').length;
		const mediumImpactDrifts = drifts.filter(d => d.impact === 'medium').length;
		
		if (highImpactDrifts >= 3) return 'critical';
		if (highImpactDrifts >= 1) return 'high';
		if (mediumImpactDrifts >= 3) return 'medium';
		return 'low';
	}

	private generateSuggestions(drifts: DriftItem[]): string[] {
		const suggestions = new Set<string>();
		
		for (const drift of drifts) {
			switch (drift.type) {
				case 'new_method':
					suggestions.add('Review and update mock registry to include new methods');
					break;
				case 'signature_change':
					suggestions.add('Update mock signatures to match current implementations');
					break;
				case 'behavioral_change':
					suggestions.add('Verify mock behavior matches actual implementation');
					break;
			}
		}
		
		suggestions.add('Run tests after mock updates to ensure compatibility');
		suggestions.add('Consider adding integration tests for drift-detected areas');
		
		return Array.from(suggestions);
	}

	private generateDatabaseMockUpdate(description: string): string {
		const models = description.match(/models: (.+)$/)?.[1]?.split(', ') || [];
		
		return models.map(model => `
// Add to DatabaseMock interface:
${model.toLowerCase()}: {
	findUnique: ReturnType<typeof vi.fn>;
	findMany: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

// Add to createDatabaseMock():
${model.toLowerCase()}: {
	findUnique: vi.fn(),
	findMany: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn()
},`).join('\n');
	}
}

// Export for use in tests
export const mockDriftDetector = MockDriftDetector.getInstance();