interface ProviderStyle {
	logo: `/${string}.svg`;
	logoDark: `/${string}.svg`;
	bg: `#${string}`;
	text: `#${string}`;
	bgDark: `#${string}`;
	textDark: `#${string}`;
}

interface ProviderAttributes extends Provider {
	id: string;
	name: string;
	style: ProviderStyle;
}

interface AuthSchema {
	baseLogoURL: `https://${string}.svg`;
	providers: Record<string, ProviderAttributes>;
}
