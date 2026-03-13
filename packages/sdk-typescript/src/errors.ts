export class CommonsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'CommonsError';
    this.code = code;
    this.status = status;
  }
}

export class AuthenticationError extends CommonsError {
  constructor(code: string, message: string) {
    super(code, message, 401);
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends CommonsError {
  constructor(code: string, message: string) {
    super(code, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends CommonsError {
  constructor(code: string, message: string) {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends CommonsError {
  constructor(code: string, message: string) {
    super(code, message, 429);
    this.name = 'RateLimitError';
  }
}
