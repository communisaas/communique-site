import { PrismaClient } from '@prisma/client';
import { templates } from '../src/lib/data/templates.js';

const db: PrismaClient = new PrismaClient();

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
                    is_public: true,
                    subject: `Support for ${template.title}`,
                    message_body: template.preview,
                    delivery_config: {},
                    recipient_config:
                        'recipientEmails' in template && template.recipientEmails
                            ? { emails: template.recipientEmails }
                            : {}
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