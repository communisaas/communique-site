declare module 'smtp-server' {
  import { Server } from 'net';
  import { TLSSocket } from 'tls';
  import { Readable } from 'stream';

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
    logger?: any;
    maxClients?: number;
    onAuth?: (auth: any, session: any, callback: (err?: Error | null, response?: any) => void) => void;
    onConnect?: (session: any, callback: (err?: Error | null) => void) => void;
    onData?: (stream: Readable, session: any, callback: (err?: Error | null) => void) => void;
    onRcptTo?: (address: any, session: any, callback: Function) => void;
    onMailFrom?: (address: any, session: any, callback: Function) => void;
  }

  export interface SMTPServerSession {
    id: string;
    transmissionType: string;
    hostNameAppearsAs: string;
    remoteAddress: string;
    clientHostname: string;
    openingCommand: string;
    envelope: {
      mailFrom: { address: string; args?: any };
      rcptTo: Array<{ address: string; args?: any }>;
    };
    socket: TLSSocket | any;
  }

  export class SMTPServer extends Server {
    constructor(options?: SMTPServerOptions);
    
    close(callback?: Function): void;
    listen(port?: number, hostname?: string, callback?: Function): void;
    listen(port?: number, callback?: Function): void;
    listen(callback?: Function): void;
    
    updateSecureContext(options: any): void;
  }
}