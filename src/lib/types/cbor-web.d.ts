/**
 * Type declarations for cbor-web
 *
 * cbor-web is a Workers-compatible CBOR encoder/decoder.
 * It does not ship its own type declarations.
 */
declare module 'cbor-web' {
	/**
	 * Decode a CBOR-encoded buffer into a JavaScript value.
	 */
	export function decode(input: Uint8Array | ArrayBuffer): unknown;

	/**
	 * Encode a JavaScript value into a CBOR buffer.
	 */
	export function encode(...values: unknown[]): Uint8Array;

	/**
	 * CBOR Tagged value.
	 */
	export class Tagged {
		tag: number;
		value: unknown;
		constructor(tag: number, value?: unknown, err?: Error);
	}

	/**
	 * Decode all CBOR values from a buffer (for streams with multiple values).
	 */
	export function decodeAll(input: Uint8Array | ArrayBuffer): unknown[];
}
