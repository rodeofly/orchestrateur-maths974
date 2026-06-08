# Bibliothèque d'activités — architecture d'information

> Comment organiser **des centaines** d'activités multi-sources sans « raz-de-marée d'icônes ».
> Issu d'un design multi-agents + critique d'échelle (2026-06-08).

## L'idée : on n'affiche jamais « tout » — on tague, puis on fait émerger par filtrage.

**4 couches empilées :**
1. **Spine = la taxonomie GS** (réutilisée 1:1) : `Domaine(7+1) → Sous-thème → Étiquette GS (NN.N) → Activités`. La **feuille de l'arbre = l'étiquette GS**, pas l'activité. Sous une même étiquette GS cohabitent automaths + λ-Zèf + vidéo + Kahoot. 8ᵉ domaine technique `00-transversal` pour le sans-GS (borné, audité).
2. **Facettes orthogonales + recherche** — filtrent l'arbre sans le restructurer (ET inter-facettes, OU intra-facette, compteurs disjonctifs, état en query-string partageable). Le **code GS n'est PAS une facette** (≈99 codes = un mur) : c'est un canal de **recherche** + un **badge** + la feuille.
3. **Sélection par INTENTION** — le prof ne « browse » pas, il REMPLIT un slot de rituel pour une classe. Le composer ouvre la bibliothèque **déjà pré-filtrée** par (rituel ⇒ compétences) ∩ (classe ⇒ niveau), avec un bandeau « Recommandé ».
4. **Peuplement par MANIFESTES auto-générés** — chaque source émet un `manifest.m974.json` à SON build ; GS le **dérive de ses content collections** (les centaines d'automaths se peuplent depuis le frontmatter, zéro saisie). L'orchestrateur agrège les manifestes vendorés (calque de `sync-m974.mjs`).

## Modèle de métadonnées — `ActivityMeta` (`src/lib/activities/types.ts`)
- **Identité** : `id` OPAQUE & stable, namespacé (`gs:zefor974/01-retour-unite`) — **découplé de la taxo** (un reclassement ne casse aucun parcours sauvegardé). `source`, `label`, `emoji`, `kind`, `support`.
- **Embed** : `{ originDev?, originProd?, path, mode?, connector? }` (réutilise `activityUrl()` + `@maths974/embed`).
- **Taxo** : `{ gs?: string[], gsBonus?: string[], domaineKey, domaineLabel?, sousTheme? }`. **`domaineKey` vient TOUJOURS du DOSSIER réel** (canonique, fiable), jamais d'un lookup `gs` global.
- **Facettes** (toutes des SETS) : `competences[]`, `niveaux[]`, `classes[]`, `rituels[]`, `support`, `keywords[]`, `dureeMin`, `canonical?` (préférence inter-sources).

## Facettes (UI)
F1 Rituel (contextuel) · F2 Classe (souple, pas un masque dur) · F3 Domaine GS (axe primaire) · F4 Compétence socle · F5 Support/nature (≈8-12 icônes MAX) · F6 Source/app · F7 Palier (partiel : fiable surtout DNB) · F8 Kind. ET inter, OU intra, compteurs disjonctifs, valeurs à 0 grisées (jamais cachées), état sérialisé en URL.

## ⚠️ Durcissements OBLIGATOIRES (critique d'échelle, contre le repo GS réel)
À traiter **dans le générateur GS (Étape 4) AVANT tout peuplement**, sinon facettes vides en silence :
1. **`gsIndex` MULTI-VALUÉE** : un même code GS existe dans cycle3 ET 3e-DNB → `Record<gsCode, GsEntry[]>`. Le **domaine se résout par le DOSSIER de la fiche**, le `gs` ne sert qu'au rangement de feuille + badge + recherche.
2. **Canoniser par DOSSIER, pas par libellé `theme`** (libre, non normalisé : `Tableur`, `Pensée informatique` absents de `THEME_COLORS_MAP`). Test CI : tout `theme` mappe vers un des 8 domaines, **fail-loud avant le 1er peuplement**.
3. **`classes[]` souple** : les `curricula/*.yaml` sont des PLAYLISTS éditoriales (~10 fiches), pas une couverture. Dériver la classe du `niveau:` file-level (présent partout) ; **F2 trie/met en avant, ne masque pas**.
4. **Contrat `?ref=` unique** : 3 espaces de noms (f.id plein chemin / e.slug / curricula bare-stem). `embed.path` doit émettre EXACTEMENT le `ref` que `amBySlug` attend (**bare-stem**). Test e2e : chaque `?ref=` résout dans le player.
5. **`niveaux[]`** uniquement depuis les variantes réellement étiquetées `niveau` (≈80% de cycle3 ne le sont pas) ; **F7 grise-sans-masquer**.
6. **Filtrer `node_modules`/`.astro`** dans tout glob de sync (674 .md bruts vs 124 réels).
7. **Dédup/préférence inter-sources** sous une même feuille GS (`canonical`/`supersedes`) — zefor canonique relègue le clone legacy.
8. **Geler un `id:` explicite stable** dans le frontmatter GS **dès maintenant**, avant que des parcours soient sauvegardés.

## Plan de build incrémental
- **Étape 0** ✅ — `types.ts` + `catalog.ts` ré-exprimé en `ActivityMeta` (5 entrées + `taxo`). UI inchangée.
- **Étape 1** ✅ — `tree.ts` (buildTree) + `library.ts` (index inversé, filtre à compteurs, recherche) + tests.
- **Étape 2** — Navigateur autonome `/prof/bibliotheque` (3 colonnes drill-down + recherche + facettes, état URL, réutilise `.am-theme-group`/`theme-colors`).
- **Étape 3** — Sélection contextuelle dans le composer (remplace le `<select>` plat par un picker pré-filtré rituel+classe).
- **Étape 4** ✅ — Générateur GS `GS.C4.2026.Maths974/src/pages/manifest.m974.json.ts` : 124 automaths dérivés
  (domaine par dossier, `?ref=e.slug`, niveaux des variantes étiquetées). → `/manifest.m974.json`.
- **Étape 5** ✅ — `scripts/sync-catalog.mjs` vendore `dist/manifest.m974.json` → `src/lib/activities/manifests/gs.json` ;
  `catalog.ts` est un AGRÉGATEUR (λ-Zèf à la main + 124 GS). **125 activités** dans la bibliothèque.
- **Étape 6** — Manifestes des apps non-GS (~5 lignes/app).
- **Étape 7** — CI de cohérence (gs existe, theme mappe, ref résout, 00-transversal borné).
