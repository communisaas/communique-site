/**
 * Reserved slugs that cannot be used for templates to prevent route conflicts
 * and maintain action-oriented URL strategy
 */

// Core application routes that must be protected
const CORE_APP_ROUTES = [
	'api',
	'auth', 
	'dashboard',
	'demo',
	'onboarding',
	'template-modal'
];

// Common web paths that should be reserved
const COMMON_WEB_PATHS = [
	'admin',
	'login', 'logout', 'register', 'signup', 'signin',
	'profile', 'settings', 'account', 'user', 'users',
	'help', 'support', 'contact', 'feedback',
	'about', 'privacy', 'terms', 'legal', 'sitemap', 'robots',
	'search', 'browse', 'explore', 'discover'
];

// Future application routes we might want
const FUTURE_ROUTES = [
	'blog', 'news', 'updates',
	'docs', 'documentation', 'guides', 'faq',
	'pricing', 'features', 'plans',
	'downloads', 'uploads', 'files',
	'analytics', 'stats', 'metrics',
	'campaigns', 'templates', 'actions'
];

// Technical and system paths
const TECHNICAL_PATHS = [
	'www', 'mail', 'email', 'ftp', 'ssh', 'ssl', 'tls',
	'http', 'https', 'ws', 'wss', 'tcp', 'udp',
	'static', 'assets', 'public', 'cdn',
	'system', 'root', 'administrator', 'moderator',
	'config', 'configuration', 'setup', 'install',
	'health', 'status', 'ping', 'monitoring'
];

// Action prefixes we use for organized URL structure
const ACTION_PREFIXES = [
	'tell-congress',
	'demand',
	'support', 
	'stop',
	'urge',
	'call-for',
	'join',
	'sign',
	'petition',
	'contact'
];

// Single words that might conflict with action URLs
const CONFLICTING_WORDS = [
	'tell', 'demand', 'support', 'stop', 'urge', 'call', 'join', 'sign',
	'congress', 'senate', 'house', 'government', 'president',
	'action', 'campaign', 'petition', 'vote', 'voting',
	'climate', 'healthcare', 'education', 'economy', 'immigration',
	'contact', 'email', 'message', 'letter', 'communication'
];

// Combine all reserved slugs
export const RESERVED_SLUGS = [
	...CORE_APP_ROUTES,
	...COMMON_WEB_PATHS,
	...FUTURE_ROUTES,
	...TECHNICAL_PATHS,
	...ACTION_PREFIXES,
	...CONFLICTING_WORDS
].map(slug => slug.toLowerCase()).sort();

/**
 * Check if a slug is reserved and cannot be used for templates
 */
export function isSlugReserved(slug: string): boolean {
	const normalizedSlug = slug.toLowerCase();
	
	// Check exact matches
	if (RESERVED_SLUGS.includes(normalizedSlug)) {
		return true;
	}
	
	// Check for action prefix patterns
	for (const prefix of ACTION_PREFIXES) {
		if (normalizedSlug.startsWith(`${prefix}-`)) {
			return true;
		}
	}
	
	return false;
}

/**
 * Generate an action-oriented slug from a template title and type
 */
export function generateActionSlug(title: string, deliveryMethod: string): string {
	// Clean and slugify the title
	const baseSlug = title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '') // Remove special chars
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/-+/g, '-') // Remove duplicate hyphens
		.replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
	
	// Choose action prefix based on delivery method and content
	let actionPrefix: string;
	
	if (deliveryMethod === 'both') {
		// Congressional delivery
		actionPrefix = 'tell-congress';
	} else {
		// Direct delivery - choose based on title keywords
		const lowerTitle = title.toLowerCase();
		
		// Check if the base slug already starts with an action prefix to avoid duplication
		const actionPrefixes = ['stop', 'support', 'demand', 'urge', 'act', 'defend', 'protect', 'save', 'help'];
		const startsWithAction = actionPrefixes.some(prefix => baseSlug.startsWith(`${prefix}-`));
		
		if (startsWithAction) {
			// Title already starts with an action word, use as-is
			return baseSlug;
		}
		
		if (lowerTitle.includes('stop') || lowerTitle.includes('end') || lowerTitle.includes('ban')) {
			actionPrefix = 'stop';
		} else if (lowerTitle.includes('support') || lowerTitle.includes('fund') || lowerTitle.includes('pass')) {
			actionPrefix = 'support';
		} else if (lowerTitle.includes('demand') || lowerTitle.includes('require') || lowerTitle.includes('force')) {
			actionPrefix = 'demand';
		} else {
			actionPrefix = 'urge';
		}
	}
	
	return `${actionPrefix}-${baseSlug}`;
}

