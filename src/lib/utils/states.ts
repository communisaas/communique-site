export const STATE_ABBREVIATIONS: Record<string, string> = {
	AL: 'Alabama',
	AK: 'Alaska',
	AZ: 'Arizona',
	AR: 'Arkansas',
	CA: 'California',
	CO: 'Colorado',
	CT: 'Connecticut',
	DE: 'Delaware',
	DC: 'District of Columbia',
	FL: 'Florida',
	GA: 'Georgia',
	HI: 'Hawaii',
	ID: 'Idaho',
	IL: 'Illinois',
	IN: 'Indiana',
	IA: 'Iowa',
	KS: 'Kansas',
	KY: 'Kentucky',
	LA: 'Louisiana',
	ME: 'Maine',
	MD: 'Maryland',
	MA: 'Massachusetts',
	MI: 'Michigan',
	MN: 'Minnesota',
	MS: 'Mississippi',
	MO: 'Missouri',
	MT: 'Montana',
	NE: 'Nebraska',
	NV: 'Nevada',
	NH: 'New Hampshire',
	NJ: 'New Jersey',
	NM: 'New Mexico',
	NY: 'New York',
	NC: 'North Carolina',
	ND: 'North Dakota',
	OH: 'Ohio',
	OK: 'Oklahoma',
	OR: 'Oregon',
	PA: 'Pennsylvania',
	RI: 'Rhode Island',
	SC: 'South Carolina',
	SD: 'South Dakota',
	TN: 'Tennessee',
	TX: 'Texas',
	UT: 'Utah',
	VT: 'Vermont',
	VA: 'Virginia',
	WA: 'Washington',
	WV: 'West Virginia',
	WI: 'Wisconsin',
	WY: 'Wyoming',
	AS: 'American Samoa',
	GU: 'Guam',
	MP: 'Northern Mariana Islands',
	PR: 'Puerto Rico',
	VI: 'U.S. Virgin Islands'
};

export const STATE_NAMES: Record<string, string> = Object.fromEntries(
	Object.entries(STATE_ABBREVIATIONS).map(([abbr, name]) => [name, abbr])
);

// Type for normalized state result
export interface NormalizedState {
	abbreviation: string;
	fullName: string;
}

export function normalizeState(state: string): NormalizedState {
	if (typeof state !== 'string' || state.trim() === '') {
		return {
			abbreviation: '',
			fullName: ''
		};
	}

	const trimmedState = state.trim();
	const upperState = trimmedState.toUpperCase();

	// Check if it's a valid 2-letter abbreviation
	if (upperState.length === 2 && STATE_ABBREVIATIONS[upperState]) {
		return {
			abbreviation: upperState,
			fullName: STATE_ABBREVIATIONS[upperState]
		};
	}

	// Check if it's a valid full state name
	if (STATE_NAMES[trimmedState]) {
		return {
			abbreviation: STATE_NAMES[trimmedState],
			fullName: trimmedState
		};
	}

	// Fallback for unrecognized input
	return {
		abbreviation: upperState.substring(0, 2),
		fullName: trimmedState
	};
}
