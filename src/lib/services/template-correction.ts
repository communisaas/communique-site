/**
 * Template Correction Service
 * Provides AI-based template analysis and correction capabilities
 */

interface ValidationResult {
	isValid: boolean;
	issues: string[];
}

interface TemplateInput {
	title: string;
	message_body: string;
	deliveryMethod: string;
	[key: string]: unknown;
}

/**
 * Template validation service with basic technical checks
 */
export const templateValidator = {
	/**
	 * Validate template content against basic requirements
	 */
	validate(template: TemplateInput): ValidationResult {
		const content = template.message_body;
		const issues: string[] = [];

		// Basic length requirements
		if (content.trim().length < 20) {
			issues.push('Message too short—add more detail');
		}

		if (content.trim().length < 50) {
			issues.push('Recipients need context');
		}

		// Title requirement
		if (!template.title.trim()) {
			issues.push('Title required');
		}

		return {
			isValid: issues.length === 0,
			issues
		};
	}
};
