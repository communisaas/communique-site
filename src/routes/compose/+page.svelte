<script lang="ts">
	import TagInput from '$components/input/Tag.svelte';
	import Editor from '$components/input/Editor.svelte';
	import AddRecipient from '$components/icon/Recipient.svelte';
	import AddTopic from '$components/icon/Topic.svelte';
	import Post from '$components/icon/Post.svelte';
	import Reader from '$components/Reader.svelte';

	import { writable, type Writable } from 'svelte/store';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { createEventDispatcher, onMount } from 'svelte';
	import { routeModal } from '$lib/ui/hash';
	import { goto } from '$app/navigation';
	import Modal from '$components/Modal.svelte';
	import modal, { handlePopover } from '$lib/ui/modal';

	export let data: ComposeSchema;

	let composed: Writable<string> = writable('');
	let postButtonHovered = writable(false);
	let sessionStore: Writable<UserState>;

	const dispatch = createEventDispatcher();

	$: recipientEmails = [] as (string | FormDataEntryValue)[];
	$: topics = [] as (string | FormDataEntryValue)[];

	onMount(async () => {
		sessionStore = (await import('$lib/data/sessionStorage')).store;
		const hashes = window.location.hash.substring(1).split('#');
		// TODO use enum
		await routeModal(hashes, $page, $sessionStore, dispatch);
	});

	let modalMapping: ModalMap = {
		privacyPolicy: {
			component: Reader,
			props: () => ({ item: $page.data.privacyPolicy, inModal: true })
		},
		termsOfUse: {
			component: Reader,
			props: () => ({ item: $page.data.termsOfUse, inModal: true })
		}
	};
</script>

<svelte:head>
	<title>Compose | Communique</title>
	<meta name="description" content="Write & share email templates!" />
</svelte:head>

<section class="py-8 min-h-screen">
	<form
		class="flex flex-col gap-y-5 rounded-full"
		method="POST"
		action="?/publish"
		aria-label="Compose form"
		aria-describedby="Add topics, recipients, a subject line, and email body here"
		use:enhance={async ({ form, data: post, action, cancel }) => {
			// `form` is the `<form>` element
			// `data` is its `FormData` object
			// `action` is the URL to which the form is posted
			// `cancel()` will prevent the submission
			for (const [tagName, list] of Object.entries({
				recipient_list: recipientEmails,
				topic_list: topics
			})) {
				post.set(tagName, list.join('␞'));
			}

			const letterInput = document.querySelector("input[name='body']");
			// TODO validate & sanitize email body, use openAI moderation API + cheapest model to generate a shortID

			// const webProfile = (
			// 	await FingerprintJS.load({
			// 		apiKey: data.profilerKey,
			// 		endpoint: data.profilerURL,
			// 		scriptUrlPattern: data.profilerScriptURL
			// 	})
			// ).get();

			// post.set('profileRequestID', (await webProfile).requestId);

			return async ({ result, update }) => {
				if (result.status == 200) {
					// TODO submit confirmation
					recipientEmails = [];
					topics = [];
					update();
				}

				// `result` is an `ActionResult` object
				// `update` runs default reset after form submission
			};
		}}
	>
		<div class="ml-20 mr-20 flex flex-col w-fit h-full max-md:w-18 gap-x-20 gap-y-3">
			<span class="flex flex-row flex-wrap gap-5">
				<TagInput
					bind:tagList={recipientEmails}
					type="email"
					name="recipient"
					placeholder="Recipient"
					style="h-14 w-fit bg-larimarGreen-700"
					tagStyle="text-xs px-1 py-1 rounded bg-peacockFeather-600 text-paper-500"
				>
					<icon class="w-12 inline-block m-1"><AddRecipient /></icon>
				</TagInput>
				<TagInput
					bind:tagList={topics}
					type="text"
					name="topic"
					placeholder="Topic"
					style="h-14 w-fit bg-larimarGreen-700"
					tagStyle="text-xs px-1 py-1 rounded bg-peacockFeather-500 text-paper-500"
				>
					<icon class="w-12 inline-block m-1"><AddTopic /></icon>
				</TagInput>
			</span>

			<span class="px-1 py-1 w-fit rounded bg-larimarGreen-700">
				<input
					required
					type="text"
					aria-label="Subject line"
					aria-describedby="Enter a subject line for your email"
					on:keypress={(e) => {
						if (e.key == 'Enter') {
							e.preventDefault();
						}
					}}
					name="subject"
					placeholder="Subject"
					class="w-42 h-fit p-0.5 rounded"
				/>
			</span>
		</div>

		<span class="py-8">
			<Editor apiKey={data.editorKey} content={composed} />
		</span>

		<button
			type="submit"
			name="post"
			title="Post"
			class="flex flex-row items-center gap-4 ml-20 px-3 py-2 w-28 h-14 rounded bg-larimarGreen-700 text-white"
			aria-label="Post button"
			on:mouseenter={() => ($postButtonHovered = true)}
			on:touchstart={() => ($postButtonHovered = true)}
			on:focus={() => ($postButtonHovered = true)}
			on:mouseleave={() => ($postButtonHovered = false)}
			on:touchend={() => ($postButtonHovered = false)}
			on:blur={() => ($postButtonHovered = false)}
		>
			<span><Post hovered={$postButtonHovered} /></span>Post
		</button>
	</form>
</section>

{#if $sessionStore && $sessionStore.hasOwnProperty('show')}
	<div use:modal>
		{#each Object.keys($sessionStore.show) as modal (modal)}
			{#if $sessionStore.show[modal] && modalMapping.hasOwnProperty(modal)}
				<Modal
					popoverComponent={modalMapping[modal].component}
					props={modalMapping[modal].props()}
					on:popover={async (e) => {
						await handlePopover(e, sessionStore, modal, '/compose');
						console.log('?');
					}}
				/>
			{/if}
		{/each}
	</div>
{/if}

<style>
	:global(.mce-content-body) {
		padding: 0.125rem;
	}
	:global(.mce-content-body::before) {
		padding: calc(0.125rem / 2) 0.125rem;
	}

	button[type='submit'] span {
		transform: scale(0.9);
		transition: 0.1s all ease-out;
	}

	button[type='submit']:hover span {
		transform: scale(1);
		transition: 0.1s all ease-in;
	}
</style>
