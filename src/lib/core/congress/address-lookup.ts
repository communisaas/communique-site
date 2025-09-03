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
        this.congressApiKey = env.CWC_API_KEY || '';
        // Only throw error if we're in production and the key is missing
        if (!this.congressApiKey && env.NODE_ENV === 'production') {
            console.warn('CWC_API_KEY environment variable is missing - CWC features will be disabled');
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
     * Primary: Census Bureau Geocoding API; Fallback: ZIP→district
     */
    private async addressToDistrict(address: Address): Promise<CongressionalDistrict> {
        try {
            const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
            const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(fullAddress)}&benchmark=4&vintage=4&format=json`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Census geocoding API error: ${response.status}`);
            }

            const data = await response.json();
            const match = data?.result?.addressMatches?.[0];
            if (!match) {
                // No match; fallback to ZIP-based
                return this.zipToDistrict(address.zip, address.state);
            }

            const district = this.extractDistrictFromCensus(match.geographies, address.state);
            return district;
        } catch (_err) {
            // Fallback to ZIP-based lookup
            return this.zipToDistrict(address.zip, address.state);
        }
    }

    /**
     * Extract congressional district from Census Bureau geocoding response
     */
    private extractDistrictFromCensus(geographies: Record<string, any>, state: string): CongressionalDistrict {
        try {
            const districts = geographies?.['119th Congressional Districts'];
            if (Array.isArray(districts) && districts.length > 0) {
                const cd = districts[0]?.CD119;
                if (cd === '98') {
                    // DC delegate special case → at-large
                    return { state: state.toUpperCase(), district: '00' };
                }
                return {
                    state: state.toUpperCase(),
                    district: String(cd).padStart(2, '0')
                };
            }
            return { state: state.toUpperCase(), district: '00' };
        } catch (_e) {
            return { state: state.toUpperCase(), district: '01' };
        }
    }

    /**
     * Fallback: ZIP code to district lookup using real data
     * Uses OpenSourceActivismTech ZIP-district mapping
     */
    private async zipToDistrict(zip: string, state: string): Promise<CongressionalDistrict> {
        try {
            const { zipDistrictLookup } = await import('$lib/services/zipDistrictLookup');
            const result = await zipDistrictLookup.lookupDistrict(zip, state);
            
            return {
                state: result.state,
                district: result.district
            };
            
        } catch (error) {
            console.error('ZIP district lookup failed:', error);
            return {
                state: state.toUpperCase(),
                district: '01' // Final fallback
            };
        }
    }

    /**
     * Get House representative for a specific district
     */
    private async getHouseRep(state: string, district: string): Promise<Representative> {
        try {
            const { api } = await import('$lib/core/api/client');
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
            const { api } = await import('$lib/core/api/client');
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
                const { api } = await import('$lib/core/api/client');
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