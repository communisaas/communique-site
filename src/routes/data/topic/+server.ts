import { error } from '@sveltejs/kit';
import { find } from '$lib/data/database';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }: { url: URL }) {
	const options: Clause = {
		where: Array.from(url.searchParams.entries()).reduce((filter: Criteria, [field, value]) => {
			let criteria;
			switch (field) {
				case 'name': {
					criteria = { has: value };
					break;
				}
				default: {
					throw Error('Invalid field name');
				}
			}
			filter[field as keyof Criteria] = criteria;
			return filter;
		}, {} as Criteria),
		take: 10
	};
	const topicList = await find('topic', options);

	return new Response(JSON.stringify(topicList));
}
