<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let type: 'text' | 'search' | 'email',
		name: string,
		placeholder: string,
		style: string,
		tagStyle: string,
		autocomplete: boolean = false;
	export let tagList: string[] = [];
	export let searchResults: string[] = [];
	export let inputStyle =
		'rounded bg-larimarGreen-500 shadow-artistBlue shadow-card w-0 h-0 focus:p-1 focus:ml-2 focus:mr-1';
	export let addIconStyle =
		'add absolute bg-peacockFeather-600 h-6 w-6 text-2xl leading-6 font-bold';

	let inputVisible: boolean = false;
	let deleteVisible: FlagMap = {}; // A map to hold visibility states

	let inputField: HTMLInputElement;
	let deleteButtons: ButtonElementMap = {}; // A map to hold the delete buttons

	const dispatch = createEventDispatcher();
	$: console.log(searchResults);
	function addTag(tag: string) {
		if (!inputField.checkValidity() || inputField.value == '') {
			inputField.reportValidity();
			return;
		}
		inputField.value = '';
		if (tagList.includes(tag)) {
			inputField.setCustomValidity(
				`${name.replace(name[0], name[0].toLocaleUpperCase())} already entered.`
			);
			inputField.reportValidity();
		} else {
			tagList = [...tagList, tag];
			dispatch('add', tag);
		}
	}

	async function handleInput() {
		const currentValueWidth = context.measureText(inputField.value).width + 8;
		if (currentValueWidth > placeholderWidth) {
			inputValueWidth = currentValueWidth;
		} else {
			inputValueWidth = placeholderWidth;
		}
		if (autocomplete && inputField.value.length > 2) {
			dispatch('autocomplete', inputField.value);
		}
	}

	$: if (inputVisible) inputField.focus();

	let canvas: HTMLCanvasElement, context: CanvasRenderingContext2D;
	let inputValueWidth: number, placeholderWidth: number;
	onMount(() => {
		canvas = document.createElement('canvas');
		context = canvas.getContext('2d') as CanvasRenderingContext2D;
		if (context) {
			// TODO measure input width smoothly using in-dom placeholder
			context.font = getComputedStyle(inputField).font;
			inputValueWidth = context.measureText(placeholder).width * 1.25;
			placeholderWidth = inputValueWidth;
		}
	});
</script>

