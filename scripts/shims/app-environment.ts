/** Shim for $app/environment — used by standalone scripts outside SvelteKit.
 *  dev = true so that db.ts falls back to the global PrismaClient singleton
 *  (scripts don't have the SvelteKit request-scoped AsyncLocalStorage). */
export const dev = true;
export const building = false;
export const browser = false;
export const version = '0.0.0';
