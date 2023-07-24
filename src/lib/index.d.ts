interface UserState {
	option: Selectable;
	topic: Selectable;
	email: Selectable;
	recipient: Selectable;
	spotlight: Selectable;
	template: Layout;
	// TODO sync embeddings of these for logged-in users
	hiddenEmails: string[];
	hiddenTopics: string[];
	loginCallbackURL?: `/${string}`;
	show: ModalState;
	[key: string];
}

interface ModalState {
	login: boolean;
	share: boolean;
	termsOfUse: boolean;
	privacyPolicy: boolean;
	[key: string];
}

interface BigInt {
	toJSON(): string;
}
