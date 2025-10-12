# Analytics System

**Status**: ✅ IMPLEMENTED | Privacy-First Database Analytics

---

**Custom analytics infrastructure built on Supabase/Prisma. No third-party tracking. Civic engagement focused.**

## Architecture

Communique uses a database-first analytics system that replaces traditional analytics providers (Google Analytics, Mixpanel, etc.) with privacy-respecting, civically-focused tracking stored directly in our Supabase Postgres database.

```
User Action
    ↓
Event Tracking (browser)
    ↓
Event Queue (batched)
    ↓
Flush API (/api/analytics/track)
    ↓
Prisma Database
    ↓
Analytics Dashboard (/analytics)
```

## Core Components

### 1. Database Analytics (`src/lib/core/analytics/database.ts`)

Main analytics engine with session management and event tracking.

**Key Features**:
- **Session tracking**: Automatic session ID generation and management
- **UTM parameter extraction**: Campaign attribution (utm_source, utm_medium, utm_campaign)
- **Device fingerprinting**: User agent, viewport, referrer tracking
- **Event batching**: Queue events and flush every 10 seconds or when queue reaches 10 events
- **Unload handling**: Flush events on page unload and tab visibility change
- **Privacy-first**: No cookies, no external tracking, data stays in our database

**Session Data Structure**:
```typescript
interface SessionData {
  session_id: string;
  user_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing_page?: string;
  referrer?: string;
  device_data?: {
    fingerprint?: string;
    ip_address?: string;
    user_agent?: string;
  };
}
```

**Event Structure**:
```typescript
interface AnalyticsEvent {
  session_id: string;
  user_id?: string;
  name: string; // 'template_viewed', 'auth_completed', 'template_used'
  event_type?: 'funnel' | 'interaction' | 'navigation' | 'performance' | 'error';
  template_id?: string;
  funnel_step?: number;
  experiment_id?: string;
  properties?: Record<string, unknown>;
}
```

### 2. Funnel Analytics (`src/lib/core/analytics/funnel.ts`)

Tracks user progression through civic action conversion funnel.

**Funnel Steps**:
1. **Template Viewed** (`template_viewed`) - User lands on template page
2. **Auth Started** (`auth_started`) - User clicks auth button
3. **Auth Completed** (`auth_completed`) - OAuth succeeds
4. **Template Used** (`template_used`) - Message sent to representatives
5. **Template Shared** (`template_shared`) - User shares template via social

**Funnel Event Structure**:
```typescript
interface FunnelEvent {
  event: string;
  template_id?: string;
  user_id?: string;
  session_id?: string;
  source?: 'social-link' | 'direct-link' | 'share';
  platform?: 'twitter' | 'facebook' | 'linkedin' | 'other';
  timestamp: number;
  properties?: Record<string, unknown>;
}
```

**Persistence**:
- Events stored in localStorage for 24 hours
- Auto-restored on page reload
- Circular reference handling for complex objects
- Graceful degradation for private browsing mode

### 3. Analytics Dashboard (`src/routes/analytics/+page.svelte`)

246-line Svelte component displaying real-time analytics.

**Metrics Displayed**:
- Template performance (views, sends, conversion rates)
- Funnel drop-off analysis
- Source attribution (social vs direct traffic)
- Campaign effectiveness (UTM tracking)
- User engagement patterns
- Session duration and bounce rates

**Access Control**:
- Admin-only route (requires elevated permissions)
- Real-time data refresh
- Export capabilities for deeper analysis

## Usage

### Client-Side Tracking

```typescript
import { analytics } from '$lib/core/analytics';

// Track page view
analytics.trackEvent({
  name: 'page_view',
  properties: {
    page: '/s/climate-action',
    title: 'Climate Action Template'
  }
});

// Track custom event
analytics.trackEvent({
  name: 'button_click',
  template_id: 'climate-123',
  properties: {
    button_text: 'Send to Congress',
    location: 'template_preview'
  }
});
```

### Funnel Tracking

```typescript
import { funnelAnalytics } from '$lib/core/analytics';

// Track funnel progression
funnelAnalytics.track('template_viewed', {
  template_id: template.id,
  source: 'social-link',
  platform: 'twitter'
});

funnelAnalytics.track('auth_completed', {
  template_id: template.id,
  oauth_provider: 'google'
});

funnelAnalytics.track('template_used', {
  template_id: template.id,
  recipients_count: 3,
  delivery_method: 'cwc_api'
});
```

### Server-Side Analytics

```typescript
// src/routes/api/analytics/track/+server.ts
import { prisma } from '$lib/core/db';

export async function POST({ request }) {
  const events = await request.json();

  await prisma.analytics_event.createMany({
    data: events.map(event => ({
      session_id: event.session_id,
      user_id: event.user_id,
      name: event.name,
      properties: event.properties,
      created_at: new Date()
    }))
  });

  return new Response('OK');
}
```

## Key Tracked Events

