<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable, derived } from 'svelte/store';

	let content: HTMLDivElement;
	let clipboardArea: SVGRectElement;
	let contentHeight: number;

	let resizeObserver: ResizeObserver;

	let baseFontSize = writable(0.75);
	onMount(() => {
		resizeObserver = new ResizeObserver(() => {
			let clipboardHeight = clipboardArea?.getBBox().height;
			contentHeight = Math.abs(content?.clientHeight - content?.scrollHeight);
			baseFontSize.set(contentHeight / content?.scrollHeight || 1); // 1 if not overflowing
		});

		resizeObserver.observe(content);
		resizeObserver.observe(clipboardArea);
	});

	onDestroy(() => {
		resizeObserver.disconnect();
	});
</script>

<div class="container">
	<svg width="100%" viewBox="0 0 400 525" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="50" y="54.2769" width="300" height="450.723" rx="10.5191" fill="#635957" />
		<rect bind:this={clipboardArea} x="67" y="80" width="266.667" height="408.99" fill="#003240" />
		<path
			d="M200 44H212.967C213.646 44 214.314 44.1642 214.916 44.4785L249.69 62.6504C249.896 62.7583 250.111 62.8488 250.333 62.921L271.429 69.8099V69.8099C275.309 71.0771 274.397 76.8073 270.315 76.8073H129.685C125.603 76.8073 124.691 71.0771 128.571 69.8099V69.8099L149.667 62.921C149.889 62.8488 150.104 62.7583 150.31 62.6504L185.084 44.4785C185.686 44.1642 186.354 44 187.033 44H200Z"
			fill="#929292"
		/>
		<g filter="url(#filter0_d_415_16)">
			<path d="M274.752 74.4255L273.762 77.3949H126.238L125.248 74.4255H274.752Z" fill="#929292" />
		</g>
		<path
			fill-rule="evenodd"
			clip-rule="evenodd"
			d="M200.661 21.1656C200.248 20.9449 199.752 20.9449 199.339 21.1656L186.274 28.1481C185.918 28.3384 185.662 28.6727 185.57 29.0657L178.701 58.4336C178.618 58.7889 178.4 59.0978 178.092 59.2948L142.992 81.8063C142.902 81.8639 142.806 81.911 142.706 81.9469L121.749 89.4138C121.538 89.4889 121.349 89.6134 121.196 89.7768L109.351 102.438C108.513 103.334 109.148 104.798 110.376 104.798H289.624C290.851 104.798 291.487 103.334 290.649 102.438L278.804 89.7768C278.651 89.6134 278.461 89.4889 278.251 89.4138L257.294 81.9469C257.194 81.911 257.097 81.8639 257.008 81.8063L221.907 59.2948C221.6 59.0978 221.382 58.7889 221.299 58.4336L214.43 29.0657C214.338 28.6727 214.082 28.3384 213.726 28.1481L200.661 21.1656ZM200 39.0001C203.314 39.0001 206 36.3138 206 33.0001C206 29.6864 203.314 27.0001 200 27.0001C196.686 27.0001 194 29.6864 194 33.0001C194 36.3138 196.686 39.0001 200 39.0001Z"
			fill="#808080"
		/>
		<defs>
			<filter
				id="filter0_d_415_16"
				x="120.248"
				y="70.4255"
				width="159.505"
				height="12.9693"
				filterUnits="userSpaceOnUse"
				color-interpolation-filters="sRGB"
			>
				<feFlood flood-opacity="0" result="BackgroundImageFix" />
				<feColorMatrix
					in="SourceAlpha"
					type="matrix"
					values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
					result="hardAlpha"
				/>
				<feOffset dy="1" />
				<feGaussianBlur stdDeviation="2.5" />
				<feComposite in2="hardAlpha" operator="out" />
				<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
				<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_415_16" />
				<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_415_16" result="shape" />
			</filter>
		</defs>
	</svg>
	<div class="content">
		<div
			bind:this={content}
			class="markdown-content content-inner"
			style={`--scaled-font-size: ${$baseFontSize}`}
		>
			<slot />
		</div>
	</div>
</div>

<style lang="scss">
	.container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		align-content: center;
	}

	.content {
		position: absolute;
		box-sizing: border-box;
		top: 20%;
		padding: 3%;
		padding-top: 1%;
		pointer-events: none;
		width: 66%;
		height: 75%;
		&::after {
			background: linear-gradient(to top, rgba(0, 50, 64, 1) 3%, transparent 10%);
			content: '';
			position: absolute;
			bottom: 3%;
			left: 0;
			height: 100%;
			width: 100%;
		}
	}
	:global(.markdown-content.content-inner) {
		margin-top: 0;
		height: 97%;
		max-width: fit-content;
		padding-bottom: 2%;
		color: white;
		box-sizing: border-box;
		overflow: hidden;
		text-align: left;
		font-size: calc(1rem * var(--scaled-font-size));

		:global(h1) {
			font-size: calc(2.6rem * var(--scaled-font-size));
		}

		:global(h2) {
			font-size: calc(2rem * var(--scaled-font-size));
		}

		:global(h3) {
			font-size: calc(1.6rem * var(--scaled-font-size));
		}

		:global(h4) {
			font-size: calc(1.4rem * var(--scaled-font-size));
		}

		:global(h5) {
			font-size: calc(1.2rem * var(--scaled-font-size));
		}

		:global(h6) {
			font-size: calc(1rem * var(--scaled-font-size));
		}

		:global(p) {
			font-size: calc(1rem * var(--scaled-font-size));
		}

		:global(code) {
			font-size: calc(0.85rem * var(--scaled-font-size));
		}
	}
</style>
