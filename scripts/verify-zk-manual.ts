import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	console.log('Starting manual verification...');

	// 1. Setup User
	console.log('Creating user...');
	const user = await prisma.user.upsert({
		where: { id: 'manual-test-user' },
		update: {},
		create: {
			id: 'manual-test-user',
			email: 'manual@test.com',
			name: 'Manual Test User'
		}
	});

	// 2. Setup Template
	console.log('Creating template...');
	await prisma.template.upsert({
		where: { id: 'manual-template-123' },
		update: {},
		create: {
			id: 'manual-template-123',
			slug: 'manual-template',
			title: 'Manual Template',
			description: 'Desc',
			message_body: 'Body',
			category: 'test',
			type: 'congressional',
			userId: user.id,
			deliveryMethod: 'email',
			preview: 'Preview',
			delivery_config: {},
			recipient_config: {},
			metrics: {}
		}
	});

	// 3. Register
	console.log('Registering...');
	// We can't call the API handler directly easily because of RequestEvent mock complexity.
	// But we can simulate the logic or use fetch if the server was running.
	// Since server is not running, we'll just test the DB operations directly to see if schema is correct.

	// Test ShadowAtlasRegistration creation
	const district = 'CA-12';
	const identityCommitment = 'manual-commitment';

	let tree = await prisma.shadowAtlasTree.findUnique({
		where: { congressional_district: district }
	});

	if (!tree) {
		tree = await prisma.shadowAtlasTree.create({
			data: {
				congressional_district: district,
				leaves: [],
				merkle_root: '0',
				leaf_count: 0
			}
		});
	}

	await prisma.shadowAtlasRegistration.deleteMany({ where: { user_id: user.id } });

	await prisma.shadowAtlasRegistration.create({
		data: {
			user_id: user.id,
			congressional_district: district,
			identity_commitment: identityCommitment,
			leaf_index: 0,
			merkle_root: '0',
			merkle_path: [],
			verification_method: 'manual',
			verification_id: 'manual',
			verification_timestamp: new Date(),
			registration_status: 'registered',
			expires_at: new Date()
		}
	});
	console.log('Registration DB op success');

	// 4. Submit
	console.log('Submitting...');
	const nullifier = 'manual-nullifier-' + Date.now();
	const actionId = 'manual-action';

	await prisma.submission.deleteMany({ where: { user_id: user.id } });

	try {
		const submission = await prisma.submission.create({
			data: {
				user_id: user.id,
				template_id: 'manual-template-123',
				proof_hex: 'mock-proof',
				public_inputs: {},
				nullifier: nullifier,
				action_id: actionId,
				encrypted_witness: 'enc-witness',
				encrypted_message: 'enc-message',
				status: 'verified',
				delivery_status: 'pending'
			}
		});
		console.log('Submission DB op success:', submission.id);
	} catch (e) {
		console.error('Submission DB op failed:', e);
	}

	console.log('Done.');
}

main()
	.catch((e) => console.error(e))
	.finally(async () => {
		await prisma.$disconnect();
	});
