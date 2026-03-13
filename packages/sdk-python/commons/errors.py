"""Typed exceptions for Commons API errors."""

from __future__ import annotations


class CommonsError(Exception):
    """Base exception for all Commons API errors."""

    def __init__(self, code: str, message: str, status: int) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(f"[{status}] {code}: {message}")


class BadRequestError(CommonsError):
    """Raised on 400 responses."""

    def __init__(self, code: str = "BAD_REQUEST", message: str = "Bad request") -> None:
        super().__init__(code, message, 400)


class AuthenticationError(CommonsError):
    """Raised on 401 responses."""

    def __init__(self, code: str = "UNAUTHORIZED", message: str = "Unauthorized") -> None:
        super().__init__(code, message, 401)


class ForbiddenError(CommonsError):
    """Raised on 403 responses."""

    def __init__(self, code: str = "FORBIDDEN", message: str = "Forbidden") -> None:
        super().__init__(code, message, 403)


class NotFoundError(CommonsError):
    """Raised on 404 responses."""

    def __init__(self, code: str = "NOT_FOUND", message: str = "Not found") -> None:
        super().__init__(code, message, 404)


class ConflictError(CommonsError):
    """Raised on 409 responses."""

    def __init__(self, code: str = "CONFLICT", message: str = "Conflict") -> None:
        super().__init__(code, message, 409)


class RateLimitError(CommonsError):
    """Raised on 429 responses."""

    def __init__(self, code: str = "RATE_LIMITED", message: str = "Rate limit exceeded") -> None:
        super().__init__(code, message, 429)
