/**
 * Trade Preimage Store — IndexedDB-backed persistence for commit-reveal preimages.
 *
 * In the commit-reveal trading scheme, the user submits a commitment hash during the
 * commit phase and must later reveal the preimage during the reveal phase. If the
 * preimage is lost, the trade is forfeit — the commitment cannot be opened.
 *
 * This module provides durable storage for commit preimages across browser sessions
 * using IndexedDB. The store is keyed by (debateId, epoch) which uniquely identifies
 * a commitment.
 *
 * SECURITY: Preimages are stored in plaintext in IndexedDB. The data is not sensitive
 * in an adversarial sense — the preimage reveals a trading intention that was already
 * cryptographically committed on-chain. The nonce prevents anyone without the preimage
 * from opening the commitment.
 *
 * BROWSER ONLY: This module uses IndexedDB and must not be imported from server code.
 *
 * @see DebateMarket.sol — commitTrade() and revealTrade()
 * @see debate-client.ts — clientCommitTrade() and clientRevealTrade()
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Direction of a trade: BUY increases price, SELL decreases it. */
export type TradeDirection = 0 | 1; // 0 = BUY, 1 = SELL

/** The preimage data needed to reveal a committed trade. */
export interface TradePreimage {
    /** Debate identifier (bytes32, 0x-prefixed). */
    debateId: string;

    /** Epoch number the commitment was made in. */
    epoch: number;

    /** Index of the commitment within the epoch's commitment array. */
    commitIndex: number;

    /** Index of the argument being traded on. */
    argumentIndex: number;

    /** Trade direction: 0=BUY, 1=SELL. */
    direction: TradeDirection;

    /** Weighted amount (from debate-weight ZK proof). Stored as decimal string. */
    weightedAmount: string;

    /** Note commitment (from debate-weight ZK proof). bytes32, 0x-prefixed. */
    noteCommitment: string;

    /** Random nonce used in the commitment hash. bytes32, 0x-prefixed. */
    nonce: string;

    /** The commitment hash submitted on-chain. bytes32, 0x-prefixed. */
    commitHash: string;

    /** Transaction hash of the commit transaction. */
    commitTxHash: string;

    /** ISO timestamp when the preimage was stored. */
    storedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// INDEXEDDB HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME = 'communique-trade-preimages';
const DB_VERSION = 1;
const STORE_NAME = 'preimages';

/**
 * Open (or create) the IndexedDB database.
 *
 * Uses a compound key of [debateId, epoch] so that each debate+epoch pair
 * stores exactly one preimage. If the user commits multiple times in the same
 * epoch (shouldn't happen — contract prevents it), the latest overwrites.
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: ['debateId', 'epoch'] });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store a trade preimage after a successful commit transaction.
 *
 * Must be called immediately after the commitTrade transaction is confirmed
 * on-chain. The preimage is needed to reveal the trade in the next epoch's
 * reveal phase. If not stored, the trade is permanently forfeit.
 *
 * @param preimage - The full preimage data including nonce, amounts, and tx hash
 */
export async function storePreimage(preimage: TradePreimage): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(preimage);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

/**
 * Retrieve a stored preimage for a specific debate and epoch.
 *
 * Returns `null` if no preimage exists (either never stored, or already cleared).
 *
 * @param debateId - Debate identifier (bytes32)
 * @param epoch - Epoch number
 * @returns The stored preimage, or null
 */
export async function getPreimage(
    debateId: string,
    epoch: number
): Promise<TradePreimage | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get([debateId, epoch]);
        request.onsuccess = () => {
            db.close();
            resolve(request.result ?? null);
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

/**
 * Clear a preimage after successful reveal.
 *
 * Should be called after the revealTrade transaction is confirmed on-chain.
 * Prevents stale preimages from accumulating in IndexedDB.
 *
 * @param debateId - Debate identifier (bytes32)
 * @param epoch - Epoch number
 */
export async function clearPreimage(
    debateId: string,
    epoch: number
): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete([debateId, epoch]);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

/**
 * Get all pending (unrevealed) preimages for a specific debate.
 *
 * Used to display pending commitments in the UI and alert the user
 * that they need to reveal during the next reveal phase.
 *
 * @param debateId - Debate identifier (bytes32)
 * @returns Array of preimages for this debate (may be empty)
 */
export async function getPendingPreimages(
    debateId: string
): Promise<TradePreimage[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            db.close();
            const all = (request.result ?? []) as TradePreimage[];
            resolve(all.filter((p) => p.debateId === debateId));
        };
        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}
