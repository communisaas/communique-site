import { TINYMCE_KEY } from '$env/static/private';
import { v4 as uuidv4 } from 'uuid';
import type { RequestEvent, PageServerLoad } from './$types';

import { objectMapper } from '$lib/data/database';
import { fail } from '@sveltejs/kit';
import { EmailForm } from '$lib/data/email';

/** @type {import('./$types').Actions} */
export const actions = {
	publish: async ({ request }: RequestEvent) => {
		const formSubmission = await request.formData();

		// TODO implement openid account linking to store profile

		// const profileRequestID: string | undefined = formSubmission.get('profileRequestID')?.toString();

		// const response = await fetch(`${FINGERPRINTJS_APIURL}/events/${profileRequestID}`, {
		// 	headers: { 'Auth-API-Key': FINGERPRINTJS_SERVER_KEY }
		// });

		// const profile = (await response.json()).products.identification.data;
		// if (profile) {
		// 	formSubmission.delete('profileRequestId');
		// } else return fail(400, { name: 'profile', missing: true });

		const emailForm = new EmailForm(formSubmission);
		try {
			emailForm.validate();
		} catch (error) {
			fail(400, { name: error, missing: true });
		}

		const stagingID = uuidv4();
		await objectMapper.$transaction(async (tx) => {
			const updateTime = new Date().toISOString();
			await tx.author.upsert({
				where: {
					rowid: stagingID
				},
				update: {}, // { profile },
				create: {
					rowid: stagingID,
					profile: {},
					read_email_count: 0,
					sent_email_count: 0,
					open_email_count: 0,
					is_registered: false
				}
			});

			emailForm.inputFields.topic_list.map(
				async (topic) =>
					await tx.topic.upsert({
						where: { name: topic },
						create: {
							name: topic,
							last_updated: updateTime,
							email_count: 1,
							email_open_count: 0,
							email_read_count: 0,
							email_sent_count: 0,
							author: {
								connect: {
									rowid: stagingID
								}
							}
						},
						update: {
							email_count: { increment: 1 },
							last_updated: updateTime
						}
					})
			);
			emailForm.inputFields.recipient_list.map(
				async (address) =>
					await tx.recipient.upsert({
						where: { address },
						create: {
							address: address,
							last_updated: updateTime,
							email_count: 1,
							email_open_count: 0,
							email_read_count: 0,
							email_sent_count: 0,
							author: {
								connect: {
									rowid: stagingID
								}
							}
						},
						update: {
							email_count: { increment: 1 },
							last_updated: updateTime
						}
					})
			);

			// TODO email shortid creation
			if (!('shortid' in emailForm.inputFields)) {
				emailForm.inputFields.shortid = stagingID.slice(-8);
			}
			await tx.email.create({
				data: {
					...emailForm.inputFields,
					...emailForm.defaultMetrics,
					author: {
						connect: {
							rowid: stagingID
						}
					}
				}
			});
		});

		return { success: true };
	}
};

export const load = (async () => {
	return {
		editorKey: process.env.TINYMCE_KEY || TINYMCE_KEY
	};
}) satisfies PageServerLoad;
