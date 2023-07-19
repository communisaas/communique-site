import he from 'he';
import DOMPurify from 'dompurify';

import { get } from 'svelte/store';
import { error } from '@sveltejs/kit';

import type { email } from '@prisma/client';

export class EmailForm {
	inputFields: EmailFormInput = {
		subject: '',
		body: '',
		shortid: '',
		topic_list: [],
		recipient_list: []
	};

	set subject(line: string) {
		this.inputFields.subject = line;
	}
	set body(text: string) {
		this.inputFields.body = text;
	}
	set shortid(text: string) {
		this.inputFields.shortid = text;
	}
	set topic_list(tagList: string) {
		this.inputFields.topic_list = tagList.split('␞');
	}
	set recipient_list(tagList: string) {
		this.inputFields.recipient_list = tagList.split('␞');
	}

	defaultMetrics = { open_count: 0, clipboard_count: 0, send_count: 0, read_count: 0 };
	emailForm: FormData;

	constructor(emailForm: FormData) {
		this.emailForm = emailForm;
	}

	validate() {
		for (const field of Object.keys(this.inputFields)) {
			const value = this.emailForm.get(field);
			if (value != null || value != undefined) {
				(this as RawEmailForm)[field] = value.toString();
			} else throw new Error(`${field} is empty`);
		}
	}
}

export function convertHtmlToText(node: Node): string {
	let text = '';

	const blockTags: string[] = [
		'div',
		'p',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'header',
		'footer',
		'article',
		'section',
		'aside',
		'br',
		'hr'
	];

	for (const child of Array.from(node.childNodes)) {
		const childText = convertHtmlToText(child);
		switch (child.nodeType) {
			case Node.ELEMENT_NODE:
				if (blockTags.includes((child as HTMLElement).tagName.toLowerCase())) {
					text += '\n' + childText;
				} else {
					text += childText;
				}
				break;
			case Node.TEXT_NODE:
				text += (child as Text).textContent;
				break;
			default:
				break;
		}
	}

	return text.trim();
}

export async function handleMailto(
	dispatch: (name: string, detail?: unknown) => void,
	includeBody = true
) {
	const sessionStore = (await import('$lib/data/sessionStorage')).store;
	const mailBaseURL = new URL(`mailto:${get(sessionStore).email.content.recipient_list.join(',')}`);
	const mailSubject = `?subject=${encodeURI(get(sessionStore).email.content.subject)}`;

	// Parse the HTML string into a DOM
	const parser = new DOMParser();
	const doc = parser.parseFromString(
		DOMPurify.sanitize(get(sessionStore).email.content.body),
		'text/html'
	);

	let mailBody = '';
	if (includeBody) {
		let plainBody = convertHtmlToText(doc.body);

		// Decode any HTML entities
		plainBody = he.decode(plainBody);

		// Collapse consecutive newlines
		plainBody = plainBody.replace(/\n{4,}/g, '\n');

		// URL encode the plain text body
		mailBody = `&body=${encodeURIComponent(plainBody)}`;
	}
	const mailURL = mailBaseURL.href + mailSubject + mailBody;

	dispatch('externalAction', { type: 'email', url: mailURL });
	window.open(mailURL, '_self');
}

export async function setActiveEmail(id: string) {
	const sessionStore = (await import('$lib/data/sessionStorage')).store;
	try {
		const email: email = await (await fetch(`data/email/${id}`)).json();
		sessionStore.update((sessionData) => {
			sessionData.email = { type: 'email', id: email.rowid, content: email };
			return sessionData;
		});
	} catch (e) {
		throw error(404, `Not found: ${e.message}`);
	}
}
