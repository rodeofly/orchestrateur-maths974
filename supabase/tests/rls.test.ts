// Test RLS en CI — exécute les VRAIES migrations sur Postgres (PGlite, WASM, sans Docker)
// et prouve les non-accès inter-tenant / inter-classe (exigence de l'audit).
// Shim Supabase minimal : schéma auth, auth.uid(), rôles.
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mig = (f: string) =>
	readFileSync(fileURLToPath(new URL(`../migrations/${f}`, import.meta.url)), 'utf8');

const PREAMBLE = `
create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
create role anon nologin;
create role authenticated nologin;
create role supabase_auth_admin nologin;
create role service_role nologin;
grant usage on schema public, auth to anon, authenticated;
`;

// Identifiants de seed
const ETAB_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const ETAB_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const PA1 = '11111111-0000-0000-0000-000000000001'; // prof, classe CA1
const PA2 = '11111111-0000-0000-0000-000000000002'; // prof, classe CA2
const ADM = '11111111-0000-0000-0000-0000000000ad'; // admin du Collège A
const SA1 = '22222222-0000-0000-0000-000000000001'; // élève CA1
const SA2 = '22222222-0000-0000-0000-000000000002'; // élève CA2
const SB1 = '33333333-0000-0000-0000-000000000001'; // élève Collège B
const PAR = '44444444-0000-0000-0000-000000000001'; // parent de SA1
const CA1 = 'caaa0001-0000-0000-0000-000000000001';
const CA2 = 'caaa0002-0000-0000-0000-000000000002';
const CB1 = 'cbbb0001-0000-0000-0000-000000000001'; // classe du Collège B
const PARC = 'daaa0001-0000-0000-0000-000000000001'; // parcours de PA1, assigné à CA1

let db: PGlite;

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
	await db.exec(
		`set role authenticated; select set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}', false);`
	);
	try {
		return await fn();
	} finally {
		await db.exec(`reset role; select set_config('request.jwt.claims','', false);`);
	}
}

async function count(sql: string): Promise<number> {
	const r = await db.query<{ n: number }>(sql);
	return Number(r.rows[0].n);
}
const seen = (table: string, where: string) => count(`select count(*)::int n from ${table} where ${where}`);

beforeAll(async () => {
	db = await PGlite.create();
	await db.exec(PREAMBLE);
	await db.exec(mig('0001_init.sql'));
	await db.exec(mig('0002_rls.sql'));
	await db.exec(mig('0003_auth_hook.sql'));
	await db.exec(mig('0004_prof_classes.sql'));
	await db.exec(mig('0005_parcours.sql'));
	await db.exec(mig('0006_admin_management.sql'));
	await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);

	// Seed en superuser (RLS contournée).
	await db.exec(`
		insert into etablissements (id,nom) values ('${ETAB_A}','A'),('${ETAB_B}','B');
		insert into auth.users (id,email) values
			('${PA1}','pa1@t.fr'),('${PA2}','pa2@t.fr'),('${ADM}','adm@t.fr'),
			('${SA1}',null),('${SA2}',null),('${SB1}',null),('${PAR}','par@t.fr');
		update profiles set role='prof',  etablissement_id='${ETAB_A}', is_minor=false where id in ('${PA1}','${PA2}');
		update profiles set role='admin', etablissement_id='${ETAB_A}', is_minor=false where id='${ADM}';
		update profiles set role='eleve', etablissement_id='${ETAB_A}' where id in ('${SA1}','${SA2}');
		update profiles set role='eleve', etablissement_id='${ETAB_B}' where id='${SB1}';
		update profiles set role='parent', is_minor=false where id='${PAR}';
		insert into classes (id,etablissement_id,nom) values
			('${CA1}','${ETAB_A}','CA1'),('${CA2}','${ETAB_A}','CA2'),('${CB1}','${ETAB_B}','CB1');
		insert into class_teachers (class_id,teacher_id) values ('${CA1}','${PA1}'),('${CA2}','${PA2}');
		insert into class_students (class_id,student_id) values ('${CA1}','${SA1}'),('${CA2}','${SA2}'),('${CB1}','${SB1}');
		insert into parent_links (parent_id,child_id,consent_given_at) values ('${PAR}','${SA1}',now());
		insert into attempts (student_id,class_id,app,activity_id,passed) values
			('${SA1}','${CA1}','lambdazef','lesson:a',true),
			('${SA2}','${CA2}','lambdazef','lesson:a',true);
		insert into student_credentials (student_id,class_code,login,pin_hash) values ('${SA1}','CA1','alice','x');
		insert into parcours (id, etablissement_id, author_id, titre, steps) values
			('${PARC}','${ETAB_A}','${PA1}','Parcours A', '["lambdazef"]'::jsonb);
		insert into parcours_assignments (parcours_id, class_id, assigned_by) values ('${PARC}','${CA1}','${PA1}');
	`);
});

afterAll(async () => {
	await db?.close();
});

describe('RLS — isolation prof', () => {
	it('un prof voit son élève, sa classe ET les tentatives de son élève', async () => {
		await asUser(PA1, async () => {
			expect(await seen('profiles', `id='${SA1}'`)).toBe(1);
			expect(await seen('classes', `id='${CA1}'`)).toBe(1);
			expect(await seen('attempts', `student_id='${SA1}'`)).toBe(1); // état de la classe
		});
	});
	it('un prof NE voit PAS l’élève d’une autre classe', async () => {
		await asUser(PA1, async () => {
			expect(await seen('profiles', `id='${SA2}'`)).toBe(0);
			expect(await seen('classes', `id='${CA2}'`)).toBe(0);
			expect(await seen('attempts', `student_id='${SA2}'`)).toBe(0);
		});
	});
	it('un prof NE voit PAS un élève d’un autre établissement', async () => {
		await asUser(PA1, async () => {
			expect(await seen('profiles', `id='${SB1}'`)).toBe(0);
		});
	});
});

