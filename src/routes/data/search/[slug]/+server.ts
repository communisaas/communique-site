import { rawSqlQuery } from '$lib/data/database';
import { Prisma } from '@prisma/client';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const searchTerms = params.slug.split('&');
	const searchQuery = searchTerms.map((term) => `${term.trim()}:*`).join(' & ');

	const rawQuery = Prisma.sql`
    WITH 
    email_search AS (
        SELECT 
            'email' AS source, 
            subject AS id, 
            ts_rank(to_tsvector('english', subject), to_tsquery('english', ${searchQuery})) AS rank
        FROM email 
        WHERE to_tsvector('english', subject) @@ to_tsquery('english', ${searchQuery})
        LIMIT 10
    ),
    recipient_search AS (
        SELECT 
            'recipient' AS source, 
            address AS id, 
            ts_rank(to_tsvector('english', address), to_tsquery('english', ${searchQuery})) AS rank
        FROM recipient 
        WHERE to_tsvector('english', address) @@ to_tsquery('english', ${searchQuery})
        LIMIT 10
    ),
    topic_search AS (
        SELECT 
            'topic' AS source, 
            name AS id, 
            ts_rank(to_tsvector('english', name), to_tsquery('english', ${searchQuery})) AS rank
        FROM topic 
        WHERE to_tsvector('english', name) @@ to_tsquery('english', ${searchQuery})
        LIMIT 10
    )
    SELECT * FROM email_search
    UNION ALL
    SELECT * FROM recipient_search
    UNION ALL
    SELECT * FROM topic_search
    ORDER BY rank DESC;
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
	return new Response(JSON.stringify(results));
}
