import { Injectable, computed, inject, signal } from '@angular/core';
import type { AuthError, Session } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.client';
import { EMPTY_CLAIMS, parseClaims, type VehoraClaims } from './session-claims';

/** État de chargement initial : évite de rediriger avant de connaître la session. */
export type AuthStatus = 'chargement' | 'connecte' | 'deconnecte';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  private readonly _session = signal<Session | null>(null);
  private readonly _status = signal<AuthStatus>('chargement');

  readonly status = this._status.asReadonly();
  readonly session = this._session.asReadonly();

  /** Claims VEHORA du jeton courant. Sert à l'affichage, jamais à la sécurité. */
  readonly claims = computed<VehoraClaims>(() => {
    const session = this._session();
    return session ? parseClaims(session.access_token) : EMPTY_CLAIMS;
  });

  readonly isAuthenticated = computed(() => this._status() === 'connecte');

  /** Compte valide mais rattaché à aucune organisation active. */
  readonly hasOrganization = computed(() => this.claims().orgId !== null);

  readonly isPlatformAdmin = computed(() => this.claims().isPlatformAdmin);

  constructor() {
    void this.restoreSession();

    // Connexion, déconnexion, rafraîchissement de jeton : une seule source.
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
      this._status.set(session ? 'connecte' : 'deconnecte');
    });
  }

  private async restoreSession(): Promise<void> {
    try {
      const { data } = await this.supabase.client.auth.getSession();
      this._session.set(data.session);
      this._status.set(data.session ? 'connecte' : 'deconnecte');
    } catch {
      // Réseau coupé au démarrage, stockage local inaccessible : on considère
      // l'utilisateur déconnecté plutôt que de figer l'application.
      // Sans ce filet, l'état resterait « chargement » et les gardes
      // attendraient indéfiniment.
      this._session.set(null);
      this._status.set('deconnecte');
    }
  }

  /**
   * Vérifie une permission pour ADAPTER L'INTERFACE uniquement.
   * Masquer un bouton n'interdit rien : la RLS reste la seule barrière.
   */
  hasPermission(key: string): boolean {
    return this.claims().permissions.has(key);
  }

  async signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error };
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  /**
   * Force le renouvellement du jeton. À appeler après tout changement de rôle
   * ou d'organisation active : les claims ne changent qu'au rafraîchissement
   * (ADR-001).
   */
  async refreshClaims(): Promise<void> {
    const { data } = await this.supabase.client.auth.refreshSession();
    this._session.set(data.session);
  }
}
