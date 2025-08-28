import aspectRatio from '@tailwindcss/aspect-ratio';
import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			colors: {
				// Semantic delivery channel colors
				'congressional': {
					50: '#ecfdf5',  // Light green background
					100: '#d1fae5',
					200: '#a7f3d0',
					500: '#10b981',  // Primary green
					600: '#059669',
					700: '#047857'
				},
				'direct': {
					50: '#eff6ff',   // Light blue background  
					100: '#dbeafe',
					200: '#bfdbfe',
					500: '#3b82f6',  // Primary blue
					600: '#2563eb',
					700: '#1d4ed8'
				},
				// Status colors
				'status': {
					'active': '#10b981',    // Green for active/success
					'pending': '#f59e0b',   // Amber for pending
					'error': '#ef4444',     // Red for errors
					'neutral': '#6b7280'    // Gray for neutral states
				},
				// Surface colors
				'surface': {
					'base': '#ffffff',
					'raised': '#f9fafb',
					'overlay': '#f3f4f6',
					'inverted': '#111827'
				}
			},
			// Semantic spacing for consistent rhythm
			spacing: {
				'badge-x': '0.5rem',
				'badge-y': '0.125rem',
				'button-x': '1rem',
				'button-y': '0.5rem',
				'card': '1.5rem'
			},
			animation: {
				'save-pulse': 'save-pulse 2s ease-in-out infinite'
			},
			keyframes: {
				'save-pulse': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				}
			}
		}
	},

	plugins: [typography, forms, containerQueries, aspectRatio]
} as Config;
