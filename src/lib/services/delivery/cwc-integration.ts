/**
 * CWC API Integration
 * Handles submission of messages to Congressional Web Contact API
 */

import axios from 'axios';
import config from './config';

/**
 * CWC API Client
 */
class CWCClient {
	constructor() {
		this.apiKey = config.cwc.apiKey;
		this.apiUrl = config.cwc.apiUrl;
		this.deliveryAgent = config.cwc.deliveryAgent;
		this.campaignId = config.cwc.campaignId;
	}

	/**
	 * Submit message to CWC API
	 */
	async submitMessage(messageData) {
		try {
			const xmlMessage = this.buildCWCXML(messageData);

			const response = await axios.post(`${this.apiUrl}/submit`, xmlMessage, {
				headers: {
					'Content-Type': 'application/xml',
					Authorization: `Bearer ${this.apiKey}`,
					'User-Agent': 'Delivery-Platform/1.0'
				},
				timeout: 30000 // 30 second timeout
			});

			return {
				success: true,
				submissionId: response.data.submissionId || `CWC_${Date.now()}`,
				messageId: messageData.messageId,
				response: response.data
			};
		} catch (error: any) {
			console.error('CWC API submission failed:', error.response?.data || error.message);

			return {
				success: false,
				error: error.response?.data?.message || error.message,
				messageId: messageData.messageId,
				statusCode: error.response?.status
			};
		}
	}

	/**
	 * Build CWC XML from parsed message data
	 */
	buildCWCXML(messageData) {
		const { templateId, userId, subject, text, personalConnection, userProfile, recipientOffice } =
			messageData;

		// Generate unique message ID
		const cwcMessageId = `DELIVERY_${templateId}_${userId}_${Date.now()}`;

		// Combine personal connection with template content
		let messageText = text;
		if (personalConnection) {
			messageText = `${personalConnection}\n\n---\n\n${text}`;
		}

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CWC_Message>
	<DeliveryAgent>
		<DeliveryAgentId>${this.escapeXML(this.deliveryAgent.id)}</DeliveryAgentId>
		<DeliveryAgentName>${this.escapeXML(this.deliveryAgent.name)}</DeliveryAgentName>
		<DeliveryAgentContact>${this.escapeXML(this.deliveryAgent.contact)}</DeliveryAgentContact>
		<DeliveryAgentAcknowledgementEmail>${this.escapeXML(this.deliveryAgent.acknowledgementEmail)}</DeliveryAgentAcknowledgementEmail>
		<DeliveryAgentAcknowledgement>${this.deliveryAgent.ack}</DeliveryAgentAcknowledgement>
	</DeliveryAgent>
	<Recipient>
		<MemberOffice>${this.escapeXML(recipientOffice || 'AUTO_DETECT')}</MemberOffice>
		<IsResponseRequested>N</IsResponseRequested>
		<Newsletter>N</Newsletter>
	</Recipient>
	<Constituent>
		<FirstName>${this.escapeXML(userProfile?.firstName || '')}</FirstName>
		<LastName>${this.escapeXML(userProfile?.lastName || '')}</LastName>
		<Address1>${this.escapeXML(userProfile?.address1 || '')}</Address1>
		${userProfile?.address2 ? `<Address2>${this.escapeXML(userProfile.address2)}</Address2>` : ''}
		<City>${this.escapeXML(userProfile?.city || '')}</City>
		<StateAbbreviation>${this.escapeXML(userProfile?.state || '')}</StateAbbreviation>
		<Zip>${this.escapeXML(userProfile?.zip || '')}</Zip>
		<Email>${this.escapeXML(userProfile?.email || '')}</Email>
	</Constituent>
	<Message>
		<MessageId>${this.escapeXML(cwcMessageId)}</MessageId>
		<Subject>${this.escapeXML(subject)}</Subject>
		<MessageText>${this.escapeXML(messageText)}</MessageText>
	</Message>
	<Campaign>
		<CampaignId>${this.escapeXML(this.campaignId)}</CampaignId>
		<OrganizationName>${this.escapeXML(this.deliveryAgent.name)}</OrganizationName>
	</Campaign>
</CWC_Message>`;

		return xml;
	}

	/**
	 * Escape XML special characters
	 */
	escapeXML(text) {
		if (typeof text !== 'string') return '';

		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}
}

/**
 * Fetch user profile from API
 */
async function fetchUserProfile(userId: any) {
	try {
		const response = await axios.get(`${config.communique.apiUrl}/users/${userId}`, {
			headers: {
				Authorization: `Bearer ${config.communique.apiKey}`,
				'Content-Type': 'application/json'
			},
			timeout: 10000
		});

		return response.data.user;
	} catch (error: any) {
		console.error('Failed to fetch user profile:', error.message);
		return null;
	}
}

/**
 * Fetch template data from API
 */
async function fetchTemplate(templateId: any) {
	try {
		const response = await axios.get(`${config.communique.apiUrl}/templates/${templateId}`, {
			headers: {
				Authorization: `Bearer ${config.communique.apiKey}`,
				'Content-Type': 'application/json'
			},
			timeout: 10000
		});

		return response.data.template;
	} catch (error: any) {
		console.error('Failed to fetch template:', error.message);
		return null;
	}
}

/**
 * Notify API of delivery result
 */
async function notifyDeliveryResult(templateId: any, userId: any, result: any) {
	try {
		await axios.post(
			`${config.communique.apiUrl}/delivery/notify`,
			{
				templateId,
				userId,
				deliveryMethod: 'certified',
				success: result.success,
				submissionId: result.submissionId,
				error: result.error,
				timestamp: new Date().toISOString()
			},
			{
				headers: {
					Authorization: `Bearer ${config.communique.apiKey}`,
					'Content-Type': 'application/json'
				},
				timeout: 10000
			}
		);

		console.log('Delivery result notification sent successfully');
	} catch (error: any) {
		console.error('Failed to notify delivery result:', error.message);
	}
}

export {
	CWCClient,
	fetchUserProfile,
	fetchTemplate,
	notifyDeliveryResult
};
