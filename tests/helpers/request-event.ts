import type { RequestEvent } from '@sveltejs/kit';

/**
 * Create a mock RequestEvent for testing
 */
export function createMockRequestEvent(
  request: Request | any,
  routeId: string = '/'
): any {
  const url = request.url ? new URL(request.url) : new URL('http://localhost:3000');
  
  return {
    request: request as Request,
    url,
    params: {},
    route: { id: routeId },
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => ''
    },
    fetch: global.fetch,
    getClientAddress: () => '127.0.0.1',
    locals: {
      user: null,
      session: null
    },
    platform: undefined,
    setHeaders: () => {},
    isDataRequest: false,
    isSubRequest: false
  };
}

/**
 * Create a mock RequestEvent with additional properties
 */
export function createMockRequestEventWithParams<Params extends Record<string, string> = Record<string, string>>(
  request: Request, 
  params: Params = {} as Params,
  locals: Partial<App.Locals> = {},
  routeId: string = '/'
): RequestEvent<Params> {
  const baseEvent = createMockRequestEvent<Params>(request, routeId);
  return {
    ...baseEvent,
    params,
    locals: {
      user: null,
      session: null,
      ...locals
    }
  };
}