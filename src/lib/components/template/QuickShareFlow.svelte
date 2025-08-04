<script lang="ts">
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut, elasticOut } from 'svelte/easing';
	import { 
		Share2,
		Copy,
		CheckCircle2,
		Twitter,
		Facebook,
		Linkedin,
		MessageCircle,
		Mail,
		QrCode,
		Zap,
		Users,
		TrendingUp,
		ExternalLink,
		Sparkles
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	
	interface Props {
		templateId: string;
		title: string;
		slug: string;
		onClose?: () => void;
	}
	
	let { templateId, title, slug, onClose }: Props = $props();
	
	// State
	let activeTab = $state<'quick' | 'email' | 'qr'>('quick');
	let copied = $state(false);
	let emailSent = $state(false);
	let qrCodeUrl = $state('');
	let emailList = $state('');
	let customMessage = $state('');
	let isSharing = $state(false);
	let shareCount = $state(0);
	
	// Generate share URL
	const shareUrl = $derived(`https://communique.app/${slug}`);
	const shortUrl = $derived(`cmq.app/${slug.slice(0, 8)}`);
	
	// Social share URLs
	const shareUrls = $derived({
		twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} - Take action now!`)}&url=${encodeURIComponent(shareUrl)}&hashtags=CivicEngagement`,
		facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
		linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
		whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title}: ${shareUrl}`)}`,
		telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`
	});
	
	// Generate QR code on mount
	onMount(async () => {
		try {
			// Generate actual QR code
			qrCodeUrl = await QRCode.toDataURL(shareUrl, {
				width: 256,
				margin: 2,
				color: {
					dark: '#1f2937',
					light: '#ffffff'
				}
			});
		} catch (error) {
			console.error('Failed to generate QR code:', error);
			// Fallback to placeholder
			qrCodeUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y5ZmFmYiIvPjx0ZXh0IHg9IjE1MCIgeT0iMTUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmI3MjgwIiBmb250LXNpemU9IjE0Ij5RUiBDb2RlPC90ZXh0Pjwvc3ZnPg==';
		}
		
		// Simulate initial share count
		shareCount = Math.floor(Math.random() * 50 + 10);
	});
	
	// Copy link to clipboard
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			shareCount++;
			setTimeout(() => copied = false, 2000);
		} catch (error) {
			console.error('Failed to copy:', error);
		}
	}
	
	// Track social share
	function trackShare(platform: string) {
		shareCount++;
		// In production, track analytics here
	}
	
	// Send email invites
	async function sendEmailInvites() {
		if (!emailList.trim()) return;
		
		isSharing = true;
		try {
			// Parse emails
			const emails = emailList
				.split(/[,\n]/)
				.map(e => e.trim())
				.filter(e => e.includes('@'));
			
			// In production, send actual emails via API
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			emailSent = true;
			shareCount += emails.length;
			
			setTimeout(() => {
				emailSent = false;
				emailList = '';
				customMessage = '';
			}, 3000);
		} finally {
			isSharing = false;
		}
	}
	
	// Share strategies
	const shareStrategies = [
		{
			icon: Users,
			title: 'Share with Friends',
			description: 'Personal networks have 5x higher engagement',
			color: 'blue'
		},
		{
			icon: MessageCircle,
			title: 'Post in Groups',
			description: 'Community groups amplify reach by 10x',
			color: 'green'
		},
		{
			icon: TrendingUp,
			title: 'Peak Hours',
			description: 'Share 7-9pm for maximum visibility',
			color: 'purple'
		}
	];
</script>

<!-- Share Modal -->
<div 
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	onclick={onClose}
>
	<!-- Modal Content -->
	<div 
		class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
		onclick={(e) => e.stopPropagation()}
		in:scale={{ duration: 300, easing: elasticOut, start: 0.9 }}
	>
		<!-- Header -->
		<div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-2xl font-bold mb-2">Share Your Template</h2>
					<p class="text-blue-100">Help spread the message and drive change</p>
				</div>
				<div class="text-right">
					<div class="text-3xl font-bold">{shareCount}</div>
					<div class="text-sm text-blue-100">shares</div>
				</div>
			</div>
		</div>
		
		<!-- Tabs -->
		<div class="flex border-b border-gray-200">
			<button
				class="flex-1 px-4 py-3 text-sm font-medium transition-colors {
					activeTab === 'quick'
						? 'text-blue-600 border-b-2 border-blue-600'
						: 'text-gray-600 hover:text-gray-900'
				}"
				onclick={() => activeTab = 'quick'}
			>
				Quick Share
			</button>
			<button
				class="flex-1 px-4 py-3 text-sm font-medium transition-colors {
					activeTab === 'email'
						? 'text-blue-600 border-b-2 border-blue-600'
						: 'text-gray-600 hover:text-gray-900'
				}"
				onclick={() => activeTab = 'email'}
			>
				Email Invite
			</button>
			<button
				class="flex-1 px-4 py-3 text-sm font-medium transition-colors {
					activeTab === 'qr'
						? 'text-blue-600 border-b-2 border-blue-600'
						: 'text-gray-600 hover:text-gray-900'
				}"
				onclick={() => activeTab = 'qr'}
			>
				QR Code
			</button>
		</div>
		
		<!-- Content -->
		<div class="p-6">
			{#if activeTab === 'quick'}
				<!-- Quick Share Options -->
				<div class="space-y-4">
					<!-- Copy Link -->
					<div class="bg-gray-50 rounded-lg p-4">
						<div class="flex items-center justify-between gap-3">
							<div class="flex-1">
								<p class="text-sm font-medium text-gray-900">Share Link</p>
								<p class="text-xs text-blue-600 mt-1">{shortUrl}</p>
							</div>
							<button
								onclick={copyLink}
								class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
							>
								{#if copied}
									<CheckCircle2 class="w-4 h-4" />
									Copied!
								{:else}
									<Copy class="w-4 h-4" />
									Copy
								{/if}
							</button>
						</div>
					</div>
					
					<!-- Social Platforms -->
					<div>
						<h3 class="text-sm font-medium text-gray-700 mb-3">Share on Social Media</h3>
						<div class="grid grid-cols-2 gap-3">
							<a
								href={shareUrls.twitter}
								target="_blank"
								rel="noopener noreferrer"
								onclick={() => trackShare('twitter')}
								class="flex items-center justify-center gap-2 p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all hover:scale-105"
							>
								<Twitter class="w-5 h-5" />
								<span class="font-medium">Twitter</span>
							</a>
							<a
								href={shareUrls.facebook}
								target="_blank"
								rel="noopener noreferrer"
								onclick={() => trackShare('facebook')}
								class="flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:scale-105"
							>
								<Facebook class="w-5 h-5" />
								<span class="font-medium">Facebook</span>
							</a>
							<a
								href={shareUrls.linkedin}
								target="_blank"
								rel="noopener noreferrer"
								onclick={() => trackShare('linkedin')}
								class="flex items-center justify-center gap-2 p-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-all hover:scale-105"
							>
								<Linkedin class="w-5 h-5" />
								<span class="font-medium">LinkedIn</span>
							</a>
							<a
								href={shareUrls.whatsapp}
								target="_blank"
								rel="noopener noreferrer"
								onclick={() => trackShare('whatsapp')}
								class="flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:scale-105"
							>
								<MessageCircle class="w-5 h-5" />
								<span class="font-medium">WhatsApp</span>
							</a>
						</div>
					</div>
					
					<!-- Share Tips -->
					<div class="bg-blue-50 rounded-lg p-4">
						<h4 class="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
							<Sparkles class="w-4 h-4" />
							Pro Tips for Maximum Impact
						</h4>
						<div class="space-y-2">
							{#each shareStrategies as strategy}
								<div class="flex items-start gap-3">
									<div class="w-8 h-8 bg-{strategy.color}-100 rounded-full flex items-center justify-center flex-shrink-0">
										<svelte:component this={strategy.icon} class="w-4 h-4 text-{strategy.color}-600" />
									</div>
									<div>
										<p class="text-sm font-medium text-gray-900">{strategy.title}</p>
										<p class="text-xs text-gray-600">{strategy.description}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{:else if activeTab === 'email'}
				<!-- Email Invite -->
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Email Addresses
						</label>
						<textarea
							bind:value={emailList}
							placeholder="Enter email addresses separated by commas or new lines"
							rows="4"
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
					
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">
							Personal Message (Optional)
						</label>
						<textarea
							bind:value={customMessage}
							placeholder="Add a personal note to your invitation"
							rows="3"
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
					
					<button
						onclick={sendEmailInvites}
						disabled={!emailList.trim() || isSharing}
						class="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{#if isSharing}
							<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
							Sending...
						{:else if emailSent}
							<CheckCircle2 class="w-5 h-5" />
							Sent Successfully!
						{:else}
							<Mail class="w-5 h-5" />
							Send Email Invites
						{/if}
					</button>
					
					<!-- Email Template Preview -->
					<div class="bg-gray-50 rounded-lg p-4">
						<h4 class="text-xs font-medium text-gray-600 mb-2">Preview</h4>
						<div class="bg-white rounded border border-gray-200 p-3 text-sm">
							<p class="font-medium text-gray-900">Join me in taking action!</p>
							{#if customMessage}
								<p class="text-gray-600 mt-2">{customMessage}</p>
							{/if}
							<p class="text-gray-600 mt-2">
								I found this important message that needs our support: "{title}"
							</p>
							<a href={shareUrl} class="text-blue-600 hover:underline mt-2 inline-block">
								{shortUrl} →
							</a>
						</div>
					</div>
				</div>
			{:else if activeTab === 'qr'}
				<!-- QR Code -->
				<div class="text-center space-y-4">
					{#if qrCodeUrl}
						<div class="inline-block p-4 bg-white rounded-xl shadow-lg border border-gray-200">
							<img src={qrCodeUrl} alt="QR Code" class="w-64 h-64" />
						</div>
						
						<div>
							<p class="text-sm font-medium text-gray-900 mb-2">Scan to Share</p>
							<p class="text-xs text-gray-600">
								Perfect for events, flyers, or in-person sharing
							</p>
						</div>
						
						<div class="flex gap-3 justify-center">
							<button
								onclick={() => {
									const link = document.createElement('a');
									link.download = `${slug}-qr-code.png`;
									link.href = qrCodeUrl;
									link.click();
								}}
								class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
							>
								Download QR Code
							</button>
							<button
								onclick={() => window.print()}
								class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
							>
								Print
							</button>
						</div>
					{:else}
						<div class="py-12">
							<QrCode class="w-16 h-16 text-gray-300 mx-auto mb-4" />
							<p class="text-gray-500">Generating QR code...</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
		
		<!-- Footer -->
		<div class="bg-gray-50 px-6 py-4 flex items-center justify-between">
			<a
				href={shareUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
			>
				<ExternalLink class="w-4 h-4" />
				View Template
			</a>
			<button
				onclick={onClose}
				class="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
			>
				Close
			</button>
		</div>
	</div>
</div>

<style>
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>