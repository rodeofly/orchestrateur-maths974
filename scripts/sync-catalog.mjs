// Sync du manifeste d'activités GS dans l'orchestrateur (Étape 5).
// Lit le manifeste auto-généré par GS (dist/manifest.m974.json) et le vendore (commité)
// dans src/lib/activities/manifests/gs.json. Usage : npm run sync:catalog
// (Cible : aussi fetch la prod automaths.maths974.fr/manifest.m974.json en option.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SRC = resolve(root, '../GS.C4.2026.Maths974/dist/manifest.m974.json');
const OUT = resolve(root, 'src/lib/activities/manifests/gs.json');

let m;
try {
	m = JSON.parse(readFileSync(SRC, 'utf8'));
} catch (e) {
	console.error(`✗ Manifeste GS introuvable (${SRC}). Builde GS d'abord :`);
	console.error(`  cd ../GS.C4.2026.Maths974 && npm run build`);
	process.exit(1);
}
if (m.source !== 'gs' || !Array.isArray(m.activities) || !m.origin) {
	console.error('✗ Manifeste GS invalide (source/activities/origin manquants).');
	process.exit(1);
}
// Garde-fou : tout doit avoir un domaineKey et un path ?ref=.
const bad = m.activities.filter((a) => !a?.taxo?.domaineKey || !a?.embed?.path?.includes('?ref='));
if (bad.length) {
	console.error(`✗ ${bad.length} activités mal formées (domaineKey/ref manquant). Ex:`, bad[0]?.id);
	process.exit(1);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(m));
console.log(`✓ ${m.activities.length} activités GS vendorées → src/lib/activities/manifests/gs.json`);
