/**
 * MongoDB Client - Public API
 *
 * Re-exports from the warmup module for backward compatibility.
 * All connection logic lives in mongodb/warm.ts.
 *
 * Usage:
 *   import { getMongoClient, getDatabase } from '$lib/server/mongodb';
 *   const db = await getDatabase();
 */

export {
	getClient as getMongoClient,
	getDb as getDatabase,
	close as closeMongoClient,
	isReady as isMongoReady,
	getStatus as getMongoStatus,
	startWarmup as startMongoWarmup
} from './mongodb/warm';

/**
 * Test MongoDB connection
 */
export async function testMongoConnection(): Promise<boolean> {
	try {
		const { getClient } = await import('./mongodb/warm');
		const client = await getClient();
		const result = await client.db('admin').command({ ping: 1 });
		return result.ok === 1;
	} catch (error) {
		console.error('[MongoDB] Connection test failed:', error);
		return false;
	}
}
