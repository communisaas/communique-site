import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
	'p', 'br', 'a', 'strong', 'b', 'em', 'i', 'u', 'strike', 's',
	'h1', 'h2', 'h3', 'h4',
	'ul', 'ol', 'li',
	'table', 'thead', 'tbody', 'tr', 'td', 'th',
	'img', 'span', 'div', 'blockquote', 'pre', 'code', 'hr'
];

const ALLOWED_STYLE_PROPERTIES = [
	'color', 'background-color', 'font-size', 'font-weight', 'font-style',
	'text-align', 'text-decoration',
	'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
	'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
	'border', 'border-radius', 'border-color', 'border-width', 'border-style',
	'width', 'max-width', 'line-height', 'letter-spacing'
];

// Properties that could hide the verification block are implicitly blocked
// by only allowing the properties listed above. Blocked properties include:
// display, visibility, position, opacity, overflow, clip, clip-path,
// transform, z-index, float

/**
 * Sanitize user-supplied email body HTML.
 * Strips dangerous tags (style, script, iframe, form) and style properties
 * that could hide the structural verification block.
 */
export function sanitizeEmailBody(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			'a': ['href', 'title', 'target', 'rel'],
			'img': ['src', 'alt', 'width', 'height', 'style'],
			'td': ['colspan', 'rowspan', 'style', 'align', 'valign', 'width'],
			'th': ['colspan', 'rowspan', 'style', 'align', 'valign', 'width'],
			'table': ['cellpadding', 'cellspacing', 'border', 'width', 'style'],
			'tr': ['style'],
			'div': ['style'],
			'span': ['style'],
			'p': ['style'],
			'h1': ['style'],
			'h2': ['style'],
			'h3': ['style'],
			'h4': ['style'],
			'blockquote': ['style']
		},
		allowedStyles: {
			'*': Object.fromEntries(
				ALLOWED_STYLE_PROPERTIES.map((prop) => [prop, [/^.*$/]])
			) as Record<string, RegExp[]>
		},
		// Strip disallowed tags entirely (not just their content)
		disallowedTagsMode: 'discard',
		// Enforce https/mailto on links
		allowedSchemes: ['https', 'http', 'mailto'],
		allowProtocolRelative: false,
		// Force safe link attributes
		transformTags: {
			'a': sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' })
		}
	});
}
