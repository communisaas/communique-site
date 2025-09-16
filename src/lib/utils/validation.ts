export interface ValidationRule {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	pattern?: RegExp;
	custom?: (value: string) => string | null;
}

export interface ValidationResult {
	isValid: boolean;
	error?: string;
}

export function validateField(value: string, rules: ValidationRule): ValidationResult {
	// Required check
	if (rules.required && (!value || value.trim() === '')) {
		return { isValid: false, error: 'This field is required' };
	}

	// Skip other validations if field is empty and not required
	if (!value || value.trim() === '') {
		return { isValid: true };
	}

	const trimmedValue = value.trim();

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

	// Custom validation
	if (rules.custom) {
		const customError = rules.custom(trimmedValue);
		if (customError) {
			return { isValid: false, error: customError };
		}
	}

	return { isValid: true };
}

// Debounce utility for real-time validation
export function debounce<T extends (...args: any[]) => void>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout>;

	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

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
	} as ValidationRule,

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
	} as ValidationRule,

	message_body: {
		required: true,
		minLength: 20,
		maxLength: 10000,
		custom: (value: string) => {
			// Check for reasonable message content
			if (value.length > 0 && value.split(' ').length < 5) {
				return 'Message should contain meaningful content';
			}
			return null;
		}
	} as ValidationRule,

	category: {
		required: false,
		maxLength: 50
	} as ValidationRule,

	description: {
		required: false,
		maxLength: 300
	} as ValidationRule
};

// Real-time validation state manager
export class ValidationManager {
	private validationErrors = new Map<string, string>();
	private validationCallbacks = new Set<(errors: Record<string, string>) => void>();

	addCallback(callback: (errors: Record<string, string>) => void) {
		this.validationCallbacks.add(callback);
	}

	removeCallback(callback: (errors: Record<string, string>) => void) {
		this.validationCallbacks.delete(callback);
	}

	validateField(fieldName: string, value: string, rules: ValidationRule) {
		const result = validateField(value, rules);

		if (result.isValid) {
			this.validationErrors.delete(fieldName);
		} else {
			this.validationErrors.set(fieldName, result.error!);
		}

		this.notifyCallbacks();
	}

	getErrors(): Record<string, string> {
		return Object.fromEntries(this.validationErrors);
	}

	hasErrors(): boolean {
		return this.validationErrors.size > 0;
	}

	clearErrors() {
		this.validationErrors.clear();
		this.notifyCallbacks();
	}

	clearField(fieldName: string) {
		this.validationErrors.delete(fieldName);
		this.notifyCallbacks();
	}

	private notifyCallbacks() {
		const errors = this.getErrors();
		this.validationCallbacks.forEach((callback) => callback(errors));
	}
}
