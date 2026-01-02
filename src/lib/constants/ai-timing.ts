export const AI_SUGGESTION_TIMING = {
	// Debouncing
	DEBOUNCE_DELAY: 1200, // Wait 1.2s after last keystroke
	MIN_INPUT_LENGTH: 15, // Don't generate for < 15 chars
	CONTENT_SIMILARITY_THRESHOLD: 0.2, // Only re-gen if 20%+ change

	// Network timeouts
	SUGGESTION_TIMEOUT: 30000, // Give up after 30s (Gemini agent may need retries)
	RETRY_DELAY: 2000, // Wait 2s before retry
	MAX_RETRIES: 1, // Retry once on timeout

	// UI animations
	FADE_IN_DURATION: 200, // Suggestion fade-in
	SLIDE_DURATION: 200, // Suggestion slide-in
	INDICATOR_FADE_IN: 150, // Thinking indicator
	MIN_THINKING_DURATION: 300, // Prevent flash for fast responses

	// Rate limiting
	MAX_CALLS_PER_SESSION: 10, // Max 10 calls per session
	RATE_LIMIT_WINDOW: 300000, // 5 minute window
	MIN_CALL_INTERVAL: 500, // Cooldown between calls

	// Caching
	CACHE_DURATION: 300000, // Cache 5 minutes
	MAX_CACHE_SIZE: 20 // Max 20 cached suggestions
} as const;
