<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, User, Building, MapPin, Save, Loader2 } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import SimpleModal from '$lib/components/modals/SimpleModal.svelte';

	let {
		user,
		section = 'basic',
		onclose
	}: {
		user: any;
		section?: 'basic' | 'profile' | 'address';
		onclose?: () => void;
	} = $props();

	const dispatch = createEventDispatcher<{ 
		close: void;
		save: { section: string; data: any };
	}>();

	let isSubmitting = $state(false);
	let errors = $state<Record<string, string>>({});

	// Form data based on section
	let formData = $state(getInitialFormData());

	function getInitialFormData() {
		switch (section) {
			case 'basic':
				return {
					name: user.name || '',
					email: user.email || '',
					phone: user.phone || ''
				};
			case 'profile':
				return {
					role: user.profile?.role || '',
					organization: user.profile?.organization || '',
					location: user.profile?.location || '',
					connection: user.profile?.connection || '',
					connection_details: user.profile?.connection_details || '',
					profile_visibility: user.profile?.visibility || 'private'
				};
			case 'address':
				return {
					street: user.address?.street || '',
					city: user.address?.city || '',
					state: user.address?.state || '',
					zip: user.address?.zip || ''
				};
			default:
				return {};
		}
	}

	function handleClose() {
		onclose?.();
		dispatch('close');
	}

	function validateForm(): boolean {
		errors = {};

		switch (section) {
			case 'basic':
				if (!formData.name?.trim()) {
					errors.name = 'Name is required';
				}
				if (!formData.email?.trim()) {
					errors.email = 'Email is required';
				} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
					errors.email = 'Please enter a valid email address';
				}
				break;

			case 'profile':
				if (!formData.role?.trim()) {
					errors.role = 'Role is required';
				}
				if (!formData.connection?.trim()) {
					errors.connection = 'Connection to issues is required';
				}
				break;

			case 'address':
				if (!formData.street?.trim()) {
					errors.street = 'Street address is required';
				}
				if (!formData.city?.trim()) {
					errors.city = 'City is required';
				}
				if (!formData.state?.trim()) {
					errors.state = 'State is required';
				}
				if (!formData.zip?.trim()) {
					errors.zip = 'ZIP code is required';
				}
				break;
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSave() {
		if (!validateForm()) return;

		isSubmitting = true;
		
		try {
			// Call the appropriate API endpoint
			let endpoint = '/api/user/profile';
			let payload = { ...formData };

			if (section === 'address') {
				endpoint = '/api/user/address';
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (result.success) {
				dispatch('save', { section, data: formData });
				handleClose();
			} else {
				errors.general = result.error || 'Failed to save changes';
			}
		} catch (error) {
			errors.general = 'Failed to save changes. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	const sectionTitles = {
		basic: 'Basic Information',
		profile: 'Profile Details', 
		address: 'Address Information'
	};

	const sectionIcons = {
		basic: User,
		profile: Building,
		address: MapPin
	};
</script>

<SimpleModal 
	title={sectionTitles[section]}
	maxWidth="max-w-lg"
	onclose={handleClose}
>
	<div class="p-6">
		<!-- Section Icon -->
		<div class="flex items-center mb-6">
			{#snippet iconSnippet()}
				{@const IconComponent = sectionIcons[section]}
				<IconComponent class="w-5 h-5 text-participation-primary-600 mr-2" />
			{/snippet}
			{@render iconSnippet()}
			<h3 class="text-lg font-semibold text-slate-900">{sectionTitles[section]}</h3>
		</div>

		<!-- Error Display -->
		{#if errors.general}
			<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
				<p class="text-sm text-red-600">{errors.general}</p>
			</div>
		{/if}

		<!-- Form Fields -->
		<div class="space-y-4">
			{#if section === 'basic'}
				<div>
					<label for="name" class="block text-sm font-medium text-slate-700 mb-1">
						Name *
					</label>
					<input
						id="name"
						type="text"
						bind:value={formData.name}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.name ? 'border-red-300' : ''}"
						placeholder="Enter your full name"
					/>
					{#if errors.name}
						<p class="mt-1 text-sm text-red-600">{errors.name}</p>
					{/if}
				</div>

				<div>
					<label for="email" class="block text-sm font-medium text-slate-700 mb-1">
						Email *
					</label>
					<input
						id="email"
						type="email"
						bind:value={formData.email}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.email ? 'border-red-300' : ''}"
						placeholder="your@email.com"
					/>
					{#if errors.email}
						<p class="mt-1 text-sm text-red-600">{errors.email}</p>
					{/if}
				</div>

				<div>
					<label for="phone" class="block text-sm font-medium text-slate-700 mb-1">
						Phone
					</label>
					<input
						id="phone"
						type="tel"
						bind:value={formData.phone}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500"
						placeholder="(555) 123-4567"
					/>
				</div>

			{:else if section === 'profile'}
				<div>
					<label for="role" class="block text-sm font-medium text-slate-700 mb-1">
						Role/Profession *
					</label>
					<input
						id="role"
						type="text"
						bind:value={formData.role}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.role ? 'border-red-300' : ''}"
						placeholder="e.g., Teacher, Student, Parent, etc."
					/>
					{#if errors.role}
						<p class="mt-1 text-sm text-red-600">{errors.role}</p>
					{/if}
				</div>

				<div>
					<label for="organization" class="block text-sm font-medium text-slate-700 mb-1">
						Organization
					</label>
					<input
						id="organization"
						type="text"
						bind:value={formData.organization}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500"
						placeholder="Company, school, nonprofit, etc."
					/>
				</div>

				<div>
					<label for="location" class="block text-sm font-medium text-slate-700 mb-1">
						General Location
					</label>
					<input
						id="location"
						type="text"
						bind:value={formData.location}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500"
						placeholder="e.g., San Francisco Bay Area"
					/>
				</div>

				<div>
					<label for="connection" class="block text-sm font-medium text-slate-700 mb-1">
						Connection to Issues *
					</label>
					<select
						id="connection"
						bind:value={formData.connection}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.connection ? 'border-red-300' : ''}"
					>
						<option value="">Select your connection...</option>
						<option value="directly_affected">Directly affected by this issue</option>
						<option value="professional">Professional interest/expertise</option>
						<option value="community">Community member concerned</option>
						<option value="advocate">Long-time advocate</option>
						<option value="other">Other</option>
					</select>
					{#if errors.connection}
						<p class="mt-1 text-sm text-red-600">{errors.connection}</p>
					{/if}
				</div>

				<div>
					<label for="connection_details" class="block text-sm font-medium text-slate-700 mb-1">
						Additional Details
					</label>
					<textarea
						id="connection_details"
						bind:value={formData.connection_details}
						rows="3"
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 resize-none"
						placeholder="Tell us more about your connection to the issues you care about..."
					></textarea>
				</div>

				<div>
					<label for="visibility" class="block text-sm font-medium text-slate-700 mb-1">
						Profile Visibility
					</label>
					<select
						id="visibility"
						bind:value={formData.profile_visibility}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500"
					>
						<option value="private">Private - Only visible to me</option>
						<option value="limited">Limited - Visible to template users</option>
						<option value="public">Public - Visible to everyone</option>
					</select>
				</div>

			{:else if section === 'address'}
				<div>
					<label for="street" class="block text-sm font-medium text-slate-700 mb-1">
						Street Address *
					</label>
					<input
						id="street"
						type="text"
						bind:value={formData.street}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.street ? 'border-red-300' : ''}"
						placeholder="123 Main Street"
					/>
					{#if errors.street}
						<p class="mt-1 text-sm text-red-600">{errors.street}</p>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="city" class="block text-sm font-medium text-slate-700 mb-1">
							City *
						</label>
						<input
							id="city"
							type="text"
							bind:value={formData.city}
							class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.city ? 'border-red-300' : ''}"
							placeholder="San Francisco"
						/>
						{#if errors.city}
							<p class="mt-1 text-sm text-red-600">{errors.city}</p>
						{/if}
					</div>

					<div>
						<label for="state" class="block text-sm font-medium text-slate-700 mb-1">
							State *
						</label>
						<input
							id="state"
							type="text"
							bind:value={formData.state}
							class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.state ? 'border-red-300' : ''}"
							placeholder="CA"
							maxlength="2"
						/>
						{#if errors.state}
							<p class="mt-1 text-sm text-red-600">{errors.state}</p>
						{/if}
					</div>
				</div>

				<div class="w-1/2">
					<label for="zip" class="block text-sm font-medium text-slate-700 mb-1">
						ZIP Code *
					</label>
					<input
						id="zip"
						type="text"
						bind:value={formData.zip}
						class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-participation-primary-500 focus:border-participation-primary-500 {errors.zip ? 'border-red-300' : ''}"
						placeholder="94102"
						maxlength="10"
					/>
					{#if errors.zip}
						<p class="mt-1 text-sm text-red-600">{errors.zip}</p>
					{/if}
				</div>

				<div class="text-sm text-slate-600 bg-participation-primary-50 p-3 rounded-lg">
					<p>Your address helps us identify your congressional representatives for advocacy messaging.</p>
				</div>
			{/if}
		</div>

		<!-- Form Actions -->
		<div class="flex justify-end space-x-3 mt-8 pt-6 border-t border-slate-200">
			<Button variant="secondary" onclick={handleClose} disabled={isSubmitting}>
				Cancel
			</Button>
			<Button variant="primary" onclick={handleSave} disabled={isSubmitting}>
				{#if isSubmitting}
					<Loader2 class="w-4 h-4 mr-2 animate-spin" />
					Saving...
				{:else}
					<Save class="w-4 h-4 mr-2" />
					Save Changes
				{/if}
			</Button>
		</div>
	</div>
</SimpleModal>