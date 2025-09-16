import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
	console.log('🌍 Seeding jurisdictions and offices...');
	try {
		await db.$transaction([db.office.deleteMany({}), db.jurisdiction.deleteMany({})]);

		// Seed minimal US structure: a few states and one district each for demo
		const states = ['CA', 'NY', 'IL'];
		for (const state of states) {
			const stateJur = await db.jurisdiction.create({
				data: {
					country_code: 'US',
					type: 'state',
					name: state,
					admin1: state
				}
			});

			// Create two senate offices per state
			await db.office.createMany({
				data: [
					{
						jurisdiction_id: stateJur.id,
						role: 'senator',
						chamber: 'senate',
						level: 'national',
						title: `US Senator (Senior) ${state}`
					},
					{
						jurisdiction_id: stateJur.id,
						role: 'senator',
						chamber: 'senate',
						level: 'national',
						title: `US Senator (Junior) ${state}`
					}
				]
			});

			// Create one demo congressional district office per state
			const districtJur = await db.jurisdiction.create({
				data: {
					country_code: 'US',
					type: 'district',
					name: `${state}-01`,
					admin1: state
				}
			});

			await db.office.create({
				data: {
					jurisdiction_id: districtJur.id,
					role: 'representative',
					chamber: 'house',
					level: 'national',
					title: `US Representative ${state}-01`
				}
			});
		}

		console.log('✅ Jurisdictions and offices seeded');
	} catch (e) {
		console.error('❌ Failed seeding jurisdictions', e);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

main();
