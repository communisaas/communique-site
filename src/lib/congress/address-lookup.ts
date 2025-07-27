import { env } from '$env/dynamic/private';

interface Address {
    street: string;
    city: string;
    state: string;
    zip: string;
}

interface CongressionalDistrict {
    state: string;
    district: string; // "01", "02", etc. Senate uses "00"
}

interface Representative {
    bioguideId: string;
    name: string;
    party: string;
    state: string;
    district: string;
    chamber: 'house' | 'senate';
    phone?: string;
    email?: string;
    officeCode: string; // For CWC submissions
}

interface UserReps {
    house: Representative;
    senate: Representative[]; // Always 2 senators per state
    district: CongressionalDistrict;
}

export class AddressLookupService {
    private congressApiKey: string;
    
    constructor() {
        this.congressApiKey = env.CONGRESS_API_KEY;
        if (!this.congressApiKey) {
            throw new Error('CONGRESS_API_KEY environment variable is required');
        }
    }

    /**
     * Main function: Address → User's Representatives
     * This is called during user onboarding
     */
    async lookupRepsByAddress(address: Address): Promise<UserReps> {
        // Step 1: Address → Congressional District
        const district = await this.addressToDistrict(address);
        
        // Step 2: District → Representatives
        const [houseRep, senators] = await Promise.all([
            this.getHouseRep(district.state, district.district),
            this.getSenators(district.state)
        ]);

        return {
            house: houseRep,
            senate: senators,
            district
        };
    }

    /**
     * Convert address to congressional district
     * Using Google Civic Information API (more reliable than Congress.gov for address lookup)
     */
    private async addressToDistrict(address: Address): Promise<CongressionalDistrict> {
        try {
            // Format address for Google Civic API
            const formattedAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
            
            // Use Google Civic Information API
            const civicApiKey = env.GOOGLE_CIVIC_API_KEY;
            if (!civicApiKey) {
                // Fallback: Extract district from ZIP code (less accurate)
                return this.zipToDistrict(address.zip, address.state);
            }

            const { api } = await import('$lib/utils/apiClient');
            const result = await api.get(
                `https://www.googleapis.com/civicinfo/v2/representatives?key=${civicApiKey}&address=${encodeURIComponent(formattedAddress)}`
            );
            
            if (!result.success) {
                throw new Error(`Google Civic API error: ${result.error}`);
            }
            
            const data = result.data;
            
            // Extract congressional district from response
            const district = this.extractDistrictFromCivicData(data, address.state);
            return district;
            
        } catch (error) {
            // Fallback to ZIP-based lookup
            return this.zipToDistrict(address.zip, address.state);
        }
    }

    /**
     * Extract congressional district from Google Civic API response
     */
    private extractDistrictFromCivicData(civicData: Record<string, unknown>, state: string): CongressionalDistrict {
        try {
            // Look for congressional district in the divisions
            const divisions = civicData.divisions || {};
            
            for (const [divisionId, division] of Object.entries(divisions)) {
                // Congressional district format: "ocd-division/country:us/state:ca/cd:12"
                const match = divisionId.match(/\/state:([a-z]{2})\/cd:(\d+)$/);
                if (match) {
                    const [, stateCode, districtNum] = match;
                    if (stateCode.toUpperCase() === state.toUpperCase()) {
                        return {
                            state: state.toUpperCase(),
                            district: districtNum.padStart(2, '0') // "01", "02", etc.
                        };
                    }
                }
            }
            
            // If no congressional district found, might be at-large district
            return {
                state: state.toUpperCase(),
                district: '00' // At-large or fallback
            };
            
        } catch (error) {
            return {
                state: state.toUpperCase(),
                district: '01' // Default fallback
            };
        }
    }

    /**
     * Fallback: ZIP code to district lookup
     * This is less accurate but works without Google Civic API
     */
    private async zipToDistrict(zip: string, state: string): Promise<CongressionalDistrict> {
        try {
            // Use a ZIP → Congressional District API or lookup table
            // For now, we'll use a simple approach and enhance later
            
            // Clean ZIP code
            const cleanZip = zip.replace(/\D/g, '').substring(0, 5);
            
            // TODO: Implement actual ZIP → District lookup
            // This could use a service like:
            // - unitedstateszip.org API
            // - Congress.gov district lookup
            // - Local lookup table
            
            
            
            // For now, return a placeholder
            // In production, implement actual lookup
            return {
                state: state.toUpperCase(),
                district: '01' // Placeholder - implement real lookup
            };
            
        } catch (error) {
            return {
                state: state.toUpperCase(),
                district: '01' // Fallback
            };
        }
    }

