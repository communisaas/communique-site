import { PrismaClient } from '@prisma/client';
import { templates } from '../src/lib/data/templates.js';

const db = new PrismaClient();

async function seedDatabase() {
    console.log('🌱 Starting database seed...');
    
    try {
        // Clear existing templates
        await db.template.deleteMany({});
        console.log('✅ Cleared existing templates');
        
        // Insert templates from mock data  
        for (const template of templates) {
            await db.template.create({
                data: {
                    title: template.title,
                    description: template.description,
                    category: template.category,
                    type: template.type,
                    deliveryMethod: template.deliveryMethod,
                    preview: template.preview,
                    metrics: template.metrics,
                    recipientEmails: template.recipientEmails || null
                }
            });
        }
        
        console.log(`✅ Seeded ${templates.length} templates`);
        
        // Verify the data
        const count = await db.template.count();
        console.log(`📊 Total templates in database: ${count}`);
        
        console.log('🎉 Database seeding completed successfully!');
        
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await db.$disconnect();
    }
    
    process.exit(0);
}

seedDatabase(); 