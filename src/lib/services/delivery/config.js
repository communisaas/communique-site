/**
 * Configuration Management
 * Loads and validates environment variables
 */

require('dotenv').config();

const config = {
	smtp: {
		port: parseInt(process.env.SMTP_PORT || '25'),
		host: process.env.SMTP_HOST || '0.0.0.0',
		secure: process.env.SMTP_SECURE === 'true',
		auth: {
			user: process.env.SMTP_AUTH_USER || '',
			pass: process.env.SMTP_AUTH_PASS || ''
		}
	},
	
	communique: {
		apiUrl: process.env.COMMUNIQUE_API_URL || 'https://communique.app/api',
		apiKey: process.env.COMMUNIQUE_API_KEY || '',
		webhookSecret: process.env.COMMUNIQUE_WEBHOOK_SECRET || ''
	},
	
	cwc: {
		apiKey: process.env.CWC_API_KEY || '',
		apiUrl: process.env.CWC_API_URL || 'https://cwc.senate.gov/api',
		deliveryAgent: {
			id: process.env.CWC_DELIVERY_AGENT_ID || 'DELIVERY_PLATFORM',
			name: process.env.CWC_DELIVERY_AGENT_NAME || 'Delivery Platform',
			contact: process.env.CWC_DELIVERY_AGENT_CONTACT || 'contact@communique.app',
			acknowledgementEmail: process.env.CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL || 'noreply@communique.app',
			ack: process.env.CWC_DELIVERY_AGENT_ACK || 'Y'
		},
		campaignId: process.env.CWC_CAMPAIGN_ID || 'delivery-platform-2025'
	},
	
	// VOTER Protocol configuration
	voter: {
		enabled: process.env.ENABLE_VOTER_CERTIFICATION === 'true',
		apiUrl: process.env.VOTER_API_URL || 'http://localhost:8000',
		apiKey: process.env.VOTER_API_KEY || ''
	},
	
	logging: {
		level: process.env.LOG_LEVEL || 'info',
		sentryDsn: process.env.SENTRY_DSN || ''
	},
	
	domains: {
		allowed: (process.env.ALLOWED_DOMAINS || 'communi.email,communique.app').split(','),
		defaultFrom: process.env.DEFAULT_FROM_DOMAIN || 'communi.email'
	}
};

// Validation
function validateConfig() {
	const errors = [];
	
	if (!config.cwc.apiKey) {
		errors.push('CWC_API_KEY is required');
	}
	
	if (!config.communique.apiKey) {
		errors.push('API_KEY is required');
	}
	
	if (errors.length > 0) {
		console.error('Configuration errors:', errors);
		process.exit(1);
	}
}

// Only validate in production
if (process.env.NODE_ENV === 'production') {
	validateConfig();
}

module.exports = config;