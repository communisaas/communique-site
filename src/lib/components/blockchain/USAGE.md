# BlockchainInit Component - Usage Guide

## Overview

The `BlockchainInit.svelte` component handles client-side blockchain account creation after OAuth authentication. It's designed to work seamlessly with SvelteKit's SSR architecture by deferring all blockchain operations to the browser.

## Problem Solved

Previously, the OAuth callback handler attempted to create NEAR/Scroll accounts server-side, which caused build failures due to browser-only dependencies:
- `@near-js/keystores-browser` (requires IndexedDB)
- `@near-js/biometric-ed25519` (requires WebAuthn)
- `idb` (IndexedDB wrapper)

## Architecture

1. **Server-side (OAuth callback)**: Sets `oauth_blockchain_pending` cookie with user info
2. **Client-side (BlockchainInit.svelte)**: Reads cookie and triggers account creation
3. **Browser-only execution**: Uses dynamic imports with browser guards
4. **Zero SSR issues**: No blockchain code runs during SSR build

## Basic Usage

### In a Page Component

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import BlockchainInit from '$lib/components/blockchain/BlockchainInit.svelte';

  let { data } = $props();

  // Check if blockchain initialization is needed
  let needsBlockchainInit = $state(false);

  onMount(() => {
    if (!browser) return;

    // Read the cookie set by OAuth callback
    const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
      const [key, value] = cookie.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const blockchainPending = cookies['oauth_blockchain_pending'];
    if (blockchainPending) {
      try {
        const pending = JSON.parse(decodeURIComponent(blockchainPending));
        needsBlockchainInit = pending.needsInit;
      } catch (e) {
        console.error('Failed to parse blockchain pending cookie:', e);
      }
    }
  });
</script>