    /**
     * Get House representative for a specific district
     */
    private async getHouseRep(state: string, district: string): Promise<Representative> {
        try {
            const { api } = await import('$lib/utils/apiClient');
            const result = await api.get(
                `https://api.data.gov/congress/v3/member?api_key=${this.congressApiKey}&format=json&currentMember=true&state=${state}&limit=50`
            );
            
            if (!result.success) {
                throw new Error(`Congress API error: ${result.error}`);
            }
            
            const data = result.data;
            const members = data.members || [];
            
            // Find the House rep for this district
            const houseRep = members.find((member: any) => 
                member.terms?.[0]?.chamber?.toLowerCase() === 'house' && 
                member.district === district.replace(/^0+/, '') // Remove leading zeros
            );
            
            if (!houseRep) {
                throw new Error(`No House representative found for ${state}-${district}`);
            }
            
            return this.formatRepresentative(houseRep, 'house');
            
        } catch (error) {
            // Return placeholder data
            return {
                bioguideId: `${state}${district}H`,
                name: `Representative for ${state}-${district}`,
                party: 'Unknown',
                state,
                district,
                chamber: 'house',
                officeCode: `${state}${district}H`
            };
        }
    }

    /**
     * Get both senators for a state
     */
    private async getSenators(state: string): Promise<Representative[]> {
        try {
            const { api } = await import('$lib/utils/apiClient');
            const result = await api.get(
                `https://api.data.gov/congress/v3/member?api_key=${this.congressApiKey}&format=json&currentMember=true&state=${state}&limit=50`
            );
            
            if (!result.success) {
                throw new Error(`Congress API error: ${result.error}`);
            }
            
            const data = result.data;
            const members = data.members || [];
            
            // Find both senators for this state
            const senators = members
                .filter((member: any) => member.terms?.[0]?.chamber?.toLowerCase() === 'senate')
                .slice(0, 2) // Should be exactly 2 senators
                .map((senator: any) => this.formatRepresentative(senator, 'senate'));
            
            if (senators.length === 0) {
                // Return placeholder senators
                return [
                    {
                        bioguideId: `${state}S1`,
                        name: `Senior Senator for ${state}`,
                        party: 'Unknown',
                        state,
                        district: '00',
                        chamber: 'senate',
                        officeCode: `${state}S1`
                    },
                    {
                        bioguideId: `${state}S2`,
                        name: `Junior Senator for ${state}`,
                        party: 'Unknown',
                        state,
                        district: '00',
                        chamber: 'senate',
                        officeCode: `${state}S2`
                    }
                ];
            }
            
            return senators;
            
        } catch (error) {
            // Return placeholder senators
            return [
                {
                    bioguideId: `${state}S1`,
                    name: `Senior Senator for ${state}`,
                    party: 'Unknown',
                    state,
                    district: '00',
                    chamber: 'senate',
                    officeCode: `${state}S1`
                },
                {
                    bioguideId: `${state}S2`,
                    name: `Junior Senator for ${state}`,
                    party: 'Unknown',
                    state,
                    district: '00',
                    chamber: 'senate',
                    officeCode: `${state}S2`
                }
            ];
        }
    }

    /**
     * Format representative data from Congress.gov API
     */
    private formatRepresentative(member: any, chamber: 'house' | 'senate'): Representative {
        return {
            bioguideId: member.bioguideId || '',
            name: member.name || '',
            party: member.partyName || 'Unknown',
            state: member.state || '',
            district: chamber === 'senate' ? '00' : (member.district || '01'),
            chamber,
            officeCode: member.bioguideId || ''
        };
    }

    /**
     * Validate that representatives are current and active
     */
    async validateReps(reps: UserReps): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        try {
            // Check if all reps are still current
            const allReps = [reps.house, ...reps.senate];
            
            for (const rep of allReps) {
                const { api } = await import('$lib/utils/apiClient');
                const result = await api.get(
                    `https://api.data.gov/congress/v3/member/${rep.bioguideId}?api_key=${this.congressApiKey}&format=json`
                );
                
                if (!result.success) {
                    errors.push(`Cannot validate representative ${rep.name} (${rep.bioguideId})`);
                    continue;
                }
                
                const data = result.data;
                const member = data.member;
                
                if (!member?.currentMember) {
                    errors.push(`Representative ${rep.name} is no longer serving`);
                }
            }
            
        } catch (error) {
            errors.push(`Validation failed: ${error}`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Export singleton instance
export const addressLookup = new AddressLookupService(); 