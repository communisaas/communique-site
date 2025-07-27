import { PrismaClient } from '@prisma/client';
import { generateActionSlug } from '../src/lib/server/reserved-slugs.js';

const db: PrismaClient = new PrismaClient();

const seedTemplates = [
    {
        title: 'Climate Action Now',
        description: 'Demand immediate Congressional action on climate change legislation to protect our planet for future generations.',
        category: 'Environment',
        type: 'advocacy',
        deliveryMethod: 'both',
        subject: 'Climate Action Now',
        preview: 'Dear [Representative Name], I am writing as your constituent to urge immediate action on climate change legislation.',
        message_body: 'Dear [Representative Name],\n\nI am writing as your constituent from [Address] to urge immediate action on climate change legislation.\n\nThe science is clear: we must act now to prevent catastrophic climate change. I urge you to support comprehensive climate legislation that includes:\n\n• Rapid transition to renewable energy\n• Investment in green infrastructure\n• Support for affected communities\n• Science-based emissions targets\n\n[Personal Connection]\n\nPlease vote for our planet\'s future.\n\nSincerely,\n[Name]\n[Address]',
        metrics: { sent: 8234, opened: 0, clicked: 0, responded: 8234, districts_covered: 417, total_districts: 435, district_coverage_percent: 96 },
        delivery_config: { timing: 'immediate', followUp: true, cwcEnabled: true },
        recipient_config: { emails: ['climate.committee@house.gov', 'environment.committee@senate.gov'] },
        is_public: true
    }
];

async function seedDatabase() {
    console.log('🌱 Starting database seed...');
    
    try {
        // Clear existing templates
        await db.template.deleteMany({});
        console.log('✅ Cleared existing templates');
        
        // Insert templates with action-oriented slugs
        const createdTemplates = [];
        for (const template of seedTemplates) {
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