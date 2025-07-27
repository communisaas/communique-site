<script lang="ts">
    import { geolocation } from '$lib/services/geolocation';
    import type { GeolocationData } from '$lib/services/geolocation';
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { coordinated, useTimerCleanup } from '$lib/utils/timerCoordinator';

    interface Props {
        show?: boolean;
        messageSent?: boolean;
    }

    const { show = false, messageSent = false }: Props = $props();

    const dispatch = createEventDispatcher<{
        locationAdded: GeolocationData;
        dismissed: void;
    }>();

    let loading = false;
    let error = '';
    let manualEntry = false;
    let zipCode = '';

    // Component ID for timer coordination
    const componentId = 'location-prompt-' + Math.random().toString(36).substring(2, 15);

    // Cleanup timers on destroy
    onDestroy(() => {
        useTimerCleanup(componentId)();
    });

    async function requestLocation() {
        loading = true;
        error = '';

        try {
            const location = await geolocation.getLocation({
                enableHighAccuracy: true,
                timeout: 10000,
                fallbackToIP: false // Don't auto-fallback, let user choose
            });

            dispatch('locationAdded', location);
            show = false;
        } catch (err) {
            error = 'Could not access your location. Try entering your ZIP code instead.';
            manualEntry = true;
        } finally {
            loading = false;
        }
    }

    async function submitZipCode() {
        if (!zipCode || zipCode.length < 5) {
            error = 'Please enter a valid ZIP code';
            return;
        }

        loading = true;
        error = '';

        try {
            const location: GeolocationData = {
                source: 'manual_address',
                address: {
                    zip: zipCode.trim()
                },
                timestamp: Date.now(),
                confidence: 0.7 // Manual ZIP is pretty reliable
            };

            dispatch('locationAdded', location);
            show = false;
        } catch (err) {
            error = 'Invalid ZIP code. Please try again.';
        } finally {
            loading = false;
        }
    }

    function dismiss() {
        dispatch('dismissed');
        show = false;
    }

    // Auto-show after successful message send
    $effect(() => {
        if (messageSent && !show) {
            coordinated.setTimeout(() => {
                show = true;
            }, 1500, 'feedback', componentId); // Give user time to see success message
        }
    });
</script>

{#if show}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                
                <h3 class="text-xl font-semibold text-gray-900 mb-2">
                    Make Your Voice Count More
                </h3>
                
                <p class="text-gray-600 text-sm">
                    Representatives prioritize messages from their actual constituents. 
                    Add your location to show you're in their district.
                </p>
            </div>

            {#if error}
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p class="text-red-700 text-sm">{error}</p>
                </div>
            {/if}

            {#if !manualEntry}
                <div class="space-y-4">
                    <button
                        onclick={requestLocation}
                        disabled={loading}
                        class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {#if loading}
                            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Getting location...
                        {:else}
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            Use My Current Location
                        {/if}
                    </button>

                    <button
                        onclick={() => manualEntry = true}
                        class="w-full text-gray-600 hover:text-gray-800 py-2 text-sm transition-colors"
                    >
                        Or enter ZIP code manually
                    </button>
                </div>
            {:else}
                <div class="space-y-4">
                    <div>
                        <label for="zipCode" class="block text-sm font-medium text-gray-700 mb-2">
                            ZIP Code
                        </label>
                        <input
                            id="zipCode"
                            bind:value={zipCode}
                            type="text"
                            placeholder="12345"
                            maxlength="10"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            onkeydown={(e) => e.key === 'Enter' && submitZipCode()}
                        />
                    </div>

                    <button
                        onclick={submitZipCode}
                        disabled={loading || !zipCode}
                        class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                    >
                        {#if loading}
                            <svg class="animate-spin w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        {:else}
                            Add Location
                        {/if}
                    </button>

                    <button
                        onclick={() => manualEntry = false}
                        class="w-full text-gray-600 hover:text-gray-800 py-2 text-sm transition-colors"
                    >
                        ← Back to location detection
                    </button>
                </div>
            {/if}

            <div class="mt-6 pt-4 border-t border-gray-200">
                <button
                    onclick={dismiss}
                    class="w-full text-gray-500 hover:text-gray-700 py-2 text-sm transition-colors"
                >
                    Skip for now
                </button>
                
                <p class="text-xs text-gray-400 text-center mt-2">
                    Your location helps verify you're a real constituent but is never required.
                </p>
            </div>
        </div>
    </div>
{/if}