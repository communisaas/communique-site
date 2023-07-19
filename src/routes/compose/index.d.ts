interface ComposeSchema extends LayoutSchema {
	profilerKey: string;
	profilerURL: string;
	profilerScriptURL: string;
	editorKey: string;
}

interface RawEmailForm {
	shortid: string;
	subject: string;
	body: string;
	topic_list: string;
	recipient_list: string;
	[key: string];
}

interface EmailFormInput extends RawEmailForm {
	topic_list: string[];
	recipient_list: string[];
}
