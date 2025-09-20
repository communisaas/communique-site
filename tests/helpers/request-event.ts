import type { RequestEvent } from '@sveltejs/kit';

/**
 * Create a mock RequestEvent for testing
 * Note: Returns properly typed RequestEvent with all required properties
 */
export function createMockRequestEvent<
  Params extends Record<string, string> = Record<string, string>
>(
  request: Request | any,
  routeId: string = '/'
): RequestEvent<Params, any> {
  const url = request.url ? new URL(request.url) : new URL('http://localhost:3000');
  
  // Mock span for tracing
  const mockSpan = {
    setAttribute: () => {},
    setAttributes: () => {},
    addEvent: () => {},
    setStatus: () => {},
    updateName: () => {},
    end: () => {},
    isRecording: () => false,
    recordException: () => {}
  };
  
  return {
    request: request as Request,
    url,
    params: {} as Params,
    route: { id: routeId as any },
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => ''
    } as any,
    fetch: global.fetch,
    getClientAddress: () => '127.0.0.1',
    locals: {
      user: null,
      session: null
    } as App.Locals,
    platform: undefined,
    setHeaders: () => {},
    isDataRequest: false,
    isSubRequest: false,
    tracing: {
      enabled: false,
      root: mockSpan as any,
      current: mockSpan as any
    },
    isRemoteRequest: false
  } as RequestEvent<Params, any>;
}

/**
 * Create a mock RequestEvent with additional properties
 * Note: Returns properly typed RequestEvent with all required properties
 */
export function createMockRequestEventWithParams<
  Params extends Record<string, string> = Record<string, string>
>(
  request: Request, 
  params: Params = {} as Params,
  locals: Partial<App.Locals> = {},
  routeId: string = '/'
): RequestEvent<Params, any> {
  const baseEvent = createMockRequestEvent<Params>(request, routeId);
  return {
    ...baseEvent,
    params,
    locals: {
      user: null,
      session: null,
      ...locals
    } as App.Locals
  };
}