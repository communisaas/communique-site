interface Expandable {
	type: 'panel';
}

interface Panel extends Expandable {
	header: string;
	focus: Descriptor<string>;
	alignment: 'start' | 'end' | 'left' | 'right' | 'center' | 'justify' | 'match-parent';
	cardList: email[];
}

type SelectableKey = 'option' | 'email' | 'topic' | 'recipient' | 'spotlight';
interface Selectable {
	id: string;
	type: SelectableKey;
	target?: SelectableKey;
	index?: number;
	content?: email;
}

interface MenuItemClickArgs {
	event?: MouseEvent | KeyboardEvent;
	focusableElements?: HTMLElement[];
}

type MenuItem = {
	name: string;
	key: string;
	class: string;
	show: boolean;
	actionToggled: boolean;
	actionComponent: SvelteComponent;
	onClick: (MenuItemClickArgs?) => void;
};

interface Settable {
	name: string;
	description: string;
	inputType:
		| radio
		| checkbox
		| text
		| textarea
		| select
		| number
		| date
		| time
		| datetime
		| email
		| url
		| search
		| tel
		| color;
	key: string;
	onUpdate: (e: FormEventHandler<HTMLInputElement>) => void;
}

interface Props {
	[key: string]: unknown;
}

// load props from a function that runs after the component mounts
type ComponentProps = () => Props;

interface ButtonElementMap {
	[key: string]: HTMLButtonElement;
}

interface FlagMap {
	[key: string]: boolean;
}
