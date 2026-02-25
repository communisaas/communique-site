/** Shim for $env/static/private — proxies to process.env for standalone scripts. */
const handler: ProxyHandler<Record<string, string>> = {
	get(_target, prop: string) {
		return process.env[prop] ?? '';
	}
};
const env = new Proxy({} as Record<string, string>, handler);
export default env;
// Also re-export common keys so named imports work
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
export const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
export const DATABASE_URL = process.env.DATABASE_URL ?? '';
