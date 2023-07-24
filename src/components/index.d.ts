interface Expandable {
	type: 'panel';
}

interface Panel extends Expandable {
	header: string;
	focus: SelectableKey;
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
