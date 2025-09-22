/**
 * CWC XML Message Builder
 * Constructs XML messages compliant with Senate CWC API requirements
 */

import type { CWCXMLMessage } from './types.js';

export class CWCXMLBuilder {
	/**
	 * Build complete XML message for CWC API submission
	 */
	static buildXMLMessage(messageData: CWCXMLMessage): string {
		return `<?xml version="1.0" encoding="UTF-8"?>
<CWC_Message>
${this.buildDeliveryAgentXML(messageData.DeliveryAgent)}
${this.buildRecipientXML(messageData.Recipient)}
${this.buildConstituentXML(messageData.Constituent)}
${this.buildMessageXML(messageData.Message)}
${this.buildCampaignXML(messageData.Campaign)}
</CWC_Message>`;
	}

	/**
	 * Build DeliveryAgent section
	 */
	private static buildDeliveryAgentXML(deliveryAgent: CWCXMLMessage['DeliveryAgent']): string {
		return `	<DeliveryAgent>
		<DeliveryAgentId>${this.escapeXML(deliveryAgent.DeliveryAgentId)}</DeliveryAgentId>
		<DeliveryAgentName>${this.escapeXML(deliveryAgent.DeliveryAgentName)}</DeliveryAgentName>
		<DeliveryAgentContact>${this.escapeXML(deliveryAgent.DeliveryAgentContact)}</DeliveryAgentContact>
		<DeliveryAgentAcknowledgementEmail>${this.escapeXML(deliveryAgent.DeliveryAgentAcknowledgementEmail)}</DeliveryAgentAcknowledgementEmail>
		<DeliveryAgentAcknowledgement>${deliveryAgent.DeliveryAgentAcknowledgement}</DeliveryAgentAcknowledgement>
	</DeliveryAgent>`;
	}

	/**
	 * Build Recipient section
	 */
	private static buildRecipientXML(recipient: CWCXMLMessage['Recipient']): string {
		return `	<Recipient>
		<MemberOffice>${this.escapeXML(recipient.MemberOffice)}</MemberOffice>
		<IsResponseRequested>${recipient.IsResponseRequested}</IsResponseRequested>
		<Newsletter>${recipient.Newsletter}</Newsletter>
	</Recipient>`;
	}

	/**
	 * Build Constituent section
	 */
	private static buildConstituentXML(constituent: CWCXMLMessage['Constituent']): string {
		const optionalFields = [];

		if (constituent.Prefix) {
			optionalFields.push(`		<Prefix>${this.escapeXML(constituent.Prefix)}</Prefix>`);
		}
		if (constituent.MiddleName) {
			optionalFields.push(`		<MiddleName>${this.escapeXML(constituent.MiddleName)}</MiddleName>`);
		}
		if (constituent.Suffix) {
			optionalFields.push(`		<Suffix>${this.escapeXML(constituent.Suffix)}</Suffix>`);
		}
		if (constituent.Title) {
			optionalFields.push(`		<Title>${this.escapeXML(constituent.Title)}</Title>`);
		}
		if (constituent.OrganizationName) {
			optionalFields.push(
				`		<OrganizationName>${this.escapeXML(constituent.OrganizationName)}</OrganizationName>`
			);
		}
		if (constituent.Address) {
			optionalFields.push(`		<Address >${this.escapeXML(constituent.Address)}</Address >`);
		}
		if (constituent.Zip4) {
			optionalFields.push(`		<Zip4>${this.escapeXML(constituent.Zip4)}</Zip4>`);
		}
		if (constituent.Phone) {
			optionalFields.push(`		<Phone>${this.escapeXML(constituent.Phone)}</Phone>`);
			if (constituent.PhoneType) {
				optionalFields.push(`		<PhoneType>${constituent.PhoneType}</PhoneType>`);
			}
		}
		if (constituent.EmailType) {
			optionalFields.push(`		<EmailType>${constituent.EmailType}</EmailType>`);
		}

		return `	<Constituent>
${constituent.Prefix ? `		<Prefix>${this.escapeXML(constituent.Prefix)}</Prefix>` : ''}
		<FirstName>${this.escapeXML(constituent.FirstName)}</FirstName>
${constituent.MiddleName ? `		<MiddleName>${this.escapeXML(constituent.MiddleName)}</MiddleName>` : ''}
		<LastName>${this.escapeXML(constituent.LastName)}</LastName>
${constituent.Suffix ? `		<Suffix>${this.escapeXML(constituent.Suffix)}</Suffix>` : ''}
${constituent.Title ? `		<Title>${this.escapeXML(constituent.Title)}</Title>` : ''}
${constituent.OrganizationName ? `		<OrganizationName>${this.escapeXML(constituent.OrganizationName)}</OrganizationName>` : ''}
${constituent.Address ? `		<Address >${this.escapeXML(constituent.Address)}</Address >` : ''}
		<City>${this.escapeXML(constituent.City)}</City>
		<StateAbbreviation>${this.escapeXML(constituent.StateAbbreviation)}</StateAbbreviation>
		<Zip>${this.escapeXML(constituent.Zip)}</Zip>
${constituent.Zip4 ? `		<Zip4>${this.escapeXML(constituent.Zip4)}</Zip4>` : ''}
${constituent.Phone ? `		<Phone>${this.escapeXML(constituent.Phone)}</Phone>` : ''}
${constituent.Phone && constituent.PhoneType ? `		<PhoneType>${constituent.PhoneType}</PhoneType>` : ''}
		<Email>${this.escapeXML(constituent.Email)}</Email>
${constituent.EmailType ? `		<EmailType>${constituent.EmailType}</EmailType>` : ''}
	</Constituent>`;
	}

	/**
	 * Build Message section
	 */
	private static buildMessageXML(message: CWCXMLMessage['Message']): string {
		return `	<Message>
		<MessageId>${this.escapeXML(message.MessageId)}</MessageId>
		<Subject>${this.escapeXML(message.Subject)}</Subject>
		<MessageText>${this.escapeXML(message.MessageText)}</MessageText>
${message.Topic ? `		<Topic>${this.escapeXML(message.Topic)}</Topic>` : ''}
${message.BillCongress ? `		<BillCongress>${this.escapeXML(message.BillCongress)}</BillCongress>` : ''}
${message.BillTypeAbbreviation ? `		<BillTypeAbbreviation>${this.escapeXML(message.BillTypeAbbreviation)}</BillTypeAbbreviation>` : ''}
${message.BillNumber ? `		<BillNumber>${this.escapeXML(message.BillNumber)}</BillNumber>` : ''}
	</Message>`;
	}

	/**
	 * Build Campaign section
	 */
	private static buildCampaignXML(campaign: CWCXMLMessage['Campaign']): string {
		return `	<Campaign>
		<CampaignId>${this.escapeXML(campaign.CampaignId)}</CampaignId>
${campaign.OrganizationName ? `		<OrganizationName>${this.escapeXML(campaign.OrganizationName)}</OrganizationName>` : ''}
${campaign.OrganizationURL ? `		<OrganizationURL>${this.escapeXML(campaign.OrganizationURL)}</OrganizationURL>` : ''}
	</Campaign>`;
	}

	/**
	 * Escape XML special characters
	 */
	private static escapeXML(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Generate unique message ID
	 */
	static generateMessageId(templateId: string, userId: string): string {
		const timestamp = Date.now();
		return `COMMUNIQUE_${templateId}_${userId}_${timestamp}`;
	}
}
