export interface Template {
	id: number;
	title: string;
	description: string;
	category: string;
	type: 'certified' | 'direct';
	deliveryMethod: string;
	metrics: {
		messages?: string;
		districts?: string;
		tooltip: string;
		verification?: string;
		reach?: string;
		target?: string;
	};
	preview: string;
}