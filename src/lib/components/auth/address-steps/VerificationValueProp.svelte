<script lang="ts">
	import { Shield, MessageSquare, TrendingUp, Users, Lock, Award } from '@lucide/svelte';

	interface Props {
		/** Variant style */
		variant?: 'full' | 'compact' | 'inline';
		/** Show statistics */
		showStats?: boolean;
		/** Show privacy section */
		showPrivacy?: boolean;
	}

	let { variant = 'full', showStats = true, showPrivacy = true }: Props = $props();

	const stats = [
		{
			icon: TrendingUp,
			value: '3x',
			label: 'Higher Response Rate',
			description: 'Verified messages receive priority attention',
			color: 'green'
		},
		{
			icon: Users,
			value: '87%',
			label: 'Offices Prioritize',
			description: 'Congressional staff read verified mail first',
			color: 'blue'
		},
		{
			icon: MessageSquare,
			value: '2-3x',
			label: 'Longer Responses',
			description: 'Verified constituents get detailed replies',
			color: 'indigo'
		},
		{
			icon: Award,
			value: '94%',
			label: 'Trust Score',
			description: 'Verified messages rated as credible',
			color: 'purple'
		}
	];

	const colorClasses = {
		green: {
			bg: 'bg-green-50',
			border: 'border-green-200',
			text: 'text-green-700',
			textDark: 'text-green-900'
		},
		blue: {
			bg: 'bg-blue-50',
			border: 'border-blue-200',
			text: 'text-blue-700',
			textDark: 'text-blue-900'
		},
		indigo: {
			bg: 'bg-indigo-50',
			border: 'border-indigo-200',
			text: 'text-indigo-700',
			textDark: 'text-indigo-900'
		},
		purple: {
			bg: 'bg-purple-50',
			border: 'border-purple-200',
			text: 'text-purple-700',
			textDark: 'text-purple-900'
		}
	};
</script>

{#if variant === 'full'}
	<div class="space-y-8">
		<!-- Hero Value Prop -->
		<div class="text-center">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
			>
				<Shield class="h-8 w-8 text-white" />
			</div>
			<h2 class="mb-3 text-3xl font-bold text-slate-900">Why Verify Your Identity?</h2>
			<p class="mx-auto max-w-2xl text-lg text-slate-600">
				Congressional offices receive thousands of messages daily. Verification proves you're a real
				constituent—not a bot, not spam, not someone from another district.
			</p>
		</div>

		<!-- Impact Statistics -->
		{#if showStats}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each stats as stat}
					{@const colors = colorClasses[stat.color as keyof typeof colorClasses]}
					{@const Icon = stat.icon}
					<div
						class="rounded-xl border {colors.border} {colors.bg} p-5 text-center shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="mb-3 flex justify-center">
							<div class="rounded-full bg-white p-2 shadow-sm">
								<Icon class="h-6 w-6 {colors.text}" />
							</div>
						</div>
						<div class="mb-1 text-3xl font-bold {colors.textDark}">
							{stat.value}
						</div>
						<p class="mb-2 text-sm font-semibold {colors.textDark}">
							{stat.label}
						</p>
						<p class="text-xs {colors.text}">
							{stat.description}
						</p>
					</div>
				{/each}
			</div>
		{/if}

		<!-- What Congress Sees -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
				<MessageSquare class="h-5 w-5 text-blue-600" />
				What Congressional Offices See
			</h3>
			<div class="space-y-3">
				<div class="flex items-start gap-3 rounded-lg bg-green-50 p-4">
					<div class="mt-0.5 rounded-full bg-green-100 p-1">
						<Shield class="h-4 w-4 text-green-700" />
					</div>
					<div class="flex-1">
						<p class="font-medium text-green-900">✓ Verified Constituent</p>
						<p class="mt-1 text-sm text-green-700">
							From Congressional District [Your District Number]
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
					<div class="mt-0.5 rounded-full bg-blue-100 p-1">
						<Award class="h-4 w-4 text-blue-700" />
					</div>
					<div class="flex-1">
						<p class="font-medium text-blue-900">Reputation Score: High</p>
						<p class="mt-1 text-sm text-blue-700">Based on verified civic participation history</p>
					</div>
				</div>
				<div class="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
					<div class="mt-0.5 rounded-full bg-slate-100 p-1">
						<Lock class="h-4 w-4 text-slate-700" />
					</div>
					<div class="flex-1">
						<p class="font-medium text-slate-900">Your Message Content</p>
						<p class="mt-1 text-sm text-slate-600">
							Encrypted delivery ensures only the congressional office can read it
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Privacy Guarantee -->
		{#if showPrivacy}
			<div
				class="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm"
			>
				<div class="flex items-start gap-4">
					<div class="rounded-full bg-green-100 p-3 shadow-sm">
						<Lock class="h-6 w-6 text-green-700" />
					</div>
					<div class="flex-1 space-y-3">
						<h3 class="text-lg font-semibold text-slate-900">Your Privacy is Our Foundation</h3>
						<div class="space-y-2 text-sm text-slate-700">
							<p class="flex items-start gap-2">
								<span class="mt-0.5 font-bold text-green-600">✓</span>
								<span>
									<span class="font-semibold">Your address never leaves this device.</span> We use cryptographic
									proofs to verify your congressional district without ever storing your location.
								</span>
							</p>
							<p class="flex items-start gap-2">
								<span class="mt-0.5 font-bold text-green-600">✓</span>
								<span>
									<span class="font-semibold">We don't store identity documents.</span> Verification
									happens through trusted third-party partners who don't share your personal data with
									us.
								</span>
							</p>
							<p class="flex items-start gap-2">
								<span class="mt-0.5 font-bold text-green-600">✓</span>
								<span>
									<span class="font-semibold">What we store:</span> Verification status (yes/no) + timestamp.
									That's it. No names, no addresses, no documents.
								</span>
							</p>
							<p class="flex items-start gap-2">
								<span class="mt-0.5 font-bold text-green-600">✓</span>
								<span>
									<span class="font-semibold">Congressional offices see:</span> "✓ Verified constituent
									from District X" – never your personal information.
								</span>
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else if variant === 'compact'}
	<div class="space-y-4">
		<div class="text-center">
			<h3 class="mb-2 text-lg font-semibold text-slate-900">Verified Messages Get Results</h3>
			<p class="text-sm text-slate-600">
				Congressional offices prioritize verified constituent communications
			</p>
		</div>

		{#if showStats}
			<div class="grid grid-cols-2 gap-3">
				<div class="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
					<div class="mb-1 text-2xl font-bold text-green-700">3x</div>
					<p class="text-xs font-medium text-green-900">Higher Response Rate</p>
				</div>
				<div class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
					<div class="mb-1 text-2xl font-bold text-blue-700">87%</div>
					<p class="text-xs font-medium text-blue-900">Offices Prioritize</p>
				</div>
			</div>
		{/if}

		{#if showPrivacy}
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
				<div class="flex items-start gap-2">
					<Lock class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
					<p class="text-xs text-slate-700">
						<span class="font-semibold">100% private:</span> Your address never stored. Congress sees
						only verification status.
					</p>
				</div>
			</div>
		{/if}
	</div>
{:else if variant === 'inline'}
	<div class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
		<Shield class="h-5 w-5 flex-shrink-0 text-blue-600" />
		<div class="flex-1 text-sm">
			<span class="font-semibold text-blue-900"
				>Verified messages get 3x higher response rates.</span
			>
			<span class="text-blue-700">Your privacy is protected—we never store your address.</span>
		</div>
	</div>
{/if}
