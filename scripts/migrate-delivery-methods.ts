import { PrismaClient } from '@prisma/client';

// Type definitions for delivery methods
type DeliveryMethod = 'email' | 'certified' | 'direct' | 'cwc';
type LegacyDeliveryMethod = 'both' | 'email';

const prisma = new PrismaClient();

async function migrateDeliveryMethods() {
	try {
		console.log('Starting delivery method migration...');

		// Update existing templates with 'both' to 'certified'
		const updateResult = await prisma.template.updateMany({
			where: {
				deliveryMethod: 'both' as LegacyDeliveryMethod
			},
			data: {
				deliveryMethod: 'certified' as DeliveryMethod
			}
		});

		console.log(`Updated ${updateResult.count} templates from 'both' to 'certified'`);

		// Update any remaining 'email' to 'direct' for consistency
		const emailResult = await prisma.template.updateMany({
			where: {
				deliveryMethod: 'email' as LegacyDeliveryMethod
			},
			data: {
				deliveryMethod: 'direct' as DeliveryMethod
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
