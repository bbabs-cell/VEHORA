import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.client';
import type { Enums, Tables } from '../../types/database.types';

export interface Membre {
  readonly id: string;
  readonly profileId: string;
  readonly nom: string;
  readonly roleId: string;
  readonly roleCode: string;
  readonly roleLabel: string;
  readonly roleScope: Enums<'role_scope'>;
  readonly statut: Enums<'membership_status'>;
}

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly roleLabel: string;
  readonly statut: Enums<'invitation_status'>;
  readonly token: string;
  readonly expireLe: string;
}

export type Role = Pick<Tables<'roles'>, 'id' | 'code' | 'label' | 'scope' | 'description'>;

function message(code: string | undefined, brut: string): string {
  if (code === '23505') return 'Une invitation est déjà en attente pour cette adresse.';
  if (code === '42501') return "Vous n'avez pas le droit d'effectuer cette action.";
  if (brut.includes('VEHORA_LAST_OWNER')) {
    return 'Votre organisation doit conserver au moins un propriétaire actif.';
  }
  if (brut.toLowerCase().includes('failed to fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.';
  }
  return "L'opération a échoué. Réessayez dans un instant.";
}

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly supabase = inject(SupabaseService);

  private readonly _membres = signal<Membre[]>([]);
  private readonly _invitations = signal<Invitation[]>([]);
  private readonly _roles = signal<Role[]>([]);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly membres = this._membres.asReadonly();
  readonly invitations = this._invitations.asReadonly();
  readonly roles = this._roles.asReadonly();
  readonly chargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  async charger(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);

    const [membres, invitations, roles] = await Promise.all([
      this.supabase.client
        .from('organization_memberships')
        // La jointure vers `profiles` doit nommer sa clé : la table en porte
        // deux (`profile_id` et `invited_by`), et PostgREST refuse l'ambiguïté.
        // La chaîne doit rester un littéral : c'est elle qui type le résultat.
        // eslint-disable-next-line max-len
        .select('id, profile_id, status, role_id, profiles!organization_memberships_profile_id_fkey(full_name), roles(code, label, scope)')
        .order('created_at', { ascending: true })
        .limit(200),
      this.supabase.client
        .from('organization_invitations')
        .select('id, email, status, token, expires_at, roles(label)')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(100),
      this.supabase.client
        .from('roles')
        .select('id, code, label, scope, description')
        .neq('scope', 'PLATFORM')
        .order('scope', { ascending: true }),
    ]);

    this._chargement.set(false);

    if (membres.error) {
      this._erreur.set(message(membres.error.code, membres.error.message));
      return;
    }

    this._membres.set(
      (membres.data ?? []).map((m) => ({
        id: m.id,
        profileId: m.profile_id,
        nom: m.profiles?.full_name || 'Sans nom',
        roleId: m.role_id,
        roleCode: m.roles?.code ?? '',
        roleLabel: m.roles?.label ?? '',
        roleScope: m.roles?.scope ?? 'STATION',
        statut: m.status,
      })),
    );

    this._invitations.set(
      (invitations.data ?? []).map((i) => ({
        id: i.id,
        email: i.email,
        roleLabel: i.roles?.label ?? '',
        statut: i.status,
        token: i.token,
        expireLe: i.expires_at,
      })),
    );

    this._roles.set(roles.data ?? []);
  }

  async inviter(email: string, roleId: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('organization_invitations')
      .insert({ email: email.trim().toLowerCase(), role_id: roleId });

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  async revoquerInvitation(id: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('organization_invitations')
      .update({ status: 'REVOKED' })
      .eq('id', id);

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  async changerRole(membershipId: string, roleId: string): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('organization_memberships')
      .update({ role_id: roleId })
      .eq('id', membershipId);

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }

  /**
   * Suspendre coupe l'accès sans supprimer le compte ni son historique.
   * L'effet n'est complet qu'au renouvellement du jeton de la personne
   * concernée (ADR-001) — au plus 15 minutes.
   */
  async changerStatut(membershipId: string, statut: Enums<'membership_status'>): Promise<string | null> {
    const { error } = await this.supabase.client
      .from('organization_memberships')
      .update({ status: statut })
      .eq('id', membershipId);

    if (error) return message(error.code, error.message);
    await this.charger();
    return null;
  }
}
