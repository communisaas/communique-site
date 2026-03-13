import type { ApiEnvelope, ApiErrorBody, PaginationMeta } from './types.js';
import {
  CommonsError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError
} from './errors.js';

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export class HttpClient {
  private readonly _apiKey: string;
  private readonly _baseUrl: string;

  constructor(options: ClientOptions) {
    this._apiKey = options.apiKey;
    this._baseUrl = (options.baseUrl ?? 'https://commons.so/api/v1').replace(/\/+$/, '');
  }

  async request<T>(method: string, path: string, options?: RequestOptions): Promise<{ data: T; meta?: PaginationMeta }> {
    const url = new URL(`${this._baseUrl}${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this._apiKey}`,
      'Content-Type': 'application/json'
    };

    const init: RequestInit = { method, headers };
    if (options?.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), init);

    if (!response.ok) {
      let errorBody: ApiErrorBody | undefined;
      try {
        errorBody = await response.json() as ApiErrorBody;
      } catch {
        // Response wasn't JSON
      }

      const code = errorBody?.error?.code ?? 'UNKNOWN';
      const message = errorBody?.error?.message ?? `HTTP ${response.status}`;

      switch (response.status) {
        case 401:
          throw new AuthenticationError(code, message);
        case 403:
          throw new ForbiddenError(code, message);
        case 404:
          throw new NotFoundError(code, message);
        case 429:
          throw new RateLimitError(code, message);
        default:
          throw new CommonsError(code, message, response.status);
      }
    }

    const envelope = await response.json() as ApiEnvelope<T>;
    return { data: envelope.data, meta: envelope.meta };
  }
}
