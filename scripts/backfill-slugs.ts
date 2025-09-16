import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w\-]+/g, '') // Remove all non-word chars
		.replace(/\-\-+/g, '-') // Replace multiple - with single -
		.replace(/^-+/, '') // Trim - from start of text
		.replace(/-+$/, ''); // Trim - from end of text
}

async function backfillTemplateSlugs() {
	const templates = await db.template.findMany({
		where: {
			slug: null
		}
	});

	if (templates.length === 0) {
		console.log('✅ All templates already have slugs. Nothing to do.');
		return;
	}

	console.log(`Found ${templates.length} templates without slugs. Backfilling...`);

	for (const template of templates) {
		const slug = slugify(template.title);

		// Check if slug already exists to avoid unique constraint errors
		const existing = await db.template.findUnique({ where: { slug } });
		let finalSlug = slug;
		if (existing) {
			finalSlug = `${slug}-${template.id.slice(0, 4)}`;
		}

		await db.template.update({
			where: { id: template.id },
			data: { slug: finalSlug }
		});

		console.log(`- Updated template "${template.title}" with slug: ${finalSlug}`);
	}

	console.log('✅ Successfully backfilled all template slugs.');
}

backfillTemplateSlugs()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
