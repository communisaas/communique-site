/** Shim for $env/dynamic/private — proxies to process.env for standalone scripts. */
export const env: Record<string, string | undefined> = new Proxy(
	{} as Record<string, string | undefined>,
	{
		get(_target, prop: string) {
			return process.env[prop];
		}
	}
);
