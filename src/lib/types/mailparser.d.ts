declare module 'mailparser' {
	import { Readable } from 'stream';

	export interface ParsedMail {
		messageId?: string;
		date?: Date;
		subject?: string;
		from?: Address[];
		to?: Address[];
		cc?: Address[];
		bcc?: Address[];
		replyTo?: Address[];
		text?: string;
		html?: string | false;
		attachments?: Attachment[];
		headers?: Map<string, unknown>;
		textAsHtml?: string;
	}

	export interface Address {
		address: string;
		name: string;
	}

	export interface Attachment {
		type: string;
		content?: Buffer;
		contentType: string;
		partId?: string;
		release?: () => void;
		contentDisposition?: string;
		filename?: string;
		headers?: Map<string, unknown>;
		checksum?: string;
		size?: number;
	}

	export class simpleParser {
		static parse(
			source: string | Buffer | Readable,
			options?: Record<string, unknown>
		): Promise<ParsedMail>;
	}

	export function simpleParser(
		source: string | Buffer | Readable,
		options?: Record<string, unknown>
	): Promise<ParsedMail>;
}
