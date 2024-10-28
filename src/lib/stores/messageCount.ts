import { writable } from 'svelte/store';

function createMessageCounter() {
    const { subscribe, set, update } = writable(0);
    
    let interval: number;
    
    return {
        subscribe,
        startCounting: () => {
            interval = setInterval(() => {
                update(n => n + 1);
            }, 2000);
        },
        stopCounting: () => {
            clearInterval(interval);
        },
        reset: () => set(0)
    };
}

export const messageCount = createMessageCounter();
