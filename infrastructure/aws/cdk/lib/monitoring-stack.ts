import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface MonitoringStackProps extends cdk.StackProps {
	readonly config: EnvironmentConfig;
	readonly senateWorkerFunction: lambda.IFunction;
	readonly houseWorkerFunction: lambda.IFunction;
	readonly senateQueue: sqs.IQueue;
	readonly houseQueue: sqs.IQueue;
	readonly senateDlq: sqs.IQueue;
	readonly houseDlq: sqs.IQueue;
	readonly rateLimitTable: dynamodb.ITable;
	readonly jobTrackingTable: dynamodb.ITable;
}

/**
 * MonitoringStack creates CloudWatch dashboards, alarms, SNS topics, and budgets
 * for comprehensive monitoring of the CWC integration system.
 */
export class MonitoringStack extends cdk.Stack {
	public readonly alarmTopic: sns.Topic;
	public readonly dashboard: cloudwatch.Dashboard;
	public readonly budget?: budgets.CfnBudget;

	constructor(scope: Construct, id: string, props: MonitoringStackProps) {
		super(scope, id, props);

		const {
			config,
			senateWorkerFunction,
			houseWorkerFunction,
			senateQueue,
			houseQueue,
			senateDlq,
			houseDlq,
			rateLimitTable,
			jobTrackingTable
		} = props;

		// Create SNS topic for alarms
		this.alarmTopic = this.createAlarmTopic(config);

		// Create CloudWatch dashboard
		this.dashboard = this.createDashboard(config, {
			senateWorkerFunction,
			houseWorkerFunction,
			senateQueue,
			houseQueue,
			senateDlq,
			houseDlq,
			rateLimitTable,
			jobTrackingTable
		});

		// Create composite alarms for system health
		this.createCompositeAlarms(config);

		// Create budget alerts if enabled
		if (config.cost.enableBudgetAlerts) {
			this.budget = this.createBudget(config);
		}

		// Add tags to all resources
		this.addResourceTags(config.tags);

		// Create outputs
		this.createOutputs(config);
	}

	/**
	 * Create SNS topic for alarm notifications
	 */
	private createAlarmTopic(config: EnvironmentConfig): sns.Topic {
		const topic = new sns.Topic(this, 'AlarmTopic', {
			topicName: `${config.appName}-alarms`,
			displayName: `${config.appName} CWC Integration Alarms`,
			enforceSSL: true
		});

		// Add email subscription if provided
		if (config.monitoring.alarmEmail) {
			topic.addSubscription(new snsSubscriptions.EmailSubscription(config.monitoring.alarmEmail));
		}

		return topic;
	}

