-- ---------------------------------------------------------------------------
-- Phase 23 — Paramètres de l'organisation
--
-- L'écran « Paramètres » était annoncé dans la navigation depuis la phase 4 et
-- n'avait jamais été construit : la devise, le pays et surtout la règle de
-- paiement avant restitution ne se changeaient que par SQL. Un propriétaire ne
-- pouvait pas régler son propre lavage.
--
-- **Mais avant de construire l'écran, il faut fermer ce qu'il exposerait.**
--
-- La policy `owners update own organization` existe depuis la phase 1 et ne
-- regarde aucune colonne :
--
--     for update using (vehora.can_write(id, 'organization.manage'))
--
-- Une policy ne voit pas quelle colonne a changé — la règle est écrite dans
-- CLAUDE.md depuis la phase 10, et elle n'avait jamais été appliquée ici.
-- Aujourd'hui, par l'API, un propriétaire peut donc écrire :
--
--   * `currency` — et **tout le passé change de sens**. Les montants sont des
--     entiers en unité mineure ; la devise vient de l'organisation et est
--     imposée aux paiements par trigger. Passer de XOF à EUR ne convertit rien :
--     60 000 F CFA deviennent 60 000 €, dans les reçus déjà remis comme dans la
--     caisse. Une devise se choisit à la création, ou se change par une
--     migration qui convertit ; jamais par un formulaire.
--   * `slug` — l'identité de l'organisation, celle par laquelle l'organisation
--     technique `vehora-platform` est reconnue.
--   * `status` — l'état que la plateforme pose en suspendant. Le suspendu ne
--     peut pas s'en servir (la révocation de session coupe ses écritures avant
--     qu'il n'essaie), mais un état que le client peut écrire n'est pas un état
--     que la plateforme contrôle.
--
-- Un trigger tranche, puisqu'une policy ne le peut pas. Les deux fonctions de
-- plateforme (`suspendre_organisation`, `reactiver_organisation`) sont
-- SECURITY DEFINER : elles s'exécutent sous le propriétaire de la fonction, pas
-- sous `authenticated`, et passent donc sans exception à écrire pour elles.
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER — et c'est tout le mécanisme. Dans une fonction SECURITY
-- DEFINER, `current_user` vaut le propriétaire de la fonction, pas l'appelant :
-- le garde-fou se serait cru appelé par `postgres` et aurait tout laissé
-- passer. Première écriture de ce trigger, premier piège, attrapé par
-- l'assertion qui tentait justement le changement de devise.
create or replace function vehora.protect_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Ce qui vient d'ailleurs que du navigateur passe : une fonction de
  -- plateforme (SECURITY DEFINER, donc exécutée sous son propriétaire), une
  -- migration, un script de maintenance.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'VEHORA_ORG_IDENTITE : l''identifiant d''une organisation ne change pas.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.slug is distinct from old.slug then
    raise exception 'VEHORA_ORG_IDENTITE : le raccourci d''une organisation ne se change pas ici.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    raise exception 'VEHORA_ORG_STATUT : l''état d''une organisation appartient à la plateforme.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.currency is distinct from old.currency then
    raise exception 'VEHORA_ORG_DEVISE : changer la devise ne convertit aucun montant déjà enregistré ; cela se fait par une migration, jamais par un formulaire.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger organizations_colonnes_protegees
  before update on public.organizations
  for each row execute function vehora.protect_organization();

comment on function vehora.protect_organization() is
  'Une policy ne voit pas quelle colonne a changé : ce trigger refuse au client '
  'la devise, le raccourci, l''état et l''identifiant. Les fonctions de '
  'plateforme, SECURITY DEFINER, ne s''exécutent pas sous authenticated et '
  'passent.';

-- ---------------------------------------------------------------------------
-- Ce que l'écran a besoin de lire et d'écrire
--
-- Les deux tables ont déjà leurs policies de lecture et de mise à jour, et le
-- trigger ci-dessus borne la première. `organization_settings` n'a besoin de
-- rien de plus : chacune de ses colonnes est un réglage légitime.
--
-- Il manquait en revanche une ligne de réglages aux organisations créées avant
-- que la table n'existe : l'écran lirait alors « rien » au lieu des valeurs par
-- défaut, et le premier enregistrement n'aurait rien à mettre à jour.
-- ---------------------------------------------------------------------------
insert into public.organization_settings (organization_id)
select o.id from public.organizations o
 where not exists (
   select 1 from public.organization_settings s where s.organization_id = o.id)
on conflict (organization_id) do nothing;

-- Une seule voie crée une organisation — `provisionner_organisation()` — et
-- elle pose déjà cette ligne. On ne double pas ce travail par un trigger : ce
-- serait deux mécanismes pour le même effet, et le premier essai l'a montré en
-- faisant échouer le provisionnement sur une clé dupliquée. Le rattrapage
-- ci-dessus suffit ; il vise les organisations nées avant la table.
