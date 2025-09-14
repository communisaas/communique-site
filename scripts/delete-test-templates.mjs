import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteTestTemplates() {
  try {
    // Find templates with test-related titles
    const testTemplates = await prisma.template.findMany({
      where: {
        OR: [
          { title: { contains: 'test' } },
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
      const templateIds = testTemplates.map(t => t.id);

      // Delete the templates
      const result = await prisma.template.deleteMany({
        where: {
          id: { in: templateIds }
        }
      });

      console.log(`Deleted ${result.count} test template(s)`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteTestTemplates();
