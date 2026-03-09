/**
 * Simple CSV parser — no external dependencies.
 *
 * Handles:
 *  - Quoted fields (double-quote delimited)
 *  - Commas within quotes
 *  - Newlines within quotes
 *  - CRLF and LF line endings
 *  - Escaped quotes ("" inside a quoted field)
 *  - BOM (byte-order mark) stripping
 */

export interface ParsedCSV {
	headers: string[];
	rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
	// Strip BOM if present
	const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	let i = 0;

	while (i < input.length) {
		const ch = input[i];

		if (inQuotes) {
			if (ch === '"') {
				// Peek ahead: escaped quote ("") or end of quoted field
				if (i + 1 < input.length && input[i + 1] === '"') {
					field += '"';
					i += 2;
				} else {
					inQuotes = false;
					i++;
				}
			} else {
				field += ch;
				i++;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
				i++;
			} else if (ch === ',') {
				row.push(field);
				field = '';
				i++;
			} else if (ch === '\r') {
				// CRLF or lone CR
				row.push(field);
				field = '';
				if (row.length > 0) rows.push(row);
				row = [];
				i++;
				if (i < input.length && input[i] === '\n') i++;
			} else if (ch === '\n') {
				row.push(field);
				field = '';
				if (row.length > 0) rows.push(row);
				row = [];
				i++;
			} else {
				field += ch;
				i++;
			}
		}
	}

	// Flush last field/row
	if (field || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	// First row = headers, rest = data
	if (rows.length === 0) {
		return { headers: [], rows: [] };
	}

	const headers = rows[0].map((h) => h.trim());
	const dataRows = rows.slice(1).filter((r) => {
		// Skip completely empty rows
		return r.some((cell) => cell.trim() !== '');
	});

	return { headers, rows: dataRows };
}
