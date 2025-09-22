declare module 'smtp-server' {
	import { Server } from 'net';
	import { TLSSocket } from 'tls';
	import { Readable } from 'stream';
	import type {
		Logger,
		AuthInfo,
		SMTPSession,
		SMTPAuthResponse,
		SMTPAddress
	} from './any-replacements';

	export interface SMTPServerOptions {
		secure?: boolean;
		name?: string;
		banner?: string;
		size?: number;
		hideSTARTTLS?: boolean;
		hidePIPELINING?: boolean;
		hide8BITMIME?: boolean;
		hideSMTPUTF8?: boolean;
		allowInsecureAuth?: boolean;
		authMethods?: string[];
		authOptional?: boolean;
		disabledCommands?: string[];
		useXClient?: boolean;
		useXForward?: boolean;
		lmtp?: boolean;
		socketTimeout?: number;
		closeTimeout?: number;
		logger?: Logger;
		maxClients?: number;
		onAuth?: (
			auth: AuthInfo,
			session: SMTPSession,
			callback: (err?: Error | null, response?: SMTPAuthResponse) => void
		) => void;
		onConnect?: (session: SMTPSession, callback: (err?: Error | null) => void) => void;
		onData?: (
			stream: Readable,
			session: SMTPSession,
			callback: (err?: Error | null) => void
		) => void;
		onRcptTo?: (address: SMTPAddress, session: SMTPSession, callback: (err?: Error | null) => void) => void;
		onMailFrom?: (address: SMTPAddress, session: SMTPSession, callback: (err?: Error | null) => void) => void;
	}

	export interface SMTPServerSession {
		id: string;
		transmissionType: string;
		hostNameAppearsAs: string;
		remoteAddress: string;
		clientHostname: string;
		openingCommand: string;
		envelope: {
			mailFrom: { address: string; args?: Record<string, unknown> };
			rcptTo: Array<{ address: string; args?: Record<string, unknown> }>;
		};
		socket: TLSSocket | unknown;
	}

	export class SMTPServer extends Server {
		constructor(options?: SMTPServerOptions);

		close(callback?: () => void): void;
		listen(port?: number, hostname?: string, callback?: () => void): void;
		listen(port?: number, callback?: () => void): void;
		listen(callback?: () => void): void;

		updateSecureContext(options: Record<string, unknown>): void;
	}
}