/**
 * Get a friendly error message for reserved slugs
 */
export function getReservedSlugError(slug: string): string {
	const normalizedSlug = slug.toLowerCase();
	
	if (CORE_APP_ROUTES.includes(normalizedSlug)) {
		return `"${slug}" is reserved for application functionality.`;
	}
	
	if (ACTION_PREFIXES.some(prefix => normalizedSlug.startsWith(`${prefix}-`))) {
		return `"${slug}" uses a reserved action prefix. Try a different format.`;
	}
	
	return `"${slug}" is a reserved word. Please choose a different slug.`;
}

/**
 * Suggest alternative slugs when a slug is reserved or taken
 */
export function suggestAlternativeSlug(originalSlug: string, title: string, deliveryMethod: string): string[] {
	const suggestions: string[] = [];
	
	// Generate action-oriented slug
	const actionSlug = generateActionSlug(title, deliveryMethod);
	if (actionSlug !== originalSlug && !isSlugReserved(actionSlug)) {
		suggestions.push(actionSlug);
	}
	
	// Add numbered variations
	for (let i = 2; i <= 5; i++) {
		const numberedSlug = `${actionSlug}-${i}`;
		if (!isSlugReserved(numberedSlug)) {
			suggestions.push(numberedSlug);
		}
	}
	
	// Add year variation for campaigns
	const currentYear = new Date().getFullYear();
	const yearSlug = `${actionSlug}-${currentYear}`;
	if (!isSlugReserved(yearSlug)) {
		suggestions.push(yearSlug);
	}
	
	return suggestions.slice(0, 3); // Return top 3 suggestions
}

/**
 * Generate validated alternative slugs by checking database availability
 */
export async function suggestAvailableAlternatives(originalSlug: string, title: string, deliveryMethod: string, checkDb: (slug: string) => Promise<boolean>): Promise<string[]> {
	const availableSuggestions: string[] = [];
	
	// Generate action-oriented slug
	const actionSlug = generateActionSlug(title, deliveryMethod);
	if (actionSlug !== originalSlug && !isSlugReserved(actionSlug) && await checkDb(actionSlug)) {
		availableSuggestions.push(actionSlug);
	}
	
	// Add numbered variations
	for (let i = 2; i <= 10 && availableSuggestions.length < 3; i++) {
		const numberedSlug = `${actionSlug}-${i}`;
		if (!isSlugReserved(numberedSlug) && await checkDb(numberedSlug)) {
			availableSuggestions.push(numberedSlug);
		}
	}
	
	// Add year variation for campaigns
	if (availableSuggestions.length < 3) {
		const currentYear = new Date().getFullYear();
		const yearSlug = `${actionSlug}-${currentYear}`;
		if (!isSlugReserved(yearSlug) && await checkDb(yearSlug)) {
			availableSuggestions.push(yearSlug);
		}
	}
	
	// Add action prefix variations if still need more
	if (availableSuggestions.length < 3) {
		const prefixes = ['support', 'demand', 'urge', 'stop', 'act'];
		const baseSlug = originalSlug.replace(/^(tell-congress|support|demand|urge|stop|act)-/, '');
		
		for (const prefix of prefixes) {
			if (availableSuggestions.length >= 3) break;
			const prefixedSlug = `${prefix}-${baseSlug}`;
			if (prefixedSlug !== originalSlug && !isSlugReserved(prefixedSlug) && await checkDb(prefixedSlug)) {
				availableSuggestions.push(prefixedSlug);
			}
		}
	}
	
	return availableSuggestions.slice(0, 3);
}

/**
 * Create urgency-focused variations of action URLs
 */
export function generateUrgentVariations(baseSlug: string, deliveryMethod: string): string[] {
	const variations: string[] = [];
	
	if (deliveryMethod === 'both') {
		// Congressional variations
		variations.push(
			`tell-congress-${baseSlug}`,
			`contact-congress-${baseSlug}`,
			`congress-must-hear-${baseSlug}`
		);
	} else {
		// Direct action variations
		variations.push(
			`demand-action-${baseSlug}`,
			`urgent-${baseSlug}`,
			`act-now-${baseSlug}`
		);
	}
	
	return variations;
}