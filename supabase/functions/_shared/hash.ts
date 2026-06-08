// Hachage des PIN élèves (PBKDF2-SHA256 via Web Crypto). Pas de dépendance externe.
// @ts-nocheck — runtime Deno.
const ITER = 100_000;
const enc = new TextEncoder();

const b64 = (buf: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iter = ITER): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
		key,
		256
	);
	return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await derive(pin, salt);
	return `pbkdf2$${ITER}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
	const [algo, iterS, saltB, keyB] = stored.split('$');
	if (algo !== 'pbkdf2') return false;
	const key = await derive(pin, unb64(saltB), Number(iterS));
	const got = b64(key);
	// comparaison à temps ~constant
	if (got.length !== keyB.length) return false;
	let diff = 0;
	for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ keyB.charCodeAt(i);
	return diff === 0;
}

// PIN imprimable, sans caractères ambigus (0/O, 1/I/l).
export function genPin(len = 6): string {
	const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(len));
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
