/**
 * ZIP Code to Congressional District Lookup Service
 * Uses data from OpenSourceActivismTech/us-zipcodes-congress
 */

interface ZipDistrictRecord {
	state_fips: string;
	state_abbr: string;
	zcta: string;
	cd: string;
}

class ZipDistrictLookupService {
	private lookupTable: Map<string, ZipDistrictRecord[]> = new Map();
	private isLoaded = false;

	/**
	 * Load ZIP-district mapping data
	 */
	async loadData(): Promise<void> {
		if (this.isLoaded) return;

		try {
			const response = await fetch(
				'https://raw.githubusercontent.com/OpenSourceActivismTech/us-zipcodes-congress/master/zccd.csv'
			);
			if (!response.ok) {
				throw new Error(`Failed to fetch ZIP-district data: ${response.status}`);
			}

			const csvText = await response.text();
			const lines = csvText.trim().split('\n');

			// Skip header row
			for (let i = 1; i < lines.length; i++) {
				const [state_fips, state_abbr, zcta, cd] = lines[i].split(',').map((s) => s.trim());

				if (zcta && state_abbr && cd) {
					const record: ZipDistrictRecord = {
						state_fips,
						state_abbr,
						zcta,
						cd
					};

					// Store by ZIP code (can have multiple districts per ZIP)
					if (!this.lookupTable.has(zcta)) {
						this.lookupTable.set(zcta, []);
					}
					this.lookupTable.get(zcta)!.push(record);
				}
			}

			this.isLoaded = true;
			console.log(`Loaded ${this.lookupTable.size} ZIP codes with district mappings`);
		} catch (_error) {
			console.error('Failed to load ZIP-district data:', _error);
			throw _error;
		}
	}

	/**
	 * Look up congressional district(s) for a ZIP code
	 * Returns the most likely district or all possible districts
	 */
	async lookupDistrict(
		zipCode: string,
		state?: string
	): Promise<{
		state: string;
		district: string;
		confidence: 'high' | 'medium' | 'low';
		alternatives?: string[];
	}> {
		await this.loadData();

		// Clean ZIP code (remove +4 extension)
		const cleanZip = zipCode.replace(/\D/g, '').substring(0, 5);

		const records = this.lookupTable.get(cleanZip);

		if (!records || records.length === 0) {
			// No data found - return fallback
			return {
				state: state?.toUpperCase() || 'XX',
				district: '01',
				confidence: 'low'
			};
		}

		// If state is provided, filter by state
		const filteredRecords = state
			? records.filter((r) => r.state_abbr.toUpperCase() === state.toUpperCase())
			: records;

		if (filteredRecords.length === 0) {
			// State mismatch - use first available
			const firstRecord = records[0];
			return {
				state: firstRecord.state_abbr.toUpperCase(),
				district: firstRecord.cd.padStart(2, '0'),
				confidence: 'low'
			};
		}

		if (filteredRecords.length === 1) {
			// Single district - high confidence
			const record = filteredRecords[0];
			return {
				state: record.state_abbr.toUpperCase(),
				district: record.cd.padStart(2, '0'),
				confidence: 'high'
			};
		}

		// Multiple districts - return most common one
		const districtCounts = new Map<string, number>();
		for (const record of filteredRecords) {
			const district = record.cd.padStart(2, '0');
			districtCounts.set(district, (districtCounts.get(district) || 0) + 1);
		}

		// Find the most frequent district
		let mostCommon = '';
		let maxCount = 0;
		for (const [district, count] of districtCounts) {
			if (count > maxCount) {
				maxCount = count;
				mostCommon = district;
			}
		}

		const alternatives = Array.from(districtCounts.keys())
			.filter((d) => d !== mostCommon)
			.sort();

		return {
			state: filteredRecords[0].state_abbr.toUpperCase(),
			district: mostCommon,
			confidence: 'medium',
			alternatives
		};
	}

	/**
	 * Get all possible districts for a ZIP code (for debugging)
	 */
	async getAllDistricts(zipCode: string): Promise<ZipDistrictRecord[]> {
		await this.loadData();
		const cleanZip = zipCode.replace(/\D/g, '').substring(0, 5);
		return this.lookupTable.get(cleanZip) || [];
	}
}

// Export singleton instance
export const zipDistrictLookup = new ZipDistrictLookupService();
