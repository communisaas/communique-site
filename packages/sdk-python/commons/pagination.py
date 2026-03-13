"""Auto-paginating iterators for cursor-based pagination."""

from __future__ import annotations

from typing import Any, Callable, Dict, Generic, Iterator, List, Optional, TypeVar

from .types import PaginationMeta

T = TypeVar("T")


class CursorPage(Generic[T]):
    """A single page of results with auto-pagination support.

    Iterating over a ``CursorPage`` yields items from the current page, then
    automatically fetches subsequent pages until all results have been consumed.
    """

    def __init__(
        self,
        data: List[T],
        meta: PaginationMeta,
        fetch_next: Optional[Callable[[str], "CursorPage[T]"]] = None,
    ) -> None:
        self.data = data
        self.meta = meta
        self.has_more: bool = meta.get("hasMore", False)
        self._fetch_next = fetch_next

    def __iter__(self) -> Iterator[T]:
        page: Optional[CursorPage[T]] = self
        while page is not None:
            yield from page.data
            cursor = page.meta.get("cursor")
            if page.has_more and cursor and page._fetch_next:
                page = page._fetch_next(cursor)
            else:
                page = None

    def __len__(self) -> int:
        return len(self.data)

    @property
    def total(self) -> Optional[int]:
        return self.meta.get("total")


class AsyncCursorPage(Generic[T]):
    """Async variant of :class:`CursorPage`."""

    def __init__(
        self,
        data: List[T],
        meta: PaginationMeta,
        fetch_next: Optional[Any] = None,
    ) -> None:
        self.data = data
        self.meta = meta
        self.has_more: bool = meta.get("hasMore", False)
        self._fetch_next = fetch_next

    async def __aiter__(self):  # type: ignore[override]
        page: Optional[AsyncCursorPage[T]] = self
        while page is not None:
            for item in page.data:
                yield item
            cursor = page.meta.get("cursor")
            if page.has_more and cursor and page._fetch_next:
                page = await page._fetch_next(cursor)
            else:
                page = None

    def __len__(self) -> int:
        return len(self.data)

    @property
    def total(self) -> Optional[int]:
        return self.meta.get("total")
