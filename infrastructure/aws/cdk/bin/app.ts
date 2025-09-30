#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack } from '../lib/networking-stack';
import { StorageStack } from '../lib/storage-stack';
import { QueueStack } from '../lib/queue-stack';
import { ComputeStack } from '../lib/compute-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { getEnvironmentConfig } from '../lib/config';

/**
 * Main CDK application for Communique CWC integration infrastructure
 */
class CommuniqueCdkApp extends cdk.App {
	constructor() {
		super();

		// Get environment configuration
		const config = getEnvironmentConfig();

		// Define common stack properties
		const commonProps: cdk.StackProps = {
			env: {
				account: config.account || process.env.CDK_DEFAULT_ACCOUNT,
				region: config.region
			},
			description: `Communique CWC integration infrastructure - ${config.environment}`,
			terminationProtection: config.environment === 'production'
		};

		// Create Networking Stack (VPC, subnets, security groups)
		const networkingStack = new NetworkingStack(this, `${config.appName}-Networking`, {
			...commonProps,
			config,
			stackName: `${config.appName}-networking-${config.environment}`
		});

		// Create Storage Stack (DynamoDB tables)
		const storageStack = new StorageStack(this, `${config.appName}-Storage`, {
			...commonProps,
			config,
			stackName: `${config.appName}-storage-${config.environment}`
		});

		// Create Queue Stack (SQS queues)
		const queueStack = new QueueStack(this, `${config.appName}-Queue`, {
			...commonProps,
			config,
			kmsKey: storageStack.kmsKey,
			stackName: `${config.appName}-queue-${config.environment}`
		});

		// Create Compute Stack (Lambda functions)
		const computeStack = new ComputeStack(this, `${config.appName}-Compute`, {
			...commonProps,
			config,
			vpc: networkingStack.vpc,
			lambdaSecurityGroup: networkingStack.lambdaSecurityGroup,
			senateQueue: queueStack.senateQueue,
			houseQueue: queueStack.houseQueue,
			rateLimitTable: storageStack.rateLimitTable,
			jobTrackingTable: storageStack.jobTrackingTable,
			stackName: `${config.appName}-compute-${config.environment}`
		});

		// Create Monitoring Stack (CloudWatch, alarms, dashboards)
		const monitoringStack = new MonitoringStack(this, `${config.appName}-Monitoring`, {
			...commonProps,
			config,
			senateWorkerFunction: computeStack.senateWorkerFunction,
			houseWorkerFunction: computeStack.houseWorkerFunction,
			senateQueue: queueStack.senateQueue,
			houseQueue: queueStack.houseQueue,
			senateDlq: queueStack.senateDlq,
			houseDlq: queueStack.houseDlq,
			rateLimitTable: storageStack.rateLimitTable,
			jobTrackingTable: storageStack.jobTrackingTable,
			stackName: `${config.appName}-monitoring-${config.environment}`
		});

		// Add stack dependencies
		storageStack.addDependency(networkingStack);
		queueStack.addDependency(storageStack);
		computeStack.addDependency(queueStack);
		monitoringStack.addDependency(computeStack);

		// Add global tags
		Object.entries(config.tags).forEach(([key, value]) => {
			cdk.Tags.of(this).add(key, value);
		});

		// Add deployment timestamp tag
		cdk.Tags.of(this).add('DeployedAt', new Date().toISOString());
		cdk.Tags.of(this).add('DeployedBy', process.env.USER || 'unknown');
		cdk.Tags.of(this).add('CDKVersion', cdk.VERSION);

		// Output environment information
		console.log(`🚀 Deploying Communique CWC infrastructure for ${config.environment} environment`);
		console.log(`📍 Region: ${config.region}`);
		console.log(`🏷️  App Name: ${config.appName}`);
		console.log(`💰 Monthly Budget: $${config.cost.monthlyBudgetUsd}`);
		console.log(
			`📊 Monitoring: ${config.monitoring.enableDetailedMonitoring ? 'Enabled' : 'Disabled'}`
		);
		console.log(
			`🔒 KMS Encryption: ${config.security.enableKmsEncryption ? 'Enabled' : 'Disabled'}`
		);
		console.log(`🌐 VPC Endpoints: ${config.security.enableVpcEndpoints ? 'Enabled' : 'Disabled'}`);
	}
}

// Create and synthesize the CDK app
new CommuniqueCdkApp();
