<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let type: 'text' | 'search' | 'email',
		name: string,
		placeholder: string,
		style: string,
		tagStyle: string;
	export let backgroundColor = 'transparent';
	export let tagList: (string | FormDataEntryValue)[] = [];
	export let inputStyle =
		'rounded bg-larimarGreen-500 shadow-artistBlue shadow-card w-0 h-0 focus:p-0.5';
	export let addIconStyle =
		'add absolute bg-peacockFeather-600 h-6 w-6 text-2xl leading-6 font-bold';

	let inputVisible: boolean = false;
	let deleteVisible: boolean = false;

	let inputField: HTMLInputElement;

	const dispatch = createEventDispatcher();

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

<div
	class="px-3 py-1 rounded h-fit flex flex-nowrap items-center justify-center cursor-pointer {style}"
>
	<ul
		class="inline-flex flex-row flex-wrap items-center"
		aria-label="{name} list"
		aria-describedby="List of {name}s with an add button"
		on:mouseenter={() => (deleteVisible = true)}
		on:mouseleave={() => (deleteVisible = false)}
		on:click|preventDefault={() => {
			inputVisible = true;
		}}
		on:keypress={(e) => {
			if (e.key == 'Enter') {
				inputVisible = true;
			}
		}}
	>
		{#each tagList as tag}
			<li class="relative mx-2 {tagStyle}">
				<button
					type="button"
					on:click={(e) => {
						tagList = tagList.filter((item) => item != tag);
						if (!inputVisible) e.stopImmediatePropagation();
					}}
					on:focus={() => (deleteVisible = true)}
					on:blur={() => (deleteVisible = false)}
					class="delete absolute -top-1 -left-2 rounded-full bg-amber-600 w-4 h-4"
					class:show={deleteVisible}
					aria-label={`Remove ${name}`}
				>
					<!-- plus sign -->
					&#215;
				</button>
				{tag}
			</li>
		{/each}

		<li class="flex gap-3 justify-center flex-wrap items-center">
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
					inputVisible = false;
					e.currentTarget.value = '';
					inputValueWidth = placeholderWidth * 1.25;
				}}
				on:focus={() => (inputVisible = true)}
				on:keydown|self={(e) => {
					// clear earlier validation errors
					inputField.setCustomValidity('');
					if (e.key == 'Enter') {
						e.preventDefault();
						addTag(inputField.value);
						inputValueWidth = placeholderWidth * 1.25;
					}
				}}
				on:input={() => {
					const currentValueWidth = context.measureText(inputField.value).width;
					if (currentValueWidth > placeholderWidth) {
						inputValueWidth = currentValueWidth * 1.25;
					} else {
						inputValueWidth = placeholderWidth * 1.25;
					}
				}}
				style="width: {inputVisible ? inputValueWidth : 0}px;"
				class={inputStyle}
				class:ml-2={tagList.length > 0 && inputVisible}
				class:mr-1={tagList.length > 0 && inputVisible}
				class:show={inputVisible}
				{type}
			/>
		</li>
	</ul>
	<button
		name={`Add ${name}`}
		aria-label="Add button for {name}s"
		on:click|preventDefault={() => {
			inputVisible ? addTag(inputField.value) : (inputVisible = true);
		}}
		class="flex justify-center items-center relative"
	>
		<span title={`Add ${name}`} class="flex" class:active={inputVisible}>
			<slot />
			<icon class={addIconStyle} />
		</span>
	</button>
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
