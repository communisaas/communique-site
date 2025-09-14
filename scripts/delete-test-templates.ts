import { db } from '../src/lib/core/db';

async function deleteTestTemplates() {
  try {
    // Find templates with test-related titles
    const testTemplates = await db.template.findMany({
      where: {
        OR: [
          { title: { contains: 'test', mode: 'insensitive' } },
          { title: { contains: 'Test' } },
          { slug: { contains: 'test' } }
        ]
      },
      select: {
        id: true,
        title: true,
        slug: true
      }
    });

    console.log(`Found ${testTemplates.length} test template(s):`);
    testTemplates.forEach(t => {
      console.log(`  - ${t.title} (${t.slug})`);
    });

    if (testTemplates.length > 0) {
      // Delete associated TemplateVerification records first
      const templateIds = testTemplates.map(t => t.id);
      
      const deletedVerifications = await db.templateVerification.deleteMany({
        where: {
          template_id: { in: templateIds }
        }
      });
      
      console.log(`Deleted ${deletedVerifications.count} verification record(s)`);

      // Now delete the templates
      const result = await db.template.deleteMany({
        where: {
          id: { in: templateIds }
        }
      });

      console.log(`Deleted ${result.count} test template(s)`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

deleteTestTemplates();
