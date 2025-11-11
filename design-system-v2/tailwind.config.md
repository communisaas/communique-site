# Refined `tailwind.config.ts`

This configuration is updated to reflect the new design philosophy, featuring `Satoshi` as the sole typeface and completely removing all monospace fonts.

```typescript
import aspectRatio from '@tailwindcss/aspect-ratio';
import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			/*
			=== COMMUNIQUE DESIGN SYSTEM V2.6 ===
			Philosophy: "A Unique & Dynamic Vision"
			Aesthetic: Modern, distinctive, and "credibly cool," using a single, unique typeface.
			*/

			fontFamily: {
				sans: [
					'Satoshi', // The new, sole typeface for the platform
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'BlinkMacSystemFont',
					'"Segoe UI"',
					'Roboto',
					'"Helvetica Neue"',
					'Arial',
					'"Noto Sans"',
					'sans-serif'
				]
				// MONO FONT FAMILY ENTIRELY REMOVED
			},

			colors: {
				// Core Participation Brand Colors - Vibrant Trust (Restored)
				'participation-primary': {
					50: '#eef2ff',
					100: '#e0e7ff',
					200: '#c7d2fe',
					300: '#a5b4fc',
					400: '#818cf8',
					500: '#6366f1', // Indigo-500
					600: '#4f46e5', // Indigo-600
					700: '#4338ca', // Indigo-700
					800: '#3730a3', // Indigo-800
					900: '#312e81', // Indigo-900
					950: '#1e1b4b' // Indigo-950
				},

				// Accent Colors - Distinctive Voice (Restored)
				'participation-accent': {
					50: '#faf5ff',
					100: '#f3e8ff',
					200: '#e9d5ff',
					300: '#d8b4fe',
					400: '#c084fc',
					500: '#a855f7', // Violet-500
					600: '#9333ea', // Violet-600
					700: '#7c3aed', // Violet-700
					800: '#6b21a8', // Violet-800
					900: '#581c87', // Violet-900
					950: '#3b0764' // Violet-950
				},

				// Delivery Channel & Status Colors (Restored)
				'channel-verified': {
					50: '#ecfdf5',
					500: '#10b981',
					600: '#059669'
				},
				'channel-community': {
					50: '#f0f9ff',
					500: '#0ea5e9',
					600: '#0284c7'
				},
				'status-success': {
					50: '#f0fdf4',
					500: '#22c55e',
					700: '#15803d'
				},
				'status-warning': {
					50: '#fffbeb',
					500: '#f59e0b',
					700: '#a16207'
				},
				'status-error': {
					50: '#fef2f2',
					500: '#ef4444',
					700: '#b91c1c'
				},

				// Surface and Text Colors (Restored)
				surface: {
					base: '#ffffff',
					raised: '#f9fafb',
					overlay: '#f3f4f6',
					inverted: '#111827',
					accent: '#f8fafc',
					border: '#e5e7eb',
					'border-strong': '#d1d5db'
				},
				text: {
					primary: '#111827',
					secondary: '#374151',
					tertiary: '#6b7280',
					quaternary: '#9ca3af',
					inverse: '#ffffff',
					accent: '#4f46e5' // Indigo-600
				}
			},

			// Spacing, border-radius, shadows, and animations are kept from the original
			// to maintain the existing feel, which will be elevated through typography and interaction design.
			spacing: {
				'participation-xs': '0.25rem',
				'participation-sm': '0.5rem',
				'participation-md': '0.75rem',
				'participation-lg': '1rem',
				'participation-xl': '1.5rem',
				'participation-2xl': '2rem',
				'participation-3xl': '3rem'
			},
			borderRadius: {
				participation: '0.375rem',
				'participation-md': '0.5rem',
				'participation-lg': '0.75rem',
				'participation-xl': '1rem'
			},
			boxShadow: {
				'participation-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
				'participation-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
				'participation-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
				'participation-brand': '0 4px 14px 0 rgb(79 70 229 / 0.15)'
			},
			animation: {
				'participation-pulse': 'participation-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'participation-bounce': 'participation-bounce 1s ease-in-out',
				'participation-fade-in': 'participation-fade-in 0.3s ease-out',
				'participation-slide-up': 'participation-slide-up 0.3s ease-out',
				'save-pulse': 'save-pulse 2s ease-in-out infinite',
				shine: 'shine 3s ease-in-out infinite'
			},
			keyframes: {
				'participation-pulse': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				},
				shine: {
					'0%': { transform: 'translateX(-100%) rotate(12deg)' },
					'50%, 100%': { transform: 'translateX(200%) rotate(12deg)' }
				}
			}
		}
	},

	plugins: [typography, forms, containerQueries, aspectRatio]
} as Config;
```
