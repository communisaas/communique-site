import { describe, it, expect } from 'vitest';
import { verifyEmailInContent } from '$lib/core/agents/utils/grounding';

const pages = [
	{
		url: 'https://www.cityofportland.gov/staff',
		title: 'City Staff Directory',
		text: 'Mayor Ted Wheeler\nEmail: mayor@portlandoregon.gov\nPhone: 503-823-4120'
	},
	{
		url: 'https://www.oregonlive.com/politics/portland-mayor',
		title: 'Portland Mayor Profile - OregonLive',
		text: 'Ted Wheeler serves as mayor. Contact: mayor@portlandoregon.gov or press@oregonlive.com'
	},
	{
		url: 'https://en.wikipedia.org/wiki/Ted_Wheeler',
		title: 'Ted Wheeler - Wikipedia',
		text: 'Ted Wheeler is an American politician serving as the mayor of Portland, Oregon.'
	}
];

describe('verifyEmailInContent', () => {
	it('returns verified true when email is found verbatim in page text', () => {
		const result = verifyEmailInContent('mayor@portlandoregon.gov', pages);

		expect(result.verified).toBe(true);
		expect(result.email).toBe('mayor@portlandoregon.gov');
		expect(result.sourceUrl).toBeDefined();
		expect(result.sourceTitle).toBeDefined();
	});

	it('matches email case-insensitively', () => {
		const result = verifyEmailInContent('Mayor@PortlandOregon.GOV', pages);

		expect(result.verified).toBe(true);
		expect(result.email).toBe('Mayor@PortlandOregon.GOV');
	});

	it('returns verified false for NO_EMAIL_FOUND sentinel', () => {
		const result = verifyEmailInContent('NO_EMAIL_FOUND', pages);

		expect(result.verified).toBe(false);
	});

	it('returns verified false for empty email', () => {
		const result = verifyEmailInContent('', pages);

		expect(result.verified).toBe(false);
	});

	it('returns verified false for email without @', () => {
		const result = verifyEmailInContent('not-an-email', pages);

		expect(result.verified).toBe(false);
	});

	it('returns verified false when email is not in any page', () => {
		const result = verifyEmailInContent('nobody@nowhere.com', pages);

		expect(result.verified).toBe(false);
		expect(result.sourceUrl).toBeUndefined();
		expect(result.sourceTitle).toBeUndefined();
	});

	it('ranks official org domain higher than news site when email appears in multiple pages', () => {
		const result = verifyEmailInContent(
			'mayor@portlandoregon.gov',
			pages,
			'Ted Wheeler',
			'City of Portland'
		);

		expect(result.verified).toBe(true);
		// The .gov staff directory should rank higher than oregonlive.com
		expect(result.sourceUrl).toBe('https://www.cityofportland.gov/staff');
		expect(result.sourceTitle).toBe('City Staff Directory');
	});

	it('returns the single matching page when only one page contains the email', () => {
		const result = verifyEmailInContent('press@oregonlive.com', pages);

		expect(result.verified).toBe(true);
		expect(result.sourceUrl).toBe('https://www.oregonlive.com/politics/portland-mayor');
		expect(result.sourceTitle).toBe('Portland Mayor Profile - OregonLive');
	});

	it('returns verified false when pages array is empty', () => {
		const result = verifyEmailInContent('mayor@portlandoregon.gov', []);

		expect(result.verified).toBe(false);
	});
});
