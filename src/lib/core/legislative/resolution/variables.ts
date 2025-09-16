import type { Representative } from '../models';
import type { User } from '../adapters/base';
import { adapterRegistry } from '../adapters/registry';

export interface VariableContext {
	user: User;
	representative: Representative;
	country_code: string;
}

export class LegislativeVariableResolver {
	private variables = new Map<string, (context: VariableContext) => Promise<string>>();

	constructor() {
		this.registerDefaultVariables();
	}

	private registerDefaultVariables() {
		// User variables
		this.variables.set('user.name', async (ctx) => ctx.user.name || 'Constituent');
		this.variables.set('user.first_name', async (ctx) => {
			const name = ctx.user.name || '';
			return name.split(' ')[0] || 'Constituent';
		});
		this.variables.set('user.email', async (ctx) => ctx.user.email);
		this.variables.set('user.city', async (ctx) => ctx.user.address?.city || '');
		this.variables.set('user.state', async (ctx) => ctx.user.address?.state || '');
		this.variables.set('user.postal_code', async (ctx) => ctx.user.address?.postal_code || '');

		// Representative variables
		this.variables.set('representative.name', async (ctx) => ctx.representative.name);
		this.variables.set('representative.title', async (ctx) => {
			const adapter = await adapterRegistry.getAdapter(ctx.country_code);
			if (adapter) {
				return adapter.formatRepresentativeName(ctx.representative);
			}
			return ctx.representative.name;
		});
		this.variables.set(
			'representative.party',
			async (ctx) => ctx.representative.party || 'Independent'
		);

		// Office variables
		this.variables.set('office.title', async (ctx) => {
			const adapter = await adapterRegistry.getAdapter(ctx.country_code);
			if (adapter) {
				const office = {
					id: ctx.representative.office_id,
					jurisdiction_id: '',
					role: '',
					title: '',
					level: 'national' as const,
					contact_methods: [],
					is_active: true
				};
				return adapter.formatOfficeTitle(office);
			}
			return 'Representative';
		});
	}

	async resolveVariables(text: string, context: VariableContext): Promise<string> {
		let resolved = text;

		// Find all variable placeholders [variable.name]
		const variablePattern = /\[([^\]]+)\]/g;
		const matches = Array.from(text.matchAll(variablePattern));

		for (const match of matches) {
			const placeholder = match[0];
			const variableName = match[1];

			const resolver = this.variables.get(variableName);
			if (resolver) {
				try {
					const value = await resolver(context);
					resolved = resolved.replace(placeholder, value);
				} catch (error) {
					console.error(`Failed to resolve variable ${variableName}:`, error);
					// Leave placeholder as-is if resolution fails
				}
			}
		}

		return resolved;
	}

	registerCustomVariable(name: string, resolver: (context: VariableContext) => Promise<string>) {
		this.variables.set(name, resolver);
	}

	getAvailableVariables(): string[] {
		return Array.from(this.variables.keys()).sort();
	}
}

export const variableResolver = new LegislativeVariableResolver();
