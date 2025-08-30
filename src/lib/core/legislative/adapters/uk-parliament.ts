import { LegislativeAdapter } from './base';
import type { 
    Address, 
    DeliveryRequest, 
    DeliveryResult, 
    Representative, 
    LegislativeSystem, 
    DeliveryCapability,
    Office
} from './base';

export class UKParliamentAdapter extends LegislativeAdapter {
    readonly country_code = 'UK';
    readonly name = 'United Kingdom Parliament';
    readonly supported_methods = ['email', 'form'];

    async getSystemInfo(): Promise<LegislativeSystem> {
        return {
            country_code: 'UK',
            name: 'Parliament of the United Kingdom',
            type: 'parliamentary',
            chambers: [
                {
                    id: 'uk-commons',
                    jurisdiction_id: 'uk-national',
                    name: 'House of Commons',
                    type: 'lower',
                    seat_count: 650,
                    term_length: 5,
                    external_ids: {}
                },
                {
                    id: 'uk-lords',
                    jurisdiction_id: 'uk-national',
                    name: 'House of Lords',
                    type: 'upper',
                    seat_count: 800, // Approximate
                    term_length: 0, // Life peers
                    external_ids: {}
                }
            ],
            primary_language: 'en',
            supported_languages: ['en', 'cy', 'gd']
        };
    }

    async getCapabilities(): Promise<DeliveryCapability> {
        return {
            country_code: 'UK',
            methods: ['email', 'form'],
            tier: 2,
            provider: 'Parliament.uk',
            config: {
                base_url: 'https://www.parliament.uk'
            }
        };
    }

    async lookupRepresentativesByAddress(address: Address): Promise<Representative[]> {
        try {
            // In a real implementation, this would call the UK Parliament API
            // or a service like MySidebar or Democracy Club
            
            // For now, return placeholder data
            const postcode = address.postal_code || '';
            
            return [
                {
                    id: `uk-mp-${postcode}`,
                    office_id: `uk-commons-${postcode}`,
                    name: `MP for ${postcode} constituency`,
                    party: 'Unknown',
                    external_ids: {
                        parliament_id: `mp-${postcode}`
                    },
                    is_current: true
                }
            ];
        } catch (error) {
            console.error('UK Parliament lookup failed:', error);
            return [];
        }
    }

    async validateRepresentative(representative: Representative): Promise<boolean> {
        // In a real implementation, validate against Parliament API
        return representative.is_current;
    }

    async deliverMessage(request: DeliveryRequest): Promise<DeliveryResult> {
        try {
            // In a real implementation, this would submit via:
            // - Direct email (if available)
            // - Parliament.uk contact form
            // - Third-party service like MySidebar
            
            // For now, simulate successful delivery
            return {
                success: true,
                message_id: `uk-msg-${Date.now()}`,
                metadata: {
                    provider: 'UK Parliament',
                    method: 'email',
                    representative: request.representative.name
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'UK Parliament submission failed',
                metadata: {
                    provider: 'UK Parliament',
                    representative: request.representative.name
                }
            };
        }
    }

    formatRepresentativeName(rep: Representative): string {
        return `${rep.name} MP`;
    }

    formatOfficeTitle(office: Office): string {
        if (office.id.includes('commons')) {
            return 'Member of Parliament';
        } else if (office.id.includes('lords')) {
            return 'Member of the House of Lords';
        }
        return office.title;
    }
}