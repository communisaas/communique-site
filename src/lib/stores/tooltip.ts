import { writable } from 'svelte/store';

export const activeTooltipId = writable<string | null>(null); 