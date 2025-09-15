#!/usr/bin/env node

/**
 * Delivery Platform Entry Point
 * Orchestrates SMTP server, N8N workflows, and AI-powered moderation
 */

import { createSMTPServer } from './smtp/server';
import { validateConfig, getConfig, isProduction } from './utils/config';
import { setupProcessHandlers } from './utils/process-handlers';

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting Delivery Platform...');
    console.log(`📦 Version: 2.0.0`);
    console.log(`🌍 Environment: ${isProduction() ? 'Production' : 'Development'}`);
    console.log('');

    // Validate configuration
    console.log('🔍 Validating configuration...');
    validateConfig();
    
    const config = getConfig();
    console.log('✅ Configuration validated');
    console.log('');
    
    // Display feature flags
    console.log('🎛️  Feature Flags:');
    console.log(`  • N8N Workflows: ${config.features.enableN8NWorkflows ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`  • VOTER Certification: ${config.features.enableVoterCertification ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`  • Beta Features: ${config.features.enableBetaFeatures ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('');
    
    // Display service endpoints
    console.log('🔗 Service Endpoints:');
    console.log(`  • Communiqué API: ${config.api.communiqueUrl}`);
    console.log(`  • CWC API: ${config.api.cwcUrl}`);
    if (config.features.enableN8NWorkflows) {
      console.log(`  • N8N Workflows: ${config.api.n8nUrl}`);
    }
    if (config.features.enableVoterCertification && config.api.voterUrl) {
      console.log(`  • VOTER Protocol: ${config.api.voterUrl}`);
    }
    console.log('');
    
    // Setup process handlers for graceful shutdown
    setupProcessHandlers();
    
    // Start SMTP server
    console.log('📧 Starting SMTP server...');
    const smtpServer = createSMTPServer();
    smtpServer.start();
    
    // Log startup complete
    console.log('');
    console.log('✨ Delivery Platform started successfully!');
    console.log('📮 Ready to process certified delivery messages');
    
    // In production, send startup notification
    if (isProduction()) {
      // TODO: Send startup notification to monitoring service
      console.log('📊 Production mode - monitoring enabled');
    }
    
  } catch (error) {
    console.error('❌ Failed to start Delivery Platform:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});