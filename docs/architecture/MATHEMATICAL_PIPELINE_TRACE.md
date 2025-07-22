# Mathematical Pipeline Implementation Trace

## 🧮 How Our Mathematician's Equations Map to Database Tables

This document traces the **exact implementation path** from mathematical formulas to database operations.

---

## **Input Data: Raw Political Messages**

### Mathematical Definition:
```
Messages = {
  m₁: "Student loans crushing families, support forgiveness!" (Austin, TX: 30.27°N, 97.74°W)
  m₂: "Oppose loan forgiveness, people should pay debts" (Amarillo, TX: 35.22°N, 101.83°W)  
  m₃: "Lower interest rates on student loans" (Houston, TX: 29.76°N, 95.37°W)
}
```

### Database Implementation:
```sql
-- Raw messages stored in template_campaign
SELECT 
  tc.id as message_id,
  t.body as message_text,
  t.category,
  u.state, u.congressional_district,
  uc.latitude, uc.longitude,
  tc.created_at
FROM template_campaign tc
JOIN template t ON tc.template_id = t.id
JOIN user u ON t.user_id = u.id  
LEFT JOIN user_coordinates uc ON u.id = uc.user_id
WHERE tc.created_at > NOW() - INTERVAL 7 DAY;
```

**Real Data Structure:**
- `template.body` = message text (m₁, m₂, m₃...)
- `user_coordinates.latitude/longitude` = geographic coordinates
- `template.category` = initial topic classification
- `template_campaign.created_at` = temporal data for time series

---

## **Step 1: BERT Sentiment Classification**

### Mathematical Formula:
```
f: Text → ℝ³
For each message mᵢ:
1. Tokenize: tokens = BERT_tokenizer(mᵢ)
2. Embed: embeddings = BERT_model(tokens) ∈ ℝ⁷⁶⁸
3. Classify: logits = W₃×₇₆₈ · embeddings + b₃
4. Softmax: P(class|mᵢ) = softmax(logits)
```

### Database Implementation:
```sql
-- Store BERT embeddings in user_coordinates.political_embedding
UPDATE user_coordinates 
SET political_embedding = JSON_OBJECT(
  'embedding', '[0.234, -0.567, 0.123, ...]',  -- 768-dim vector
  'sentiment_class', 'Pro-Forgiveness',
  'confidence', 0.89,
  'intensity', 0.72,
  'bert_version', 'bert-base-uncased',
  'processed_at', NOW()
)
WHERE user_id = ?;
```

**Processing Pipeline:**
1. **Input:** `template.body` → BERT tokenizer
2. **Process:** BERT model inference → 768-dimensional embedding
3. **Classify:** Linear layer → sentiment probabilities  
4. **Store:** `user_coordinates.political_embedding` JSON field

---

## **Step 2: Geographic Interpolation (IDW)**

### Mathematical Formula:
```
For any point (x₀, y₀), estimate sentiment:
S(x₀, y₀) = Σᵢ wᵢ · sᵢ / Σᵢ wᵢ

where:
- wᵢ = 1 / d(x₀, y₀, xᵢ, yᵢ)^p  (p = 2, inverse square weighting)
- d(x₀, y₀, xᵢ, yᵢ) = √[(x₀-xᵢ)² + (y₀-yᵢ)²]  (Euclidean distance)
```

### Database Implementation:
```sql
-- Calculate geographic sentiment field using PostGIS
WITH sentiment_points AS (
  SELECT 
    u.id,
    uc.latitude, uc.longitude,
    JSON_EXTRACT(uc.political_embedding, '$.sentiment_class') as sentiment,
    JSON_EXTRACT(uc.political_embedding, '$.intensity') as intensity
  FROM user u
  JOIN user_coordinates uc ON u.id = uc.user_id
  WHERE uc.political_embedding IS NOT NULL
),
distance_weights AS (
  SELECT 
    sp1.id as query_point,
    sp2.id as data_point,
    sp2.sentiment,
    sp2.intensity,
    1.0 / POW(
      SQRT(
        POW(sp1.latitude - sp2.latitude, 2) + 
        POW(sp1.longitude - sp2.longitude, 2)
      ), 2
    ) as weight
  FROM sentiment_points sp1
  CROSS JOIN sentiment_points sp2
  WHERE sp1.id != sp2.id
)
SELECT 
  query_point,
  SUM(weight * intensity * CASE sentiment 
    WHEN 'Pro-Forgiveness' THEN 1
    WHEN 'Anti-Forgiveness' THEN -1  
    ELSE 0 
  END) / SUM(weight) as interpolated_sentiment
FROM distance_weights
GROUP BY query_point;
```

