<script lang="ts">
	import '../app.postcss';
	import './styles.css';
	import colors from '$lib/ui/colors';
	import weMakeChangeLogo from '$lib/assets/We Make Change Logo.png';
	import Navigation from '$components/Navigation.svelte';

	import { createEventDispatcher, onMount } from 'svelte';
	import { signIn, signOut } from '@auth/sveltekit/client';
	import type { topic } from '@prisma/client';
	import Selector from '$components/Selector.svelte';
	import Tag from '$components/Tag.svelte';
	import LoginIcon from '$components/icon/Login.svelte';
	import type { Writable } from 'svelte/store';
	import { handleSelect } from '$lib/data/select';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { routeModal } from '$lib/ui/hash';

	export let data: LayoutSchema;
	const dispatch = createEventDispatcher();

	let sessionStore: Writable<UserState>;
	onMount(async () => {
		sessionStore = (await import('$lib/data/sessionStorage')).store;
		$sessionStore.topic = $sessionStore.topic || { id: topicNames[0], type: 'topic' };
		$sessionStore.recipient = $sessionStore.recipient || {
			id: '',
			type: 'recipient'
		};
		$sessionStore.spotlight = $sessionStore.spotlight || { id: 'custom', type: 'recipient' };
		$sessionStore.email = $sessionStore.email || { id: '', type: 'email' };
		$sessionStore.template = $sessionStore.template || data.template;
		$sessionStore.show = $sessionStore.show || {
			login: false,
			share: false,
			privacyPolicy: false,
			termsOfUse: false
		};
		const hashes = window.location.hash.substring(1).split('#');
		// TODO use enum
		$sessionStore = await routeModal(hashes, $page, $sessionStore, dispatch);
	});
	$: topicNames = data.loudestTopics.map((topic: topic) => topic.name);
</script>

<main class="flex">
	<div class="grow-0 shrink-0 w-20"><Navigation /></div>
	<div class="w-full relative flex flex-col min-h-full">
		<section class="min-h-screen">
			<header
				aria-label="Popular topics list"
				class="flex px-3 bg-peacockFeather-700 items-center relative h-14"
			>
				{#if $sessionStore && $sessionStore.template}
					<Selector
						selectable={Tag}
						target="email"
						itemStyle="bg-peacockFeather-500 text-paper-500"
						selectorStyle="py-3"
						items={topicNames}
						alignment="center"
						backgroundColor={colors.peacockFeather[700]}
						bind:selectedContent={$sessionStore.topic}
						on:select={async (e) => {
							if ($sessionStore.template.primary) {
								$sessionStore.template.primary.cardList = await handleSelect(e);
								$sessionStore.template.primary.focus = {
									type: 'topic',
									item: e.detail.id,
									field: 'topic_list',
									source: 'topic',
									iterable: true
								};
								await goto('/', { noScroll: true });
							}
						}}
					/>
				{/if}
				<span class="ml-auto flex items-center h-full text-paper-500">
					{#if $page.data.session}
						{#if $page.data.session.user?.image}
							<img src={$page.data.session.user.image} alt="avatar" class="h-10 w-10" />
						{/if}

						<button on:click={() => signOut({ callbackUrl: '/', redirect: false })}>
							Sign out
						</button>
					{:else}
						<span class="whitespace-nowrap text-xs self-end justify-self-end -mr-4">Sign in</span>
						<button
							class="w-10 -mt-2"
							on:click={() => signIn({ callbackUrl: '/', redirect: false })}
						>
							<LoginIcon />
						</button>
					{/if}
				</span>
			</header>
			<slot />
		</section>
		<!-- TODO aria labels for footer -->
		<footer class="bg-gray-900 text-white py-6 static bottom-0 w-full z-10">
			<div class="container mx-auto flex flex-wrap items-center justify-center px-4">
				<div class="mb-4 md:mb-0">
					<div class="flex justify-center md:justify-start">
						<h4 class="font-bold text-lg mb-2 mr-2">Communique</h4>

						<span class="border-l border-gray-600 pl-2 w-1/2">
							<p class="text-sm text-gray-400">
								Changing the world is too important to be left unread.
							</p>
						</span>
					</div>
				</div>
				<!-- <div class="w-full md:w-1/3 text-center mb-4 md:mb-0">
			<h4 class="font-bold text-lg mb-2">Get Involved</h4>
			<ul class="list-reset">
				<li><a href="#" class="text-teal-400 hover:text-teal-500">Find legislators</a></li>
				<li><a href="#" class="text-teal-400 hover:text-teal-500">Codebase</a></li>
				<li><a href="#" class="text-teal-400 hover:text-teal-500">Donate</a></li>
			</ul>
		</div>
		<div class="w-full md:w-1/3 text-center md:text-right">
			<h4 class="font-bold text-lg mb-2">Connect</h4>
			<ul class="list-reset">
				<li><a href="#" class="text-teal-400 hover:text-teal-500">Discord</a></li>
				<li><a href="#" class="text-teal-400 hover:text-teal-500">Twitter</a></li>
				<li><a href="#" class="text-teal-400 hover:text-teal-500">Instagram</a></li>
			</ul>
		</div>
	</div> -->

				<div class="text-gray-400 text-sm mt-6 flex justify-center items-center">
					<span class="mr-2">&copy; 2023 Communique. All rights reserved.</span>

					<span class="border-l border-gray-600 pl-2 ml-2">
						<a
							href="#terms-of-use"
							on:click={() => ($sessionStore.show.termsOfUse = true)}
							class="text-teal-400 hover:text-teal-500">Terms of Use</a
						>
					</span>
					<span class="border-l border-gray-600 pl-2 ml-2">
						<a
							href="#privacy-policy"
							on:click={() => ($sessionStore.show.privacyPolicy = true)}
							class="text-teal-400 hover:text-teal-500">Privacy Policy</a
						>
					</span>
					<span class="border-l border-gray-600 pl-2 ml-2">
						<a href="https://www.wemakechange.org/" target="_blank" class="self-start">
							<img src={weMakeChangeLogo} alt="We Make Change Logo" class="w-[10.125rem]" />
						</a>
					</span>
				</div>
			</div>
		</footer>
	</div>
</main>

<style lang="scss">
</style>