describe('RLS — isolation élève', () => {
	it('un élève voit ses tentatives, pas celles des autres', async () => {
		await asUser(SA1, async () => {
			expect(await seen('attempts', `student_id='${SA1}'`)).toBe(1);
			expect(await seen('attempts', `student_id='${SA2}'`)).toBe(0);
		});
	});
	it('student_credentials est deny-all côté client', async () => {
		await asUser(SA1, async () => {
			expect(await count('select count(*)::int n from student_credentials')).toBe(0);
		});
	});
});

describe('RLS — isolation parent', () => {
	it('un parent voit son enfant rattaché, pas un autre', async () => {
		await asUser(PAR, async () => {
			expect(await seen('attempts', `student_id='${SA1}'`)).toBe(1);
			expect(await seen('attempts', `student_id='${SA2}'`)).toBe(0);
		});
	});
});

describe('RLS — parcours assigné', () => {
	it('l’élève de la classe assignée lit le parcours et son assignation', async () => {
		await asUser(SA1, async () => {
			expect(await seen('parcours', `id='${PARC}'`)).toBe(1);
			expect(await seen('parcours_assignments', `parcours_id='${PARC}'`)).toBe(1);
		});
	});
	it('un élève d’une AUTRE classe ne voit pas ce parcours', async () => {
		await asUser(SA2, async () => {
			expect(await seen('parcours', `id='${PARC}'`)).toBe(0);
		});
	});
	it('l’auteur (prof) voit son parcours', async () => {
		await asUser(PA1, async () => {
			expect(await seen('parcours', `id='${PARC}'`)).toBe(1);
		});
	});
});

describe('RLS — cloisonnement admin par établissement', () => {
	it('un admin voit les classes de SON établissement, pas celles d’un autre', async () => {
		await asUser(ADM, async () => {
			expect(await seen('classes', `id='${CA1}'`)).toBe(1);
			expect(await seen('classes', `id='${CA2}'`)).toBe(1);
			expect(await seen('classes', `id='${CB1}'`)).toBe(0); // Collège B
		});
	});
});

describe('RLS — création de classe par le prof (0004)', () => {
	it('un prof crée une classe dans SON établissement et en devient enseignant', async () => {
		await asUser(PA1, async () => {
			await db.exec(`insert into classes (etablissement_id, nom) values ('${ETAB_A}','Nouvelle A');`);
			expect(await seen('classes', `nom='Nouvelle A'`)).toBe(1); // visible car auto-enseignant
		});
	});
	it('un prof NE peut PAS créer une classe dans un autre établissement', async () => {
		await expect(
			asUser(PA1, async () => {
				await db.exec(`insert into classes (etablissement_id, nom) values ('${ETAB_B}','Pirate');`);
			})
		).rejects.toThrow();
	});
});

// Placé en dernier : ce test INSÈRE une tentative (pas de rollback partagé) → ne doit pas
// polluer les comptages d'attempts des tests précédents.
describe('RLS — un élève n’enregistre QUE ses propres tentatives', () => {
	it('un élève insère une tentative à son nom', async () => {
		await asUser(SA1, async () => {
			await db.exec(
				`insert into attempts (student_id, app, activity_id, passed) values ('${SA1}','lambdazef','lesson:b',true);`
			);
			expect(await seen('attempts', `student_id='${SA1}' and activity_id='lesson:b'`)).toBe(1);
		});
	});
	it('un élève NE PEUT PAS enregistrer une tentative au nom d’un autre', async () => {
		await expect(
			asUser(SA1, async () => {
				await db.exec(
					`insert into attempts (student_id, app, activity_id, passed) values ('${SA2}','lambdazef','triche',true);`
				);
			})
		).rejects.toThrow();
	});
});

// Placé en dernier : ces appels MUTENT les rôles (et restaurent l'état initial à la fin).
describe('admin_set_role — gestion des rôles atomique & sûre', () => {
	const call = async (c: string, t: string, r: string) =>
		(await db.query<{ r: string }>(`select public.admin_set_role('${c}','${t}','${r}') as r`)).rows[0].r;

	it('refuse : non-admin, autre établissement, mineur, auto-modif, rôle invalide', async () => {
		expect(await call(PA1, PA2, 'admin')).toBe('pas_admin'); // PA1 = prof
		expect(await call(ADM, SB1, 'prof')).toBe('autre_tenant'); // SB1 = Collège B
		expect(await call(ADM, SA1, 'prof')).toBe('mineur'); // SA1 = élève (mineur)
		expect(await call(ADM, ADM, 'prof')).toBe('self');
		expect(await call(ADM, PA1, 'eleve')).toBe('role_invalide'); // pas de bascule vers élève
	});

	it('un admin promeut/rétrograde un adulte de son tenant, en gardant ≥1 admin', async () => {
		expect(await call(ADM, PA1, 'admin')).toBe('ok'); // 2 admins
		expect(await call(PA1, ADM, 'prof')).toBe('ok'); // PA1(admin) rétrograde ADM → reste 1 admin
		// restaure l'état initial (ADM admin, PA1 prof)
		expect(await call(PA1, ADM, 'admin')).toBe('ok');
		expect(await call(ADM, PA1, 'prof')).toBe('ok');
	});
});
