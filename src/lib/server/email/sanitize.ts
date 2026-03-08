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
			'*': {
				'color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-zA-Z]+$/],
				'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^[a-zA-Z]+$/, /^transparent$/],
				'font-size': [/^(?:[1-9]\d?|1[0-4]\d|150)px$/, /^(?:0?\.\d+|[1-9]\d?)(?:\.\d+)?(?:em|rem)$/],
				'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00)$/],
				'font-style': [/^(?:normal|italic|oblique)$/],
				'text-align': [/^(?:left|center|right|justify)$/],
				'text-decoration': [/^(?:none|underline|overline|line-through)$/],
				'margin': [/^(?:\d{1,3}(?:px|em|rem|%)?\s*){1,4}$/],
				'margin-top': [/^\d{1,3}(?:px|em|rem|%)$/],
				'margin-bottom': [/^\d{1,3}(?:px|em|rem|%)$/],
				'margin-left': [/^\d{1,3}(?:px|em|rem|%)$/],
				'margin-right': [/^\d{1,3}(?:px|em|rem|%)$/],
				'padding': [/^(?:\d{1,3}(?:px|em|rem|%)?\s*){1,4}$/],
				'padding-top': [/^\d{1,3}(?:px|em|rem|%)$/],
				'padding-bottom': [/^\d{1,3}(?:px|em|rem|%)$/],
				'padding-left': [/^\d{1,3}(?:px|em|rem|%)$/],
				'padding-right': [/^\d{1,3}(?:px|em|rem|%)$/],
				'border': [/^[^;]{1,50}$/],
				'border-radius': [/^\d{1,3}(?:px|em|rem|%)$/],
				'border-color': [/^#[0-9a-fA-F]{3,8}$/, /^[a-zA-Z]+$/],
				'border-width': [/^\d{1,3}px$/],
				'border-style': [/^(?:none|solid|dashed|dotted|double)$/],
				'width': [/^\d{1,4}(?:px|em|rem|%)$/],
				'max-width': [/^[1-9]\d{0,3}(?:px|em|rem|%)$/],
				'line-height': [/^(?:[1-9](?:\.\d{1,2})?|0?\.\d{1,2})(?:em|rem)?$/, /^(?:normal|[1-9]\d{0,2}(?:\.\d{1,2})?)$/],
				'letter-spacing': [/^-?[0-2](?:\.\d{1,2})?(?:px|em)$/, /^normal$/]
			}
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
