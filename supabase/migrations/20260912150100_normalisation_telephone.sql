-- VEHORA — Phase 5 : normalisation réelle des numéros de téléphone.
--
-- Constat. La colonne générée se contentait de retirer les caractères non
-- numériques. « +221 77 123 45 67 » donnait donc « 221771234567 », et
-- « 00221 77 123 45 67 » donnait « 00221771234567 » : deux fiches pour la même
-- personne, alors que l'unicité du numéro est précisément ce qui empêche les
-- doublons. Et « 77 123 45 67 », la forme que tout le monde saisit réellement,
-- ne correspondait à aucune des deux.
--
-- Impact. Le doublon client est le premier problème de qualité de données en
-- station : un même client accumule plusieurs historiques et sa fidélité
-- devient fausse.
--
-- Correction. Une colonne générée ne peut pas consulter une autre table ; on
-- passe donc par un trigger, qui connaît le pays de l'organisation et ramène
-- tout numéro à sa forme internationale.

-- Indicatifs des pays du marché. Étendre ici, pas dans le code applicatif.
create or replace function vehora.indicatif_pays(p_code text)
returns text language sql immutable set search_path = '' as $$
  select case upper(coalesce(p_code, ''))
    when 'SN' then '221'  when 'ML' then '223'  when 'CI' then '225'
    when 'BF' then '226'  when 'GN' then '224'  when 'BJ' then '229'
    when 'TG' then '228'  when 'NE' then '227'  when 'MR' then '222'
    when 'GH' then '233'  when 'NG' then '234'  when 'CM' then '237'
    when 'FR' then '33'
    else null
  end;
$$;

create or replace function vehora.normaliser_telephone(p_numero text, p_pays text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_chiffres  text;
  v_indicatif text := vehora.indicatif_pays(p_pays);
begin
  v_chiffres := nullif(regexp_replace(coalesce(p_numero, ''), '[^0-9]', '', 'g'), '');
  if v_chiffres is null then
    return null;
  end if;

  -- « 00 » est le préfixe international composé à l'ancienne : 00221… = +221…
  if left(v_chiffres, 2) = '00' then
    v_chiffres := substr(v_chiffres, 3);
  end if;

  if v_indicatif is null then
    return v_chiffres;
  end if;

  -- Déjà international : on n'ajoute rien.
  if left(v_chiffres, length(v_indicatif)) = v_indicatif
     and length(v_chiffres) > length(v_indicatif) then
    return v_chiffres;
  end if;

  -- Numéro national : certains pays le font précéder d'un 0 (France, Mali…).
  if left(v_chiffres, 1) = '0' then
    v_chiffres := substr(v_chiffres, 2);
  end if;

  return v_indicatif || v_chiffres;
end;
$$;

-- La colonne générée ne peut pas lire `organizations` : on la remplace par une
-- colonne remplie par trigger. L'index unique porte sur elle, il tombe avec.
drop index if exists customers_telephone_unique_idx;
alter table public.customers drop column phone_digits;
alter table public.customers add column phone_digits text;

create or replace function vehora.normaliser_telephone_client()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_pays text;
begin
  select country_code into v_pays
    from public.organizations where id = new.organization_id;

  new.phone_digits := vehora.normaliser_telephone(new.phone, v_pays);
  return new;
end;
$$;

create trigger customers_normaliser_telephone
  before insert or update of phone, organization_id on public.customers
  for each row execute function vehora.normaliser_telephone_client();

-- Reprise des lignes existantes.
update public.customers c
   set phone_digits = vehora.normaliser_telephone(
         c.phone, (select country_code from public.organizations o where o.id = c.organization_id))
 where c.phone is not null;

create unique index customers_telephone_unique_idx
  on public.customers (organization_id, phone_digits)
  where archived_at is null and phone_digits is not null;

comment on column public.customers.phone_digits is
  'Numéro normalisé en forme internationale par trigger. Ne jamais l''écrire depuis le client.';
