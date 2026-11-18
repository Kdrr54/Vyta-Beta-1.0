export interface WarrantyStatus {
  email: string | null;
  active: boolean;
  plan?: string;
  expiresAt?: string;
  source: 'remote' | 'registry' | 'none';
}

export interface WarrantyRecord {
  active: boolean;
  plan?: string;
  expiresAt?: string;
}

/**
 * Registre local des e-mails vérifiés Aurel Care (complété dynamiquement si une API Shopify/Supabase est configurée).
 * Par défaut vide : aucune garantie n'est accordée arbitrairement sans preuve d'achat.
 */
const VERIFIED_WARRANTY_REGISTRY: Record<string, WarrantyRecord> = {};

const ACCOUNT_EMAIL_KEY = 'aurel_account_email';
const WARRANTY_API_URL_KEY = 'aurel_warranty_api_url';

export function getAccountEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACCOUNT_EMAIL_KEY);
    const cleaned = raw?.trim().toLowerCase();
    return cleaned && cleaned.includes('@') ? cleaned : null;
  } catch {
    return null;
  }
}

export function setAccountEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (email && email.trim()) {
      localStorage.setItem(ACCOUNT_EMAIL_KEY, email.trim().toLowerCase());
    } else {
      localStorage.removeItem(ACCOUNT_EMAIL_KEY);
    }
  } catch (_) {}
}

/**
 * Vérifie la couverture Aurel Care associée à l'adresse e-mail de l'utilisateur.
 * Interroge le endpoint configuré (VITE_AUREL_WARRANTY_API / localStorage) si présent,
 * sinon vérifie strictement dans le registre vérifié.
 */
export async function checkWarrantyForEmail(emailInput?: string | null): Promise<WarrantyStatus> {
  const email = (emailInput ?? getAccountEmail())?.trim().toLowerCase() || null;
  if (!email) {
    return { email: null, active: false, source: 'none' };
  }

  const remoteEndpoint =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AUREL_WARRANTY_API) ||
    (typeof window !== 'undefined' ? localStorage.getItem(WARRANTY_API_URL_KEY) : null);

  if (remoteEndpoint && /^https?:\/\//i.test(remoteEndpoint)) {
    try {
      const separator = remoteEndpoint.includes('?') ? '&' : '?';
      const res = await fetch(`${remoteEndpoint}${separator}email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const payload = await res.json();
        return {
          email,
          active: Boolean(payload?.active),
          plan: typeof payload?.plan === 'string' ? payload.plan : undefined,
          expiresAt: typeof payload?.expiresAt === 'string' ? payload.expiresAt : undefined,
          source: 'remote',
        };
      }
    } catch (_) {}
  }

  const record = VERIFIED_WARRANTY_REGISTRY[email];
  if (record && record.active) {
    return {
      email,
      active: true,
      plan: record.plan,
      expiresAt: record.expiresAt,
      source: 'registry',
    };
  }

  return { email, active: false, source: 'none' };
}
