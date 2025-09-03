// Shared verification session storage
// In production, this would be Redis/Database

interface VerificationSession {
	userId: string;
	templateSlug: string;
	disclosures: Record<string, any>;
	qrCodeData: string;
	status: 'pending' | 'verified' | 'failed';
	credentialSubject?: any;
	createdAt: Date;
}

// In-memory storage for verification sessions (use Redis/DB in production)
export const verificationSessions = new Map<string, VerificationSession>();

// Cleanup function to remove old sessions
export function cleanupOldSessions() {
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
	for (const [key, session] of verificationSessions.entries()) {
		if (session.createdAt < oneHourAgo) {
			verificationSessions.delete(key);
		}
	}
}

export type { VerificationSession };