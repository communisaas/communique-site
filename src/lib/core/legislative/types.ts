/**
 * Legislative Provider Interface
 *
 * Abstract interface for interacting with legislative bodies (Congress, State Legislatures, etc.)
 * Decouples the application from specific implementation details (like CWC).
 */

export interface Representative {
	name: string;
	party: string;
	chamber: 'house' | 'senate' | string;
	state: string;
	district: string;
	bioguideId?: string;
	email?: string; // Some state reps might have direct email
}

export interface LegislativeProvider {
	/**
	 * Get representatives for a specific address
	 */
	getRepresentatives(address: {
		street: string;
		city: string;
		state: string;
		zip: string;
	}): Promise<Representative[]>;

	/**
	 * Submit a message to a specific representative
	 */
	submitMessage(
		representative: Representative,
		message: {
			subject: string;
			body: string;
			topic?: string;
		},
		constituent: {
			firstName: string;
			lastName: string;
			email: string;
			address: {
				street: string;
				city: string;
				state: string;
				zip: string;
			};
			phone?: string;
		}
	): Promise<{
		success: boolean;
		confirmationCode?: string;
		error?: string;
	}>;
}
