import { rawSqlQuery } from '$lib/data/database';
import { Prisma } from '@prisma/client';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const searchItem = `%${params.slug}%`;
	// TODO elastic search
	const rawQuery = Prisma.sql`
	WITH 
	recipient_search AS (
		SELECT 
			'recipient' AS source, 
			address AS id, 
			ts_rank(to_tsvector('english', address), to_tsquery('english', ${searchItem} || ':*')) AS rank,
			levenshtein(address, ${searchItem}) AS lev_distance
		FROM recipient 
		WHERE to_tsvector('english', address) @@ to_tsquery('english', ${searchItem} || ':*')
		LIMIT 10
	),
	topic_search AS (
		SELECT 
			'topic' AS source, 
			name AS id, 
			ts_rank(to_tsvector('english', name), to_tsquery('english', ${searchItem} || ':*')) AS rank,
			levenshtein(name, ${searchItem}) AS lev_distance
		FROM topic 
		WHERE to_tsvector('english', name) @@ to_tsquery('english', ${searchItem} || ':*')
		LIMIT 10
	)
	SELECT * FROM recipient_search
	UNION ALL
	SELECT * FROM topic_search
	ORDER BY rank DESC, lev_distance ASC;
	`;

	let results;
	try {
		results = await rawSqlQuery(rawQuery);
	} catch (error) {
		if (error.code == 'P2010') results = [];
		else {
			console.error(error);
			return new Response(JSON.stringify({ error: error.message }), { status: 500 });
		}
	}
	console.log(results);
	return new Response(JSON.stringify(results));
}
