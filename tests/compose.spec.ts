import { expect, test as base, chromium, type Page, type Locator } from '@playwright/test';

// TODO testing environment for authwalled pages

// let page: Page;
// base.beforeAll(async () => {
// 	const browser = await chromium.launch();
// 	page = await browser.newPage();

// 	await page.goto('/compose');
// });

// base.describe('tag', () => {
// 	type TagFixture = {
// 		input: Locator;
// 		tagInterface: Locator;
// 	};
// 	for (const placeholderText of ['Recipient', 'Topic']) {
// 		const test = base.extend<TagFixture>({
// 			input: async ({}, use) => {
// 				await use(page.getByPlaceholder(placeholderText));
// 			},
// 			tagInterface: async ({}, use) => {
// 				await use(
// 					page.getByRole('list').filter({
// 						has: page.getByPlaceholder(placeholderText)
// 					})
// 				);
// 			}
// 		});

// 		test(`${placeholderText.toLowerCase()} input appears/disappears on click`, async ({
// 			input,
// 			tagInterface
// 		}) => {
// 			// invisible by default
// 			await expect(input).toHaveCSS('width', '0px');
// 			// toggle visibility
// 			for (const visible of [true, false]) {
// 				if (visible) {
// 					await tagInterface.getByRole('button').click();
// 					await expect(input).not.toHaveCSS('width', '0px');
// 				} else {
// 					await page.click("input[name='subject']");
// 					await expect(input).toHaveCSS('width', '0px');
// 				}
// 			}
// 		});
// 	}
// });

// base.describe('post', () => {
// 	type EmailFixture = {
// 		topic: string[];
// 		recipient: string[];
// 		subject: string;
// 		body: string;
// 		postStatus: Response;
// 	};
// 	const test = base.extend<EmailFixture>({
// 		topic: async ({}, use) => {
// 			await use(['topic 1', 'topic 2']);
// 		},
// 		recipient: async ({}, use) => {
// 			await use(['email@first.com', 'email@next.com']);
// 		},
// 		subject: async ({}, use) => {
// 			await use("let's talk about: this");
// 		},
// 		body: async ({}, use) => {
// 			// TODO body placeholders
// 			await use(`
// 				Hello,
// 				thank you for reading!
// 				Best regards, {name}
// 			`);
// 		}
// 		// postStatus: async ({ page }, use) => {
// 		// 	await page.route('**/compose/publish', (route) =>
// 		// 		route.fulfill({
// 		// 			status: 200,
// 		// 			body: 'accept'
// 		// 		})
// 		// 	);
// 		// }
// 	});

// 	test.afterEach(async () => {
// 		// erase form
// 		page.reload();
// 	});

// 	for (const placeholderText of ['Recipient', 'Topic']) {
// 		test(`Missing ${placeholderText.toLowerCase()}s caught`, async ({
// 			subject,
// 			recipient,
// 			topic,
// 			body
// 		}) => {
// 			await page.getByPlaceholder('Subject').type(subject);
// 			// fill in one of two taglists
// 			for (const tag of placeholderText == 'Recipient' ? topic : recipient) {
// 				const oppositePlaceholder = placeholderText === 'Recipient' ? 'Topic' : 'Recipient';
// 				await page.getByPlaceholder(oppositePlaceholder).type(tag);
// 				await page.keyboard.press('Enter');
// 			}
// 			await page.locator('.mce-content-body').type(body);
// 			await page.locator("button[name='post']").click();
// 			// check if form focuses input to empty taglist input
// 			await expect(
// 				page.getByPlaceholder(placeholderText == 'Recipient' ? 'Recipient' : 'Topic')
// 			).toBeFocused();
// 		});
// 	}

// 	test(`Missing subject caught`, async ({ topic, recipient, body }) => {
// 		for (const [placeholderText, tags] of Object.entries({
// 			Recipient: recipient,
// 			Topic: topic
// 		})) {
// 			for (const tag of tags) {
// 				await page.getByPlaceholder(placeholderText).type(tag);
// 				await page.keyboard.press('Enter');
// 			}
// 		}
// 		await page.locator('.mce-content-body').type(body);
// 		await page.locator("button[name='post']").click();
// 		// check if form focuses input to empty taglist input
// 		await expect(page.getByPlaceholder('subject')).toBeFocused();
// 	});

// 	// test(`Missing body caught`, async ({ topic, recipient, body, page }) => {});

// 	// test(`Post success confirmation appears after response`, async ({
// 	// 	topic,
// 	// 	recipient,
// 	// 	body,
// 	// 	page
// 	// }) => {});
// });