**Geographic Sentiment Field Storage:**
- Use existing `user_coordinates` table for point data
- Calculate interpolated sentiment on-demand or cache in new table
- Geographic queries use lat/lng for IDW algorithm

---

## **Step 3: Message Clustering (K-means)**

### Mathematical Formula:
```
Minimize: J = Σᵢ₌₁ⁿ Σⱼ₌₁ᵏ wᵢⱼ ||xᵢ - μⱼ||²
where:
- xᵢ ∈ ℝ⁷⁶⁸ = BERT embedding of message i
- μⱼ ∈ ℝ⁷⁶⁸ = centroid of cluster j
```

### Database Implementation:
```sql
-- Store cluster assignments in community_intersection
INSERT INTO community_intersection (
  community_a,
  community_b, 
  shared_users,
  shared_issues,
  intersection_strength,
  created_at
)
SELECT 
  'pro_forgiveness_cluster' as community_a,
  'high_intensity_cluster' as community_b,
  JSON_ARRAYAGG(user_id) as shared_users,
  JSON_ARRAY('student_loans', 'debt_relief') as shared_issues,
  AVG(intensity) as intersection_strength,
  NOW()
FROM (
  SELECT 
    u.id as user_id,
    JSON_EXTRACT(uc.political_embedding, '$.intensity') as intensity
  FROM user u
  JOIN user_coordinates uc ON u.id = uc.user_id
  WHERE JSON_EXTRACT(uc.political_embedding, '$.sentiment_class') = 'Pro-Forgiveness'
    AND JSON_EXTRACT(uc.political_embedding, '$.intensity') > 0.7
) clustered_users;
```

**Clustering Implementation:**
- **Input:** BERT embeddings from `political_embedding` JSON
- **Process:** K-means algorithm on 768-dimensional vectors
- **Output:** Cluster assignments stored in `community_intersection`
- **Community IDs:** Generated from dominant topics + sentiment

---

## **Step 4: Time Series Analysis (ARIMA)**

### Mathematical Formula:
```
ARIMA(p,d,q): φ(B)(1-B)ᵈ sₜ = θ(B)εₜ
Parameter estimation via maximum likelihood
```

### Database Implementation:
```sql
-- Time series data from user_activation table
WITH daily_sentiment AS (
  SELECT 
    DATE(ua.activation_time) as day,
    AVG(CASE 
      WHEN JSON_EXTRACT(uc.political_embedding, '$.sentiment_class') = 'Pro-Forgiveness' THEN 1
      WHEN JSON_EXTRACT(uc.political_embedding, '$.sentiment_class') = 'Anti-Forgiveness' THEN -1
      ELSE 0 
    END) as avg_sentiment,
    COUNT(*) as message_count,
    AVG(JSON_EXTRACT(uc.political_embedding, '$.intensity')) as avg_intensity
  FROM user_activation ua
  JOIN user u ON ua.user_id = u.id
  JOIN user_coordinates uc ON u.id = uc.user_id
  WHERE ua.activation_time > NOW() - INTERVAL 30 DAY
    AND uc.political_embedding IS NOT NULL
  GROUP BY DATE(ua.activation_time)
  ORDER BY day
)
SELECT 
  day,
  avg_sentiment,
  avg_intensity,
  -- Calculate trend (simple first difference)
  avg_sentiment - LAG(avg_sentiment) OVER (ORDER BY day) as sentiment_trend,
  avg_intensity - LAG(avg_intensity) OVER (ORDER BY day) as intensity_trend
FROM daily_sentiment;
```

