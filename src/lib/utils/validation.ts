export interface ValidationRule<T = string> {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	pattern?: RegExp;
	custom?: (value: T) => string | null;
}

// Type guard for ValidationRule with generic support
export function isValidationRule<T = string>(obj: unknown): obj is ValidationRule<T> {
	if (typeof obj !== 'object' || obj === null) return false;
	const rule = obj as Record<string, unknown>;

	return (
		(rule.required === undefined || typeof rule.required === 'boolean') &&
		(rule.minLength === undefined || (typeof rule.minLength === 'number' && rule.minLength >= 0)) &&
		(rule.maxLength === undefined || (typeof rule.maxLength === 'number' && rule.maxLength >= 0)) &&
		(rule.pattern === undefined || rule.pattern instanceof RegExp) &&
		(rule.custom === undefined || typeof rule.custom === 'function')
	);
}

export interface ValidationResult {
	isValid: boolean;
	error?: string;
}

export function validateField<T = string>(value: T, rules: ValidationRule<T>): ValidationResult {
	// Enhanced input validation
	if (value === null || value === undefined) {
		return { isValid: false, error: 'Value cannot be null or undefined' };
	}

	if (!isValidationRule<T>(rules)) {
		return { isValid: false, error: 'Invalid validation rules provided' };
	}

	// Convert value to string for length and pattern checks
	const stringValue = String(value);
	// Required check
	if (rules.required && (!stringValue || stringValue.trim() === '')) {
		return { isValid: false, error: 'This field is required' };
	}

	// Skip other validations if field is empty and not required
	if (!stringValue || stringValue.trim() === '') {
		return { isValid: true };
	}

	const trimmedValue = stringValue.trim();

	// Min length check
	if (rules.minLength && trimmedValue.length < rules.minLength) {
		return {
			isValid: false,
			error: `Must be at least ${rules.minLength} character${rules.minLength === 1 ? '' : 's'}`
		};
	}

	// Max length check
	if (rules.maxLength && trimmedValue.length > rules.maxLength) {
		return {
			isValid: false,
			error: `Must be no more than ${rules.maxLength} character${rules.maxLength === 1 ? '' : 's'}`
		};
	}

	// Pattern check
	if (rules.pattern && !rules.pattern.test(trimmedValue)) {
		return {
			isValid: false,
			error: 'Invalid format'
		};
	}

	// Custom validation with proper typing
	if (rules.custom && typeof rules.custom === 'function') {
		try {
			const customError = rules.custom(value);
			if (customError && typeof customError === 'string') {
				return { isValid: false, error: customError };
			}
		} catch {
			console.error('Error occurred');
			return { isValid: false, error: 'Validation error occurred' };
		}
	}

	return { isValid: true };
}

// Export debounce from the dedicated utility file for backward compatibility
export { debounce } from './debounce';

// Template-specific validation rules
export const templateValidationRules = {
	title: {
		required: true,
		minLength: 3,
		maxLength: 200,
		custom: (value: string) => {
			// Check for reasonable title format
			if (value.length > 0 && /^[^a-zA-Z0-9]/.test(value)) {
				return 'Title should start with a letter or number';
			}
			return null;
		}
	} as ValidationRule<string>,

	preview: {
		required: true,
		minLength: 10,
		maxLength: 500,
		custom: (value: string) => {
			// Check for reasonable content
			if (value.length > 0 && value.split(' ').length < 3) {
				return 'Preview should contain at least a few words';
			}
			return null;
		}
	} as ValidationRule<string>,

	message_body: {
		required: true,
		minLength: 20,
		maxLength: 10000,
		custom: (value: string) => {
			// Check for reasonable message content
			if (value.length > 0 && value.split(' ').length < 5) {
				return 'Message should contain meaningful content';
			}

			// Security-aware validation with civic voice - Focus on clear technical violations
			// SSN pattern detection (clear PII violation)
			if (/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/.test(value)) {
				return "Social Security numbers don't belong in public messages to officials";
			}

			// Credit card pattern detection (clear financial PII)
			if (/\b(?:\d{4}[-\s]?){3}\d{4}\b/.test(value)) {
				return "Financial information doesn't belong in advocacy messages";
			}

			// Email pattern in message body (vs variables) - guidance only
			if (
				/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(value) &&
				!value.includes('[') &&
				!value.includes(']')
			) {
				return 'Include your email in the signature, not the message body';
			}

			// Phone number pattern detection - guidance only
			if (/\b(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/.test(value)) {
				return 'Phone numbers in message text can be harvested by bad actors';
			}

			return null;
		}
	} as ValidationRule<string>,

	category: {
		required: false,
		maxLength: 50
	} as ValidationRule<string>,

	description: {
		required: false,
		maxLength: 300
	} as ValidationRule<string>
};

// Type for error callback functions
export type ValidationErrorCallback = (errors: Record<string, string>) => void;

// Real-time validation state manager
export class ValidationManager {
	private validationErrors = new Map<string, string>();
	private validationCallbacks = new Set<ValidationErrorCallback>();

	public addCallback(callback: ValidationErrorCallback): void {
		if (typeof callback !== 'function') {
			throw new Error('Callback must be a function');
		}
		this.validationCallbacks.add(callback);
	}

	public removeCallback(callback: ValidationErrorCallback): void {
		this.validationCallbacks.delete(callback);
	}

	public validateField<T = string>(fieldName: string, value: T, rules: ValidationRule<T>): void {
		if (typeof fieldName !== 'string' || fieldName.trim() === '') {
			throw new Error('Field name must be a non-empty string');
		}

		const result = validateField<T>(value, rules);

		if (result.isValid) {
			this.validationErrors.delete(fieldName);
		} else if (result.error) {
			// result.error exists when isValid is false
			this.validationErrors.set(fieldName, result.error);
		}

		this.notifyCallbacks();
	}

	public getErrors(): Record<string, string> {
		return Object.fromEntries(this.validationErrors);
	}

	public hasErrors(): boolean {
		return this.validationErrors.size > 0;
	}

	public clearErrors(): void {
		this.validationErrors.clear();
		this.notifyCallbacks();
	}

	public clearField(fieldName: string): void {
		if (typeof fieldName !== 'string') {
			throw new Error('Field name must be a string');
		}
		this.validationErrors.delete(fieldName);
		this.notifyCallbacks();
	}

	private notifyCallbacks(): void {
		const errors = this.getErrors();
		this.validationCallbacks.forEach((callback) => {
			try {
				callback(errors);
			} catch {
				console.error('Error occurred');
			}
		});
	}
}
