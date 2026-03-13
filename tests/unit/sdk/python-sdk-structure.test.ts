import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Python SDK structure', () => {
	const sdkRoot = path.resolve('packages/sdk-python');

	it('has pyproject.toml', () => {
		expect(fs.existsSync(path.join(sdkRoot, 'pyproject.toml'))).toBe(true);
	});

	it('has commons package with __init__.py', () => {
		expect(fs.existsSync(path.join(sdkRoot, 'commons', '__init__.py'))).toBe(true);
	});

	it('has all required modules', () => {
		for (const mod of ['client.py', 'types.py', 'errors.py', 'pagination.py']) {
			expect(
				fs.existsSync(path.join(sdkRoot, 'commons', mod)),
				`Missing module: ${mod}`
			).toBe(true);
		}
	});

	it('has README.md', () => {
		expect(fs.existsSync(path.join(sdkRoot, 'README.md'))).toBe(true);
	});

	it('pyproject.toml has correct name', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'pyproject.toml'), 'utf-8');
		expect(content).toContain('name = "commons-sdk"');
	});

	it('pyproject.toml requires Python 3.9+', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'pyproject.toml'), 'utf-8');
		expect(content).toContain('requires-python');
		expect(content).toContain('3.9');
	});

	it('pyproject.toml depends on httpx', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'pyproject.toml'), 'utf-8');
		expect(content).toContain('httpx');
	});

	it('__init__.py exports Commons class', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'commons', '__init__.py'), 'utf-8');
		expect(content).toContain('class Commons');
	});

	it('__init__.py exports AsyncCommons class', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'commons', '__init__.py'), 'utf-8');
		expect(content).toContain('AsyncCommons');
	});

	it('errors.py defines error classes', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'commons', 'errors.py'), 'utf-8');
		expect(content).toContain('CommonsError');
		expect(content).toContain('AuthenticationError');
		expect(content).toContain('NotFoundError');
		expect(content).toContain('RateLimitError');
	});

	it('types.py defines resource TypedDicts', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'commons', 'types.py'), 'utf-8');
		expect(content).toContain('Supporter');
		expect(content).toContain('Campaign');
		expect(content).toContain('Event');
		expect(content).toContain('Donation');
	});

	it('pagination.py defines CursorPage', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'commons', 'pagination.py'), 'utf-8');
		expect(content).toContain('CursorPage');
	});

	it('__init__.py has all resource namespaces', () => {
		const content = fs.readFileSync(path.join(sdkRoot, 'commons', '__init__.py'), 'utf-8');
		for (const resource of [
			'supporters',
			'campaigns',
			'events',
			'donations',
			'workflows',
			'sms',
			'calls',
			'tags',
			'representatives',
			'usage',
			'org',
			'keys'
		]) {
			expect(
				content.includes(`self.${resource}`),
				`Missing resource namespace: ${resource}`
			).toBe(true);
		}
	});
});
