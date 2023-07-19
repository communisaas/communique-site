interface ProviderStyle {
	logo: `/${string}.svg`;
	logoDark: `/${string}.svg`;
	bg: `#${string}`;
	text: `#${string}`;
	bgDark: `#${string}`;
	textDark: `#${string}`;
}

type ProviderAttributes = {
	id: string;
	name: string;
	style: ProviderStyle;
};

interface AuthSchema {
	baseLogoURL: `https://${string}.svg`;
	providers: Record<'id', ProviderAttributes>;
}
