/**
 * Delivery Service Integration
 * Embedded SMTP service for congressional message delivery via CWC API
 */

import { spawn } from 'child_process';
import { env } from '$env/dynamic/private';
import path from 'path';

export interface DeliveryServiceConfig {
	smtpPort: number;
	smtpHost: string;
	cwcApiUrl: string;
	cwcApiKey: string;
	voterProtocolUrl: string;
	enableCertification: boolean;
}

export class DeliveryService {
	private server: any;
	private config: DeliveryServiceConfig;

	constructor() {
		this.config = {
			smtpPort: parseInt(env.SMTP_PORT || '587'),
			smtpHost: env.SMTP_HOST || '0.0.0.0',
			cwcApiUrl: env.CWC_API_URL || 'https://cwc.house.gov/api',
			cwcApiKey: env.CWC_API_KEY || '',
			voterProtocolUrl: env.VOTER_PROTOCOL_URL || 'http://localhost:8000',
			enableCertification: env.ENABLE_CERTIFICATION === 'true'
		};
	}

	/**
	 * Start the embedded delivery service
	 */
	async start(): Promise<void> {
		console.log('🚀 Starting Delivery Service...');

		// Set environment variables for the delivery service
		const deliveryEnv = {
			...process.env,
			SMTP_PORT: this.config.smtpPort.toString(),
			SMTP_HOST: this.config.smtpHost,
			CWC_API_URL: this.config.cwcApiUrl,
			CWC_API_KEY: this.config.cwcApiKey,
			VOTER_PROTOCOL_URL: this.config.voterProtocolUrl,
			ENABLE_CERTIFICATION: this.config.enableCertification.toString(),
			// Use Communiqué's database connection
			DATABASE_URL: env.DATABASE_URL
		};

		// Import and start the SMTP server directly
		try {
			const smtpServerModule = await import('./delivery/smtp-server.js');
			// The delivery service will start automatically when imported
			console.log(`📧 Delivery Service running on ${this.config.smtpHost}:${this.config.smtpPort}`);
		} catch (error) {
			console.error('❌ Failed to start Delivery Service:', error);
			throw error;
		}
	}

	/**
	 * Stop the delivery service
	 */
	async stop(): Promise<void> {
		console.log('🛑 Stopping Delivery Service...');
		// Implementation depends on how the SMTP server exposes its stop method
	}

	/**
	 * Health check for the delivery service
	 */
	async healthCheck(): Promise<boolean> {
		// Simple health check - verify SMTP port is listening
		return new Promise((resolve) => {
			const net = require('net');
			const client = net.createConnection({
				port: this.config.smtpPort,
				host: this.config.smtpHost
			});

			client.on('connect', () => {
				client.end();
				resolve(true);
			});

			client.on('error', () => {
				resolve(false);
			});

			// Timeout after 5 seconds
			setTimeout(() => {
				client.destroy();
				resolve(false);
			}, 5000);
		});
	}

	/**
	 * Get service status
	 */
	getStatus() {
		return {
			service: 'Delivery Service',
			smtp: {
				host: this.config.smtpHost,
				port: this.config.smtpPort
			},
			cwc: {
				apiUrl: this.config.cwcApiUrl,
				hasApiKey: !!this.config.cwcApiKey
			},
			certification: {
				enabled: this.config.enableCertification,
				voterProtocolUrl: this.config.voterProtocolUrl
			}
		};
	}
}

// Export singleton instance
export const deliveryService = new DeliveryService();
