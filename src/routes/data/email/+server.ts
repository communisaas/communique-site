import { error } from '@sveltejs/kit';
import { find } from '$lib/data/database';

/** @type {import('./$types').RequestHandler} */
// TODO same origin policy
export async function GET({ url }: { url: URL }) {
	let fieldName: string;
	const options: Clause = {
		where: Array.from(url.searchParams.entries()).reduce(
			(filter: Criteria, [field, values]: [string, string]) => {
				let clause: Operator;
				const valueList = values.split('␞');
				switch (field) {
					case 'recipient':
						fieldName = 'recipient_list';
						clause = { hasEvery: valueList };
						break;
					case 'topic': {
						fieldName = 'topic_list';
						clause = { hasEvery: valueList };
						break;
					}
					case 'email': {
						clause = valueList.length > 1 ? { in: valueList } : { equals: valueList[0] };
						break;
					}
					default: {
						throw Error('Invalid field name: ' + field);
					}
				}
				filter[fieldName as keyof Criteria] = clause;
				return filter;
			},
			{} as Criteria
		),
		take: 10
	};
	const emailList = await find('email', options);
	return new Response(JSON.stringify(emailList));
}
