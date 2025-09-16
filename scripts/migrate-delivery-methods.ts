import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDeliveryMethods() {
	try {
		console.log('Starting delivery method migration...');

		// Update existing templates with 'both' to 'certified'
		const updateResult = await prisma.template.updateMany({
			where: {
				deliveryMethod: 'both' as any // Temporarily bypass type checking
			},
			data: {
				deliveryMethod: 'certified' as any
			}
		});

		console.log(`Updated ${updateResult.count} templates from 'both' to 'certified'`);

		// Update any remaining 'email' to 'direct' for consistency
		const emailResult = await prisma.template.updateMany({
			where: {
				deliveryMethod: 'email' as any
			},
			data: {
				deliveryMethod: 'direct' as any
			}
		});

		console.log(`Updated ${emailResult.count} templates from 'email' to 'direct'`);

		console.log('Migration completed successfully!');
	} catch (error) {
		console.error('Migration failed:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

migrateDeliveryMethods();
