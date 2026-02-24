import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

// Import managers
import { RedisManager } from './managers/RedisManager';
import { SpamDetector, SpamDetectionConfig } from './managers/SpamDetector';
import { RateLimiter, RateLimitConfig } from './managers/RateLimiter';

// Import types
import { RedisCredential, BufferState, BufferedMessage } from './types';

export class ChatBotEnhanced implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ChatBot Enhanced',
		name: 'chatBotEnhanced',
		icon: 'file:chatbot-enhanced.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Advanced chatbot functionality with smart rate limiting, message buffering, session management, and Redis integration for scalable conversation automation',
		codex: {
			categories: ['Data & Storage'],
			subcategories: {
				'Data & Storage': ['Redis', 'Session Management', 'Cache', 'Message Processing']
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/community-nodes/'
					},
					{
						url: 'https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/CONTRIBUTING.md'
					}
				],
				credentialDocumentation: [
					{
						url: 'https://redis.io/docs/getting-started/'
					},
					{
						url: 'https://redis.io/docs/manual/security/'
					}
				]
			},
			alias: [
				'chat bot', 'conversation bot', 'redis cache', 'rate limiter', 
				'spam filter', 'message queue', 'session store', 'conversation memory',
				'chatbot automation', 'messaging automation'
			]
		},
		defaults: {
			name: 'ChatBot Enhanced',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main, NodeConnectionType.Main, NodeConnectionType.Main],
		outputNames: ['Success', 'Spam', 'Process'],
		credentials: [
			{
				name: 'redis',
				required: true,
			},
		],
		properties: [
			// Resource Selection (Actions Only)
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
						description: 'Message buffering and routing for human-like responses',
					},
				],
				default: 'message',
				description: 'Choose the category of operations you want to perform',
			},





			// Message Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				required: true,
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Buffer Messages',
						value: 'bufferMessages',
						action: 'Buffer message',
						description: 'Collect multiple messages and flush after time delay',
					},
					{
						name: 'Spam Detection',
						value: 'spamDetection',
						action: 'Spam detection',
						description: 'Protect chatbot from spam and malicious content',
					},
					{
						name: 'Rate Limit',
						value: 'rateLimit',
						action: 'Rate limit',
						description: 'Prevent message flooding with smart rate limiting',
					},
				],
				default: 'bufferMessages',
			},



			// Common Parameters (hidden for connection test)
			{
				displayName: 'Session Key',
				name: 'sessionKey',
				type: 'string',
				required: true,
				default: '={{$json.userId || $json.sessionId || "test-connection"}}',
				description: 'Unique identifier for the user or session (can use expressions)',
			},
			{
				displayName: 'Message Content',
				name: 'messageContent',
				type: 'string',
				required: true,
				default: '',
				description: 'The message content as a string (can use expressions)',
			},

			// Buffer Time Configuration - Message Buffering
			{
				displayName: 'Buffer Time (Seconds)',
				name: 'bufferTime',
				type: 'number',
				required: true,
				default: 30,
				typeOptions: {
					minValue: 1,
					maxValue: 3600,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['bufferMessages'],
					},
				},
				description: 'Time to wait before flushing buffered messages',
			},

			// Buffer Size - Message Buffering
			{
				displayName: 'Buffer Size',
				name: 'bufferSize',
				type: 'number',
				required: true,
				default: 100,
				typeOptions: {
					minValue: 1,
					maxValue: 10000,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['bufferMessages'],
					},
				},
				description: 'Maximum number of messages to buffer before flushing',
			},

			// Buffer Pattern - Message Buffering
			{
				displayName: 'Buffer Pattern',
				name: 'bufferPattern',
				type: 'options',
				required: true,
				options: [
					{
						name: 'Collect & Send All',
						value: 'collect_send',
						description: 'Collect messages and send all at once',
					},
					{
						name: 'Throttle',
						value: 'throttle',
						description: 'Limit number of messages per flush',
					},
					{
						name: 'Batch',
						value: 'batch',
						description: 'Send messages in fixed-size batches',
					},
					{
						name: 'Priority Based',
						value: 'priority',
						description: 'Send high priority messages first',
					},
				],
				default: 'collect_send',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['bufferMessages'],
					},
				},
				description: 'How to handle buffered messages when flushing',
			},


			// Spam Detection Configuration - spamDetection operation
			{
				displayName: 'Detection Type',
				name: 'detectionType',
				type: 'options',
				options: [
					{
						name: 'Combined Detection',
						value: 'combined',
						description: 'Use multiple detection methods',
					},
					{
						name: 'Disabled',
						value: 'disabled',
						description: 'Turn off spam detection',
					},
					{
						name: 'Flood Protection',
						value: 'flood',
						description: 'Detect message flooding',
					},
					{
						name: 'Pattern Matching',
						value: 'pattern',
						description: 'Detect predefined spam patterns',
					},
					{
						name: 'Repeated Content',
						value: 'repeated',
						description: 'Detect similar or repeated messages',
					},
				],
				default: 'repeated',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
					},
				},
				description: 'Type of spam detection to use',
			},

			{
				displayName: 'Action on Detection',
				name: 'spamAction',
				type: 'options',
				options: [
					{
						name: 'Block',
						value: 'block',
						description: 'Block spam messages completely',
					},
					{
						name: 'Delay',
						value: 'delay',
						description: 'Delay processing of spam messages',
					},
					{
						name: 'Mark',
						value: 'mark',
						description: 'Mark as spam but continue processing',
					},
					{
						name: 'Warn',
						value: 'warn',
						description: 'Generate warning for spam messages',
					},
				],
				default: 'block',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						detectionType: ['repeated', 'flood', 'pattern', 'combined'],
					},
				},
				description: 'Action to take when spam is detected',
			},

			{
				displayName: 'Similarity Threshold (%)',
				name: 'similarityThreshold',
				type: 'number',
				default: 80,
				typeOptions: {
					minValue: 70,
					maxValue: 95,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						detectionType: ['repeated', 'combined'],
					},
				},
				description: 'Minimum similarity percentage to consider messages as repeated',
			},

			{
				displayName: 'Detection Time Window (Minutes)',
				name: 'detectionTimeWindow',
				type: 'number',
				default: 10,
				typeOptions: {
					minValue: 1,
					maxValue: 60,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						detectionType: ['repeated', 'combined'],
					},
				},
				description: 'Time window to check for repeated messages',
			},

			{
				displayName: 'Max Messages per Window',
				name: 'floodMaxMessages',
				type: 'number',
				default: 10,
				typeOptions: {
					minValue: 3,
					maxValue: 50,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						detectionType: ['flood', 'combined'],
					},
				},
				description: 'Maximum messages allowed in the flood time window',
			},

			{
				displayName: 'Flood Time Window (Seconds)',
				name: 'floodTimeWindow',
				type: 'number',
				default: 60,
				typeOptions: {
					minValue: 10,
					maxValue: 300,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						detectionType: ['flood', 'combined'],
					},
				},
				description: 'Time window to check for message flooding',
			},

			{
				displayName: 'Predefined Patterns',
				name: 'predefinedPatterns',
				type: 'multiOptions',
				options: [
					{
						name: 'Emails',
						value: 'emails',
						description: 'Detect email addresses',
					},
					{
						name: 'Excessive Caps',
						value: 'caps',
						description: 'Detect excessive capital letters',
					},
					{
						name: 'Phone Numbers',
						value: 'phones',
						description: 'Detect phone numbers',
					},
					{
						name: 'Repeated Characters',
						value: 'repeated_chars',
						description: 'Detect repeated characters like "aaaa"',
					},
					{
						name: 'URLs',
						value: 'urls',
						description: 'Detect URLs in messages',
					},
				],
				default: ['urls', 'emails'],
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						detectionType: ['pattern', 'combined'],
					},
				},
				description: 'Select predefined spam patterns to detect',
			},

			{
				displayName: 'Custom Patterns (Regex)',
				name: 'customPatterns',
				type: 'string',
				default: '',
				placeholder: 'Enter regex patterns, separated by newlines',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						detectionType: ['pattern', 'combined'],
					},
				},
				description: 'Custom regex patterns for spam detection (one per line)',
			},

			{
				displayName: 'Delay Time (Seconds)',
				name: 'delayTime',
				type: 'number',
				default: 5,
				typeOptions: {
					minValue: 1,
					maxValue: 60,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						spamAction: ['delay'],
					},
				},
				description: 'Delay time for spam messages when using delay action',
			},

			{
				displayName: 'Warning Message',
				name: 'warningMessage',
				type: 'string',
				default: 'Spam detected in message',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['spamDetection'],
						spamAction: ['warn'],
					},
				},
				description: 'Warning message to include with spam detection',
			},

			// Rate Limiting Configuration - rateLimit operation
			{
				displayName: 'Limit Type',
				name: 'limitType',
				type: 'options',
				options: [
					{
						name: 'Disabled',
						value: 'disabled',
						description: 'Turn off rate limiting',
					},
					{
						name: 'Global',
						value: 'global',
						description: 'Global rate limit for all messages',
					},
					{
						name: 'Per Session',
						value: 'per_session',
						description: 'Rate limit per session ID',
					},
					{
						name: 'Per User',
						value: 'per_user',
						description: 'Rate limit per user/session',
					},
					{
						name: 'Smart Adaptive',
						value: 'smart_adaptive',
						description: 'Adaptive rate limiting based on patterns',
					},
				],
				default: 'per_user',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
					},
				},
				description: 'Type of rate limiting to apply',
			},

			{
				displayName: 'Algorithm',
				name: 'rateLimitAlgorithm',
				type: 'options',
				options: [
					{
						name: 'Token Bucket',
						value: 'token_bucket',
						description: 'Allow burst of requests, then steady rate',
					},
					{
						name: 'Sliding Window',
						value: 'sliding_window',
						description: 'Track requests over moving time window',
					},
					{
						name: 'Fixed Window',
						value: 'fixed_window',
						description: 'Fixed time windows with reset',
					},
				],
				default: 'token_bucket',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
						limitType: ['per_user', 'per_session', 'global', 'smart_adaptive'],
					},
				},
				description: 'Rate limiting algorithm to use',
			},

			{
				displayName: 'Max Requests',
				name: 'maxRequests',
				type: 'number',
				default: 10,
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
						limitType: ['per_user', 'per_session', 'global', 'smart_adaptive'],
					},
				},
				description: 'Maximum requests allowed per time window',
			},

			{
				displayName: 'Time Window (Seconds)',
				name: 'rateLimitTimeWindow',
				type: 'number',
				default: 60,
				typeOptions: {
					minValue: 1,
					maxValue: 3600,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
						limitType: ['per_user', 'per_session', 'global', 'smart_adaptive'],
					},
				},
				description: 'Time window for rate limiting in seconds',
			},

			{
				displayName: 'Burst Limit',
				name: 'burstLimit',
				type: 'number',
				default: 15,
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
						rateLimitAlgorithm: ['token_bucket'],
					},
				},
				description: 'Maximum burst requests allowed (token bucket only)',
			},

			{
				displayName: 'Penalty Multiplier',
				name: 'penaltyMultiplier',
				type: 'number',
				default: 2.0,
				typeOptions: {
					minValue: 1.0,
					maxValue: 10.0,
					numberPrecision: 1,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
						limitType: ['smart_adaptive'],
					},
				},
				description: 'Penalty multiplier for exceeding limits',
			},

			{
				displayName: 'Enable Adaptive',
				name: 'enableAdaptive',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
						limitType: ['smart_adaptive'],
					},
				},
				description: 'Whether to enable adaptive rate adjustments based on patterns',
			},

			{
				displayName: 'Baseline Window (Minutes)',
				name: 'baselineWindow',
				type: 'number',
				default: 30,
				typeOptions: {
					minValue: 5,
					maxValue: 180,
				},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['rateLimit'],
						limitType: ['smart_adaptive'],
					},
				},
				description: 'Time window to establish baseline patterns',
			},

			// Legacy spam detection for buffer messages (keeping minimal for backward compatibility)
			{
				displayName: 'Anti-Spam Detection',
				name: 'antiSpamType',
				type: 'options',
				options: [
					{
						name: 'Disabled',
						value: 'disabled',
						description: '⚪ Turn off spam protection - all messages will be processed normally'
					},
					{
						name: 'Repeated Text Detection',
						value: 'repeated',
						description: '🔄 Catch users sending the same or very similar messages repeatedly (like "help help help")'
					},
					{
						name: 'Flood Protection',
						value: 'flood',
						description: '⚡ Stop users from flooding your chatbot with too many messages in a short time'
					},
					{
						name: 'Custom Pattern Match',
						value: 'pattern',
						description: '🎯 Advanced: Block messages containing specific words, URLs, phone numbers, or email addresses'
					}
				],
				default: 'disabled',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['bufferMessages']
					}
				},
				description: '🛡️ Protect your chatbot from spam messages. Choose how to detect unwanted or repetitive content automatically.'
			},



			// Global Options
			{
				displayName: 'Redis Key Prefix',
				name: 'keyPrefix',
				type: 'string',
				required: true,
				default: 'chatbot',
				description: 'Prefix for Redis keys to avoid collisions',
			},
		],
	};


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const successOutput: INodeExecutionData[] = [];
		const spamOutput: INodeExecutionData[] = [];
		const processOutput: INodeExecutionData[] = [];

		// Initialize Redis connection
		let redisManager: RedisManager | null = null;
		
		try {
			// Get Redis credentials using built-in n8n method
			const credentials = await this.getCredentials('redis') as RedisCredential;
			
			// Initialize Redis manager
			redisManager = new RedisManager(credentials, {
				connectionTimeout: 5000,
			});
			
			// Test Redis connection immediately before any operations
			let redisHealthy = false;
			try {
				const healthCheckPromise = redisManager.healthCheck();
				const timeoutPromise = new Promise<boolean>((_, reject) => {
					setTimeout(() => reject(new Error('Redis health check timeout after 2 seconds')), 2000);
				});
				redisHealthy = await Promise.race([healthCheckPromise, timeoutPromise]);
			} catch (healthError) {
				// Redis health check failed - logged internally
				redisHealthy = false;
			}
			
			if (!redisHealthy) {
				// Redis is not healthy - throwing error
				// Throw error immediately at the top level to properly fail the node
				// This is safe because we're not in a nested async context or wait loop
				throw new NodeOperationError(
					this.getNode(),
					`Redis Connection Failed: Cannot connect to ${credentials.host}:${credentials.port}. Please check your Redis credentials and ensure Redis server is running.`
				);
			}

			// Process only first item for now
			if (items.length === 0) {
				throw new NodeOperationError(this.getNode(), 'No input data provided');
			}
			const itemIndex = 0;
			
			// Get operation type to route to appropriate handler
			const operation = this.getNodeParameter('operation', itemIndex) as string;
			
			switch (operation) {
				case 'bufferMessages':
					return await ChatBotEnhanced.prototype.executeBufferMessages.call(this, redisManager, items, itemIndex, successOutput, spamOutput, processOutput);
				case 'spamDetection':
					return await ChatBotEnhanced.prototype.executeSpamDetection.call(this, redisManager, items, itemIndex, successOutput, spamOutput, processOutput);
				case 'rateLimit':
					return await ChatBotEnhanced.prototype.executeRateLimit.call(this, redisManager, items, itemIndex, successOutput, spamOutput, processOutput);
				default:
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
			}

		} catch (error) {
			const errorOutput = {
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Unknown error',
				operationType: this.getNodeParameter('operation', 0, 'unknown') as string,
				sessionId: 'node_level_error',
				timestamp: Date.now(),
			};

			processOutput.push({
				json: errorOutput,
				pairedItem: { item: 0 },
			});

			if (!this.continueOnFail()) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		} finally {
			// Clean up Redis connection
			if (redisManager) {
				await redisManager.cleanup();
			}
		}

		// Return 3 output arrays: Success, Spam, Process
		return [successOutput, spamOutput, processOutput];
	}

	/**
	 * Execute Buffer Messages operation (existing implementation)
	 */
	private async executeBufferMessages(
		this: IExecuteFunctions,
		redisManager: RedisManager,
		items: INodeExecutionData[],
		itemIndex: number,
		successOutput: INodeExecutionData[],
		spamOutput: INodeExecutionData[],
		processOutput: INodeExecutionData[]
	): Promise<INodeExecutionData[][]> {
		try {
			const sessionKey = this.getNodeParameter('sessionKey', itemIndex) as string;
			const messageContent = this.getNodeParameter('messageContent', itemIndex) as string;
				const keyPrefix = this.getNodeParameter('keyPrefix', itemIndex) as string;

				// Buffer configuration
				const bufferTime = this.getNodeParameter('bufferTime', itemIndex, 30) as number;
				const bufferSize = this.getNodeParameter('bufferSize', itemIndex, 100) as number;
				
				// Debug: Buffer execution started
				
				// Anti-spam parameters (will be used during buffer flush)
				const antiSpamType = this.getNodeParameter('antiSpamType', itemIndex, 'disabled') as string;

				// BufferKey with collision avoidance
				const { id } = this.getWorkflow();
				const bufferKey = `${keyPrefix}_buffer_${id}_${sessionKey}`;
				const waitAmount = bufferTime * 1000; // Convert to milliseconds

				// Get buffer state from Redis - simplified without nested health checks
				const getBufferState = async (): Promise<BufferState | null> => {
					try {
						const val = await redisManager!.read(bufferKey);
						if (!val) return null;
						return JSON.parse(val) as BufferState;
					} catch (error) {
						// Failed to read buffer state - logged internally
						// Return null instead of throwing to allow graceful handling
						return null;
					}
				};

				// Setup cancellation handler with error handling
				this.onExecutionCancellation(async () => {
					try {
						await redisManager!.delete(bufferKey);
					} catch (error) {
						// Ignore cleanup errors during cancellation
					}
				});

				// Get existing buffer state with error handling
				const existingBuffer = await getBufferState();
				const newMessage: BufferedMessage = {
					content: messageContent,
					userId: sessionKey,
					timestamp: Date.now(),
					metadata: {
						sessionKey: sessionKey,
						itemIndex: itemIndex
					},
				};

				if (!existingBuffer) {
					// FIRST MESSAGE - Create buffer and wait
					const bufferState: BufferState = {
						exp: Date.now() + waitAmount,
						data: [newMessage],
						sessionId: sessionKey,
						totalCount: 1,
					};

					try {
						await redisManager!.write(bufferKey, JSON.stringify(bufferState));
					} catch (redisError) {
						throw new NodeOperationError(
							this.getNode(), 
							`Failed to write buffer state to Redis: ${redisError instanceof Error ? redisError.message : 'Unknown Redis error'}`
						);
					}

					// Check if buffer size reached immediately
					if (bufferState.totalCount >= bufferSize) {
						// Size trigger - flush immediately
						const buffer = await getBufferState();
						
						// Analyze buffer for spam
						const spamAnalysis = await ChatBotEnhanced.analyzeBufferForSpam(
							this, redisManager!, buffer!, antiSpamType, itemIndex
						);
						
						// Send spam report if any spam detected
						if (spamAnalysis.spamDetected && spamAnalysis.spamMessages.length > 0) {
							spamOutput.push({
								json: {
									type: 'spam_analysis',
									totalMessages: buffer!.totalCount,
									spamMessages: spamAnalysis.spamMessages,
									cleanMessages: spamAnalysis.cleanMessages,
									spamCount: spamAnalysis.spamMessages.length,
									spamTypes: spamAnalysis.spamTypes,
									sessionId: sessionKey,
									timestamp: Date.now(),
								},
								pairedItem: { item: itemIndex },
							});
						}
						
						successOutput.push({
							json: {
								type: 'buffer_flush',
								messages: buffer!.data.map(msg => msg.content),
								totalMessages: buffer!.totalCount,
								trigger: 'size',
								spamAnalysis: {
									spamDetected: spamAnalysis.spamDetected,
									spamCount: spamAnalysis.spamMessages.length,
									cleanCount: spamAnalysis.cleanMessages.length,
								},
								sessionId: sessionKey,
								timestamp: Date.now(),
							},
							pairedItem: { item: itemIndex },
						});
						
						// Clean up buffer from Redis (non-critical operation)
						try {
							await redisManager!.delete(bufferKey);
						} catch (deleteError) {
							// Log but don't fail the operation since buffer flush succeeded
						}
						
						return [successOutput, spamOutput, processOutput];
					}

					// BLOCKING WAIT for timer (TimedBuffer pattern)
					// Constants for buffer wait protection (see tech-spec-fix-emergency-timeout-override-buffer-message.md)
					const BUFFER_WAIT_INTERVAL_MS = 100; // Each iteration sleeps for 100ms
					const MIN_ABSOLUTE_WAIT_MS = 10000; // Minimum 10 seconds absolute wait
					const MIN_WAIT_ITERATIONS = 50; // Minimum iterations to prevent premature exit
					const SAFETY_BUFFER_MS = 2000; // Safety buffer on top of bufferTime
					const ABSOLUTE_SAFETY_BUFFER_MS = 3000; // Safety buffer for absolute max wait

					let resume = false;
					let waitIterations = 0;
					const startTime = Date.now();
					const maxWaitTime = Date.now() + (bufferTime * 1000) + SAFETY_BUFFER_MS;
					// Dynamic absolute max: at least 10s, or bufferTime + 3s safety buffer
					const ABSOLUTE_MAX_WAIT = Math.max(MIN_ABSOLUTE_WAIT_MS, bufferTime * 1000 + ABSOLUTE_SAFETY_BUFFER_MS);
					// Iterations based on bufferTime: 10 iterations per second (100ms each), minimum 50
					const MAX_WAIT_ITERATIONS = Math.max(MIN_WAIT_ITERATIONS, bufferTime * (1000 / BUFFER_WAIT_INTERVAL_MS));


					while (!resume) {
						// Circuit breaker protection - prevents infinite loops (iterations-based safety)
						if (waitIterations++ > MAX_WAIT_ITERATIONS) {
							resume = true;
							break;
						}
						
						// Timeout protection
						const elapsedTime = Date.now() - startTime;
						if (Date.now() > maxWaitTime || elapsedTime > ABSOLUTE_MAX_WAIT) {
							// Buffer timeout reached
							resume = true;
							break;
						}
						
						// CRITICAL: Enhanced Redis connection monitoring during buffer wait to prevent infinite loop
						
						// Use async health check instead of sync isAvailable
						let healthCheckPassed = false;
						try {
							healthCheckPassed = await redisManager!.healthCheck();
						} catch (healthError) {
							// Connection health check failed - return error data instead of throwing
							const errorOutput: INodeExecutionData[] = [{
								json: {
									error: 'Redis Health Check Failed',
									message: 'Redis connection health check failed during buffer wait operation',
									sessionKey,
									timestamp: Date.now(),
									errorDetails: healthError instanceof Error ? healthError.message : 'Unknown error'
								},
								pairedItem: { item: itemIndex }
							}];
							return [errorOutput, [], []];
						}
						
						if (!healthCheckPassed) {
							// Connection is not healthy - return error data instead of throwing
							// Redis connection unhealthy - handled internally
							const errorOutput: INodeExecutionData[] = [{
								json: {
									error: 'Redis Connection Lost',
									message: 'Redis connection became unhealthy during buffer wait operation',
									sessionKey,
									timestamp: Date.now()
								},
								pairedItem: { item: itemIndex }
							}];
							return [errorOutput, [], []];
						}
						
						let refreshBuffer;
						
						// Get buffer state with timeout protection
						try {
							const bufferStatePromise = getBufferState();
							const timeoutPromise = new Promise<BufferState | null>((resolve) => {
								setTimeout(() => resolve(null), 3000);
							});
							
							refreshBuffer = await Promise.race([bufferStatePromise, timeoutPromise]);
						} catch (error) {
							// getBufferState() error - logged internally
							refreshBuffer = null;
						}
						
						if (refreshBuffer === null) {
							// Redis connection lost - handled internally
							// Return error data instead of throwing to prevent infinite loop
							const errorOutput: INodeExecutionData[] = [{
								json: {
									error: 'Redis Connection Lost',
									message: 'Lost connection to Redis during buffer wait operation',
									sessionKey,
									timestamp: Date.now()
								},
								pairedItem: { item: itemIndex }
							}];
							return [errorOutput, [], []];
						}
						
						if (!refreshBuffer) {
							resume = true;
							break;
						}

						
						// Check if buffer size reached during wait
						if (refreshBuffer && refreshBuffer.totalCount >= bufferSize) {
							resume = true;
							break;
						}

						// Defensive timing calculation with validation
						if (!refreshBuffer || !refreshBuffer.exp || isNaN(refreshBuffer.exp)) {
							resume = true;
							break;
						}
						
						const remainingTime = Math.max(0, refreshBuffer.exp - Date.now());
						resume = remainingTime <= 50; // 50ms tolerance for timing inconsistencies
						
						if (!resume) {
							const waitTime = Math.min(remainingTime, 100); // Check every 100ms max
							await new Promise((resolve) => {
								const timer = setTimeout(resolve, waitTime);
								this.onExecutionCancellation(() => clearTimeout(timer));
							});
						}
					}

					// Timer completed or size reached - flush buffer
					const finalBuffer = await getBufferState();
					if (finalBuffer) {
						const trigger = finalBuffer.totalCount >= bufferSize ? 'size' : 'time';
						
						// Analyze buffer for spam BEFORE flushing
						const spamAnalysis = await ChatBotEnhanced.analyzeBufferForSpam(
							this, redisManager!, finalBuffer, antiSpamType, itemIndex
						);
						
						// Send spam report if any spam detected
						if (spamAnalysis.spamDetected && spamAnalysis.spamMessages.length > 0) {
							spamOutput.push({
								json: {
									type: 'spam_analysis',
									totalMessages: finalBuffer.totalCount,
									spamMessages: spamAnalysis.spamMessages,
									cleanMessages: spamAnalysis.cleanMessages,
									spamCount: spamAnalysis.spamMessages.length,
									spamTypes: spamAnalysis.spamTypes,
									sessionId: sessionKey,
									timestamp: Date.now(),
								},
								pairedItem: { item: itemIndex },
							});
						}
						
						// Always send buffer flush to Success (regardless of spam)
						successOutput.push({
							json: {
								type: 'buffer_flush',
								messages: finalBuffer.data.map(msg => msg.content),
								totalMessages: finalBuffer.totalCount,
								trigger,
								spamAnalysis: {
									spamDetected: spamAnalysis.spamDetected,
									spamCount: spamAnalysis.spamMessages.length,
									cleanCount: spamAnalysis.cleanMessages.length,
								},
								sessionId: sessionKey,
								timestamp: Date.now(),
							},
							pairedItem: { item: itemIndex },
						});
						
						// Clean up buffer from Redis (non-critical operation)
						try {
							await redisManager!.delete(bufferKey);
						} catch (deleteError) {
							// Log but don't fail the operation since buffer flush succeeded
						}
					}

				} else {
					// SUBSEQUENT MESSAGE - Add to existing buffer
					const updatedData = [...existingBuffer.data, newMessage];
					const bufferState: BufferState = {
						exp: Date.now() + waitAmount, // Reset timer
						data: updatedData,
						sessionId: sessionKey,
						totalCount: updatedData.length,
					};

					try {
						await redisManager!.write(bufferKey, JSON.stringify(bufferState));
					} catch (redisError) {
						throw new NodeOperationError(
							this.getNode(), 
							`Failed to write updated buffer state to Redis: ${redisError instanceof Error ? redisError.message : 'Unknown Redis error'}`
						);
					}

					// Check if buffer size reached
					if (bufferState.totalCount >= bufferSize) {
						// Size trigger - flush immediately
						// Analyze buffer for spam
						const spamAnalysis = await ChatBotEnhanced.analyzeBufferForSpam(
							this, redisManager!, bufferState, antiSpamType, itemIndex
						);
						
						// Send spam report if any spam detected
						if (spamAnalysis.spamDetected && spamAnalysis.spamMessages.length > 0) {
							spamOutput.push({
								json: {
									type: 'spam_analysis',
									totalMessages: bufferState.totalCount,
									spamMessages: spamAnalysis.spamMessages,
									cleanMessages: spamAnalysis.cleanMessages,
									spamCount: spamAnalysis.spamMessages.length,
									spamTypes: spamAnalysis.spamTypes,
									sessionId: sessionKey,
									timestamp: Date.now(),
								},
								pairedItem: { item: itemIndex },
							});
						}
						
						successOutput.push({
							json: {
								type: 'buffer_flush',
								messages: bufferState.data.map(msg => msg.content),
								totalMessages: bufferState.totalCount,
								trigger: 'size',
								spamAnalysis: {
									spamDetected: spamAnalysis.spamDetected,
									spamCount: spamAnalysis.spamMessages.length,
									cleanCount: spamAnalysis.cleanMessages.length,
								},
								sessionId: sessionKey,
								timestamp: Date.now(),
							},
							pairedItem: { item: itemIndex },
						});
						
						// Clean up buffer from Redis (non-critical operation)
						try {
							await redisManager!.delete(bufferKey);
						} catch (deleteError) {
							// Log but don't fail the operation since buffer flush succeeded
						}
					} else {
						// Message added to buffer - return skipped (Process output)
						processOutput.push({
							json: {
								status: 'buffered',
								message: messageContent,
								sessionId: sessionKey,
								totalInBuffer: bufferState.totalCount,
								operationType: 'messageBuffering',
								timestamp: Date.now(),
							},
							pairedItem: { item: itemIndex },
						});
					}
				}

		} catch (error) {
			const errorOutput = {
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Unknown error',
				operationType: 'messageBuffering',
				sessionId: this.getNodeParameter('sessionKey', itemIndex, 'node_level_error') as string,
				timestamp: Date.now(),
			};

			processOutput.push({
				json: errorOutput,
				pairedItem: { item: itemIndex },
			});

			if (!this.continueOnFail()) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		// Return 3 output arrays: Success, Spam, Process
		return [successOutput, spamOutput, processOutput];
	}

	/**
	 * Execute Spam Detection operation (new implementation)
	 */
	private async executeSpamDetection(
		this: IExecuteFunctions,
		redisManager: RedisManager,
		items: INodeExecutionData[],
		itemIndex: number,
		successOutput: INodeExecutionData[],
		spamOutput: INodeExecutionData[],
		processOutput: INodeExecutionData[]
	): Promise<INodeExecutionData[][]> {
		try {
			const sessionKey = this.getNodeParameter('sessionKey', itemIndex) as string;
			const messageContent = this.getNodeParameter('messageContent', itemIndex) as string;
			const keyPrefix = this.getNodeParameter('keyPrefix', itemIndex) as string;

			// Spam detection configuration
			const detectionType = this.getNodeParameter('detectionType', itemIndex, 'repeated') as string;
			const spamAction = this.getNodeParameter('spamAction', itemIndex, 'block') as string;
			const similarityThreshold = this.getNodeParameter('similarityThreshold', itemIndex, 80) as number;
			const detectionTimeWindow = this.getNodeParameter('detectionTimeWindow', itemIndex, 10) as number;
			const floodMaxMessages = this.getNodeParameter('floodMaxMessages', itemIndex, 10) as number;
			const floodTimeWindow = this.getNodeParameter('floodTimeWindow', itemIndex, 60) as number;
			const predefinedPatterns = this.getNodeParameter('predefinedPatterns', itemIndex, []) as string[];
			const customPatterns = this.getNodeParameter('customPatterns', itemIndex, '') as string;
			const delayTime = this.getNodeParameter('delayTime', itemIndex, 5) as number;
			const warningMessage = this.getNodeParameter('warningMessage', itemIndex, 'Spam detected in message') as string;

			// Create spam detection configuration
			const spamConfig: SpamDetectionConfig = {
				detectionType: detectionType as any,
				action: spamAction as any,
				similarityThreshold,
				detectionTimeWindow,
				floodMaxMessages,
				floodTimeWindow,
				predefinedPatterns: predefinedPatterns as any,
				customRegexPattern: customPatterns,
				extraDelayTime: delayTime,
				keyPrefix,
				userId: sessionKey,
				sessionId: sessionKey,
			};

			// Initialize SpamDetector
			const spamDetector = new SpamDetector(redisManager, spamConfig);

			// Perform spam detection
			const result = await spamDetector.detectSpam(messageContent);

			if (result.isSpam) {
				// Route to spam output
				spamOutput.push({
					json: {
						type: 'spam_detected',
						message: messageContent,
						sessionId: sessionKey,
						spamType: result.spamType,
						confidence: result.confidence,
						actionTaken: result.actionTaken,
						reason: result.reason,
						matchedPattern: result.matchedPattern,
						additionalDelay: result.additionalDelay,
						warningMessage: spamAction === 'warn' ? warningMessage : undefined,
						timestamp: result.timestamp,
						operationType: 'spamDetection',
					},
					pairedItem: { item: itemIndex },
				});

				// If action is block, don't process further
				if (result.actionTaken === 'blocked') {
					return [successOutput, spamOutput, processOutput];
				}

				// If action is delay, add to process output with delay info
				if (result.actionTaken === 'delayed') {
					processOutput.push({
						json: {
							status: 'delayed',
							message: messageContent,
							sessionId: sessionKey,
							delayTime: result.additionalDelay,
							operationType: 'spamDetection',
							timestamp: Date.now(),
						},
						pairedItem: { item: itemIndex },
					});
				}
			} else {
				// Clean message - route to process output (normal flow)
				processOutput.push({
					json: {
						type: 'clean_message',
						message: messageContent,
						sessionId: sessionKey,
						confidence: result.confidence,
						operationType: 'spamDetection',
						timestamp: result.timestamp,
					},
					pairedItem: { item: itemIndex },
				});
			}

		} catch (error) {
			const errorOutput = {
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Unknown error',
				sessionId: this.getNodeParameter('sessionKey', itemIndex) as string,
				operationType: 'spamDetection',
				timestamp: Date.now(),
			};

			processOutput.push({
				json: errorOutput,
				pairedItem: { item: itemIndex },
			});

			if (!this.continueOnFail()) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		return [successOutput, spamOutput, processOutput];
	}

	/**
	 * Execute Rate Limit operation (new implementation)
	 */
	private async executeRateLimit(
		this: IExecuteFunctions,
		redisManager: RedisManager,
		items: INodeExecutionData[],
		itemIndex: number,
		successOutput: INodeExecutionData[],
		spamOutput: INodeExecutionData[],
		processOutput: INodeExecutionData[]
	): Promise<INodeExecutionData[][]> {
		try {
			const sessionKey = this.getNodeParameter('sessionKey', itemIndex) as string;
			const messageContent = this.getNodeParameter('messageContent', itemIndex) as string;
			const keyPrefix = this.getNodeParameter('keyPrefix', itemIndex) as string;

			// Rate limit configuration
			const limitType = this.getNodeParameter('limitType', itemIndex, 'per_user') as string;
			const algorithm = this.getNodeParameter('rateLimitAlgorithm', itemIndex, 'token_bucket') as string;
			const maxRequests = this.getNodeParameter('maxRequests', itemIndex, 10) as number;
			const timeWindow = this.getNodeParameter('rateLimitTimeWindow', itemIndex, 60) as number;
			const burstLimit = this.getNodeParameter('burstLimit', itemIndex, 15) as number;
			const penaltyMultiplier = this.getNodeParameter('penaltyMultiplier', itemIndex, 2.0) as number;
			const enableAdaptive = this.getNodeParameter('enableAdaptive', itemIndex, true) as boolean;
			// const baselineWindow = this.getNodeParameter('baselineWindow', itemIndex, 30) as number;

			if (limitType === 'disabled') {
				// Rate limiting disabled - pass through to process (normal flow)
				processOutput.push({
					json: {
						type: 'rate_limit_disabled',
						message: messageContent,
						sessionId: sessionKey,
						operationType: 'rateLimit',
						timestamp: Date.now(),
					},
					pairedItem: { item: itemIndex },
				});
				return [successOutput, spamOutput, processOutput];
			}

			// Create rate limit configuration
			const rateLimitConfig: RateLimitConfig = {
				algorithm: algorithm as any,
				strategy: limitType as any,
				windowSize: timeWindow,
				maxRequests,
				burstLimit,
				penaltyTime: penaltyMultiplier * timeWindow,
				keyPrefix,
			};

			// Initialize RateLimiter
			const rateLimiter = new RateLimiter(redisManager, rateLimitConfig);

			// Generate identifier based on limit type
			let identifier = sessionKey;
			if (limitType === 'global') {
				identifier = 'global';
			}

			// Check if under penalty first
			const penaltyCheck = await rateLimiter.checkPenalty(identifier);
			if (penaltyCheck.isPenalized) {
				// Under penalty - route to spam output
				spamOutput.push({
					json: {
						type: 'rate_limit_penalty',
						message: messageContent,
						sessionId: sessionKey,
						remainingPenaltyTime: penaltyCheck.remainingTime,
						operationType: 'rateLimit',
						timestamp: Date.now(),
					},
					pairedItem: { item: itemIndex },
				});
				return [successOutput, spamOutput, processOutput];
			}

			// Perform rate limit check
			const result = await rateLimiter.checkRateLimit(identifier);

			if (result.allowed) {
				// Request allowed - route to process output (normal flow)
				processOutput.push({
					json: {
						type: 'rate_limit_allowed',
						message: messageContent,
						sessionId: sessionKey,
						remainingRequests: result.remainingRequests,
						resetTime: result.resetTime,
						algorithm: result.algorithm,
						strategy: result.strategy,
						operationType: 'rateLimit',
						timestamp: Date.now(),
					},
					pairedItem: { item: itemIndex },
				});
			} else {
				// Rate limit exceeded - route to spam output
				spamOutput.push({
					json: {
						type: 'rate_limit_exceeded',
						message: messageContent,
						sessionId: sessionKey,
						remainingRequests: result.remainingRequests,
						resetTime: result.resetTime,
						retryAfter: result.retryAfter,
						algorithm: result.algorithm,
						strategy: result.strategy,
						operationType: 'rateLimit',
						timestamp: Date.now(),
					},
					pairedItem: { item: itemIndex },
				});

				// Apply penalty if enabled
				if (enableAdaptive && penaltyMultiplier > 1) {
					await rateLimiter.applyPenalty(identifier);
				}
			}

		} catch (error) {
			const errorOutput = {
				status: 'error',
				errorMessage: error instanceof Error ? error.message : 'Unknown error',
				sessionId: this.getNodeParameter('sessionKey', itemIndex) as string,
				operationType: 'rateLimit',
				timestamp: Date.now(),
			};

			processOutput.push({
				json: errorOutput,
				pairedItem: { item: itemIndex },
			});

			if (!this.continueOnFail()) {
				throw new NodeOperationError(this.getNode(), error as Error);
			}
		}

		return [successOutput, spamOutput, processOutput];
	}

	/**
	 * Analyze buffer for spam patterns
	 */
	private static async analyzeBufferForSpam(
		executeFunctions: IExecuteFunctions,
		redisManager: RedisManager,
		bufferState: BufferState,
		antiSpamType: string,
		itemIndex: number
	): Promise<{
		spamDetected: boolean;
		spamMessages: Array<{ content: string; reason: string; confidence: number }>;
		cleanMessages: string[];
		spamTypes: string[];
	}> {
		const spamMessages: Array<{ content: string; reason: string; confidence: number }> = [];
		const cleanMessages: string[] = [];
		const spamTypes: string[] = [];

		if (antiSpamType === 'disabled') {
			return {
				spamDetected: false,
				spamMessages: [],
				cleanMessages: bufferState.data.map(msg => msg.content),
				spamTypes: [],
			};
		}

		// Analyze buffer for spam patterns
		switch (antiSpamType) {
			case 'repeated':
				const similarityThreshold = executeFunctions.getNodeParameter('similarityThreshold', itemIndex, 80) as number;
				const spamAnalysisResult = ChatBotEnhanced.analyzeRepeatedContent(bufferState.data, similarityThreshold);
				spamMessages.push(...spamAnalysisResult.spamMessages);
				cleanMessages.push(...spamAnalysisResult.cleanMessages);
				if (spamAnalysisResult.spamMessages.length > 0) {
					spamTypes.push('repeated_content');
				}
				break;
				
			case 'flood':
				// For flood protection, check if buffer size reached too quickly
				const bufferCreationTime = Math.min(...bufferState.data.map(msg => msg.timestamp));
				const bufferDuration = Date.now() - bufferCreationTime;
				const floodMaxMessages = executeFunctions.getNodeParameter('floodMaxMessages', itemIndex, 5) as number;
				const floodTimeWindow = executeFunctions.getNodeParameter('floodTimeWindow', itemIndex, 30) as number;
				
				if (bufferState.data.length >= floodMaxMessages && bufferDuration < (floodTimeWindow * 1000)) {
					// All messages are considered spam due to flooding
					for (const message of bufferState.data) {
						spamMessages.push({
							content: message.content,
							reason: 'flooding',
							confidence: 95,
						});
					}
					spamTypes.push('flooding');
				} else {
					cleanMessages.push(...bufferState.data.map(msg => msg.content));
				}
				break;
				
			case 'pattern':
				// Check each message for spam patterns
				for (const message of bufferState.data) {
					const hasSpamPattern = ChatBotEnhanced.checkSpamPatterns(message.content);
					if (hasSpamPattern.isSpam) {
						spamMessages.push({
							content: message.content,
							reason: hasSpamPattern.reason,
							confidence: 90,
						});
						if (!spamTypes.includes(hasSpamPattern.reason)) {
							spamTypes.push(hasSpamPattern.reason);
						}
					} else {
						cleanMessages.push(message.content);
					}
				}
				break;
		}

		return {
			spamDetected: spamMessages.length > 0,
			spamMessages,
			cleanMessages,
			spamTypes,
		};
	}

	/**
	 * Analyze repeated content within buffered messages
	 */
	private static analyzeRepeatedContent(
		messages: BufferedMessage[], 
		similarityThreshold: number
	): {
		spamMessages: Array<{ content: string; reason: string; confidence: number }>;
		cleanMessages: string[];
	} {
		const spamMessages: Array<{ content: string; reason: string; confidence: number }> = [];
		const cleanMessages: string[] = [];
		const processedMessages: Set<string> = new Set();

		for (let i = 0; i < messages.length; i++) {
			const currentMsg = messages[i];
			let isSpam = false;
			let maxSimilarity = 0;

			// Skip if already processed as spam
			if (processedMessages.has(currentMsg.content)) {
				continue;
			}

			// Compare with other messages in buffer
			for (let j = 0; j < messages.length; j++) {
				if (i === j) continue;
				
				const otherMsg = messages[j];
				const similarity = ChatBotEnhanced.calculateStringSimilarity(
					currentMsg.content, 
					otherMsg.content
				);

				if (similarity >= similarityThreshold) {
					maxSimilarity = Math.max(maxSimilarity, similarity);
					isSpam = true;
					
					// Mark both messages as spam (if not already processed)
					if (!processedMessages.has(otherMsg.content)) {
						spamMessages.push({
							content: otherMsg.content,
							reason: 'repeated_content',
							confidence: similarity,
						});
						processedMessages.add(otherMsg.content);
					}
				}
			}

			if (isSpam) {
				spamMessages.push({
					content: currentMsg.content,
					reason: 'repeated_content',
					confidence: maxSimilarity,
				});
				processedMessages.add(currentMsg.content);
			} else {
				cleanMessages.push(currentMsg.content);
			}
		}

		return { spamMessages, cleanMessages };
	}



	/**
	 * Check for spam patterns
	 */
	private static checkSpamPatterns(messageContent: string): { isSpam: boolean; reason: string } {
		// URL pattern
		const urlPattern = /(https?:\/\/[^\s]+)/gi;
		if (urlPattern.test(messageContent)) {
			return { isSpam: true, reason: 'contains_url' };
		}
		
		// Phone pattern
		const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
		if (phonePattern.test(messageContent)) {
			return { isSpam: true, reason: 'contains_phone' };
		}
		
		// Email pattern
		const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
		if (emailPattern.test(messageContent)) {
			return { isSpam: true, reason: 'contains_email' };
		}
		
		return { isSpam: false, reason: '' };
	}

	/**
	 * Calculate string similarity (simple Levenshtein-based)
	 */
	private static calculateStringSimilarity(str1: string, str2: string): number {
		if (str1 === str2) return 100;
		if (str1.length === 0 || str2.length === 0) return 0;
		
		const longer = str1.length > str2.length ? str1 : str2;
		const shorter = str1.length > str2.length ? str2 : str1;
		
		if (longer.length === 0) return 100;
		
		const distance = ChatBotEnhanced.levenshteinDistance(longer, shorter);
		return Math.round(((longer.length - distance) / longer.length) * 100);
	}

	/**
	 * Calculate Levenshtein distance
	 */
	private static levenshteinDistance(str1: string, str2: string): number {
		const matrix = [];
		
		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}
		
		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}
		
		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1
					);
				}
			}
		}
		
		return matrix[str2.length][str1.length];
	}
}