export interface MergeContext {
	firstName: string;
	lastName: string;
	email: string;
	postalCode: string | null;
	verificationStatus: 'verified' | 'postal-resolved' | 'imported';
	tierLabel: string | null;
	tierContext: string;
}

export interface VerificationBlock {
	totalRecipients: number;
	verifiedCount: number;
	verifiedPct: number;
	districtCount: number;
	tierSummary: string; // e.g. "12 Pillars, 43 Veterans, 89 Established"
}

/**
 * Replace merge fields in a template string.
 * Supported fields: {{firstName}}, {{lastName}}, {{email}}, {{postalCode}},
 * {{verificationStatus}}, {{tierLabel}}, {{tierContext}}
 */
export function compileMergeFields(template: string, ctx: MergeContext): string {
	return template
		.replace(/\{\{firstName\}\}/g, escapeHtml(ctx.firstName))
		.replace(/\{\{lastName\}\}/g, escapeHtml(ctx.lastName))
		.replace(/\{\{email\}\}/g, escapeHtml(ctx.email))
		.replace(/\{\{postalCode\}\}/g, escapeHtml(ctx.postalCode ?? ''))
		.replace(/\{\{verificationStatus\}\}/g, escapeHtml(ctx.verificationStatus))
		.replace(/\{\{tierLabel\}\}/g, escapeHtml(ctx.tierLabel ?? ''))
		.replace(/\{\{tierContext\}\}/g, escapeHtml(ctx.tierContext));
}

/**
 * Render the structural verification context block as HTML.
 * This block is NON-OPTIONAL -- it appears in every email sent through the platform.
 * Content varies based on verification density.
 */
export function renderVerificationBlock(block: VerificationBlock): string {
	const { totalRecipients, verifiedCount, verifiedPct, districtCount, tierSummary } = block;

	let headline: string;
	let detail: string;

	if (verifiedPct >= 50) {
		// High verification density
		headline = `This campaign reaches ${verifiedCount.toLocaleString()} verified constituents across ${districtCount} district${districtCount === 1 ? '' : 's'}.`;
		detail = tierSummary
			? `Engagement breakdown: ${tierSummary}.`
			: '';
	} else if (verifiedPct >= 10) {
		// Moderate verification
		headline = `${verifiedCount.toLocaleString()} of ${totalRecipients.toLocaleString()} recipients are verified constituents.`;
		detail = 'Verify your residency to strengthen this campaign.';
	} else if (verifiedCount > 0) {
		// Low verification
		headline = `${verifiedCount.toLocaleString()} of ${totalRecipients.toLocaleString()} recipients are verified.`;
		detail = 'Verify your residency to add weight to this message.';
	} else {
		// Zero verification
		headline = `${totalRecipients.toLocaleString()} supporter${totalRecipients === 1 ? '' : 's'}. 0 verified.`;
		detail = 'Be the first to verify your residency.';
	}

	return `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #3f3f46;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #3f3f46;border-radius:8px;background-color:#18181b;">
    <tr>
      <td style="padding:16px 20px;">
        <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;">
          Verification Context
        </p>
        <p style="margin:0 0 4px 0;font-size:14px;color:#e4e4e7;">
          ${escapeHtml(headline)}
        </p>
        ${detail ? `<p style="margin:0;font-size:13px;color:#71717a;">${escapeHtml(detail)}</p>` : ''}
      </td>
    </tr>
  </table>
</div>`.trim();
}

/**
 * Compile a complete email: apply merge fields, append verification block, wrap in email-safe HTML.
 */
export function compileEmail(
	body: string,
	merge: MergeContext,
	verification: VerificationBlock,
	unsubscribeUrl?: string
): string {
	const mergedBody = compileMergeFields(body, merge);
	const verificationHtml = renderVerificationBlock(verification);

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title></title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:24px;background-color:#18181b;border-radius:12px;border:1px solid #27272a;">
              <div style="font-size:15px;line-height:1.6;color:#d4d4d8;">
                ${mergedBody}
              </div>
              ${verificationHtml}
              ${unsubscribeUrl ? `
              <div style="margin-top:24px;padding-top:16px;border-top:1px solid #27272a;text-align:center;">
                <p style="margin:0;font-size:11px;color:#52525b;">
                  <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Unsubscribe</a>
                  &nbsp;&middot;&nbsp;
                  Sent via <a href="https://commons.email" style="color:#71717a;text-decoration:underline;">commons.email</a>
                </p>
              </div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate tier context string for a supporter based on their verification status.
 */
export function buildTierContext(verificationStatus: 'verified' | 'postal-resolved' | 'imported'): string {
	switch (verificationStatus) {
		case 'verified':
			return 'Your identity is verified. Your voice carries full weight in this campaign.';
		case 'postal-resolved':
			return 'Your postal code is on file. Verify your identity to strengthen your impact.';
		case 'imported':
			return 'Complete verification to add civic weight to your participation.';
	}
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
