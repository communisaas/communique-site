import type { PaginationMeta } from './types.js';

export type PageFetcher<T> = (cursor: string | null) => Promise<{ data: T[]; meta: PaginationMeta }>;

export class CursorPage<T> implements AsyncIterable<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;

  private readonly _fetchPage: PageFetcher<T>;

  constructor(data: T[], meta: PaginationMeta, fetchPage: PageFetcher<T>) {
    this.data = data;
    this.meta = meta;
    this._fetchPage = fetchPage;
  }

  get hasMore(): boolean {
    return this.meta.hasMore;
  }

  async nextPage(): Promise<CursorPage<T> | null> {
    if (!this.meta.hasMore || !this.meta.cursor) return null;
    const { data, meta } = await this._fetchPage(this.meta.cursor);
    return new CursorPage(data, meta, this._fetchPage);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    // Yield items from current page
    for (const item of this.data) {
      yield item;
    }

    // Fetch subsequent pages
    let nextCursor = this.meta.hasMore ? this.meta.cursor : null;
    while (nextCursor) {
      const { data, meta } = await this._fetchPage(nextCursor);
      for (const item of data) {
        yield item;
      }
      nextCursor = meta.hasMore ? meta.cursor : null;
    }
  }
}
