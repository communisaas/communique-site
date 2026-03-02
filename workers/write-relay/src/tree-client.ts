/**
 * Tree Service Client — HTTP calls to Shadow Atlas sidecar
 *
 * The relay owns mutable state (D1). The sidecar owns Merkle tree computation:
 * Poseidon2 hashing, proof generation, receipt signing.
 *
 * All calls have 10s timeout and Bearer auth.
 */

export interface TreeProof {
	userRoot: string;
	userPath: string[];
	pathIndices: number[];
	receipt?: { data: string; sig: string };
}

export interface TreeInfo {
	root: string;
	size: number;
	depth: number;
}

export interface EngagementProof {
	engagementRoot: string;
	engagementPath: string[];
	pathIndices: number[];
}

export interface EngagementInfo {
	root: string;
	size: number;
	depth: number;
}

export class TreeServiceClient {
	constructor(
		private baseUrl: string,
		private authToken: string,
	) {}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const headers: Record<string, string> = {
			'Accept': 'application/json',
			'X-Client-Version': 'write-relay-v1',
		};
		if (this.authToken) {
			headers['Authorization'] = `Bearer ${this.authToken}`;
		}
		if (body) {
			headers['Content-Type'] = 'application/json';
		}

		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
			const msg = (err as { error?: { message?: string } }).error?.message ?? response.statusText;
			throw new Error(`Sidecar ${method} ${path} failed [${response.status}]: ${msg}`);
		}

		const result = await response.json() as { success?: boolean; data?: T };
		if (result.data !== undefined) return result.data;
		return result as T;
	}

	// -- Registration (Tree 1) --

	async getRegistrationProof(leafIndex: number): Promise<TreeProof> {
		return this.request<TreeProof>('GET', `/v1/leaf/${leafIndex}/proof`);
	}

	async getTreeInfo(): Promise<TreeInfo> {
		return this.request<TreeInfo>('GET', '/v1/tree/info');
	}

	async notifyInsertion(leaf: string, index: number): Promise<TreeProof> {
		return this.request<TreeProof>('POST', '/v1/tree/insert', { leaf, index });
	}

	async notifyReplacement(newLeaf: string, oldIndex: number, newIndex: number): Promise<TreeProof> {
		return this.request<TreeProof>('POST', '/v1/tree/replace', { newLeaf, oldIndex, newIndex });
	}

	// -- Engagement (Tree 3) --

	async getEngagementProof(leafIndex: number): Promise<EngagementProof> {
		return this.request<EngagementProof>('GET', `/v1/engagement-path/${leafIndex}`);
	}

	async getEngagementInfo(): Promise<EngagementInfo> {
		return this.request<EngagementInfo>('GET', '/v1/engagement/info');
	}

	async notifyEngagementRegistration(
		identityCommitment: string,
		signerAddress: string,
		leafIndex: number,
	): Promise<{ engagementRoot: string }> {
		return this.request<{ engagementRoot: string }>('POST', '/v1/engagement/register', {
			identityCommitment,
			signerAddress,
			leafIndex,
		});
	}

	// -- Community Field --

	async verifyContributionProof(
		proof: string,
		publicInputs: string[],
		epochDate: string,
	): Promise<{ cellSetRoot: string }> {
		return this.request<{ cellSetRoot: string }>('POST', '/v1/community-field/verify', {
			proof,
			publicInputs,
			epochDate,
		});
	}
}
