import type { TEEManager } from './manager';
import type { TEEResponse } from './provider';

/**
 * Client-side Load Balancer for TEE Instances
 * 
 * Implements:
 * - Round-robin selection
 * - Automatic retries on failure
 * - Health check integration
 */
export class TEELoadBalancer {
    private manager: TEEManager;
    private currentInstanceIndex = 0;
    private maxRetries = 3;

    constructor(manager: TEEManager) {
        this.manager = manager;
    }

    /**
     * Submit message to TEE with load balancing and retries
     */
    async submitMessage(data: {
        userId: string;
        templateId: string;
        recipient: {
            name: string;
            office: 'senate' | 'house';
            state: string;
            district?: string;
        };
        message: string;
    }): Promise<TEEResponse> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Get healthy instances
                const instances = await this.manager.getHealthyInstances();

                if (instances.length === 0) {
                    throw new Error('No healthy TEE instances available');
                }

                // Round-robin selection
                const instance = instances[this.currentInstanceIndex % instances.length];
                this.currentInstanceIndex++; // Increment for next call

                console.log(`Load Balancer: Selected TEE instance ${instance.id} (Attempt ${attempt}/${this.maxRetries})`);

                // Submit message
                return await this.manager.encryptAndSubmit(instance.id, data);
            } catch (error) {
                console.warn(`Load Balancer: Submission failed (Attempt ${attempt}/${this.maxRetries})`, error);
                lastError = error instanceof Error ? error : new Error(String(error));

                // Wait before retry (exponential backoff)
                if (attempt < this.maxRetries) {
                    const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new Error(`Failed to submit message after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
    }
}