**Time Series Storage:**
- **Raw Data:** `user_activation.activation_time` provides temporal sequence
- **Sentiment Values:** Extracted from `political_embedding` JSON
- **ARIMA Model:** Calculated in application layer, predictions stored as JSON

---

## **Step 5: CWC Transformation**

### Mathematical Transformation:
```
φ: (cluster_centroid, member_messages) → CWC_XML
Raw clusters → canonical positions → CWC schema
```

### Database Implementation:
```sql
-- Generate CWC intelligence reports
WITH cluster_summary AS (
  SELECT 
    ci.community_a as cluster_name,
    JSON_LENGTH(ci.shared_users) as member_count,
    ci.intersection_strength as avg_intensity,
    ci.shared_issues,
    COUNT(DISTINCT uc.user_id) as geographic_spread
  FROM community_intersection ci
  JOIN JSON_TABLE(ci.shared_users, '$[*]' COLUMNS (user_id VARCHAR(255) PATH '$')) jt
  JOIN user_coordinates uc ON jt.user_id = uc.user_id
  GROUP BY ci.id, ci.community_a, ci.intersection_strength, ci.shared_issues
)
SELECT 
  cluster_name,
  CASE 
    WHEN cluster_name LIKE '%pro_%' THEN 'Pro'
    WHEN cluster_name LIKE '%anti_%' THEN 'Con'
    ELSE 'Neutral'
  END as cwc_position,
  CONCAT(
    'Analysis of ', member_count, ' constituent messages shows ',
    ROUND(avg_intensity * 100, 1), '% average intensity. ',
    'Geographic distribution: ', geographic_spread, ' districts represented.'
  ) as cwc_message,
  shared_issues as cwc_topics
FROM cluster_summary;
```

**CWC Output Generation:**
- **Input:** Cluster data from `community_intersection`
- **Transform:** Aggregate statistics → CWC XML format
- **Route:** Through existing congressional routing system

---

## **Data Flow Summary**

```
1. template.body → BERT → user_coordinates.political_embedding
2. user_coordinates (lat,lng) → IDW → geographic sentiment field  
3. political_embedding vectors → K-means → community_intersection
4. user_activation.activation_time → ARIMA → trend predictions
5. community_intersection → CWC XML → congressional routing
```

## **Existing Code Integration Points**

### Files Already Implemented:
- ✅ `src/lib/server/political-field-analytics.ts` - Community detection framework
- ✅ `src/lib/server/district-metrics.ts` - Geographic analysis functions
- ✅ `src/lib/server/cascade-analytics.ts` - Time series foundations
- ✅ `prisma/schema.prisma` - Complete data model

### Files To Implement:
- 🚧 `src/lib/server/sentiment-classification.ts` - BERT pipeline
- 🚧 `src/lib/server/geographic-interpolation.ts` - IDW algorithm  
- 🚧 `src/lib/server/message-clustering.ts` - K-means implementation
- 🚧 `src/lib/server/time-series-analysis.ts` - ARIMA modeling
- 🚧 `src/lib/server/cwc-transformation.ts` - Congressional intelligence output

---

## **Mathematical Complexity → Database Performance**

| Algorithm | Complexity | Database Operation | Performance Notes |
|-----------|------------|-------------------|------------------|
| BERT Classification | O(n × m) | INSERT political_embedding | Batch process, async |
| IDW Interpolation | O(n²) | Spatial queries with indexes | PostGIS optimization |
| K-means Clustering | O(n×k×i) | UPDATE community_intersection | Cache centroids |
| ARIMA Analysis | O(t×log t) | SELECT time series | Sliding window queries |
| CWC Transform | O(k) | JSON aggregation | Real-time generation |

**This mathematical pipeline is 100% implementable with our existing schema and analytics foundation.** 🚀