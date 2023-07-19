import { objectMapper } from '$lib/data/database';
import { providers, baseProviderLogoURL } from '$lib/data/auth';
import type { LayoutServerLoad } from './$types';
import { marked } from 'marked';
import termsOfUseMarkdown from '$lib/policies/serviceTerms.md?raw';
import privacyPolicyMarkdown from '$lib/policies/privacyPolicy.md?raw';

export const load = (async ({ locals }) => {
	// TODO: compound queries, lazy load, caching

	const loudestTopics = await objectMapper.topic.findMany({ take: 10 });
	const loudestTopicEmails = objectMapper.email.findMany({
		where: {
			topic_list: {
				has: loudestTopics[0].name
			}
		},
		take: 10
	});
	// const spotlightEmails = objectMapper.email.findMany({
	// 	take: 10
	// });
	return {
		loudestTopics,
		template: {
			primary: {
				type: 'panel',
				selectable: 'topic',
				header: 'Loudest voices',
				focus: loudestTopics[0].name,
				alignment: 'end',
				cardList: await loudestTopicEmails
			}
			// secondary: {
			// 	type: 'panel',
			// 	selectable: 'spotlight',
			// 	header: 'Spotlight on',
			// 	focus: 'custom',
			// 	alignment: 'start',
			// 	cardList: await spotlightEmails
			// }
		},
		session: await locals.getSession(),
		authProviders: {
			baseLogoURL: baseProviderLogoURL.toString() as `https://${string}.svg`,
			providers: providers.reduce((accumulator, provider) => {
				accumulator[provider.id] = { name: provider.name, id: provider.id, style: provider.style };
				return accumulator;
			}, {} as Record<string, ProviderAttributes>)
		},
		privacyPolicy: marked(privacyPolicyMarkdown, { mangle: false, headerIds: false }),
		termsOfUse: marked(termsOfUseMarkdown, { mangle: false, headerIds: false }) // clear deprecation warnings for mangle & headerIds
	};
}) satisfies LayoutServerLoad;
