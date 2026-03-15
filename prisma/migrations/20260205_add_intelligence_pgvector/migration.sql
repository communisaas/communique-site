-- Intelligence table pgvector indexes and hybrid search function
-- Requires: CREATE EXTENSION vector (done in docker/init-db.sql)

-- HNSW index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS intelligence_embedding_hnsw
  ON intelligence USING hnsw (embedding vector_cosine_ops);

-- Generated tsvector column for full-text search
ALTER TABLE intelligence
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(snippet, ''))) STORED;

-- GIN index on tsvector for fast full-text search
CREATE INDEX IF NOT EXISTS intelligence_fts_gin ON intelligence USING gin(fts);

-- GIN index on topics array for @> and && operators
CREATE INDEX IF NOT EXISTS intelligence_topics_gin ON intelligence USING gin(topics);

-- Hybrid search function combining vector similarity + full-text search via RRF
CREATE OR REPLACE FUNCTION hybrid_search_intelligence(
  query_text text,
  query_embedding vector(1024),
  match_count int DEFAULT 10,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 50,
  filter_categories text[] DEFAULT NULL,
  filter_topics text[] DEFAULT NULL,
  filter_min_relevance float DEFAULT NULL,
  filter_published_after timestamptz DEFAULT NULL,
  filter_published_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id text,
  category text,
  title text,
  source text,
  source_url text,
  published_at timestamptz,
  snippet text,
  topics text[],
  entities text[],
  relevance_score float,
  sentiment text,
  geographic_scope text,
  created_at timestamptz,
  expires_at timestamptz,
  score float
)
LANGUAGE sql STABLE
AS $$
WITH full_text AS (
  SELECT
    i.id,
    ROW_NUMBER() OVER (ORDER BY ts_rank_cd(i.fts, websearch_to_tsquery(query_text)) DESC) AS rank_ix
  FROM intelligence i
  WHERE i.fts @@ websearch_to_tsquery(query_text)
    AND (filter_categories IS NULL OR i.category = ANY(filter_categories))
    AND (filter_topics IS NULL OR i.topics && filter_topics)
    AND (filter_min_relevance IS NULL OR i.relevance_score >= filter_min_relevance)
    AND (filter_published_after IS NULL OR i.published_at >= filter_published_after)
    AND (filter_published_before IS NULL OR i.published_at <= filter_published_before)
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
),
semantic AS (
  SELECT
    i.id,
    ROW_NUMBER() OVER (ORDER BY i.embedding <=> query_embedding) AS rank_ix
  FROM intelligence i
  WHERE i.embedding IS NOT NULL
    AND (filter_categories IS NULL OR i.category = ANY(filter_categories))
    AND (filter_topics IS NULL OR i.topics && filter_topics)
    AND (filter_min_relevance IS NULL OR i.relevance_score >= filter_min_relevance)
    AND (filter_published_after IS NULL OR i.published_at >= filter_published_after)
    AND (filter_published_before IS NULL OR i.published_at <= filter_published_before)
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
)
SELECT
  i.id, i.category, i.title, i.source, i.source_url, i.published_at,
  i.snippet, i.topics, i.entities, i.relevance_score, i.sentiment,
  i.geographic_scope, i.created_at, i.expires_at,
  (
    coalesce(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
    coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
  )::float AS score
FROM full_text
  FULL OUTER JOIN semantic ON full_text.id = semantic.id
  JOIN intelligence i ON coalesce(full_text.id, semantic.id) = i.id
ORDER BY score DESC
LIMIT least(match_count, 30);
$$;
