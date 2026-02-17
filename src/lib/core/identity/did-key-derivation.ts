/**
 * did:key derivation from WebAuthn COSE-encoded public keys.
 *
 * Supports P-256 (ES256) and Ed25519 (EdDSA) key types.
 * Zero external dependencies — works on Cloudflare Workers (no Buffer, no Node crypto).
 *
 * References:
 * - did:key spec: https://w3c-ccg.github.io/did-method-key/
 * - Multicodec table: https://github.com/multiformats/multicodec/blob/master/table.csv
 * - COSE key structures: RFC 9052 / RFC 9053
 */

// ── Base58btc ────────────────────────────────────────────────────────────────

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode a Uint8Array as a base58btc string.
 * Standard Bitcoin base58 algorithm operating on big-integer arithmetic.
 */
function encodeBase58btc(bytes: Uint8Array): string {
	// Count leading zeros — each becomes a '1' in the output
	let leadingZeros = 0;
	for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
		leadingZeros++;
	}

	// Convert byte array to a big number, then repeatedly divide by 58
	// We work with a mutable copy as an array of numbers for division
	const input = Array.from(bytes);
	const encoded: string[] = [];

	while (input.some((b) => b !== 0)) {
		let remainder = 0;
		for (let i = 0; i < input.length; i++) {
			const digit = input[i] + remainder * 256;
			input[i] = Math.floor(digit / 58);
			remainder = digit % 58;
		}
		encoded.push(BASE58_ALPHABET[remainder]);
	}

	// Add leading '1's for leading zero bytes
	for (let i = 0; i < leadingZeros; i++) {
		encoded.push('1');
	}

	return encoded.reverse().join('');
}

// ── COSE Key Parsing ─────────────────────────────────────────────────────────

/** COSE key labels we care about */
const COSE_LABEL_KTY = 1; // Key type
const COSE_LABEL_ALG = 3; // Algorithm
const COSE_LABEL_CRV = -1; // Curve (maps to CBOR key 0x20)
const COSE_LABEL_X = -2; // x-coordinate (maps to CBOR key 0x21)
const COSE_LABEL_Y = -3; // y-coordinate (maps to CBOR key 0x22)

/** Parsed fields from a COSE key */
interface COSEKeyFields {
	kty: number | null;
	alg: number | null;
	crv: number | null;
	x: Uint8Array | null;
	y: Uint8Array | null;
}

/**
 * Minimal CBOR decoder targeting COSE key maps only.
 *
 * Handles the subset of CBOR needed for WebAuthn COSE keys:
 * - Major type 0: unsigned integer
 * - Major type 1: negative integer
 * - Major type 2: byte string
 * - Major type 5: map
 *
 * Does NOT handle: text strings, arrays, tags, floats, indefinite lengths,
 * nested maps, or any other CBOR features not used in COSE key structures.
 */
