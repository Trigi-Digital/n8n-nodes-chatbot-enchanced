import type {
	ITriggerFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

// Import managers and utilities
import { RedisTriggerManager } from './managers/RedisTriggerManager';
import { PatternMatcher, EventTypeUtils } from './trigger-utils';

// Import types
import { RedisCredential } from './types';

export class ChatBotEnhancedRedisTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Chatbot Enhanced - Trigger',
		name: 'chatBotEnhancedRedisTrigger',
		icon: 'file:chatbot-enhanced.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["keyPattern"] + " (" + $parameter["eventTypes"].join(", ") + ")"}}',
		description:
			'ChatBot Enhanced with real-time trigger capabilities for monitoring Redis key changes and session events',
		codex: {
			categories: ['Trigger'],
			subcategories: {
				Trigger: ['Database', 'Real-time', 'Event-driven'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/trigger-nodes/',
					},
				],
				credentialDocumentation: [
					{
						url: 'https://redis.io/docs/manual/keyspace-notifications/',
					},
				],
			},
			alias: [
				'redis trigger',
				'keyspace notification',
				'real-time redis',
				'redis monitor',
				'event trigger',
				'database trigger',
			],
		},
		defaults: {
			name: 'Chatbot Enhanced - Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'redis',
				required: true,
			},
		],
		properties: [
			// Key Pattern Configuration
			{
				displayName: 'Key Monitoring',
				name: 'keyMonitoringMode',
				type: 'options',
				required: true,
				default: 'chooseKey',
				options: [
					{
						name: 'Track All',
						value: 'trackAll',
						description: 'Monitor all Redis keys (⚠️ High performance impact)',
					},
					{
						name: 'Choose Key',
						value: 'chooseKey',
						description: 'Monitor specific key patterns only (Recommended)',
					},
				],
				description: 'Select how you want to monitor Redis keys',
			},
			{
				displayName: 'Key Pattern',
				name: 'keyPattern',
				type: 'string',
				required: true,
				default: 'chatbot:*',
				placeholder: 'chatbot:*, session:*, user:*',
				description: 'Redis key pattern to monitor (supports glob patterns like * and ?)',
				displayOptions: {
					show: {
						keyMonitoringMode: ['chooseKey'],
					},
				},
				typeOptions: {
					rows: 1,
				},
			},
			{
				displayName: 'Warning: Leave this blank will track all keys!',
				name: 'patternHelp',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						keyMonitoringMode: ['chooseKey'],
					},
				},
				typeOptions: {
					theme: 'info',
				},
				options: [],
				description:
					'<strong>Pattern Syntax:</strong>• <code>*</code> - Matches any characters (but not colon :)• <code>?</code> - Matches single character (but not colon :)• <code>**</code> - Matches any characters including colons<strong>Examples:</strong>• <code>chatbot:*</code> → chatbot:user123, chatbot:session456• <code>user:???:data</code> → user:abc:data, user:123:data• <code>*:messages</code> → chat:messages, room:messages• <code>cache:**</code> → cache:user:profile:settings',
			},
			{
				displayName: 'Warning: This will trigger all keys on your Redis Instance',
				name: 'performanceWarning',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						keyMonitoringMode: ['trackAll'],
					},
				},
				typeOptions: {
					theme: 'warning',
				},
				options: [],
				description:
					'&lt;strong&gt;⚠️ Performance Warning:&lt;/strong&gt;Tracking all keys will monitor EVERY Redis operation and can cause:• High CPU usage on Redis server• Network bandwidth consumption• Potential n8n workflow overload• Production performance issues&lt;strong&gt;Recommended:&lt;/strong&gt; Use "Choose Key" with specific patterns for production',
			},

			// Event Type Selection
			{
				displayName: 'Event Types',
				name: 'eventTypes',
				type: 'multiOptions',
				required: true,
				default: ['set', 'del'],
				options: [
					{
						name: 'SET - Key Created/Updated',
						value: 'set',
						description: 'Triggered when keys are created or their values updated',
					},
					{
						name: 'DEL - Key Deleted',
						value: 'del',
						description: 'Triggered when keys are explicitly deleted',
					},
					{
						name: 'EXPIRED - Key Expired',
						value: 'expired',
						description: 'Triggered when keys expire due to TTL',
					},
					{
						name: 'EVICTED - Key Evicted',
						value: 'evicted',
						description: 'Triggered when keys are evicted due to memory pressure',
					},
				],
				description: 'Select which Redis events should trigger the workflow',
			},

			// Rate Limiting Configuration
			{
				displayName: 'Rate Limiting',
				name: 'rateLimitEnabled',
				type: 'boolean',
				default: true,
				description: 'Whether to enable rate limiting to prevent event storms',
			},
			{
				displayName: 'Max Events Per Second',
				name: 'maxEventsPerSecond',
				type: 'number',
				default: 100,
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
				displayOptions: {
					show: {
						rateLimitEnabled: [true],
					},
				},
				description: 'Maximum number of events to process per second',
			},

			// Advanced Configuration
			{
				displayName: 'Advanced Options',
				name: 'advancedOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Connection Timeout (Ms)',
						name: 'connectionTimeout',
						type: 'number',
						default: 5000,
						typeOptions: {
							minValue: 1000,
							maxValue: 30000,
						},
						description: 'Redis connection timeout in milliseconds',
					},
					{
						displayName: 'Reconnect Attempts',
						name: 'reconnectAttempts',
						type: 'number',
						default: 5,
						typeOptions: {
							minValue: 1,
							maxValue: 20,
						},
						description: 'Number of reconnection attempts before giving up',
					},
					{
						displayName: 'Include Event Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: true,
						description: 'Whether to include additional metadata like timestamp and database info',
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		// Get parameters
		const keyMonitoringMode = this.getNodeParameter('keyMonitoringMode') as string;
		const eventTypes = this.getNodeParameter('eventTypes') as string[];
		const rateLimitEnabled = this.getNodeParameter('rateLimitEnabled', true) as boolean;
		const maxEventsPerSecond = this.getNodeParameter('maxEventsPerSecond', 100) as number;
		const advancedOptions = this.getNodeParameter('advancedOptions', {}) as any;

		// Determine key pattern based on monitoring mode
		let keyPattern: string;
		if (keyMonitoringMode === 'trackAll') {
			keyPattern = '*';
			// Track all mode enabled - monitoring all Redis keys
		} else {
			keyPattern = this.getNodeParameter('keyPattern') as string;

			// Validate pattern for chooseKey mode
			const patternValidation = PatternMatcher.validatePattern(keyPattern);
			if (!patternValidation.isValid) {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid key pattern: ${patternValidation.error}`,
				);
			}
		}

		// Validate event types
		const eventTypeValidation = EventTypeUtils.validateEventTypes(eventTypes);
		if (!eventTypeValidation.isValid) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid event types: ${eventTypeValidation.error}`,
			);
		}

		// Get Redis credentials
		const credentials = (await this.getCredentials('redis')) as RedisCredential;

		// Validate credentials are present
		if (!credentials || !credentials.host || !credentials.port) {
			throw new NodeOperationError(
				this.getNode(),
				'Redis credentials are incomplete. Please check host, port, and other connection settings.',
			);
		}

		// Initialize Redis Trigger Manager
		let redisTriggerManager: RedisTriggerManager | null = null;

		try {
			redisTriggerManager = new RedisTriggerManager(credentials, {
				connectionTimeout: advancedOptions.connectionTimeout || 5000,
				reconnectAttempts: advancedOptions.reconnectAttempts || 5,
				rateLimitEnabled,
				maxEventsPerSecond,
				includeMetadata: advancedOptions.includeMetadata !== false,
			});

			// Test Redis connection before starting monitoring
			try {
				const testClient = redisTriggerManager.getClient();
				if (!testClient.isOpen) {
					await testClient.connect();
				}

				// Test connection with a simple ping
				await testClient.ping();
			} catch (connectionError) {
				const errorMessage =
					connectionError instanceof Error ? connectionError.message : 'Unknown connection error';
				throw new NodeOperationError(
					this.getNode(),
					`Failed to connect to Redis server at ${credentials.host}:${credentials.port}. Please verify your Redis credentials and server availability. Error: ${errorMessage}`,
				);
			}

			// Configure keyspace notifications and start monitoring
			await redisTriggerManager.startMonitoring(keyPattern, eventTypes, (eventData) => {
				try {
					// Ensure all data is JSON-serializable and clean
					const outputData: INodeExecutionData = {
						json: {
							eventType: String(eventData.eventType || ''),
							key: String(eventData.key || ''),
							value: eventData.value !== undefined ? eventData.value : null,
							database: eventData.database !== undefined ? Number(eventData.database) : 0,
							timestamp: eventData.timestamp || new Date().toISOString(),
							...(advancedOptions.includeMetadata && {
								metadata: {
									pattern: String(keyPattern),
									triggerId: String(this.getNode().id),
									workflowId: String(this.getWorkflow().id),
									nodeVersion: 1,
								},
							}),
						},
					};

					// Emit trigger event to n8n workflow using the standard format
					this.emit([this.helpers.returnJsonArray([outputData])]);

					// Trigger event emitted successfully
				} catch (emissionError) {
					// Trigger emission failed - logged internally
					// Don't throw here to avoid workflow failures - just log the error
				}
			});

			// Return cleanup function
			const closeFunction = async () => {
				if (redisTriggerManager) {
					await redisTriggerManager.stopMonitoring();
					await redisTriggerManager.cleanup();
				}
			};

			// Return trigger response
			return {
				closeFunction,
			};
		} catch (error) {
			// Clean up on error
			if (redisTriggerManager) {
				try {
					await redisTriggerManager.cleanup();
				} catch (cleanupError) {
					// Log cleanup error but don't throw
					// Cleanup error - handled internally
				}
			}

			throw new NodeOperationError(
				this.getNode(),
				`Failed to initialize Redis trigger: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}
}
