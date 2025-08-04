import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173
  },

  testDir: 'e2e',
  
  // MCP-specific configuration
  use: {
    // Enable trace collection for MCP inspection
    trace: 'on-first-retry',
    
    // Enable video recording for visual debugging
    video: 'retain-on-failure',
    
    // Enable screenshots on failure
    screenshot: 'only-on-failure',
    
    // Slower navigation timeout for better debugging
    navigationTimeout: 30000,
    
    // Enable inspector mode for UI debugging
    launchOptions: {
      slowMo: 100, // Slow down actions for visual inspection
    }
  },

  // MCP reporter configuration
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report',
      open: 'never' // Don't auto-open since we'll use MCP to inspect
    }],
    ['json', { 
      outputFile: 'test-results.json' // For MCP consumption
    }],
    ['list'] // Console output
  ],

  // MCP-enhanced project setup
  projects: [
    {
      name: 'mcp-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable MCP debugging features
        contextOptions: {
          recordVideo: { dir: 'videos/' },
          recordHar: { path: 'network-logs.har' }
        }
      },
    },
    
    {
      name: 'mcp-mobile',
      use: { 
        ...devices['iPhone 13'],
        contextOptions: {
          recordVideo: { dir: 'videos-mobile/' }
        }
      }
    }
  ],

  // Enhanced debugging output
  outputDir: 'test-results/',
  
  // Fulltrace for comprehensive debugging
  fullyParallel: false, // Better for MCP inspection
  
  // Global setup for MCP integration
  globalSetup: './playwright-mcp-setup.ts',
});