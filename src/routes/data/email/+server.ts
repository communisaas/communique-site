import { error } from '@sveltejs/kit';
import { find } from '$lib/data/database';

const emailFieldMap: FieldMap = {
	topic: 'topic_list',
	recipient: 'recipient_list',
	email: 'rowid'
};

/** @type {import('./$types').RequestHandler} */
// TODO same origin policy
export async function GET({ url }) {
	const options = {
		where: Array.from(url.searchParams.entries()).reduce(
			(filter: Criteria, [field, value]: string[]) => {
				const fieldName = emailFieldMap ? emailFieldMap[field] : field;
				let criteria;
				switch (field) {
					case 'recipient':
					case 'topic': {
						criteria = { has: value };
						break;
					}
					case 'email': {
						criteria = { equals: value };
						break;
					}
				}
				if (!criteria) throw Error('Invalid field name');
				filter[fieldName] = criteria;
				return filter;
			},
			{} as Criteria
		),
		take: 10
	};
	const emailList = await find('email', options);
	return new Response(JSON.stringify(emailList));
}
