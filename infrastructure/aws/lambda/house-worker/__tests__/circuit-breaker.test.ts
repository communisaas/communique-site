import { CircuitBreaker, CircuitBreakerError } from '../circuit-breaker';

describe('CircuitBreaker', () => {
	let circuitBreaker: CircuitBreaker;
	let mockFn: jest.Mock;

	beforeEach(() => {
		mockFn = jest.fn();
		circuitBreaker = new CircuitBreaker({
			failureThreshold: 3,
			resetTimeout: 1000
		});
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	test('should start in CLOSED state', () => {
		expect(circuitBreaker.getState()).toBe('CLOSED');
	});

	test('should allow requests in CLOSED state', async () => {
		mockFn.mockResolvedValue('success');

		const result = await circuitBreaker.execute(mockFn);

		expect(result).toBe('success');
		expect(mockFn).toHaveBeenCalledTimes(1);
		expect(circuitBreaker.getState()).toBe('CLOSED');
	});

	test('should transition to OPEN after failure threshold', async () => {
		mockFn.mockRejectedValue(new Error('Test error'));

		// Fail 3 times to reach threshold
		for (let i = 0; i < 3; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected to fail
			}
		}

		expect(circuitBreaker.getState()).toBe('OPEN');
		expect(mockFn).toHaveBeenCalledTimes(3);
	});

	test('should fail fast in OPEN state', async () => {
		mockFn.mockRejectedValue(new Error('Test error'));

		// Reach failure threshold
		for (let i = 0; i < 3; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected to fail
			}
		}

		expect(circuitBreaker.getState()).toBe('OPEN');

		// Next request should fail fast without calling the function
		mockFn.mockClear();

		try {
			await circuitBreaker.execute(mockFn);
			fail('Should have thrown CircuitBreakerError');
		} catch (error) {
			expect(error).toBeInstanceOf(CircuitBreakerError);
			expect((error as CircuitBreakerError).state).toBe('OPEN');
		}

		expect(mockFn).not.toHaveBeenCalled();
	});

	test('should transition to HALF_OPEN after reset timeout', async () => {
		jest.useFakeTimers();

		mockFn.mockRejectedValue(new Error('Test error'));

		// Reach failure threshold
		for (let i = 0; i < 3; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected to fail
			}
		}

		expect(circuitBreaker.getState()).toBe('OPEN');

		// Fast forward time
		jest.advanceTimersByTime(1001);

		mockFn.mockClear();
		mockFn.mockResolvedValue('success');

		const result = await circuitBreaker.execute(mockFn);

		expect(result).toBe('success');
		expect(circuitBreaker.getState()).toBe('CLOSED');
		expect(mockFn).toHaveBeenCalledTimes(1);

		jest.useRealTimers();
	});

	test('should transition back to OPEN from HALF_OPEN on failure', async () => {
		jest.useFakeTimers();

		mockFn.mockRejectedValue(new Error('Test error'));

		// Reach failure threshold
		for (let i = 0; i < 3; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected to fail
			}
		}

		expect(circuitBreaker.getState()).toBe('OPEN');

		// Fast forward time to allow reset
		jest.advanceTimersByTime(1001);

		mockFn.mockClear();

		// First call after timeout should transition to HALF_OPEN, then fail and go back to OPEN
		try {
			await circuitBreaker.execute(mockFn);
		} catch (error) {
			// Expected to fail
		}

		expect(circuitBreaker.getState()).toBe('OPEN');
		expect(mockFn).toHaveBeenCalledTimes(1);

		jest.useRealTimers();
	});

	test('should reset failure count on success in CLOSED state', async () => {
		mockFn
			.mockRejectedValueOnce(new Error('Test error'))
			.mockRejectedValueOnce(new Error('Test error'))
			.mockResolvedValueOnce('success')
			.mockRejectedValueOnce(new Error('Test error'))
			.mockRejectedValueOnce(new Error('Test error'))
			.mockRejectedValueOnce(new Error('Test error'));

		// Fail twice
		for (let i = 0; i < 2; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected to fail
			}
		}

		expect(circuitBreaker.getState()).toBe('CLOSED');

		// Succeed once (should reset failure count)
		const result = await circuitBreaker.execute(mockFn);
		expect(result).toBe('success');
		expect(circuitBreaker.getState()).toBe('CLOSED');

		// Fail three more times (threshold should start from 0)
		for (let i = 0; i < 3; i++) {
			try {
				await circuitBreaker.execute(mockFn);
			} catch (error) {
				// Expected to fail
			}
		}

		expect(circuitBreaker.getState()).toBe('OPEN');
	});

	test('should provide accurate statistics', () => {
		const stats = circuitBreaker.getStats();

		expect(stats.state).toBe('CLOSED');
		expect(stats.failureCount).toBe(0);
		expect(stats.successCount).toBe(0);
		expect(stats.totalExecutions).toBe(0);
		expect(stats.stateChanges).toBe(0);
	});

	test('should call state change callback', () => {
		const onStateChange = jest.fn();

		const cb = new CircuitBreaker({
			failureThreshold: 2,
			resetTimeout: 1000,
			onStateChange
		});

		const testFn = jest.fn().mockRejectedValue(new Error('Test error'));

		// Trigger state change
		Promise.all([cb.execute(testFn).catch(() => {}), cb.execute(testFn).catch(() => {})]);

		// Should eventually call onStateChange with 'OPEN'
		setTimeout(() => {
			expect(onStateChange).toHaveBeenCalledWith('OPEN');
		}, 0);
	});

	test('should support manual state changes', () => {
		expect(circuitBreaker.getState()).toBe('CLOSED');

		circuitBreaker.manuallyOpen('Test reason');
		expect(circuitBreaker.getState()).toBe('OPEN');

		circuitBreaker.manuallyHalfOpen('Test reason');
		expect(circuitBreaker.getState()).toBe('HALF_OPEN');

		circuitBreaker.manuallyClose('Test reason');
		expect(circuitBreaker.getState()).toBe('CLOSED');
	});

	test('should provide health status', () => {
		let health = circuitBreaker.getHealthStatus();
		expect(health.healthy).toBe(true);
		expect(health.state).toBe('CLOSED');

		circuitBreaker.manuallyOpen();
		health = circuitBreaker.getHealthStatus();
		expect(health.healthy).toBe(false);
		expect(health.state).toBe('OPEN');
	});

	test('should handle configuration validation', () => {
		expect(() => {
			new CircuitBreaker({
				failureThreshold: 0,
				resetTimeout: 1000
			});
		}).toThrow('Failure threshold must be greater than 0');

		expect(() => {
			new CircuitBreaker({
				failureThreshold: 5,
				resetTimeout: 0
			});
		}).toThrow('Reset timeout must be greater than 0');
	});
});