### Template Lifecycle
- `template_viewed` - Template preview page loaded
- `template_personalized` - User edits template variables
- `template_preview` - User previews final message
- `template_used` - Message sent successfully
- `template_shared` - User shares template link

### Authentication Flow
- `auth_modal_opened` - User clicks login/signup
- `auth_provider_selected` - OAuth provider chosen
- `auth_completed` - OAuth callback succeeded
- `auth_failed` - OAuth error occurred

### Engagement Actions
- `representative_viewed` - User views rep details
- `representative_selected` - User chooses which reps to contact
- `address_collected` - User provides address for rep lookup
- `verification_completed` - Identity verification succeeded

### Performance Metrics
- `page_load_time` - Client-side performance tracking
- `api_latency` - Server response times
- `error_boundary_triggered` - React/Svelte error boundary hits

## Database Schema

```prisma
model AnalyticsEvent {
  id          String   @id @default(cuid())
  session_id  String
  user_id     String?
  name        String
  event_type  String?
  template_id String?
  funnel_step Int?
  properties  Json?
  created_at  DateTime @default(now())

  @@index([session_id])
  @@index([user_id])
  @@index([template_id])
  @@index([created_at])
  @@map("analytics_events")
}

model AnalyticsSession {
  id              String   @id @default(cuid())
  session_id      String   @unique
  user_id         String?
  utm_source      String?
  utm_medium      String?
  utm_campaign    String?
  landing_page    String?
  referrer        String?
  device_data     Json?
  created_at      DateTime @default(now())
  last_active_at  DateTime @updatedAt

  @@index([user_id])
  @@map("analytics_sessions")
}
```

## Privacy & Compliance

### What We Track
- ✅ Session IDs (ephemeral, no cross-device tracking)
- ✅ User IDs (for logged-in users only, linked to their account)
- ✅ Template interactions (views, sends, shares)
- ✅ Funnel progression (conversion tracking)
- ✅ UTM parameters (campaign attribution)
- ✅ Referrer URLs (traffic sources)
- ✅ User agent strings (device type detection)

### What We DON'T Track
- ❌ Third-party cookies
- ❌ Cross-site tracking
- ❌ Precise geolocation (only country/state for rep lookup)
- ❌ Mouse movements or keystrokes
- ❌ Content of user messages (only that they were sent)
- ❌ Personal data beyond email (unless user provides)

### GDPR/CCPA Compliance
- All analytics data stored in EU-compliant Supabase regions
- Users can request full data export
- Users can request analytics deletion (separate from account deletion)
- No data sold to third parties (we don't use third parties)

## Performance Considerations

### Event Batching
Events are queued in memory and flushed in batches to reduce API calls:
- Auto-flush every 10 seconds
- Immediate flush at 10 queued events
- Force flush on page unload
- Retry logic for failed flushes

### Circular Reference Handling
Custom JSON serialization prevents crashes from circular object references:
```typescript
private safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
      return '[HTMLElement]';
    }
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}
```

### LocalStorage Resilience
- Handles quota exceeded errors gracefully
- Cleans up old events (24-hour TTL)
- Degrades gracefully in private browsing mode
- Never blocks user actions if analytics fail

## Analytics Dashboard Features

### Campaign Performance
- Templates ranked by conversion rate
- Source breakdown (social, direct, referral)
- UTM campaign effectiveness
- Viral coefficient (shares per send)

### User Behavior
- Funnel visualization with drop-off rates
- Session duration and engagement metrics
- Return user vs new user patterns
- Peak usage times and seasonal trends

### Template Intelligence
- Which templates resonate most
- What personalization patterns increase sends
- Representative targeting effectiveness
- Geographic distribution of actions

## Roadmap

### Near Term
- Real-time dashboard updates via WebSocket
- A/B testing framework integration
- Automated anomaly detection
- Custom dashboard builder

### Medium Term
- Predictive analytics (which templates will perform best)
- Cohort analysis (user retention over time)
- Revenue attribution (for VOTER Protocol rewards)
- Mobile app analytics integration

### Long Term
- Federated learning for privacy-preserving ML
- Cross-platform analytics (if we add mobile apps)
- International compliance (country-specific rules)
- Open-source analytics toolkit for other civic platforms

## API Endpoints

- `POST /api/analytics/track` - Batch event submission
- `GET /api/analytics/session` - Retrieve session data
- `GET /api/analytics/template/:id` - Template-specific metrics
- `GET /api/analytics/funnel` - Funnel conversion data
- `DELETE /api/analytics/user/:id` - User data deletion (GDPR)

## Testing

```bash
npm run test:integration -- analytics-core.test.ts  # Core analytics logic
npm run test:integration -- analytics-funnel.test.ts # Funnel tracking
```

## References

- **Code**: `src/lib/core/analytics/`
- **Dashboard**: `src/routes/analytics/+page.svelte`
- **Tests**: `tests/integration/analytics-*.test.ts`
- **Database Schema**: `prisma/schema.prisma`

---

This analytics system gives us complete control over civic engagement data while respecting user privacy and enabling data-driven platform improvements.
