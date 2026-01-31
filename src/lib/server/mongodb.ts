/**
 * MongoDB Client Singleton
 *
 * Provides a connection-pooled MongoDB client that handles:
 * - Development mode (HMR-safe with global caching)
 * - Production mode (standard singleton)
 * - Graceful connection management
 * - Type-safe database access
 */

import { MongoClient, Db } from 'mongodb';
import { DATABASE_NAME } from './mongodb/schema';

// Connection string from MongoDB Atlas
const MONGODB_URI =
	process.env.MONGODB_URI ||
	'mongodb+srv://communique:***REMOVED***@cluster0.udtiui.mongodb.net/?appName=Cluster0';

// Connection options for optimal performance
const MONGODB_OPTIONS = {
	maxPoolSize: 10,
	minPoolSize: 2,
	maxIdleTimeMS: 30000,
	serverSelectionTimeoutMS: 5000,
	socketTimeoutMS: 45000
};

// Global cache for development HMR safety
// In dev, Vite may reload modules but we want to preserve the MongoDB connection
declare global {
	// eslint-disable-next-line no-var
	var __mongoClient: MongoClient | undefined;
	// eslint-disable-next-line no-var
	var __mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

/**
 * Initialize MongoDB client with singleton pattern
 * Handles both development (with HMR) and production environments
 */
function initializeMongoClient(): Promise<MongoClient> {
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (isDevelopment) {
		// In development, use a global variable to preserve the client across HMR
		if (!global.__mongoClientPromise) {
			console.log('[MongoDB] Creating new development client connection');
			const client = new MongoClient(MONGODB_URI, MONGODB_OPTIONS);
			global.__mongoClientPromise = client.connect();
		} else {
			console.log('[MongoDB] Reusing existing development client connection');
		}
		return global.__mongoClientPromise;
	} else {
		// In production, create a new connection if one doesn't exist
		if (!clientPromise) {
			console.log('[MongoDB] Creating new production client connection');
			const client = new MongoClient(MONGODB_URI, MONGODB_OPTIONS);
			clientPromise = client.connect();
		}
		return clientPromise;
	}
}

// Lazy initialization - don't connect until first use
// This prevents crashes in environments where MongoDB isn't available (e.g., Cloudflare Workers)
let isInitialized = false;

function ensureClientInitialized(): void {
	if (!isInitialized) {
		try {
			clientPromise = initializeMongoClient();
			isInitialized = true;
		} catch (error) {
			console.error('[MongoDB] Failed to initialize client:', error);
			throw error;
		}
	}
}

/**
 * Get the MongoDB client instance
 * Returns a promise that resolves to the connected MongoClient
 *
 * @returns Promise<MongoClient>
 *
 * @example
 * const client = await getMongoClient();
 * const db = client.db('communique');
 */
export async function getMongoClient(): Promise<MongoClient> {
	try {
		ensureClientInitialized();
		const client = await clientPromise;

		// Verify connection is alive
		await client.db('admin').command({ ping: 1 });

		return client;
	} catch (error) {
		console.error('[MongoDB] Connection error:', error);
		throw new Error(
			`Failed to connect to MongoDB: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Get the Communique database instance
 * Convenience wrapper around getMongoClient().db()
 *
 * @returns Promise<Db>
 *
 * @example
 * const db = await getDatabase();
 * const orgs = db.collection('organizations');
 */
export async function getDatabase(): Promise<Db> {
	const client = await getMongoClient();
	return client.db(DATABASE_NAME);
}

/**
 * Gracefully close the MongoDB connection
 * Should be called on server shutdown
 */
export async function closeMongoClient(): Promise<void> {
	try {
		const client = await clientPromise;
		await client.close();
		console.log('[MongoDB] Connection closed');
	} catch (error) {
		console.error('[MongoDB] Error closing connection:', error);
	}
}

/**
 * Test the MongoDB connection
 * Useful for health checks and startup validation
 *
 * @returns Promise<boolean> true if connection is successful
 */
export async function testMongoConnection(): Promise<boolean> {
	try {
		const client = await getMongoClient();
		const result = await client.db('admin').command({ ping: 1 });
		const isConnected = result.ok === 1;

		if (isConnected) {
			console.log('[MongoDB] Connection test successful');
		} else {
			console.error('[MongoDB] Connection test failed - ping returned not ok');
		}

		return isConnected;
	} catch (error) {
		console.error('[MongoDB] Connection test failed:', error);
		return false;
	}
}

// Connection logging moved to getMongoClient() for lazy initialization