{#if needsBlockchainInit && data.user}
  <BlockchainInit
    userId={data.user.id}
    provider={data.user.oauth_provider}
    oauthUserId={data.user.oauth_user_id}
  >
    <!-- Your page content -->
    <h1>Welcome, {data.user.name}!</h1>
    <p>Your blockchain accounts have been created.</p>
  </BlockchainInit>
{:else}
  <!-- Regular page content for users with existing blockchain accounts -->
  <h1>Welcome back, {data.user?.name}!</h1>
{/if}
```

### In a Layout Component

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import BlockchainInit from '$lib/components/blockchain/BlockchainInit.svelte';

  // Automatically initialize for all authenticated users
  $: user = $page.data.user;
  $: needsInit = user && (!user.near_account_id || !user.scroll_address);
</script>

{#if needsInit}
  <BlockchainInit
    userId={user.id}
    provider={user.oauth_provider}
    oauthUserId={user.oauth_user_id}
    showLoading={true}
    showError={true}
    autoRetry={true}
  >
    <slot />
  </BlockchainInit>
{:else}
  <slot />
{/if}
```

## Component Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `userId` | `string` | Yes | - | Communique user ID |
| `provider` | `string` | Yes | - | OAuth provider (google, facebook, etc.) |
| `oauthUserId` | `string` | Yes | - | Provider-specific OAuth user ID |
| `skipIfExists` | `boolean` | No | `true` | Skip initialization if user already has accounts |
| `showLoading` | `boolean` | No | `true` | Show loading UI during initialization |
| `showError` | `boolean` | No | `true` | Show error UI if initialization fails |
| `autoRetry` | `boolean` | No | `false` | Auto-retry on error (max 3 attempts) |
| `retryDelay` | `number` | No | `3000` | Delay between retries in milliseconds |

## Direct Store Usage (Advanced)

For more control, you can use the blockchain store directly:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { initializeBlockchain, blockchain } from '$lib/core/blockchain/use-blockchain';

  let { data } = $props();

  onMount(async () => {
    if (!browser || !data.user) return;

    // Skip if already initialized
    if ($blockchain.initialized) return;

    try {
      await initializeBlockchain(
        data.user.id,
        data.user.oauth_provider,
        data.user.oauth_user_id
      );

      console.log('Blockchain accounts created!', {
        near: $blockchain.nearAccountId,
        scroll: $blockchain.scrollAddress
      });
    } catch (error) {
      console.error('Failed to create blockchain accounts:', error);
    }
  });
</script>

<!-- Reactive UI based on blockchain state -->
{#if $blockchain.loading}
  <p>Creating blockchain accounts...</p>
{:else if $blockchain.error}
  <p>Error: {$blockchain.error}</p>
{:else if $blockchain.initialized}
  <p>NEAR: {$blockchain.nearAccountId}</p>
  <p>Scroll: {$blockchain.scrollAddress}</p>
{/if}
```

## Store State

The `blockchain` store provides the following reactive state:

```typescript
interface BlockchainState {
  initialized: boolean;      // Whether accounts have been created
  nearAccountId: string | null;
  scrollAddress: string | null;
  ethereumAddress: string | null;  // Same as scrollAddress (ECDSA)
  loading: boolean;          // Loading state during creation
  error: string | null;      // Error message if creation failed
}
```

## Error Handling

The component provides automatic error handling with optional retry:

```svelte
<BlockchainInit
  userId={user.id}
  provider="google"
  oauthUserId={googleUserId}
  autoRetry={true}
  retryDelay={5000}
  showError={true}
>
  <!-- Content shown after successful initialization -->
</BlockchainInit>
```

## SSR Safety

All blockchain operations are guarded with browser checks:

```typescript
if (!browser) {
  console.warn('[Blockchain] Cannot initialize in SSR context');
  return null;
}
```

This ensures:
- No browser-only imports during SSR build
- No IndexedDB/WebAuthn calls on the server
- Clean separation between server and client execution

## Integration with OAuth Flow

The OAuth callback handler sets a cookie for client-side detection:

```typescript
cookies.set('oauth_blockchain_pending', JSON.stringify({
  userId: user.id,
  provider: 'google',
  needsInit: !user.near_account_id || !user.scroll_address,
  timestamp: Date.now()
}), {
  path: '/',
  httpOnly: false,  // Allow client access
  maxAge: 60 * 15   // 15 minutes
});
```

Your page can read this cookie to conditionally render `BlockchainInit`:

```typescript
onMount(() => {
  const pendingCookie = getCookie('oauth_blockchain_pending');
  if (pendingCookie) {
    const data = JSON.parse(decodeURIComponent(pendingCookie));
    if (data.needsInit) {
      // Show BlockchainInit component
    }
  }
});
```

## Testing

### Development

```bash
npm run dev
```

1. Sign in via OAuth
2. Verify BlockchainInit renders
3. Check browser console for logs
4. Confirm NEAR/Scroll accounts created

### Production Build

```bash
npm run build
```

Verify no SSR errors related to:
- IndexedDB
- WebAuthn
- @near-js/keystores-browser
- @near-js/biometric-ed25519

### Manual Testing

```typescript
// In browser console after OAuth:
const blockchain = await import('/src/lib/core/blockchain/use-blockchain.ts');
const accounts = await blockchain.initializeBlockchain(
  'user-id',
  'google',
  'google-oauth-id'
);
console.log(accounts);
```

## Troubleshooting

### "VOTERClient requires browser context" error

**Problem**: Blockchain code ran during SSR
**Solution**: Ensure all blockchain imports are inside `onMount()` or wrapped with `if (browser)`

### WebAuthn prompt doesn't appear

**Problem**: Browser blocked passkey creation
**Solution**:
- Check HTTPS is enabled (required for WebAuthn)
- Verify user interaction triggered the flow
- Check browser permissions

### Accounts not created after OAuth

**Problem**: Cookie expired or not set
**Solution**:
- Check `oauth_blockchain_pending` cookie exists
- Verify `needsInit` flag is true
- Check console logs for errors

## Related Files

- `/src/lib/core/blockchain/use-blockchain.ts` - Store and initialization logic
- `/src/lib/core/blockchain/oauth-near.ts` - NEAR account creation
- `/src/lib/core/blockchain/chain-signatures.ts` - Scroll address derivation
- `/src/lib/core/blockchain/voter-client.ts` - VOTER Protocol client wrapper
- `/src/lib/core/auth/oauth-callback-handler.ts` - OAuth callback with cookie setup
