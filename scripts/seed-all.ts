#!/usr/bin/env tsx

/**
 * Comprehensive Database Seeding Orchestrator
 * 
 * Runs all seeding scripts in the correct order based on:
 * - Data dependencies (templates before campaigns, users before activations)
 * - Feature flags (only seed enabled features)
 * - Schema compatibility (use updated scripts that match current schema)
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { isFeatureEnabled, getFeaturesByStatus, FeatureStatus } from '../src/lib/features/config.js';

const db = new PrismaClient();

interface SeedStep {
  name: string;
  description: string;
  script: string;
  required: boolean;
  feature_flag?: string;
  dependencies?: string[];
}

const SEED_STEPS: SeedStep[] = [
  {
    name: 'core-data',
    description: 'Core production data (templates, representatives, users)',
    script: 'tsx scripts/seed-db-updated.ts',
    required: true
  },
  {
    name: 'legislative-channels',
    description: 'Global legislative delivery channels',
    script: 'tsx scripts/seed-legislative-channels-updated.ts',
    required: false,
    feature_flag: 'LEGISLATIVE_CHANNELS'
  },
  {
    name: 'feature-data',
    description: 'Feature-flagged models (AI, analytics, personalization)',
    script: 'tsx scripts/seed-features.ts',
    required: false,
    dependencies: ['core-data']
  }
];

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.$connect();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  } finally {
    await db.$disconnect();
  }
}

async function checkSchemaSync(): Promise<boolean> {
  try {
    // Try a simple query to see if the schema is in sync
    await db.template.findFirst();
    console.log('✅ Schema appears to be in sync');
    return true;
  } catch (error) {
    console.error('❌ Schema sync issue detected:', error);
    console.log('💡 Try running: npm run db:push');
    return false;
  }
}

function checkFeatureFlags(): void {
  console.log('🚩 Feature Flag Status:');
  console.log('======================');
  
  const productionFeatures = getFeaturesByStatus(FeatureStatus.ON);
  const betaFeatures = getFeaturesByStatus(FeatureStatus.BETA);
  const roadmapFeatures = getFeaturesByStatus(FeatureStatus.ROADMAP);
  
  if (productionFeatures.length > 0) {
    console.log('✅ Production Features:', productionFeatures.join(', '));
  }
  
  if (betaFeatures.length > 0) {
    const enabledBeta = betaFeatures.filter(f => isFeatureEnabled(f));
    if (enabledBeta.length > 0) {
      console.log('🧪 Enabled Beta Features:', enabledBeta.join(', '));
    }
    const disabledBeta = betaFeatures.filter(f => !isFeatureEnabled(f));
    if (disabledBeta.length > 0) {
      console.log('⚠️  Disabled Beta Features:', disabledBeta.join(', '), '(set ENABLE_BETA=true)');
    }
  }
  
  if (roadmapFeatures.length > 0) {
    console.log('📋 Roadmap Features:', roadmapFeatures.join(', '), '(not yet implemented)');
  }
  
  console.log('');
}

function shouldRunStep(step: SeedStep): boolean {
  if (step.required) return true;
  
  if (step.feature_flag) {
    return isFeatureEnabled(step.feature_flag as any);
  }
  
  // Run by default if no specific requirements
  return true;
}

async function runSeedStep(step: SeedStep): Promise<boolean> {
  console.log(`🌱 Running: ${step.name}`);
  console.log(`   ${step.description}`);
  
  try {
    execSync(step.script, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ Completed: ${step.name}\n`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${step.name}`);
    console.error('   Error:', error);
    return false;
  }
}

async function seedDatabase() {
  console.log('🌱 Communique Database Seeding');
  console.log('=' .repeat(50));
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');
  
  // Pre-flight checks
  console.log('🔍 Pre-flight Checks:');
  console.log('====================');
  
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.error('❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  const schemaSync = await checkSchemaSync();
  if (!schemaSync) {
    console.error('❌ Cannot proceed with schema sync issues');
    console.log('💡 Run: npm run db:push to sync schema');
    process.exit(1);
  }
  
  checkFeatureFlags();
  
  // Plan execution
  console.log('📋 Seed Execution Plan:');
  console.log('=======================');
  
  const stepsToRun = SEED_STEPS.filter(shouldRunStep);
  const skippedSteps = SEED_STEPS.filter(step => !shouldRunStep(step));
  
  if (stepsToRun.length === 0) {
    console.log('⚠️  No seed steps will run based on current feature flags');
    console.log('💡 Enable features or run specific seed scripts manually');
    process.exit(0);
  }
  
  console.log('Will run:');
  stepsToRun.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.name}: ${step.description}`);
  });
  
  if (skippedSteps.length > 0) {
    console.log('\nWill skip:');
    skippedSteps.forEach(step => {
      const reason = step.feature_flag ? 
        `${step.feature_flag} feature disabled` : 
        'not required';
      console.log(`  • ${step.name}: ${reason}`);
    });
  }
  
  console.log('');
  
  // Execute steps
  console.log('🚀 Executing Seed Steps:');
  console.log('========================');
  
  const results = [];
  
  for (const step of stepsToRun) {
    const success = await runSeedStep(step);
    results.push({ step: step.name, success });
    
    if (!success && step.required) {
      console.error(`❌ Required step '${step.name}' failed. Aborting.`);
      process.exit(1);
    }
  }
  
  // Summary
  console.log('📊 Seeding Summary:');
  console.log('==================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  if (successful.length > 0) {
    successful.forEach(r => console.log(`  ✓ ${r.step}`));
  }
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => console.log(`  ✗ ${r.step}`));
  }
  
  // Final database state
  try {
    await db.$connect();
    const finalCounts = {
      templates: await db.template.count(),
      users: await db.user.count(),
      representatives: await db.representative.count(),
      legislative_channels: await db.legislative_channel.count().catch(() => 0),
      user_activations: await db.user_activation.count().catch(() => 0),
      ai_suggestions: await db.ai_suggestions.count().catch(() => 0)
    };
    
    console.log('\n📊 Final Database State:');
    console.log('========================');
    Object.entries(finalCounts).forEach(([model, count]) => {
      if (count > 0) {
        console.log(`${model}: ${count}`);
      }
    });
  } catch (error) {
    console.warn('⚠️  Could not fetch final database counts:', error);
  } finally {
    await db.$disconnect();
  }
  
  console.log('\n🎉 Database seeding completed!');
  console.log('');
  console.log('💡 Next Steps:');
  console.log('  • Test the application with seeded data');
  console.log('  • Enable additional features as needed');
  console.log('  • Monitor data integrity and performance');
  console.log('  • Add production data as the system grows');
  console.log('');
  
  if (failed.length === 0) {
    process.exit(0);
  } else {
    console.log('⚠️  Some non-critical steps failed. Review logs above.');
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}