	/**
	 * Create CloudWatch dashboard with comprehensive metrics
	 */
	private createDashboard(
		config: EnvironmentConfig,
		resources: {
			senateWorkerFunction: lambda.IFunction;
			houseWorkerFunction: lambda.IFunction;
			senateQueue: sqs.IQueue;
			houseQueue: sqs.IQueue;
			senateDlq: sqs.IQueue;
			houseDlq: sqs.IQueue;
			rateLimitTable: dynamodb.ITable;
			jobTrackingTable: dynamodb.ITable;
		}
	): cloudwatch.Dashboard {
		const dashboard = new cloudwatch.Dashboard(this, 'CwcDashboard', {
			dashboardName: config.monitoring.dashboardName,
			defaultInterval: cdk.Duration.hours(1)
		});

		// Add widgets to dashboard
		dashboard.addWidgets(
			// System Overview Row
			new cloudwatch.TextWidget({
				markdown: `# ${config.appName.toUpperCase()} CWC Integration System\n\nEnvironment: **${config.environment}**\nRegion: **${config.region}**\nLast Updated: ${new Date().toISOString()}`,
				width: 24,
				height: 3
			})
		);

		// Lambda Functions Row
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'Lambda Function Invocations',
				left: [
					resources.senateWorkerFunction.metricInvocations({ label: 'Senate Worker' }),
					resources.houseWorkerFunction.metricInvocations({ label: 'House Worker' })
				],
				width: 12,
				height: 6
			}),
			new cloudwatch.GraphWidget({
				title: 'Lambda Function Errors',
				left: [
					resources.senateWorkerFunction.metricErrors({ label: 'Senate Worker Errors' }),
					resources.houseWorkerFunction.metricErrors({ label: 'House Worker Errors' })
				],
				width: 12,
				height: 6
			})
		);

		// Lambda Performance Row
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'Lambda Function Duration',
				left: [
					resources.senateWorkerFunction.metricDuration({ label: 'Senate Worker Duration' }),
					resources.houseWorkerFunction.metricDuration({ label: 'House Worker Duration' })
				],
				width: 12,
				height: 6
			}),
			new cloudwatch.GraphWidget({
				title: 'Lambda Function Throttles',
				left: [
					resources.senateWorkerFunction.metricThrottles({ label: 'Senate Worker Throttles' }),
					resources.houseWorkerFunction.metricThrottles({ label: 'House Worker Throttles' })
				],
				width: 12,
				height: 6
			})
		);

		// SQS Queues Row
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'SQS Queue Depth',
				left: [
					resources.senateQueue.metricApproximateNumberOfMessagesVisible({ label: 'Senate Queue' }),
					resources.houseQueue.metricApproximateNumberOfMessagesVisible({ label: 'House Queue' })
				],
				width: 12,
				height: 6
			}),
			new cloudwatch.GraphWidget({
				title: 'SQS Message Age',
				left: [
					resources.senateQueue.metricApproximateAgeOfOldestMessage({ label: 'Senate Queue Age' }),
					resources.houseQueue.metricApproximateAgeOfOldestMessage({ label: 'House Queue Age' })
				],
				width: 12,
				height: 6
			})
		);

		// DLQ Monitoring Row
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'Dead Letter Queue Messages',
				left: [
					resources.senateDlq.metricApproximateNumberOfMessagesVisible({ label: 'Senate DLQ' }),
					resources.houseDlq.metricApproximateNumberOfMessagesVisible({ label: 'House DLQ' })
				],
				width: 12,
				height: 6
			}),
			new cloudwatch.SingleValueWidget({
				title: 'Total DLQ Messages',
				metrics: [
					resources.senateDlq.metricApproximateNumberOfMessagesVisible({ label: 'Senate DLQ' }),
					resources.houseDlq.metricApproximateNumberOfMessagesVisible({ label: 'House DLQ' })
				],
				width: 12,
				height: 6
			})
		);

		// DynamoDB Tables Row
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'DynamoDB Read/Write Operations',
				left: [
					resources.rateLimitTable.metricConsumedReadCapacityUnits({ label: 'Rate Limit Reads' }),
					resources.jobTrackingTable.metricConsumedReadCapacityUnits({
						label: 'Job Tracking Reads'
					})
				],
				right: [
					resources.rateLimitTable.metricConsumedWriteCapacityUnits({ label: 'Rate Limit Writes' }),
					resources.jobTrackingTable.metricConsumedWriteCapacityUnits({
						label: 'Job Tracking Writes'
					})
				],
				width: 12,
				height: 6
			}),
			new cloudwatch.GraphWidget({
				title: 'DynamoDB Throttled Requests',
				left: [
					resources.rateLimitTable.metricThrottledRequests({
						label: 'Rate Limit Throttles'
					}),
					resources.jobTrackingTable.metricThrottledRequests({
						label: 'Job Tracking Throttles'
					})
				],
				width: 12,
				height: 6
			})
		);

		// Custom Business Metrics Row
		dashboard.addWidgets(
			new cloudwatch.GraphWidget({
				title: 'CWC Submission Success Rate',
				left: [
					new cloudwatch.Metric({
						namespace: 'Communique/CWC',
						metricName: 'SubmissionSuccessRate',
						dimensionsMap: {
							Environment: config.environment,
							Chamber: 'Senate'
						},
						statistic: 'Average'
					}),
					new cloudwatch.Metric({
						namespace: 'Communique/CWC',
						metricName: 'SubmissionSuccessRate',
						dimensionsMap: {
							Environment: config.environment,
							Chamber: 'House'
						},
						statistic: 'Average'
					})
				],
				width: 12,
				height: 6
			}),
			new cloudwatch.GraphWidget({
				title: 'API Response Times',
				left: [
					new cloudwatch.Metric({
						namespace: 'Communique/CWC',
						metricName: 'ApiResponseTime',
						dimensionsMap: {
							Environment: config.environment,
							Chamber: 'Senate'
						},
						statistic: 'Average'
					}),
					new cloudwatch.Metric({
						namespace: 'Communique/CWC',
						metricName: 'ApiResponseTime',
						dimensionsMap: {
							Environment: config.environment,
							Chamber: 'House'
						},
						statistic: 'Average'
					})
				],
				width: 12,
				height: 6
			})
		);

		return dashboard;
	}

	/**
	 * Create composite alarms for overall system health
	 */
	private createCompositeAlarms(config: EnvironmentConfig): void {
		// System Health Composite Alarm
		const systemHealthAlarm = new cloudwatch.CompositeAlarm(this, 'SystemHealthAlarm', {
			compositeAlarmName: `${config.appName}-system-health`,
			alarmDescription: 'Overall CWC integration system health',
			alarmRule: cloudwatch.AlarmRule.anyOf(
				cloudwatch.AlarmRule.fromAlarm(
					cloudwatch.Alarm.fromAlarmArn(
						this,
						'SenateErrorsAlarmRef',
						`arn:aws:cloudwatch:${this.region}:${this.account}:alarm:${config.appName}-senateworker-error-rate`
					),
					cloudwatch.AlarmState.ALARM
				),
				cloudwatch.AlarmRule.fromAlarm(
					cloudwatch.Alarm.fromAlarmArn(
						this,
						'HouseErrorsAlarmRef',
						`arn:aws:cloudwatch:${this.region}:${this.account}:alarm:${config.appName}-houseworker-error-rate`
					),
					cloudwatch.AlarmState.ALARM
				),
				cloudwatch.AlarmRule.fromAlarm(
					cloudwatch.Alarm.fromAlarmArn(
						this,
						'SenateDlqAlarmRef',
						`arn:aws:cloudwatch:${this.region}:${this.account}:alarm:${config.appName}-senate-dlq-messages`
					),
					cloudwatch.AlarmState.ALARM
				),
				cloudwatch.AlarmRule.fromAlarm(
					cloudwatch.Alarm.fromAlarmArn(
						this,
						'HouseDlqAlarmRef',
						`arn:aws:cloudwatch:${this.region}:${this.account}:alarm:${config.appName}-house-dlq-messages`
					),
					cloudwatch.AlarmState.ALARM
				)
			)
		});

		// Add action to send notification
		systemHealthAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

		// High Latency Composite Alarm
		const highLatencyAlarm = new cloudwatch.CompositeAlarm(this, 'HighLatencyAlarm', {
			compositeAlarmName: `${config.appName}-high-latency`,
			alarmDescription: 'CWC integration system experiencing high latency',
			alarmRule: cloudwatch.AlarmRule.anyOf(
				cloudwatch.AlarmRule.fromAlarm(
					cloudwatch.Alarm.fromAlarmArn(
						this,
						'SenateDurationAlarmRef',
						`arn:aws:cloudwatch:${this.region}:${this.account}:alarm:${config.appName}-senateworker-duration`
					),
					cloudwatch.AlarmState.ALARM
				),
				cloudwatch.AlarmRule.fromAlarm(
					cloudwatch.Alarm.fromAlarmArn(
						this,
						'HouseDurationAlarmRef',
						`arn:aws:cloudwatch:${this.region}:${this.account}:alarm:${config.appName}-houseworker-duration`
					),
					cloudwatch.AlarmState.ALARM
				)
			)
		});

		highLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
	}

	/**
	 * Create AWS Budget for cost monitoring
	 */
	private createBudget(config: EnvironmentConfig): budgets.CfnBudget {
		return new budgets.CfnBudget(this, 'MonthlyBudget', {
			budget: {
				budgetName: `${config.appName}-monthly-budget`,
				budgetType: 'COST',
				timeUnit: 'MONTHLY',
				budgetLimit: {
					amount: config.cost.monthlyBudgetUsd,
					unit: 'USD'
				},
				costFilters: {
					TagKeyValue: [`user:Project$${config.tags.Project || 'communique'}`]
				}
			},
			notificationsWithSubscribers: [
				{
					notification: {
						notificationType: 'ACTUAL',
						comparisonOperator: 'GREATER_THAN',
						threshold: 80, // Alert at 80% of budget
						thresholdType: 'PERCENTAGE'
					},
					subscribers: config.monitoring.alarmEmail
						? [
								{
									subscriptionType: 'EMAIL',
									address: config.monitoring.alarmEmail
								}
							]
						: []
				},
				{
					notification: {
						notificationType: 'FORECASTED',
						comparisonOperator: 'GREATER_THAN',
						threshold: 100, // Alert when forecasted to exceed budget
						thresholdType: 'PERCENTAGE'
					},
					subscribers: config.monitoring.alarmEmail
						? [
								{
									subscriptionType: 'EMAIL',
									address: config.monitoring.alarmEmail
								}
							]
						: []
				}
			]
		});
	}

	/**
	 * Add tags to all resources in this stack
	 */
	private addResourceTags(tags: Record<string, string>): void {
		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(this).add(key, value);
		});
	}

	/**
	 * Create CloudFormation outputs
	 */
	private createOutputs(config: EnvironmentConfig): void {
		new cdk.CfnOutput(this, 'AlarmTopicArn', {
			value: this.alarmTopic.topicArn,
			description: 'SNS topic ARN for alarm notifications',
			exportName: `${config.appName}-alarm-topic-arn`
		});

		new cdk.CfnOutput(this, 'DashboardUrl', {
			value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${config.monitoring.dashboardName}`,
			description: 'CloudWatch dashboard URL',
			exportName: `${config.appName}-dashboard-url`
		});

		if (this.budget) {
			new cdk.CfnOutput(this, 'BudgetName', {
				value: `${config.appName}-monthly-budget`,
				description: 'AWS Budget name for cost monitoring',
				exportName: `${config.appName}-budget-name`
			});
		}
	}
}
