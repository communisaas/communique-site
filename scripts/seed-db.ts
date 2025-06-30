import { PrismaClient } from '@prisma/client';
import { templates } from '../src/lib/data/templates.js';

const db: PrismaClient = new PrismaClient();

async function seedDatabase() {
    console.log('🌱 Starting database seed...');
    
    try {
        // Clear existing templates
        await db.Template.deleteMany({});
        console.log('✅ Cleared existing templates');
        
        // Insert templates with updated structure
        for (const template of templates) {
            await db.Template.create({
                data: {
                    title: template.title,
                    description: template.description,
                    category: template.category,
                    type: template.type,
                    deliveryMethod: template.deliveryMethod,
                    subject: template.subject,
                    preview: template.preview,
                    message_body: template.message_body,
                    metrics: template.metrics,
                    delivery_config: template.delivery_config,
                    recipient_config: template.recipient_config,
                    is_public: template.is_public
                }
            });
        }
        
        console.log(`✅ Seeded ${templates.length} templates`);
        
        // Verify the data
        const count = await db.Template.count();
        console.log(`📊 Total templates in database: ${count}`);
        
        // Show template details
        const allTemplates = await db.Template.findMany({
            select: {
                id: true,
                title: true,
                category: true,
                deliveryMethod: true
            }
        });
        
        console.log('📋 Seeded templates:');
        allTemplates.forEach(t => {
            console.log(`  • ${t.title} (${t.category}) - ${t.deliveryMethod}`);
        });
        
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