# Refinement Guide: Adopting a Unique Typographic Voice

This guide outlines the key typographic refinements to our design system. The goal is to create a unique, modern, and unified visual identity by adopting **`Satoshi`** as our sole typeface and completely **eliminating all monospace fonts**.

## Summary of Refinements

- **Primary Typeface:** `Satoshi` is now the one and only font for the entire application. This provides a distinctive and "credibly cool" aesthetic that is neither corporate nor generic.
- **No Monospace Fonts:** All text, including data points, numbers, and metrics, will now be rendered in `Satoshi`. This is a critical step to move away from a "technical" feel and towards a more accessible and visually unified interface. We will use font weights, colors, and styles to create hierarchy and distinguish data.

## Typographic Refinement

The most significant change is the adoption of `Satoshi` and the removal of `JetBrains Mono`.

**Before (Using `Inter` and `JetBrains Mono`):**

```html
<h1 class="font-sans text-3xl font-bold text-text-primary">
	Coordinate campaigns that can't be ignored.
</h1>
<p class="font-mono text-sm text-text-secondary">Adoptions: 847 | Districts: 94</p>
```

**After (Using `Satoshi` exclusively):**

```html
<!-- Ensure your CSS applies 'Satoshi' to the `font-sans` utility -->
<h1 class="font-sans text-3xl font-bold text-text-primary">
	Coordinate campaigns that can't be ignored.
</h1>
<!-- Data is now rendered in Satoshi, using weight and color for emphasis -->
<p class="font-sans text-sm text-text-secondary">
	Adoptions: <span class="font-bold text-text-primary">847</span> | Districts:
	<span class="font-bold text-text-primary">94</span>
</p>
```

## Component Refinement Examples

The following examples demonstrate how to refactor components to use `Satoshi` exclusively.

### Buttons

All button text, including any data, now uses `Satoshi`.

**Before (with `font-mono`):**

```html
<button class="flex flex-col items-center rounded-lg bg-participation-primary-600 p-3 text-white">
	<span class="font-sans font-semibold">Send to Congress</span>
	<span class="font-mono text-xs opacity-80">Join 847 others | +50 Reputation</span>
</button>
```

**After (Unified with `Satoshi`):**

```html
<button class="flex flex-col items-center rounded-lg bg-participation-primary-600 p-3 text-white">
	<span class="font-sans font-semibold">Send to Congress</span>
	<span class="font-sans text-xs opacity-80"
		>Join <span class="font-bold">847</span> others | +<span class="font-bold">50</span>
		Reputation</span
	>
</button>
```

### Cards

Card metrics are now presented using `Satoshi`, relying on weight and color for differentiation.

**Before (with `font-mono`):**

```html
<div class="group relative rounded-participation-lg border border-surface-border p-4">
	<h3 class="font-sans text-lg font-semibold">Support Medicare Expansion</h3>
	<div class="flex items-center space-x-4 font-mono text-xs text-text-tertiary">
		<div class="flex items-center">
			Adoptions: <span class="ml-1 font-medium text-text-secondary">847</span>
		</div>
		<div class="flex items-center">
			Districts: <span class="ml-1 font-medium text-text-secondary">94</span>
		</div>
	</div>
</div>
```

**After (Unified with `Satoshi`):**

```html
<div class="group relative rounded-participation-lg border border-surface-border p-4">
	<h3 class="font-sans text-lg font-semibold text-text-primary">Support Medicare Expansion</h3>
	<div class="flex items-center space-x-4 font-sans text-xs text-text-tertiary">
		<div class="flex items-center">
			<span class="mr-1.5 h-2 w-2 rounded-full bg-participation-accent-500"></span>
			Adoptions: <span class="ml-1 font-bold text-text-secondary">847</span>
		</div>
		<div class="flex items-center">
			<span class="mr-1.5 h-2 w-2 rounded-full bg-participation-primary-500"></span>
			Districts: <span class="ml-1 font-bold text-text-secondary">94</span>
		</div>
	</div>
</div>
```

## General Guidance

1.  **Remove All Monospace:** Audit all components and pages to remove any instance of `font-mono`. Replace it with `font-sans`.
2.  **Create Hierarchy with Weight and Color:** Use font weights (`font-medium`, `font-bold`) and the existing text color palette (`text-primary`, `text-secondary`, `text-accent`) to differentiate data points from labels.
3.  **Embrace `Satoshi`:** Fully adopt `Satoshi` as the voice of the platform. Its clean, modern, and distinctive character is now a core part of our visual identity.
4.  **Review `design-philosophy.md`:** Continuously refer back to the core principles to ensure all design and implementation decisions align with our unique vision.
