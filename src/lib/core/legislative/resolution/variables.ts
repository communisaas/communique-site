import type { Representative as _Representative } from '../models';
import type { LegislativeUser } from '../adapters/base';
import { adapterRegistry } from '../adapters/registry';

export interface VariableContext {
	user: LegislativeUser;
	_representative: _Representative;
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
		this.variables.set('_representative.name', async (ctx) => ctx._representative.name);
		this.variables.set('_representative.title', async (ctx) => {
			const adapter = await adapterRegistry.getAdapter(ctx.country_code);
			if (adapter) {
				return adapter.formatRepresentativeName(ctx._representative);
			}
			return ctx._representative.name;
		});
		this.variables.set(
			'_representative.party',
			async (ctx) => ctx._representative.party || 'Independent'
		);

		// Office variables
		this.variables.set('office.title', async (ctx) => {
			const adapter = await adapterRegistry.getAdapter(ctx.country_code);
			if (adapter) {
				const office = {
					id: ctx._representative.office_id,
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
					console.error('[Variables] Resolver failed:', { variable: variableName, error: error instanceof Error ? error.message : String(error) });
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
