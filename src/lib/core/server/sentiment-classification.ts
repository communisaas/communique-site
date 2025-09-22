import { db } from '$lib/core/db';

/**
 * BERT Sentiment Classification Pipeline
 *
 * Implements the mathematical processing pipeline:
 * f: Text → ℝ³ (sentiment_class, confidence, intensity)
 */

export interface SentimentResult {
	sentiment_class: 'pro' | 'anti' | 'neutral';
	confidence: number; // 0-1
	intensity: number; // 0-1
	embedding?: number[]; // BERT embedding ∈ ℝ⁷⁶⁸
}

export interface MessageEmbedding {
	message_id: string;
	text: string;
	embedding: number[];
	sentiment: SentimentResult;
	geographic_coords?: {
		latitude: number;
		longitude: number;
	};
}

/**
 * Step 1: BERT Classification
 * Algorithm: Fine-tuned BERT classification
 *
 * For each message mᵢ:
 * 1. Tokenize: tokens = BERT_tokenizer(mᵢ)
 * 2. Embed: embeddings = BERT_model(tokens) ∈ ℝ⁷⁶⁸
 * 3. Classify: logits = W₃×₇₆₈ · embeddings + b₃
 * 4. Softmax: P(class|mᵢ) = softmax(logits)
 */
export async function classifyMessageSentiment(text: string): Promise<SentimentResult> {
	// For now, implement rule-based classification that will be replaced with BERT
	const lowerText = text.toLowerCase();

	// Political keywords for classification
	const proKeywords = [
		'support',
		'approve',
		'endorse',
		'favor',
		'agree',
		'yes',
		'forward',
		'progress',
		'reform',
		'improve',
		'help',
		'benefit',
		'relief',
		'forgiveness',
		'cancel'
	];

	const antiKeywords = [
		'oppose',
		'against',
		'reject',
		'deny',
		'no',
		'stop',
		'prevent',
		'block',
		'unfair',
		'wrong',
		'bad',
		'terrible',
		'disaster',
		'waste',
		'burden'
	];

	const emotionalIntensifiers = [
		'very',
		'extremely',
		'completely',
		'totally',
		'absolutely',
		'definitely',
		'strongly',
		'deeply',
		'really',
		'truly',
		'highly',
		'!',
		'crisis',
		'urgent'
	];

	// Calculate scores
	let proScore = 0;
	let antiScore = 0;
	let intensityScore = 0;

	proKeywords.forEach((keyword) => {
		if (lowerText.includes(keyword)) proScore += 1;
	});

	antiKeywords.forEach((keyword) => {
		if (lowerText.includes(keyword)) antiScore += 1;
	});

	emotionalIntensifiers.forEach((intensifier) => {
		if (lowerText.includes(intensifier)) intensityScore += 0.1;
	});

	// Determine classification
	const totalScore = proScore + antiScore;
	let sentiment_class: 'pro' | 'anti' | 'neutral';
	let confidence: number;

	if (totalScore === 0) {
		sentiment_class = 'neutral';
		confidence = 0.5;
	} else if (proScore > antiScore) {
		sentiment_class = 'pro';
		confidence = Math.min(0.95, 0.6 + (proScore / (totalScore + 1)) * 0.35);
	} else if (antiScore > proScore) {
		sentiment_class = 'anti';
		confidence = Math.min(0.95, 0.6 + (antiScore / (totalScore + 1)) * 0.35);
	} else {
		sentiment_class = 'neutral';
		confidence = 0.55;
	}

	// Calculate intensity (0-1 scale)
	const baseIntensity = Math.min(1.0, totalScore * 0.2);
	const intensity = Math.min(1.0, baseIntensity + intensityScore);

	return {
		sentiment_class,
		confidence,
		intensity
	};
}

/**
 * Process messages from template campaigns and extract sentiment
 */
export async function processTemplateMessages(): Promise<MessageEmbedding[]> {
	// Get recent template campaigns with message content
	const campaigns = await db.template_campaign.findMany({
		where: {
			created_at: {
				gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
			}
		},
		include: {
			template: {
				include: {
					user: {
						select: {
							id: true,
							state: true,
							congressional_district: true,
							latitude: true,
							longitude: true
						}
					}
				}
			}
		},
		take: 100
	});

	const processedMessages: MessageEmbedding[] = [];

	for (const campaign of campaigns) {
		const messageText = campaign.template.message_body || campaign.template.description;
		if (!messageText) continue;

		// Classify sentiment
		const sentiment = await classifyMessageSentiment(messageText);

		// Create embedding representation (mock for now)
		const embedding = generateMockEmbedding(messageText, sentiment);

		const messageEmbedding: MessageEmbedding = {
			message_id: campaign.id,
			text: messageText,
			embedding,
			sentiment,
			geographic_coords:
				campaign.template.user?.latitude && campaign.template.user?.longitude
					? {
							latitude: campaign.template.user.latitude,
							longitude: campaign.template.user.longitude
						}
					: undefined
		};

		processedMessages.push(messageEmbedding);
	}

	return processedMessages;
}

/**
 * Generate mock BERT-like embedding (768 dimensions)
 * This will be replaced with actual BERT inference
 */
function generateMockEmbedding(text: string, sentiment: SentimentResult): number[] {
	const embedding = new Array(768);

	// Create pseudo-embedding based on text features and sentiment
	const textHash = hashString(text);
	const sentimentVector =
		sentiment.sentiment_class === 'pro' ? 1 : sentiment.sentiment_class === 'anti' ? -1 : 0;

	for (let i = 0; i < 768; i++) {
		// Combine text features with sentiment signal
		const textComponent = Math.sin(textHash * (i + 1) * 0.001) * 0.5;
		const sentimentComponent = sentimentVector * sentiment.intensity * 0.3;
		const randomNoise = (Math.random() - 0.5) * 0.2;

		embedding[i] = textComponent + sentimentComponent + randomNoise;
	}

	return embedding;
}

/**
 * Simple string hash function for consistent embedding generation
 */
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash);
}

/**
 * Store processed sentiment data in user_coordinates political_embedding
 */
export async function storePoliticalEmbeddings(messages: MessageEmbedding[]): Promise<void> {
	for (const message of messages) {
		if (!message.geographic_coords) continue;

		// Find user from campaign
		const campaign = await db.template_campaign.findUnique({
			where: { id: message.message_id },
			include: {
				template: {
					select: { userId: true }
				}
			}
		});

		if (!campaign?.template.userId) continue;

		// Update political embedding directly in User model
		await db.user.update({
			where: { id: campaign.template.userId },
			data: {
				political_embedding: {
					embedding: message.embedding,
					sentiment: JSON.parse(JSON.stringify(message.sentiment)),
					last_updated: new Date(),
					version: 'v1_mock_bert'
				},
				embedding_version: 'v1_mock_bert',
				coordinates_updated_at: new Date(),
				// Update coordinates if they're not already set
				latitude: message.geographic_coords.latitude,
				longitude: message.geographic_coords.longitude
			}
		});
	}
}

/**
 * Main processing pipeline: Text → Sentiment Classification → Storage
 */
export async function runSentimentClassificationPipeline(): Promise<{
	processed: number;
	results: MessageEmbedding[];
}> {
	// Step 1: Process recent template messages
	const messages = await processTemplateMessages();

	// Step 2: Store political embeddings
	await storePoliticalEmbeddings(messages);

	// Step 3: Return results for further processing
	return {
		processed: messages.length,
		results: messages
	};
}
