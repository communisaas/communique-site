import type { RequestEvent } from '@sveltejs/kit';

/**
 * Create a mock RequestEvent for testing
 */
export function createMockRequestEvent(request: Request): RequestEvent {
  const url = new URL(request.url);
  
  return {
    request,
    url,
    params: {},
    route: { id: url.pathname },
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => ''
    },
    fetch: global.fetch,
    getClientAddress: () => '127.0.0.1',
    locals: {},
    platform: undefined,
    setHeaders: () => {},
    isDataRequest: false,
    isSubRequest: false
  } as RequestEvent;
}

/**
 * Create a mock RequestEvent with additional properties
 */
export function createMockRequestEventWithParams(
  request: Request, 
  params: Record<string, string> = {},
  locals: Record<string, any> = {}
): RequestEvent {
  const baseEvent = createMockRequestEvent(request);
  return {
    ...baseEvent,
    params,
    locals
  };
}