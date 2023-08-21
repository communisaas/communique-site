import { rawSqlQuery } from '$lib/data/database';
import { Prisma } from '@prisma/client';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const searchItem = `%${params.slug}%`; // Wrap in % for ILIKE
	const rawQuery = Prisma.sql`
		WITH search_results AS (
			SELECT 'email' AS source, shortid AS id FROM email 
			WHERE subject ILIKE ${searchItem} OR body ILIKE ${searchItem} OR shortid ILIKE ${searchItem}
		
			UNION
		
			SELECT 'recipient' AS source, address AS id FROM recipient 
			WHERE address ILIKE ${searchItem}
		
			UNION
		
			SELECT 'topic' AS source, name AS id FROM topic 
			WHERE name ILIKE ${searchItem}
		)
		SELECT * FROM search_results LIMIT 10;
    `;
	const results = await rawSqlQuery(rawQuery);
	console.log(results);
	return new Response(JSON.stringify(results));
}
