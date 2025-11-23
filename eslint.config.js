import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],

		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		// Standard rule configuration
		// TODO: Re-enable stricter rules once violations are fixed
		rules: {
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-ex-assign': 'error',
			'no-empty': 'warn',
			'no-undef': 'warn', // Svelte component imports
			'svelte/no-at-html-tags': 'off',
			'svelte/valid-compile': 'warn' // Svelte5 reactive warnings
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'infrastructure/**',
			'src/lib/components/blockchain/**',
			'src/lib/core/blockchain/**',
			'src/routes/admin/**',
			'src/routes/api/blockchain/**',
			'tests/**',
			'src/lib/paraglide/**', // Generated i18n files
			'scripts/legacy-*.js' // Legacy script files
		]
	}
);
