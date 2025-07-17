import { PrismaClient } from '@prisma/client';
import { templates } from '../src/lib/data/templates.js';
import { generateActionSlug } from '../src/lib/server/reserved-slugs.js';

const db: PrismaClient = new PrismaClient();

async function seedDatabase() {
    console.log('🌱 Starting database seed...');
    
    try {
        // Clear existing templates
        await db.template.deleteMany({});
        console.log('✅ Cleared existing templates');
        
        // Insert templates with action-oriented slugs
        const createdTemplates = [];
        for (const template of templates) {
            // Generate action-oriented slug
            const actionSlug = generateActionSlug(template.title, template.deliveryMethod);
            
            const createdTemplate = await db.template.create({
                data: {
                    title: template.title,
                    slug: actionSlug,
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
            
            createdTemplates.push(createdTemplate);
            console.log(`📝 Created: "${template.title}" → ${actionSlug}`);
        }
        
        console.log(`✅ Seeded ${templates.length} templates`);
        
        // Verify the data
        const count = await db.template.count();
        console.log(`\n📊 Total templates in database: ${count}`);
        
        // Show template details with URLs
        console.log('\n🌐 Action-Oriented URLs:');
        console.log('========================');
        createdTemplates.forEach(t => {
            console.log(`📍 https://communi.email/${t.slug}`);
            console.log(`   "${t.title}" (${t.category})`);
            console.log('');
        });
        
        console.log('📋 Template Categories:');
        const categories = [...new Set(createdTemplates.map(t => t.category))];
        categories.forEach(cat => {
            const count = createdTemplates.filter(t => t.category === cat).length;
            console.log(`  • ${cat}: ${count} template${count > 1 ? 's' : ''}`);
        });
        
        console.log('\n🎉 Database seeding completed successfully!\n');
        console.log('💡 Pro Tips:');
        console.log('  • URLs are now action-oriented for better engagement');
        console.log('  • Congressional templates use "tell-congress-" prefix');
        console.log('  • Direct templates use action verbs (demand-, support-, stop-)');
        console.log('  • All URLs are social media ready and instantly copyable\n');
        
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await db.$disconnect();
    }
    
    process.exit(0);
}

seedDatabase(); 