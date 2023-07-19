interface LayoutSchema {
	loudestTopics: topic[];
	template: Layout;
	authProviders: AuthSchema;
}

interface Layout {
	primary: Panel;
	secondary: Panel;
	[key: string];
}

interface ModalMap {
	[key: keyof ModalState]: { component: ComponentType; props: ComponentProps };
}
