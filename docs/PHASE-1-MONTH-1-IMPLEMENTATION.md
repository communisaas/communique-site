# Phase 1 - Month 1 Implementation Plan

**Goal**: Optimize viral infrastructure for social media sharing and network effects
**Timeline**: 4 weeks
**Status**: In Progress

---

## Overview

Month 1 focuses on completing the viral infrastructure needed for templates to spread on social media. We have 95% of the crypto infrastructure (ZK proofs, Merkle trees, TEE) and template infrastructure (CodeMirror, 3-layer moderation). What we need is **social media optimization**.

**From PHASE-1-REALITY-GROUNDED.md lines 199-213:**
```
### Month 1: Core Viral Infrastructure

**Build**:
1. **Shareable template URLs** (`/s/[slug]`) - DONE ✅
2. **Open Graph optimization** (rich social previews) - NEEDS WORK ⚠️
3. **Social proof display** ("5,247 people have taken action") - NEW ❌
4. **One-click sharing** (Twitter/Facebook/native share) - DONE ✅
5. **Privacy-preserving analytics** (aggregate counts by district) - MOSTLY DONE ⚠️
```

---

## Implementation Tasks

### Week 1: Open Graph Optimization + Social Proof Display

**Priority 1: Rich Social Preview Cards** (2 days)

Current state (`src/routes/s/[slug]/+page.svelte:163-179`):
```svelte
<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content={shareUrl} />
<meta property="og:title" content={template.title} />
<meta property="og:description" content={template.description} />
<meta property="og:site_name" content="Communiqué" />

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content={shareUrl} />
<meta property="twitter:title" content={template.title} />
<meta property="twitter:description" content={template.description} />
```

**Missing**:
- ❌ `og:image` - Rich preview image (auto-generated from template metadata)
- ❌ `twitter:image` - Same as og:image
- ❌ `og:image:width` and `og:image:height` - Required for proper rendering
- ❌ Dynamic social proof in preview text ("Join 5,247 constituents who took action")

**Implementation**:

1. **Auto-generate Open Graph images** (Day 1-2):
   - Create `/api/og/[slug]/+server.ts` endpoint
   - Use `@vercel/og` or `satori` to generate images dynamically
   - Template: Template title + category + social proof count + Communiqué branding
   - Size: 1200x630px (Facebook/Twitter standard)
   - Cache generated images (Redis or file system)

2. **Update meta tags** (Day 2):
   ```svelte
   <!-- src/routes/s/[slug]/+page.svelte -->
   <meta property="og:image" content="{$page.url.origin}/api/og/{template.slug}" />
   <meta property="og:image:width" content="1200" />
   <meta property="og:image:height" content="630" />
   <meta property="twitter:image" content="{$page.url.origin}/api/og/{template.slug}" />

   <!-- Enhanced description with social proof -->
   <meta property="og:description" content="{socialProofDescription}" />
   <meta property="twitter:description" content="{socialProofDescription}" />
   ```

   ```typescript
   const socialProofDescription = $derived(() => {
     const sent = template.metrics?.sent || 0;
     if (sent > 0) {
       return `Join ${sent.toLocaleString()} constituents who took action. ${template.description}`;
     }
     return template.description;
   });
   ```

**Priority 2: Social Proof Display Component** (2 days)

Current state:
- We show metrics in template header (`src/routes/s/[slug]/+page.svelte:206-215`)
- But no prominent social proof callout

**Missing**:
- ❌ Prominent social proof banner ("5,247 people have taken action")
- ❌ District-level breakdown ("1,247 in CA-12, 892 in NY-03")
- ❌ Real-time updates as count grows

**Implementation**:

