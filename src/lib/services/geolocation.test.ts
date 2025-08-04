import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geolocation, GeolocationService, type GeolocationData, type GeolocationOptions } from './geolocation';

// Mock the apiClient module
const mockApi = {
	get: vi.fn()
};

vi.mock('$lib/utils/apiClient', () => ({
	api: mockApi
}));

// Mock navigator.geolocation
const mockGeolocation = {
	getCurrentPosition: vi.fn()
};

Object.defineProperty(navigator, 'geolocation', {
	value: mockGeolocation,
	configurable: true
});

// Mock btoa for fingerprinting
global.btoa = vi.fn((str: string) => Buffer.from(str).toString('base64'));

describe('GeolocationService', () => {
	let service: GeolocationService;

	beforeEach(() => {
		service = GeolocationService.getInstance();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Singleton Pattern', () => {
		it('should return the same instance', () => {
			const instance1 = GeolocationService.getInstance();
			const instance2 = GeolocationService.getInstance();
			expect(instance1).toBe(instance2);
		});

		it('should return the same instance as exported singleton', () => {
			const instance = GeolocationService.getInstance();
			expect(instance).toBe(geolocation);
		});
	});

	describe('getLocation', () => {
		it('should get location from browser API successfully', async () => {
			const mockPosition = {
				coords: {
					latitude: 37.7749,
					longitude: -122.4194,
					accuracy: 10
				}
			};

			mockGeolocation.getCurrentPosition.mockImplementation((success) => {
				success(mockPosition);
			});

			const result = await service.getLocation();

			expect(result).toEqual({
				source: 'browser_api',
				coordinates: {
					lat: 37.7749,
					lng: -122.4194,
					accuracy: 10
				},
				timestamp: expect.any(Number),
				confidence: 1.0 // High accuracy = high confidence
			});
		});

		it('should fallback to IP location when browser API fails', async () => {
			mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
				error(new Error('Permission denied'));
			});

			mockApi.get.mockResolvedValue({
				success: true,
				data: {
					postal_code: '94102',
					city: 'San Francisco',
					region_code: 'CA'
				}
			});

			const result = await service.getLocation();

			expect(result).toEqual({
				source: 'ip_fallback',
				address: {
					zip: '94102',
					city: 'San Francisco',
					state: 'CA'
				},
				timestamp: expect.any(Number),
				confidence: 0.3
			});

			expect(mockApi.get).toHaveBeenCalledWith('/api/geo/ip-location');
		});

		it('should respect custom options', async () => {
			const mockPosition = {
				coords: {
					latitude: 37.7749,
					longitude: -122.4194,
					accuracy: 50
				}
			};

			mockGeolocation.getCurrentPosition.mockImplementation((success) => {
				success(mockPosition);
			});

			const options: GeolocationOptions = {
				enableHighAccuracy: false,
				timeout: 5000,
				maximumAge: 60000
			};

			await service.getLocation(options);

			expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
				expect.any(Function),
				expect.any(Function),
				{
					enableHighAccuracy: false,
					timeout: 5000,
					maximumAge: 60000
				}
			);
		});

		it('should fail when all location methods fail', async () => {
			mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
				error(new Error('Permission denied'));
			});

			mockApi.get.mockResolvedValue({
				success: false,
				error: 'IP location failed'
			});

			await expect(service.getLocation()).rejects.toThrow('All geolocation methods failed');
		});

		it('should skip IP fallback when fallbackToIP is false', async () => {
			mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
				error(new Error('Permission denied'));
			});

			await expect(service.getLocation({ fallbackToIP: false })).rejects.toThrow('All geolocation methods failed');
			expect(mockApi.get).not.toHaveBeenCalled();
		});
	});

	describe('coordinatesToDistrict', () => {
		it('should convert coordinates to district successfully', async () => {
			mockApi.get.mockResolvedValue({
				success: true,
				data: {
					congressional_district: 'CA-12',
					state_house_district: 'AD-17',
					state_senate_district: 'SD-11'
				}
			});

			const result = await service.coordinatesToDistrict(37.7749, -122.4194);

			expect(result).toEqual({
				congressional: 'CA-12',
				state_house: 'AD-17',
				state_senate: 'SD-11'
			});

			expect(mockApi.get).toHaveBeenCalledWith('/api/geo/district?lat=37.7749&lng=-122.4194');
		});

		it('should return undefined when API fails', async () => {
			mockApi.get.mockResolvedValue({
				success: false,
				error: 'District not found'
			});

			const result = await service.coordinatesToDistrict(37.7749, -122.4194);
			expect(result).toBeUndefined();
		});

		it('should handle network errors gracefully', async () => {
			mockApi.get.mockRejectedValue(new Error('Network error'));

			const result = await service.coordinatesToDistrict(37.7749, -122.4194);
			expect(result).toBeUndefined();
		});
	});

	describe('zipToDistrict', () => {
		it('should convert ZIP to district successfully', async () => {
			mockApi.get.mockResolvedValue({
				success: true,
				data: {
					congressional_district: 'CA-12'
				}
			});

			const result = await service.zipToDistrict('94102');

			expect(result).toEqual({
				congressional: 'CA-12'
			});

			expect(mockApi.get).toHaveBeenCalledWith('/api/geo/zip-district?zip=94102');
		});

		it('should return undefined when API fails', async () => {
			mockApi.get.mockResolvedValue({
				success: false,
				error: 'ZIP not found'
			});

			const result = await service.zipToDistrict('94102');
			expect(result).toBeUndefined();
		});
	});

	describe('requestManualAddress', () => {
		it('should throw error for UI integration requirement', async () => {
			await expect(service.requestManualAddress()).rejects.toThrow('Manual address collection requires UI integration');
		});
	});

	describe('validateLocation', () => {
		it('should validate location without expected district', async () => {
			const location: GeolocationData = {
				source: 'browser_api',
				coordinates: { lat: 37.7749, lng: -122.4194, accuracy: 10 },
				timestamp: Date.now(),
				confidence: 0.9
			};

			const result = await service.validateLocation(location);

			expect(result).toEqual({
				valid: true,
				confidence: 0.9
			});
		});

		it('should validate location with matching district', async () => {
			const location: GeolocationData = {
				source: 'browser_api',
				coordinates: { lat: 37.7749, lng: -122.4194, accuracy: 10 },
				timestamp: Date.now(),
				confidence: 0.9
			};

			mockApi.get.mockResolvedValue({
				success: true,
				data: {
					congressional_district: 'CA-12'
				}
			});

			const result = await service.validateLocation(location, 'CA-12');

			expect(result).toEqual({
				valid: true,
				confidence: 0.9
			});
		});

		it('should validate location with non-matching district', async () => {
			const location: GeolocationData = {
				source: 'browser_api',
				coordinates: { lat: 37.7749, lng: -122.4194, accuracy: 10 },
				timestamp: Date.now(),
				confidence: 0.9
			};

			mockApi.get.mockResolvedValue({
				success: true,
				data: {
					congressional_district: 'CA-11'
				}
			});

			const result = await service.validateLocation(location, 'CA-12');

			expect(result).toEqual({
				valid: false,
				confidence: 0.45 // Reduced confidence
			});
		});

		it('should validate ZIP-based location', async () => {
			const location: GeolocationData = {
				source: 'ip_fallback',
				address: { zip: '94102' },
				timestamp: Date.now(),
				confidence: 0.3
			};

			mockApi.get.mockResolvedValue({
				success: true,
				data: {
					congressional_district: 'CA-12'
				}
			});

			const result = await service.validateLocation(location, 'CA-12');

			expect(result).toEqual({
				valid: true,
				confidence: 0.3
			});

			expect(mockApi.get).toHaveBeenCalledWith('/api/geo/zip-district?zip=94102');
		});

		it('should handle validation errors', async () => {
			const location: GeolocationData = {
				source: 'browser_api',
				coordinates: { lat: 37.7749, lng: -122.4194, accuracy: 10 },
				timestamp: Date.now(),
				confidence: 0.9
			};

			mockApi.get.mockRejectedValue(new Error('API error'));

			const result = await service.validateLocation(location, 'CA-12');

			expect(result).toEqual({
				valid: false,
				confidence: 0
			});
		});
	});

	describe('generateLocationFingerprint', () => {
		it('should generate fingerprint for coordinate-based location', () => {
			const location: GeolocationData = {
				source: 'browser_api',
				coordinates: { lat: 37.7749, lng: -122.4194, accuracy: 10 },
				timestamp: 1234567890,
				confidence: 0.9
			};

			global.btoa = vi.fn().mockReturnValue('YnJvd3Nlcl9hcGl8MzcuNzc1LC0xMjIuNDE5fHwxMjM0NTY3ODkwfDAuOQ==');

			const fingerprint = service.generateLocationFingerprint(location);

			expect(fingerprint).toBe('YnJvd3Nlcl9hcGl8');
			expect(global.btoa).toHaveBeenCalledWith('browser_api|37.775,-122.419||1234567890|0.9');
		});

		it('should generate fingerprint for address-based location', () => {
			const location: GeolocationData = {
				source: 'ip_fallback',
				address: { zip: '94102' },
				timestamp: 1234567890,
				confidence: 0.3
			};

			global.btoa = vi.fn().mockReturnValue('aXBfZmFsbGJhY2t8fDk0MTAyfDEyMzQ1Njc4OTB8MC4z');

			const fingerprint = service.generateLocationFingerprint(location);

			expect(fingerprint).toBe('aXBfZmFsbGJhY2t8');
			expect(global.btoa).toHaveBeenCalledWith('ip_fallback||94102|1234567890|0.3');
		});
	});

	describe('calculateLocationConfidence', () => {
		it('should calculate confidence based on accuracy', () => {
			// Test private method through public interface
			const testAccuracies = [
				{ accuracy: 5, expected: 1.0 },
				{ accuracy: 25, expected: 0.9 },
				{ accuracy: 75, expected: 0.8 },
				{ accuracy: 250, expected: 0.6 },
				{ accuracy: 750, expected: 0.4 },
				{ accuracy: 2000, expected: 0.2 }
			];

			testAccuracies.forEach(({ accuracy, expected }) => {
				const mockPosition = {
					coords: {
						latitude: 37.7749,
						longitude: -122.4194,
						accuracy
					}
				};

				mockGeolocation.getCurrentPosition.mockImplementation((success) => {
					success(mockPosition);
				});

				service.getLocation().then((result) => {
					expect(result.confidence).toBe(expected);
				});
			});
		});
	});

	describe('Browser API not supported', () => {
		it('should handle missing geolocation API', async () => {
			// Temporarily remove geolocation
			const originalGeolocation = navigator.geolocation;
			Object.defineProperty(navigator, 'geolocation', {
				value: undefined,
				configurable: true
			});

			mockApi.get.mockResolvedValue({
				success: true,
				data: {
					postal_code: '94102',
					city: 'San Francisco',
					region_code: 'CA'
				}
			});

			const result = await service.getLocation();

			expect(result.source).toBe('ip_fallback');

			// Restore geolocation
			Object.defineProperty(navigator, 'geolocation', {
				value: originalGeolocation,
				configurable: true
			});
		});
	});
});