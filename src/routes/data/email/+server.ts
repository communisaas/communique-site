import { error } from '@sveltejs/kit';
import { find } from '$lib/data/database';

const emailFieldMap: FieldMap = {
	topic: 'topic_list',
	recipient: 'recipient_list',
	email: 'rowid'
};

/** @type {import('./$types').RequestHandler} */
// TODO same origin policy
export async function GET({ url }: { url: URL }) {
	const options: Clause = {
		where: Array.from(url.searchParams.entries()).reduce(
			(filter: Criteria, [field, value]: [string, string]) => {
				const fieldName = emailFieldMap ? emailFieldMap[field] : field;
				let clause: Operator;
				switch (field) {
					case 'recipient':
					case 'topic': {
						clause = { has: value };
						break;
					}
					case 'email': {
						clause = { equals: value };
						break;
					}
					default: {
						throw Error('Invalid field name');
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
