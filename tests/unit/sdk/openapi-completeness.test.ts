import { describe, it, expect } from 'vitest';
import { openApiSpec } from '$lib/server/api-v1/openapi';

const spec = openApiSpec;
const paths = Object.keys(spec.paths);

describe('OpenAPI spec completeness', () => {
	describe('all v1 route files have corresponding spec paths', () => {
		it('documents / endpoint', () => {
			expect(paths).toContain('/');
		});

		it('documents /orgs endpoint', () => {
			expect(paths).toContain('/orgs');
		});

		it('documents /supporters endpoint', () => {
			expect(paths).toContain('/supporters');
		});

		it('documents /supporters/{id} endpoint', () => {
			expect(paths).toContain('/supporters/{id}');
		});

		it('documents /campaigns endpoint', () => {
			expect(paths).toContain('/campaigns');
		});

		it('documents /campaigns/{id} endpoint', () => {
			expect(paths).toContain('/campaigns/{id}');
		});

		it('documents /campaigns/{id}/actions endpoint', () => {
			expect(paths).toContain('/campaigns/{id}/actions');
		});

		it('documents /tags endpoint', () => {
			expect(paths).toContain('/tags');
		});

		it('documents /tags/{id} endpoint', () => {
			expect(paths).toContain('/tags/{id}');
		});

		it('documents /usage endpoint', () => {
			expect(paths).toContain('/usage');
		});

		it('documents /keys endpoint', () => {
			expect(paths).toContain('/keys');
		});

		it('documents /keys/{id} endpoint', () => {
			expect(paths).toContain('/keys/{id}');
		});

		it('documents /events endpoint', () => {
			expect(paths).toContain('/events');
		});

		it('documents /events/{id} endpoint', () => {
			expect(paths).toContain('/events/{id}');
		});

		it('documents /donations endpoint', () => {
			expect(paths).toContain('/donations');
		});

		it('documents /donations/{id} endpoint', () => {
			expect(paths).toContain('/donations/{id}');
		});

		it('documents /workflows endpoint', () => {
			expect(paths).toContain('/workflows');
		});

		it('documents /workflows/{id} endpoint', () => {
			expect(paths).toContain('/workflows/{id}');
		});

		it('documents /sms endpoint', () => {
			expect(paths).toContain('/sms');
		});

		it('documents /calls endpoint', () => {
			expect(paths).toContain('/calls');
		});

		it('documents /representatives endpoint', () => {
			expect(paths).toContain('/representatives');
		});
	});

	describe('every path has operationId on all methods', () => {
		it('has operationId on all operations', () => {
			const httpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;

			for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
				for (const method of httpMethods) {
					const operation = (pathItem as Record<string, unknown>)[method] as
						| { operationId?: string }
						| undefined;
					if (operation) {
						expect(
							operation.operationId,
							`${method.toUpperCase()} ${pathKey} is missing operationId`
						).toBeDefined();
						expect(typeof operation.operationId).toBe('string');
						expect(operation.operationId!.length).toBeGreaterThan(0);
					}
				}
			}
		});
	});

	describe('component schemas exist for all resources', () => {
		const schemas = spec.components.schemas;

		it('has Supporter schema', () => {
			expect(schemas.Supporter).toBeDefined();
		});

		it('has Campaign schema', () => {
			expect(schemas.Campaign).toBeDefined();
		});

		it('has CampaignAction schema', () => {
			expect(schemas.CampaignAction).toBeDefined();
		});

		it('has Tag schema', () => {
			expect(schemas.Tag).toBeDefined();
		});

		it('has Usage schema', () => {
			expect(schemas.Usage).toBeDefined();
		});

		it('has OrgResponse schema', () => {
			expect(schemas.OrgResponse).toBeDefined();
		});

		it('has Event schema', () => {
			expect(schemas.Event).toBeDefined();
		});

		it('has EventDetail schema', () => {
			expect(schemas.EventDetail).toBeDefined();
		});

		it('has Donation schema', () => {
			expect(schemas.Donation).toBeDefined();
		});

		it('has DonationDetail schema', () => {
			expect(schemas.DonationDetail).toBeDefined();
		});

		it('has Workflow schema', () => {
			expect(schemas.Workflow).toBeDefined();
		});

		it('has WorkflowDetail schema', () => {
			expect(schemas.WorkflowDetail).toBeDefined();
		});

		it('has SmsBlast schema', () => {
			expect(schemas.SmsBlast).toBeDefined();
		});

		it('has PatchThroughCall schema', () => {
			expect(schemas.PatchThroughCall).toBeDefined();
		});

		it('has Representative schema', () => {
			expect(schemas.Representative).toBeDefined();
		});

		it('has PaginationMeta schema', () => {
			expect(schemas.PaginationMeta).toBeDefined();
		});

		it('has ErrorEnvelope schema', () => {
			expect(schemas.ErrorEnvelope).toBeDefined();
		});
	});

	describe('spec metadata', () => {
		it('uses OpenAPI 3.1.x', () => {
			expect(spec.openapi).toMatch(/^3\.1\./);
		});

		it('has title', () => {
			expect(spec.info.title).toBeDefined();
			expect(spec.info.title.length).toBeGreaterThan(0);
		});

		it('has version', () => {
			expect(spec.info.version).toBeDefined();
		});

		it('has bearerAuth security scheme', () => {
			expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
			expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
			expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
		});

		it('has global security requirement', () => {
			expect(spec.security).toBeDefined();
			expect(spec.security).toEqual([{ bearerAuth: [] }]);
		});
	});

	describe('error responses are defined', () => {
		const responses = spec.components.responses;

		it('has BadRequest response', () => {
			expect(responses.BadRequest).toBeDefined();
		});

		it('has Unauthorized response', () => {
			expect(responses.Unauthorized).toBeDefined();
		});

		it('has Forbidden response', () => {
			expect(responses.Forbidden).toBeDefined();
		});

		it('has NotFound response', () => {
			expect(responses.NotFound).toBeDefined();
		});

		it('has InternalError response', () => {
			expect(responses.InternalError).toBeDefined();
		});
	});
});