<div class="px-3 py-1 rounded h-fit flex flex-nowrap items-center justify-center z-10 {style}">
	<form
		autocomplete="off"
		class="flex"
		on:submit|preventDefault={() => {
			inputVisible ? addTag(inputField.value) : (inputVisible = true);
		}}
	>
		<ul
			class="inline-flex flex-row flex-wrap items-center"
			aria-label="{name} list"
			aria-describedby="List of {name}s with an add button"
		>
			{#each tagList as tag}
				<li class="relative mx-2 {tagStyle}">
					<span
						class="relative"
						style="width: 100%; height: 100%;"
						on:mouseenter={() => (deleteVisible[tag] = true)}
						on:mouseleave={() => (deleteVisible[tag] = false)}
						on:mousemove={(event) => {
							const containerRect = event.currentTarget.getBoundingClientRect();

							// Make sure the button stays within the boundaries
							let deleteX = Math.min(
								event.clientX - containerRect.left - 10,
								containerRect.width - 10
							);
							let deleteY = Math.min(
								event.clientY - containerRect.top - 10,
								containerRect.height - 10
							);

							deleteX = Math.max(deleteX, 0); // To keep it within left boundary
							deleteY = Math.max(deleteY, 0); // To keep it within top boundary

							deleteButtons[tag].style.left = `${deleteX}px`;
							deleteButtons[tag].style.top = `${deleteY}px`;
						}}
					>
						<button
							bind:this={deleteButtons[tag]}
							type="button"
							on:click|stopPropagation={(e) => {
								tagList = tagList.filter((item) => item != tag);
								if (inputVisible) inputField.focus();
							}}
							on:focus={() => (deleteVisible[tag] = true)}
							on:blur={() => (deleteVisible[tag] = false)}
							class="delete absolute -top-1 -left-2 rounded-full bg-amber-600 w-4 h-4"
							class:show={deleteVisible[tag]}
							aria-label={`Remove ${name}`}
						>
							<!-- x sign -->
							&#215;
						</button>
						{tag}
					</span>
				</li>
			{/each}

			<li class="flex gap-3 justify-center flex-wrap items-center relative">
				<input
					required={tagList.length <= 0}
					{name}
					role="textbox"
					aria-label="{name} input"
					aria-describedby="Add a {name} here"
					{placeholder}
					inputmode={type}
					bind:this={inputField}
					on:blur={(e) => {
						if (!Object.keys(deleteVisible).some((k) => deleteVisible[k])) {
							inputVisible = false;
							e.currentTarget.value = '';
							inputValueWidth = placeholderWidth;
							searchResults = [];
						}
					}}
					on:focus={() => (inputVisible = true)}
					on:keydown|self={(e) => {
						// clear earlier validation errors
						inputField.setCustomValidity('');
						if (e.key == 'Enter') {
							e.preventDefault();
							addTag(inputField.value);
							inputValueWidth = placeholderWidth;
						}
					}}
					on:input={() => {
						handleInput();
					}}
					style="width: {inputVisible ? inputValueWidth : 0}px;"
					class={inputStyle}
					class:show={inputVisible}
					{type}
				/>
				<ul class="autocomplete flex flex-col">
					{#each searchResults as result}
						<li class="relative">{result.id}</li>
					{/each}
				</ul>
			</li>
		</ul>

		<button
			type="submit"
			name={`Add ${name}`}
			aria-label="Add button for {name}s"
			class="flex justify-center items-center relative"
		>
			<span title={`Add ${name}`} class="flex" class:active={inputVisible}>
				<slot />
				<icon class={addIconStyle} />
			</span>
		</button>
	</form>
</div>

<style lang="scss">
	input {
		transition: all 0.2s;
		font-size: 1rem;
		color: black;
	}
	button span {
		filter: drop-shadow(1px 1px 0.5px rgb(0 0 0 / 0.4));
		transform: scale(0.97);
		transition: 0.1s all ease-out;
	}
	button .active {
		transform: scale(1);
	}
	button:hover span {
		filter: drop-shadow(2px 2px 1px rgb(0 0 0 / 0.4));
		transform: scale(1);
		transition: 0.1s all ease-in;
	}
	.add {
		bottom: 0;
		right: 0;
		border-radius: 9999px; // render circle
		color: #fff;
		opacity: 75%;
		transform: scale(0.75);
		transition: all 0.2s ease-in;
	}
	span:hover > .add {
		opacity: 85%;
		transform: scale(0.85);
		transition: all 0.2s ease-out;
	}
	.add:after {
		content: '+';
	}
	.delete {
		opacity: 0;
		transform: scale(0);
		transition: opacity 0.2s, transform 0.2s, visibility 0s 0.2s;
		color: #fff;
		font-size: 1rem;
		line-height: 1rem;
		opacity: 95%;
		text-shadow: rgba(0, 0, 0, 0.25) 0 2px 2px;
		&.show:hover {
			transform: scale(1.35);
			text-shadow: rgba(0, 0, 0, 0.25) 0 1px 1px;
		}
		&.show {
			transform: scale(1);
			transition: opacity 0.2s, transform 0.2s, visibility 0s 0.2s;
		}
	}

	.autocomplete {
		position: absolute;
		top: 100%;
		right: 0;
		max-height: 200px;
		overflow-y: auto;
		background-color: #fff;
		border-radius: 4px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);

		li {
			padding: 4px;
			cursor: pointer;

			&:hover {
				background-color: #eee;
			}
		}
	}

	.show {
		visibility: visible;
		opacity: 1;
	}
	input.show {
		width: 4.55rem;
		height: 1.5rem;
		transition: all 0.2s;
	}
</style>