1. **Create SocialProofBanner component** (Day 3):
   ```svelte
   <!-- src/lib/components/template/SocialProofBanner.svelte -->
   <script lang="ts">
     import { Users, TrendingUp, MapPin } from '@lucide/svelte';
     import { spring } from 'svelte/motion';

     let {
       totalActions,
       topDistricts = []
     }: {
       totalActions: number;
       topDistricts?: Array<{ district: string; count: number }>;
     } = $props();

     // Animated counter
     let displayCount = spring(0, { stiffness: 0.2, damping: 0.8 });

     $effect(() => {
       displayCount.set(totalActions);
     });
   </script>

   <div class="rounded-lg border-2 border-participation-primary-200 bg-participation-primary-50 p-4">
     <div class="flex items-center gap-3">
       <div class="flex h-12 w-12 items-center justify-center rounded-full bg-participation-primary-100">
         <Users class="h-6 w-6 text-participation-primary-600" />
       </div>

       <div class="flex-1">
         <div class="flex items-baseline gap-2">
           <span class="text-2xl font-bold text-slate-900">
             {Math.floor($displayCount).toLocaleString()}
           </span>
           <span class="text-sm text-slate-600">people have taken action</span>
           {#if totalActions > 1000}
             <TrendingUp class="h-4 w-4 text-green-600" />
           {/if}
         </div>

         {#if topDistricts.length > 0}
           <div class="mt-1 flex items-center gap-2 text-xs text-slate-600">
             <MapPin class="h-3 w-3" />
             <span>
               Top districts: {topDistricts.map(d => `${d.district} (${d.count})`).join(', ')}
             </span>
           </div>
         {/if}
       </div>
     </div>
   </div>
   ```

2. **Add to template page** (Day 3):
   ```svelte
   <!-- src/routes/s/[slug]/+page.svelte -->
   <script lang="ts">
     import SocialProofBanner from '$lib/components/template/SocialProofBanner.svelte';

     const totalActions = $derived(template.metrics?.sent || 0);
     const topDistricts = $derived(data.topDistricts || []); // From server load
   </script>

   <!-- Insert after template header, before template preview -->
   {#if totalActions > 10}
     <div class="mb-6">
       <SocialProofBanner {totalActions} {topDistricts} />
     </div>
   {/if}
   ```

3. **Update server load function** (Day 4):
   ```typescript
   // src/routes/s/[slug]/+page.server.ts
   export const load: PageServerLoad = async ({ params, locals }) => {
     const template = await prisma.template.findUnique({
       where: { slug: params.slug },
       include: {
         metrics: true,
         submissions: {
           select: {
             user: {
               select: { congressional_district: true }
             }
           }
         }
       }
     });

     // Aggregate district-level counts (privacy-preserving)
     const districtCounts = template.submissions.reduce((acc, sub) => {
       const district = sub.user?.congressional_district;
       if (district) {
         acc[district] = (acc[district] || 0) + 1;
       }
       return acc;
     }, {} as Record<string, number>);

     // Top 3 districts
     const topDistricts = Object.entries(districtCounts)
       .sort((a, b) => b[1] - a[1])
       .slice(0, 3)
       .map(([district, count]) => ({ district, count }));

     return {
       template,
       topDistricts,
       user: locals.user
     };
   };
   ```

**Priority 3: Enhanced Share UI in TemplateModal** (1 day)

Current state (`src/lib/components/template/TemplateModal.svelte:549-602`):
- Share UI exists in celebration state
- URL copy works
- Social sharing works (Twitter only)

**Missing**:
- ❌ Pre-written share copy with social proof
- ❌ Facebook and LinkedIn sharing
- ❌ Native share API for mobile
- ❌ Hashtag suggestions

**Implementation** (Day 5):

