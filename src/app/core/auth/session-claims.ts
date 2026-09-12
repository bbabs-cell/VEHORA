/**
 * Claims VEHORA portés par le JWT, produits par le custom access token hook
 * (`vehora.custom_access_token_hook`, ADR-001).
 *
 * IMPORTANT — ces claims servent UNIQUEMENT à adapter l'interface.
 * Ils ne protègent rien : la vérité est appliquée par la RLS côté serveur.
 * Un utilisateur peut fabriquer un JWT arbitraire côté client ; il n'en tirera
 * aucun accès, car PostgreSQL vérifie la signature du jeton.
 */
export interface VehoraClaims {
  readonly sub: string;
  readonly orgId: string | null;
  readonly role: string | null;
  readonly roleScope: 'PLATFORM' | 'ORGANIZATION' | 'STATION' | null;
  readonly stationIds: readonly string[];
  readonly permissions: ReadonlySet<string>;
  readonly isPlatformAdmin: boolean;
  readonly isImpersonating: boolean;
}

/** Claims vides : utilisateur non connecté, ou jeton illisible. */
export const EMPTY_CLAIMS: VehoraClaims = {
  sub: '',
  orgId: null,
  role: null,
  roleScope: null,
  stationIds: [],
  permissions: new Set<string>(),
  isPlatformAdmin: false,
  isImpersonating: false,
};

/** Décode la charge utile d'un JWT sans vérifier sa signature. */
function decodePayload(accessToken: string): Record<string, unknown> | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    // Jeton illisible : on retombe sur des claims vides plutôt que de planter.
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function parseClaims(accessToken: string | undefined): VehoraClaims {
  if (!accessToken) return EMPTY_CLAIMS;

  const payload = decodePayload(accessToken);
  if (!payload) return EMPTY_CLAIMS;

  const scope = payload['role_scope'];
  // Le rôle métier est publié sous `vehora_role` : le claim `role` appartient à
  // Supabase et détermine le rôle PostgreSQL de la session (cf. migration
  // 20260912090000). Ne jamais le lire ici.
  const vehoraRole = payload['vehora_role'];

  return {
    sub: typeof payload['sub'] === 'string' ? payload['sub'] : '',
    orgId: typeof payload['org_id'] === 'string' ? payload['org_id'] : null,
    role: typeof vehoraRole === 'string' ? vehoraRole : null,
    roleScope:
      scope === 'PLATFORM' || scope === 'ORGANIZATION' || scope === 'STATION' ? scope : null,
    stationIds: asStringArray(payload['station_ids']),
    permissions: new Set(asStringArray(payload['permissions'])),
    isPlatformAdmin: payload['is_platform_admin'] === true,
    isImpersonating: typeof payload['impersonation_session_id'] === 'string',
  };
}
