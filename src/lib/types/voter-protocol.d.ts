/**
 * Type stub for @voter-protocol/ai-evaluator
 *
 * This optional peer dependency lives in the voter-protocol monorepo.
 * The module is dynamically imported at runtime; this declaration
 * satisfies the TypeScript compiler when the package is not installed.
 */
declare module '@voter-protocol/ai-evaluator' {
	export function loadModelConfigs(): Array<{
		provider: number;
		modelName: string;
		apiKey: string;
		signerPrivateKey: string;
	}>;
	export function evaluateDebate(params: unknown): Promise<unknown>;
}
