/**
 * Generate X25519 keypair for witness encryption.
 *
 * Usage: npx tsx scripts/generate-witness-keypair.ts
 *
 * Add the output to your .env:
 *   WITNESS_ENCRYPTION_PRIVATE_KEY=0x...
 *   WITNESS_ENCRYPTION_PUBLIC_KEY=0x...
 */

import sodium from 'libsodium-wrappers';

async function main() {
	await sodium.ready;

	const keypair = sodium.crypto_box_keypair();

	const privateKeyHex =
		'0x' +
		Array.from(keypair.privateKey)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

	const publicKeyHex =
		'0x' +
		Array.from(keypair.publicKey)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

	console.log('# Witness Encryption Keypair');
	console.log('# Generated:', new Date().toISOString());
	console.log('# Algorithm: X25519-XChaCha20-Poly1305');
	console.log('#');
	console.log('# Add these to your .env file:');
	console.log(`WITNESS_ENCRYPTION_PRIVATE_KEY=${privateKeyHex}`);
	console.log(`WITNESS_ENCRYPTION_PUBLIC_KEY=${publicKeyHex}`);
}

main().catch(console.error);
