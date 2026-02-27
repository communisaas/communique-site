/**
 * Position Service — Power Landscape (Cycle 37)
 *
 * Manages position registrations (support/oppose) on templates.
 * Privacy-preserving: keyed on identity_commitment, not user_id.
 * One position per identity per template (unique constraint enforced).
 */

import { prisma } from '$lib/core/db';

/**
 * Register a position (support/oppose) on a template.
 * Upsert semantics: if already registered, returns existing record.
 */
export async function registerPosition(params: {
	templateId: string;
	identityCommitment: string;
	stance: 'support' | 'oppose';
	districtCode?: string;
}): Promise<{ id: string; isNew: boolean }> {
	const { templateId, identityCommitment, stance, districtCode } = params;

	try {
		const registration = await prisma.positionRegistration.create({
			data: {
				template_id: templateId,
				identity_commitment: identityCommitment,
				stance,
				district_code: districtCode ?? null
			}
		});

		return { id: registration.id, isNew: true };
	} catch (err: unknown) {
		// Unique constraint violation — already registered
		if (
			err &&
			typeof err === 'object' &&
			'code' in err &&
			(err as { code: string }).code === 'P2002'
		) {
			const existing = await prisma.positionRegistration.findUnique({
				where: {
					template_id_identity_commitment: {
						template_id: templateId,
						identity_commitment: identityCommitment
					}
				}
			});

			if (existing) {
				return { id: existing.id, isNew: false };
			}
		}

		throw err;
	}
}

/**
 * Get aggregate position counts for a template.
 * Public endpoint — returns only aggregate counts, no PII.
 */
export async function getPositionCounts(templateId: string): Promise<{
	support: number;
	oppose: number;
	districts: number;
}> {
	const [support, oppose, districts] = await Promise.all([
		prisma.positionRegistration.count({
			where: { template_id: templateId, stance: 'support' }
		}),
		prisma.positionRegistration.count({
			where: { template_id: templateId, stance: 'oppose' }
		}),
		prisma.positionRegistration
			.groupBy({
				by: ['district_code'],
				where: {
					template_id: templateId,
					district_code: { not: null }
				}
			})
			.then((groups) => groups.length)
	]);

	return { support, oppose, districts };
}

/**
 * Batch-create delivery records for a position registration.
 * Called after the citizen confirms which recipients to address.
 */
export async function batchRegisterDeliveries(params: {
	registrationId: string;
	recipients: Array<{
		name: string;
		email?: string;
		deliveryMethod: 'cwc' | 'email' | 'recorded';
	}>;
}): Promise<{ created: number }> {
	const { registrationId, recipients } = params;

	const result = await prisma.positionDelivery.createMany({
		data: recipients.map((r) => ({
			registration_id: registrationId,
			recipient_name: r.name,
			recipient_email: r.email ?? null,
			delivery_method: r.deliveryMethod,
			delivery_status: 'pending'
		}))
	});

	return { created: result.count };
}
