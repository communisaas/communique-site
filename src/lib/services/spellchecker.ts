import spell from 'spell-checker-js';

class SpellcheckerService {
	private isLoaded = false;
	private variableRegex = /\[(.*?)\]/g;

	constructor() {
		this.loadDictionary();
	}

	private async loadDictionary(): Promise<void> {
		if (this.isLoaded) {
			return;
		}

		try {
			await new Promise<void>((resolve, reject) => {
				spell.load({ input: 'en', async: true }, (err) => {
					if (err) {
						console.error('Failed to load dictionary:', err);
						reject(err);
						return;
					}
					this.isLoaded = true;
					resolve();
				});
			});
		} catch (error) {
			console.error('Error loading spellchecker dictionary:', error);
		}
	}

	private sanitizeText(text: string): string[] {
		// Remove variables and then split into words
		const sanitized = text.replace(this.variableRegex, '');
		// Tokenize: split by spaces and punctuation, remove empty strings
		return sanitized.split(/[\s,.;:!?]+/).filter(Boolean);
	}

	public async getMisspelledWords(text: string): Promise<Set<string>> {
		if (!this.isLoaded) {
			await this.loadDictionary();
		}

		const words = this.sanitizeText(text);
		const misspelled = spell.check(words.join(' '));

		return new Set(misspelled);
	}
}

export const spellcheckerService = new SpellcheckerService(); 