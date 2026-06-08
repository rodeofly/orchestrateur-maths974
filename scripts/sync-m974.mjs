// Resync des paquets VENDORÉS (couches 1 & 2) depuis les dépôts sources voisins.
// Usage : npm run sync:m974
// Tant que @maths974/embed et @maths974/competences ne sont pas publiés sur npm,
// on copie les fichiers (même pattern que lambda-zef/grenier/src/lib/m974).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const HEADER =
	'// @ts-nocheck — fichier VENDORÉ (ne pas éditer ici). Source: maths974-embed / maths974-competences. Resync: npm run sync:m974.';

const FILES = [
	['../maths974-embed/src/protocol.js', 'src/lib/m974/protocol.js'],
	['../maths974-embed/src/host.js', 'src/lib/m974/host.js'],
	['../maths974-competences/src/referential.js', 'src/lib/m974/referential.js'],
	['../maths974-competences/src/attempt.js', 'src/lib/m974/attempt.js']
];

let ok = 0;
for (const [from, to] of FILES) {
	const src = resolve(root, from);
	const dst = resolve(root, to);
	try {
		const body = readFileSync(src, 'utf8');
		mkdirSync(dirname(dst), { recursive: true });
		writeFileSync(dst, `${HEADER}\n${body}`);
		console.log(`✓ ${to}`);
		ok++;
	} catch (e) {
		console.error(`✗ ${to} — source introuvable : ${src}\n  ${e.message}`);
	}
}
console.log(`\n${ok}/${FILES.length} fichiers synchronisés.`);
if (ok < FILES.length) process.exit(1);
