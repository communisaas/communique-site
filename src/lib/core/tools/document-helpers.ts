/**
 * Document Tool Helpers (Client-Safe)
 *
 * Pure utility functions for document display and formatting.
 * Can be safely imported in browser code.
 *
 * @module tools/document-helpers
 */

import type { DocumentType } from '$lib/server/reducto/types';

// ============================================================================
// Document Type Helpers
// ============================================================================

/**
 * Get icon for document type (for L1 citations)
 */
export function getDocumentTypeIcon(type: DocumentType): string {
	const icons: Record<DocumentType, string> = {
		legislative: '📜',
		official: '📋',
		media: '📰',
		corporate: '📊',
		academic: '📚'
	};
	return icons[type] || '📄';
}

/**
 * Get color token for document type (for peripheral encoding)
 */
export function getDocumentTypeColor(type: DocumentType): string {
	const colors: Record<DocumentType, string> = {
		legislative: 'var(--doc-legislative, oklch(0.75 0.15 85))', // amber
		official: 'var(--doc-official, oklch(0.55 0.03 260))', // slate
		media: 'var(--doc-media, oklch(0.6 0.15 250))', // blue
		corporate: 'var(--doc-corporate, oklch(0.6 0.15 160))', // emerald
		academic: 'var(--doc-academic, oklch(0.6 0.15 300))' // purple
	};
	return colors[type] || 'var(--color-text-secondary)';
}