1. **Update TemplateModal share section**:
   ```svelte
   <!-- src/lib/components/template/TemplateModal.svelte -->
   <script lang="ts">
     // Enhanced share copy with social proof
     const shareText = $derived(() => {
       const sent = template.metrics?.sent || 0;
       if (sent > 1000) {
         return `Just joined ${sent.toLocaleString()}+ people taking action on "${template.title}". Your voice matters too! 🔥`;
       } else if (sent > 100) {
         return `I just took action on "${template.title}" - join ${sent.toLocaleString()}+ others! 🔥`;
       } else {
         return `Just took action on "${template.title}" - every voice matters! 🔥`;
       }
     });

     // Suggested hashtags based on template category
     const suggestedHashtags = $derived(() => {
       const categoryHashtags = {
         'Housing': ['RentControl', 'HousingJustice', 'AffordableHousing'],
         'Climate': ['GreenNewDeal', 'ClimateAction', 'ClimateJustice'],
         'Healthcare': ['MedicareForAll', 'HealthcareJustice', 'HealthEquity'],
         'Labor': ['UnionStrong', 'LaborRights', 'WorkersRights'],
         'Voting': ['VotingRights', 'DemocracyNow', 'EveryVoteCounts']
       };

       return categoryHashtags[template.category] || ['CivicAction'];
     });

     function shareOnSocial(platform: 'twitter' | 'facebook' | 'linkedin' | 'native') {
       const encodedUrl = encodeURIComponent(shareUrl);
       const text = shareText + '\n\n' + suggestedHashtags.map(h => `#${h}`).join(' ');
       const encodedText = encodeURIComponent(text);

       if (platform === 'native' && navigator.share) {
         // Mobile native share
         navigator.share({
           title: template.title,
           text: shareText,
           url: shareUrl
         });
         return;
       }

       const urls = {
         twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
         facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
         linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
       };

       if (platform !== 'native') {
         window.open(urls[platform], '_blank', 'width=600,height=400');
       }
     }
   </script>

   <!-- Enhanced share buttons -->
   <div class="flex flex-col gap-3">
     <!-- Native Share (mobile) -->
     {#if navigator.share}
       <button
         onclick={() => shareOnSocial('native')}
         class="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2"
       >
         <Share2 class="h-4 w-4" />
         <span class="text-sm font-medium">Share</span>
       </button>
     {:else}
       <!-- Desktop Social Share -->
       <div class="flex gap-3">
         <button
           onclick={() => shareOnSocial('twitter')}
           class="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2"
         >
           <span class="text-sm font-bold">𝕏</span>
           <span class="text-sm">Share</span>
         </button>

         <button
           onclick={() => shareOnSocial('facebook')}
           class="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2"
         >
           <span class="text-sm">📘</span>
           <span class="text-sm">Facebook</span>
         </button>

         <button
           onclick={() => shareOnSocial('linkedin')}
           class="flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2"
         >
           <span class="text-sm">💼</span>
           <span class="text-sm">LinkedIn</span>
         </button>
       </div>
     {/if}

     <!-- Suggested hashtags -->
     <div class="text-center">
       <p class="text-xs text-slate-500">Suggested hashtags:</p>
       <p class="text-xs text-slate-600">
         {suggestedHashtags.map(h => `#${h}`).join(' ')}
       </p>
     </div>
   </div>
   ```

---

### Week 2: Privacy-Preserving Analytics Dashboard (MVP)

**Goal**: Build analytics dashboard for template creators showing aggregate district-level intelligence WITHOUT individual tracking.

**From PHASE-1-REALITY-GROUNDED.md lines 267-298:**
```markdown
### What Advocacy Groups Get

**Dashboard showing**:
1. **Geographic intelligence**:
   - "12,000 constituents across 50 districts care about climate"
   - "CA-12 has 1,247 engaged constituents (highest)"
   - "15 swing districts have 200+ constituents each"

**What advocacy groups DON'T get**:
- ❌ Individual identities
- ❌ Addresses
- ❌ Email addresses
- ❌ Tracking across time
- ❌ Profiling
```

**Implementation**:

1. **Create analytics aggregation service** (Day 1-2):
   ```typescript
   // src/lib/services/analytics/aggregation.ts
   import { prisma } from '$lib/core/db';

   export interface DistrictAggregates {
     district: string;
     actionCount: number;
     percentageOfTotal: number;
   }

   export interface TemplateAnalytics {
     totalActions: number;
     uniqueDistricts: number;
     topDistricts: DistrictAggregates[];
     swingDistricts: DistrictAggregates[];
     recentGrowth: {
       last24h: number;
       last7d: number;
       last30d: number;
     };
   }

   export async function getTemplateAnalytics(
     templateId: string
   ): Promise<TemplateAnalytics> {
     // Aggregate submissions by district (privacy-preserving)
     const submissions = await prisma.submission.findMany({
       where: {
         template_id: templateId,
         status: 'sent'
       },
       select: {
         created_at: true,
         user: {
           select: {
             congressional_district: true
           }
         }
       }
     });

     // Count by district
     const districtCounts = submissions.reduce((acc, sub) => {
       const district = sub.user?.congressional_district || 'Unknown';
       acc[district] = (acc[district] || 0) + 1;
       return acc;
     }, {} as Record<string, number>);

     const totalActions = submissions.length;
     const uniqueDistricts = Object.keys(districtCounts).length;

     // Top districts
     const topDistricts = Object.entries(districtCounts)
       .map(([district, count]) => ({
         district,
         actionCount: count,
         percentageOfTotal: (count / totalActions) * 100
       }))
       .sort((a, b) => b.actionCount - a.actionCount)
       .slice(0, 10);

     // Swing districts (if we have swing district data)
     const swingDistrictCodes = [
       'CA-13', 'CA-22', 'CA-27', 'CA-40', 'CA-45', 'CA-47', 'CA-49',
       'NY-03', 'NY-17', 'NY-19', 'NY-22',
       'PA-07', 'PA-08', 'PA-17',
       // ... more swing districts
     ];

     const swingDistricts = topDistricts.filter(d =>
       swingDistrictCodes.includes(d.district)
     );

     // Recent growth
     const now = new Date();
     const last24h = submissions.filter(s =>
       s.created_at > new Date(now.getTime() - 24 * 60 * 60 * 1000)
     ).length;
     const last7d = submissions.filter(s =>
       s.created_at > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
     ).length;
     const last30d = submissions.filter(s =>
       s.created_at > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
     ).length;

     return {
       totalActions,
       uniqueDistricts,
       topDistricts,
       swingDistricts,
       recentGrowth: { last24h, last7d, last30d }
     };
   }
   ```

2. **Create analytics API endpoint** (Day 2):
   ```typescript
   // src/routes/api/analytics/template/[id]/+server.ts
   import { json } from '@sveltejs/kit';
   import type { RequestHandler } from './$types';
   import { getTemplateAnalytics } from '$lib/services/analytics/aggregation';

   export const GET: RequestHandler = async ({ params, locals }) => {
     // Only template creators can view analytics
     const template = await prisma.template.findUnique({
       where: { id: params.id },
       select: { creator_id: true }
     });

     if (!template || template.creator_id !== locals.user?.id) {
       return json({ error: 'Unauthorized' }, { status: 403 });
     }

     const analytics = await getTemplateAnalytics(params.id);

     return json({ success: true, data: analytics });
   };
   ```

3. **Create analytics dashboard component** (Day 3-4):
   ```svelte
   <!-- src/lib/components/analytics/TemplateAnalyticsDashboard.svelte -->
   <script lang="ts">
     import { MapPin, Users, TrendingUp, Target } from '@lucide/svelte';
     import type { TemplateAnalytics } from '$lib/services/analytics/aggregation';

     let { templateId }: { templateId: string } = $props();

     let analytics = $state<TemplateAnalytics | null>(null);
     let loading = $state(true);

     $effect(() => {
       loadAnalytics();
     });

     async function loadAnalytics() {
       loading = true;
       const response = await fetch(`/api/analytics/template/${templateId}`);
       const result = await response.json();
       if (result.success) {
         analytics = result.data;
       }
       loading = false;
     }
   </script>

   {#if loading}
     <div class="p-8 text-center">
       <div class="animate-spin">Loading...</div>
     </div>
   {:else if analytics}
     <div class="space-y-6">
       <!-- Overview Cards -->
       <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
         <div class="rounded-lg border bg-white p-4">
           <div class="flex items-center gap-2 text-sm text-slate-600">
             <Users class="h-4 w-4" />
             <span>Total Actions</span>
           </div>
           <div class="mt-2 text-2xl font-bold text-slate-900">
             {analytics.totalActions.toLocaleString()}
           </div>
         </div>

         <div class="rounded-lg border bg-white p-4">
           <div class="flex items-center gap-2 text-sm text-slate-600">
             <MapPin class="h-4 w-4" />
             <span>Districts Reached</span>
           </div>
           <div class="mt-2 text-2xl font-bold text-slate-900">
             {analytics.uniqueDistricts}
           </div>
         </div>

         <div class="rounded-lg border bg-white p-4">
           <div class="flex items-center gap-2 text-sm text-slate-600">
             <TrendingUp class="h-4 w-4" />
             <span>Last 7 Days</span>
           </div>
           <div class="mt-2 text-2xl font-bold text-slate-900">
             {analytics.recentGrowth.last7d}
           </div>
         </div>
       </div>

       <!-- Top Districts -->
       <div class="rounded-lg border bg-white p-6">
         <h3 class="mb-4 text-lg font-semibold text-slate-900">
           Top Districts by Engagement
         </h3>
         <div class="space-y-3">
           {#each analytics.topDistricts as district}
             <div class="flex items-center justify-between">
               <div class="flex items-center gap-2">
                 <MapPin class="h-4 w-4 text-slate-400" />
                 <span class="font-medium text-slate-900">{district.district}</span>
               </div>
               <div class="flex items-center gap-3">
                 <span class="text-sm text-slate-600">
                   {district.actionCount.toLocaleString()} actions
                 </span>
                 <div class="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                   <div
                     class="h-full bg-participation-primary-500"
                     style="width: {district.percentageOfTotal}%"
                   ></div>
                 </div>
               </div>
             </div>
           {/each}
         </div>
       </div>

       <!-- Swing Districts -->
       {#if analytics.swingDistricts.length > 0}
         <div class="rounded-lg border border-amber-200 bg-amber-50 p-6">
           <div class="mb-4 flex items-center gap-2">
             <Target class="h-5 w-5 text-amber-600" />
             <h3 class="text-lg font-semibold text-amber-900">
               Swing District Impact
             </h3>
           </div>
           <p class="mb-4 text-sm text-amber-700">
             Your template has reached {analytics.swingDistricts.length} swing districts
             where your message could make a critical difference.
           </p>
           <div class="space-y-2">
             {#each analytics.swingDistricts as district}
               <div class="flex items-center justify-between">
                 <span class="font-medium text-amber-900">{district.district}</span>
                 <span class="text-sm text-amber-700">
                   {district.actionCount.toLocaleString()} constituents
                 </span>
               </div>
             {/each}
           </div>
         </div>
       {/if}
     </div>
   {/if}
   ```

4. **Add analytics tab to template creator page** (Day 5):
   ```svelte
   <!-- src/routes/templates/[id]/+page.svelte -->
   <script lang="ts">
     import TemplateAnalyticsDashboard from '$lib/components/analytics/TemplateAnalyticsDashboard.svelte';

     let activeTab = $state<'preview' | 'analytics'>('preview');
   </script>

   <!-- Tabs -->
   <div class="mb-6 border-b border-slate-200">
     <nav class="flex gap-6">
       <button
         class="border-b-2 pb-2 {activeTab === 'preview' ? 'border-participation-primary-500 text-participation-primary-600' : 'border-transparent text-slate-600'}"
         onclick={() => activeTab = 'preview'}
       >
         Preview
       </button>
       <button
         class="border-b-2 pb-2 {activeTab === 'analytics' ? 'border-participation-primary-500 text-participation-primary-600' : 'border-transparent text-slate-600'}"
         onclick={() => activeTab = 'analytics'}
       >
         Analytics
       </button>
     </nav>
   </div>

   <!-- Content -->
   {#if activeTab === 'preview'}
     <!-- Existing template preview -->
   {:else}
     <TemplateAnalyticsDashboard templateId={template.id} />
   {/if}
   ```

---

### Week 3: Viral Mechanics Testing & Optimization

**Goal**: Test sharing flows, optimize conversion, measure viral coefficient.

1. **Add analytics tracking for shares** (Day 1-2):
   ```typescript
   // src/lib/core/analytics/sharing.ts
   export async function trackTemplateShare(
     templateId: string,
     platform: 'twitter' | 'facebook' | 'linkedin' | 'native' | 'copy',
     userId?: string
   ) {
     await fetch('/api/analytics/share', {
       method: 'POST',
       body: JSON.stringify({ templateId, platform, userId })
     });
   }

   export async function trackReferral(
     templateId: string,
     referrerUserId?: string
   ) {
     // Track that a user arrived via share link
     await fetch('/api/analytics/referral', {
       method: 'POST',
       body: JSON.stringify({ templateId, referrerUserId })
     });
   }
   ```

2. **Add referral tracking to share URLs** (Day 2):
   ```svelte
   <!-- src/lib/components/template/TemplateModal.svelte -->
   <script lang="ts">
     // Generate share URL with referral tracking
     const shareUrl = $derived(() => {
       const base = `${$page.url.origin}/s/${template.slug}`;
       if (user?.id) {
         return `${base}?ref=${user.id}`;
       }
       return base;
     });
   </script>
   ```

3. **Measure viral coefficient** (Day 3-4):
   ```typescript
   // src/lib/services/analytics/viral-coefficient.ts
   export async function calculateViralCoefficient(
     templateId: string,
     timeWindow: '24h' | '7d' | '30d' = '7d'
   ): Promise<number> {
     // Viral coefficient k = (invites sent per user) × (conversion rate)
     // k > 1.0 = exponential growth

     const windowMs = {
       '24h': 24 * 60 * 60 * 1000,
       '7d': 7 * 24 * 60 * 60 * 1000,
       '30d': 30 * 24 * 60 * 60 * 1000
     };

     const cutoff = new Date(Date.now() - windowMs[timeWindow]);

     // Get all users who took action on this template in time window
     const users = await prisma.submission.findMany({
       where: {
         template_id: templateId,
         created_at: { gte: cutoff }
       },
       select: { user_id: true }
     });

     const uniqueUsers = new Set(users.map(u => u.user_id));

     // Get all shares from these users
     const shares = await prisma.analyticsEvent.count({
       where: {
         event_type: 'template_share',
         template_id: templateId,
         user_id: { in: Array.from(uniqueUsers) },
         created_at: { gte: cutoff }
       }
     });

     // Get all referrals (users who arrived via share link)
     const referrals = await prisma.submission.count({
       where: {
         template_id: templateId,
         referrer_id: { in: Array.from(uniqueUsers) },
         created_at: { gte: cutoff }
       }
     });

     const avgSharesPerUser = shares / uniqueUsers.size;
     const conversionRate = referrals / shares;

     return avgSharesPerUser * conversionRate;
   }
   ```

4. **Add viral coefficient to analytics dashboard** (Day 4-5):
   ```svelte
   <!-- src/lib/components/analytics/TemplateAnalyticsDashboard.svelte -->
   <script lang="ts">
     import { calculateViralCoefficient } from '$lib/services/analytics/viral-coefficient';

     let viralCoefficient = $state<number | null>(null);

     async function loadViralMetrics() {
       viralCoefficient = await calculateViralCoefficient(templateId, '7d');
     }
   </script>

   <!-- Viral Coefficient Card -->
   <div class="rounded-lg border bg-white p-6">
     <h3 class="mb-2 text-lg font-semibold text-slate-900">Viral Growth</h3>
     {#if viralCoefficient !== null}
       <div class="flex items-baseline gap-2">
         <span class="text-3xl font-bold {viralCoefficient >= 1.0 ? 'text-green-600' : 'text-amber-600'}">
           k = {viralCoefficient.toFixed(2)}
         </span>
         {#if viralCoefficient >= 1.0}
           <span class="text-sm text-green-600">Exponential growth! 🚀</span>
         {:else}
           <span class="text-sm text-amber-600">Need k > 1.0 for viral growth</span>
         {/if}
       </div>
       <p class="mt-2 text-sm text-slate-600">
         Each user brings {viralCoefficient.toFixed(2)} new users on average (7-day window)
       </p>
     {/if}
   </div>
   ```

---

### Week 4: Polish, Testing, Documentation

1. **A/B test Open Graph images** (Day 1-2):
   - Test different image layouts
   - Test with/without social proof in image
   - Measure click-through rate from social media

2. **Test sharing flows on all platforms** (Day 2-3):
   - Twitter/X
   - Facebook
   - LinkedIn
   - Native mobile share
   - URL copy

3. **Update documentation** (Day 4):
   - Social sharing best practices
   - Analytics dashboard guide
   - Viral coefficient interpretation

4. **Success metrics validation** (Day 5):
   - ✅ 10 templates with rich Open Graph previews
   - ✅ Social proof display working
   - ✅ Sharing analytics tracking
   - ✅ Viral coefficient calculation
   - ✅ Privacy-preserving analytics dashboard

---

## Success Criteria (Month 1)

From PHASE-1-REALITY-GROUNDED.md lines 382-386:
```
### Month 1 Metrics
- ✅ 10 templates with rich Open Graph previews
- ✅ Shareable URLs working (`/s/[slug]`)
- ✅ Social proof display ("X people have taken action")
- ✅ 3-layer moderation preventing doxxing
```

**Validation checklist**:
- [ ] Open Graph images auto-generate for all templates
- [ ] Social preview cards render correctly on Twitter, Facebook, LinkedIn
- [ ] Social proof banner shows real-time action counts
- [ ] District-level aggregates display (top 3 districts)
- [ ] Analytics dashboard shows geographic intelligence
- [ ] Viral coefficient calculation works
- [ ] Referral tracking works
- [ ] Share buttons work on all platforms
- [ ] Native mobile share works
- [ ] Privacy guarantees maintained (no individual tracking)

---

## Technical Debt Prevention

1. **Type safety**:
   - All analytics types strictly defined
   - No `any` types in analytics aggregation
   - Proper Prisma type imports

2. **Performance**:
   - Cache Open Graph images (1 hour TTL)
   - Index `congressional_district` on User table
   - Efficient aggregation queries (avoid N+1)

3. **Privacy**:
   - NEVER expose individual user data in analytics
   - Only aggregate counts by district
   - No cross-time tracking of individuals
   - Document privacy guarantees in analytics dashboard

4. **Testing**:
   - Integration tests for analytics aggregation
   - E2E tests for sharing flows
   - Visual regression tests for Open Graph images

---

## Dependencies

**External libraries**:
- `@vercel/og` or `satori` for Open Graph image generation
- `canvas` for server-side image rendering (fallback)

**Database changes**:
```sql
-- Add index for analytics performance
CREATE INDEX idx_user_congressional_district ON "User"(congressional_district);

-- Add referral tracking
ALTER TABLE "Submission" ADD COLUMN "referrer_id" TEXT REFERENCES "User"(id);

-- Add analytics events table
CREATE TABLE "AnalyticsEvent" (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  template_id TEXT REFERENCES "Template"(id),
  user_id TEXT REFERENCES "User"(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_template ON "AnalyticsEvent"(template_id, created_at);
CREATE INDEX idx_analytics_user ON "AnalyticsEvent"(user_id, created_at);
```

**Environment variables**:
```bash
# Optional: OG image caching
OG_IMAGE_CACHE_TTL=3600  # 1 hour
OG_IMAGE_CDN_URL=...     # Optional CDN for image serving
```

---

## Next Steps (Month 2)

After Month 1 completes, we move to **Template Seeding + Advocacy Partnerships**:

1. Create 10 high-quality templates on urgent issues
2. Reach out to 3 advocacy groups (Sunrise Movement, Justice Democrats, NLIHC)
3. Get 1 advocacy group to test platform
4. Goal: 1 template shared by advocacy group with 50K+ followers → 500 actions

**But first**: Complete Month 1 viral infrastructure so we have something worth sharing.