function parseCOSEKey(data: Uint8Array): COSEKeyFields {
	let offset = 0;

	const fields: COSEKeyFields = {
		kty: null,
		alg: null,
		crv: null,
		x: null,
		y: null
	};

	/**
	 * Read a CBOR "additional info" value (the low 5 bits of the initial byte)
	 * and return the decoded unsigned integer + advance offset.
	 */
	function readUint(additionalInfo: number): number {
		if (additionalInfo < 24) {
			return additionalInfo;
		} else if (additionalInfo === 24) {
			return data[offset++];
		} else if (additionalInfo === 25) {
			const value = (data[offset] << 8) | data[offset + 1];
			offset += 2;
			return value;
		} else if (additionalInfo === 26) {
			const value =
				(data[offset] << 24) |
				(data[offset + 1] << 16) |
				(data[offset + 2] << 8) |
				data[offset + 3];
			offset += 4;
			return value >>> 0; // ensure unsigned
		}
		throw new Error(`CBOR: unsupported additional info ${additionalInfo}`);
	}

	/**
	 * Read one CBOR item and return it as a number (for integers) or Uint8Array (for byte strings).
	 * Skips items we don't need.
	 */
	function readItem(): number | Uint8Array | 'skip' {
		if (offset >= data.length) {
			throw new Error('CBOR: unexpected end of data');
		}

		const initialByte = data[offset++];
		const majorType = initialByte >> 5;
		const additionalInfo = initialByte & 0x1f;

		switch (majorType) {
			case 0: // Unsigned integer
				return readUint(additionalInfo);
			case 1: // Negative integer: -1 - n
				return -1 - readUint(additionalInfo);
			case 2: {
				// Byte string
				const length = readUint(additionalInfo);
				const value = data.slice(offset, offset + length);
				offset += length;
				return value;
			}
			case 3: {
				// Text string — skip over it
				const length = readUint(additionalInfo);
				offset += length;
				return 'skip';
			}
			default:
				// For anything else (arrays, maps, tags, etc.) within a value position,
				// we can't easily skip without recursion, so error out.
				throw new Error(`CBOR: unsupported major type ${majorType} at offset ${offset - 1}`);
		}
	}

	// The outer structure must be a map (major type 5)
	if (offset >= data.length) {
		throw new Error('COSE key: empty data');
	}

	const initialByte = data[offset++];
	const majorType = initialByte >> 5;
	const additionalInfo = initialByte & 0x1f;

	if (majorType !== 5) {
		throw new Error(`COSE key: expected CBOR map (major type 5), got ${majorType}`);
	}

	const mapLength = readUint(additionalInfo);

	for (let i = 0; i < mapLength; i++) {
		const key = readItem();
		const value = readItem();

		// We only care about numeric keys (COSE labels)
		if (typeof key !== 'number') continue;
		if (value === 'skip') continue;

		switch (key) {
			case COSE_LABEL_KTY:
				if (typeof value === 'number') fields.kty = value;
				break;
			case COSE_LABEL_ALG:
				if (typeof value === 'number') fields.alg = value;
				break;
			case COSE_LABEL_CRV:
				if (typeof value === 'number') fields.crv = value;
				break;
			case COSE_LABEL_X:
				if (value instanceof Uint8Array) fields.x = value;
				break;
			case COSE_LABEL_Y:
				if (value instanceof Uint8Array) fields.y = value;
				break;
		}
	}

	return fields;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract the algorithm from a COSE key.
 * @returns 'P-256' | 'Ed25519' | 'unknown'
 */
export function getCOSEKeyAlgorithm(cosePublicKey: Uint8Array): 'P-256' | 'Ed25519' | 'unknown' {
	try {
		const fields = parseCOSEKey(cosePublicKey);

		// P-256: kty=2 (EC2), crv=1 (P-256)
		if (fields.kty === 2 && fields.crv === 1) return 'P-256';

		// Ed25519: kty=1 (OKP), crv=6 (Ed25519)
		if (fields.kty === 1 && fields.crv === 6) return 'Ed25519';

		return 'unknown';
	} catch {
		return 'unknown';
	}
}

/**
 * Derive a did:key identifier from a COSE-encoded WebAuthn public key.
 *
 * Supports:
 * - P-256 (ES256) -- WebAuthn default on Apple, most common
 * - Ed25519 (EdDSA) -- Used by some security keys
 *
 * @param cosePublicKey - Raw COSE-encoded public key from WebAuthn registration (Uint8Array)
 * @returns did:key string (e.g., "did:key:zDn...")
 * @throws Error if key type is unsupported or data is malformed
 */
export function deriveDIDKey(cosePublicKey: Uint8Array): string {
	const fields = parseCOSEKey(cosePublicKey);

	// P-256 (EC2, crv=1)
	if (fields.kty === 2 && fields.crv === 1) {
		return deriveP256DIDKey(fields);
	}

	// Ed25519 (OKP, crv=6)
	if (fields.kty === 1 && fields.crv === 6) {
		return deriveEd25519DIDKey(fields);
	}

	const ktyDesc = fields.kty !== null ? `kty=${fields.kty}` : 'kty=null';
	const crvDesc = fields.crv !== null ? `crv=${fields.crv}` : 'crv=null';
	throw new Error(`Unsupported COSE key type: ${ktyDesc}, ${crvDesc}`);
}

/**
 * Derive did:key for P-256 (ES256) keys.
 *
 * Multicodec for P-256 public key: 0x1200
 * Varint encoding: [0x80, 0x24]
 */
function deriveP256DIDKey(fields: COSEKeyFields): string {
	if (!fields.x || fields.x.length !== 32) {
		throw new Error('P-256 COSE key: missing or invalid x-coordinate (expected 32 bytes)');
	}
	if (!fields.y || fields.y.length !== 32) {
		throw new Error('P-256 COSE key: missing or invalid y-coordinate (expected 32 bytes)');
	}

	// Compress the public key: prefix (0x02 if y is even, 0x03 if odd) + x
	const prefix = (fields.y[fields.y.length - 1] & 1) === 0 ? 0x02 : 0x03;
	const compressed = new Uint8Array(33);
	compressed[0] = prefix;
	compressed.set(fields.x, 1);

	// Multicodec prefix for P-256: 0x1200 -> varint [0x80, 0x24]
	const multicodecBytes = new Uint8Array(2 + 33);
	multicodecBytes[0] = 0x80;
	multicodecBytes[1] = 0x24;
	multicodecBytes.set(compressed, 2);

	// Multibase base58btc: 'z' prefix + base58btc
	const encoded = encodeBase58btc(multicodecBytes);
	return `did:key:z${encoded}`;
}

/**
 * Derive did:key for Ed25519 (EdDSA) keys.
 *
 * Multicodec for Ed25519 public key: 0xed
 * Varint encoding: [0xed, 0x01] (since 0xed > 0x7f, needs 2 varint bytes)
 */
function deriveEd25519DIDKey(fields: COSEKeyFields): string {
	if (!fields.x || fields.x.length !== 32) {
		throw new Error('Ed25519 COSE key: missing or invalid public key (expected 32 bytes)');
	}

	// Multicodec prefix for Ed25519: 0xed -> varint [0xed, 0x01]
	const multicodecBytes = new Uint8Array(2 + 32);
	multicodecBytes[0] = 0xed;
	multicodecBytes[1] = 0x01;
	multicodecBytes.set(fields.x, 2);

	// Multibase base58btc: 'z' prefix + base58btc
	const encoded = encodeBase58btc(multicodecBytes);
	return `did:key:z${encoded}`;
}
