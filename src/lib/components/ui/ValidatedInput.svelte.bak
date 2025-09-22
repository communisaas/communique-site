<script lang="ts">
	import { validateField, debounce, type ValidationRule } from '$lib/utils/validation';

	interface Props {
		value: string;
		label?: string;
		placeholder?: string;
		type?: 'text' | 'textarea' | 'email';
		rules?: ValidationRule;
		disabled?: boolean;
		serverError?: string;
		onValidation?: (isValid: boolean, error?: string) => void;
		rows?: number; // For textarea
		class?: string;
		style?: string;
		id?: string;
	}

	let {
		value = $bindable(),
		label,
		placeholder,
		type = 'text',
		rules = {},
		disabled = false,
		serverError,
		onValidation,
		rows = 4,
		class: className,
		style,
		id
	}: Props = $props();

	// Generate unique ID if not provided
	const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

	let clientError = $state<string | null>(null);
	let isTouched = $state(false);
	let isFocused = $state(false);

	// Combine client and server errors
	const displayError = $derived(serverError || (isTouched ? clientError : null));
	const hasError = $derived(!!displayError);
	const isValid = $derived(!hasError && isTouched);

	// Debounced validation
	const debouncedValidate = debounce((val: string) => {
		const result = validateField(val, rules);
		clientError = result.error || null;
		onValidation?.(result.isValid, result.error);
	}, 300);

	// Immediate validation for certain cases
	function immediateValidate() {
		const result = validateField(value, rules);
		clientError = result.error || null;
		onValidation?.(result.isValid, result.error);
	}

	function handleInput() {
		// Clear server errors when user starts typing
		if (serverError) {
			serverError = undefined;
		}

		debouncedValidate(value);
	}

	function handleBlur() {
		isTouched = true;
		isFocused = false;
		immediateValidate();
	}

	function handleFocus() {
		isFocused = true;
	}

	// Input classes based on state
	const inputClasses = $derived.by(() => {
		const base =
			'block w-full rounded-md border px-3 md:px-3 py-2 md:py-2 text-sm md:text-sm transition-colors focus:outline-none focus:ring-1 md:focus:ring-2 focus:ring-offset-1 md:focus:ring-offset-2';

		let classes = '';
		if (hasError) {
			classes = `${base} border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500`;
		} else if (isValid) {
			classes = `${base} border-green-300 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:ring-green-500`;
		} else {
			classes = `${base} border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500`;
		}

		// Add custom class if provided
		return className ? `${classes} ${className}` : classes;
	});

	const labelClasses = $derived.by(() => {
		const base = 'block text-sm md:text-sm font-medium mb-1 md:mb-1';
		if (hasError) {
			return `${base} text-red-700`;
		} else {
			return `${base} text-gray-700`;
		}
	});
</script>

<div class="space-y-1">
	{#if label}
		<label for={inputId} class={labelClasses}>
			{label}
			{#if rules.required}
				<span class="text-red-500">*</span>
			{/if}
		</label>
	{/if}

	{#if type === 'textarea'}
		<textarea
			id={inputId}
			bind:value
			class={inputClasses}
			{placeholder}
			{disabled}
			{rows}
			{style}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		></textarea>
	{:else}
		<input
			id={inputId}
			{type}
			bind:value
			class={inputClasses}
			{placeholder}
			{disabled}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={handleFocus}
		/>
	{/if}

	<!-- Error message -->
	{#if displayError}
		<div class="flex items-center gap-1 text-xs text-red-600 md:text-sm" role="alert">
			<svg class="h-3 w-3 flex-shrink-0 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
					clip-rule="evenodd"
				/>
			</svg>
			<span>{displayError}</span>
		</div>
	{:else if isValid && rules.required}
		<div class="flex items-center gap-1 text-xs text-green-600 md:text-sm">
			<svg class="h-3 w-3 flex-shrink-0 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					clip-rule="evenodd"
				/>
			</svg>
			<span>Looks good!</span>
		</div>
	{/if}

	<!-- Character count for fields with maxLength (disabled for textarea) -->
	{#if rules.maxLength && isFocused && type !== 'textarea'}
		<div class="text-right text-xs text-gray-500">
			{value.length} / {rules.maxLength} characters
		</div>
	{/if}
</div>
