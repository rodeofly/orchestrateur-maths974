# Supabase — runbook de configuration (v0)

Fondation auth + 5 rôles. Région **EU** obligatoire (RGPD/mineurs).

## 1. Projet & migrations

1. Créer un projet Supabase (région **EU**, ex. `eu-west-3`).
2. Appliquer les migrations dans l'ordre (`supabase/migrations/0001 → 0003`) via le CLI :
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   ou coller chaque fichier dans le SQL Editor.
3. Régénérer les types :
   ```bash
   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
   ```

## 2. Authentication (réglages critiques)

- **Hooks > Custom Access Token** : activer et pointer sur `public.custom_access_token_hook`
  (UX uniquement — la sécurité reste la RLS).
- **Email** : pour les élèves, pas d'email réel → la connexion élève passe par l'Edge Function
  `student-signin` (cf. §4). Pour les adultes : mot de passe et/ou magic link.
- **URL Configuration > Redirect URLs** : ajouter l'URL EXACTE de callback
  `https://ftobe-maths974.github.io/orchestrateur-maths974/auth/callback`
  (et `http://localhost:5173/auth/callback` en dev).

## 3. Variables d'environnement (frontend)

Copier `.env.example` → `.env` et renseigner `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`
(région EU). En CI : Settings > Secrets and variables > Actions. L'anon key est publique par
design ; la sécurité = RLS.

## 4. Edge Functions (service_role — jamais côté client) — **code fourni**

Code dans `supabase/functions/` (Deno). Déploiement :

```bash
supabase login
supabase functions deploy provision-students --project-ref <ref>
supabase functions deploy erase-student      --project-ref <ref>
# student-signin est appelée AVANT que l'élève soit authentifié → JWT non vérifié :
supabase functions deploy student-signin     --project-ref <ref> --no-verify-jwt
```

> ⚠️ `student-signin` DOIT être déployée avec `--no-verify-jwt` (l'élève n'a pas encore de session ;
> la fonction vérifie elle-même le PIN). Les deux autres gardent la vérification JWT (l'appelant est
> un prof/admin authentifié, et la fonction re-vérifie son identité en base).

Supabase injecte automatiquement `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` (la **Secret key** `sb_secret_…`) dans le runtime — rien à coller à la main.

- **`provision-students`** : un prof crée un lot de comptes élèves SANS email réel
  (email synthétique `<student_key>@eleve.maths974.invalid`, `email_confirm: true`, PIN imprimable
  PBKDF2). Vérifie l'appelant (`getUser`) ET, en base, qu'il enseigne la classe. Renvoie les PIN **une fois**.
- **`student-signin`** : valide `{classCode, login, pin}` (PIN PBKDF2), renvoie un `token_hash`
  (magic link) que le client confirme via `verifyOtp`. Ne renvoie jamais l'email synthétique.
- **`erase-student`** : droit à l'effacement RGPD (admin de l'établissement uniquement ; cascade FK).

> Avant prod : restreindre `Access-Control-Allow-Origin` (dans `_shared/util.ts`) aux origines réelles,
> et ajouter un rate-limit anti-bruteforce sur `student-signin`.

## 5. Tests RLS (gate de sécurité)

```bash
supabase db reset
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
```
Prouve les non-accès inter-tenant / inter-classe. **À câbler en CI** une fois le projet créé
(aujourd'hui non bloquant en CI : pas encore de Postgres dans le pipeline — gap connu).

## 6. Rappels RGPD (cf. /confidentialite)

- EPLE = responsable de traitement ; asso = sous-traitant (accord art. 28) ; registre art. 30.
- `profiles.extended_processing` (défaut **OFF**) : gating du traitement étendu — à imposer au
  moment du lancement d'une activité (le runner arrive après la v0).
- Aucune PII (prénom, student_key…) ne doit transiter par l'URL d'une iframe — le connecteur
  `@maths974/embed` ne passe que les clés non sensibles dans l'URL (cf. `URL_SAFE_KEYS`).
