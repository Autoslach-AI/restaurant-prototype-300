import { Product } from './types';

/**
 * Renvoie le timestamp (en ms) correspondant au début du jour local (00:00:00.000)
 * pour l'horodatage nowMs fourni.
 */
export function getStartOfTodayMs(nowMs: number): number {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Détermine si le plafond journalier d'un produit est atteint ou dépassé.
 * Renvoie true si daily_limit est défini (non-null et non-undefined)
 * et que la somme (soldToday + qtyInCart) atteint ou dépasse daily_limit.
 */
export function isLimitReached(
  product?: { daily_limit?: number | null } | null,
  soldToday: number = 0,
  qtyInCart: number = 0
): boolean {
  if (!product || product.daily_limit === null || product.daily_limit === undefined) {
    return false;
  }
  return (soldToday + qtyInCart) >= product.daily_limit;
}

/**
 * Calcule le nombre d'unités restantes disponibles à la vente aujourd'hui.
 * Renvoie null si aucune limite quotidienne n'est définie (illimité),
 * ou un entier >= 0 représentant le solde restant.
 */
export function getRemainingUnits(
  product?: { daily_limit?: number | null } | null,
  soldToday: number = 0
): number | null {
  if (!product || product.daily_limit === null || product.daily_limit === undefined) {
    return null;
  }
  return Math.max(0, product.daily_limit - soldToday);
}

export interface CutoffInfo {
  passed: boolean;
  remainingMs: number;
  time: string;
}

/**
 * Renvoie les informations d'heure limite des commandes calculées avec l'heure locale du jour.
 * Renvoie null si order_cutoff est absent ou désactivé, ou si l'heure est invalide.
 * Sinon renvoie { passed: boolean, remainingMs: number, time: string }.
 */
export function getCutoffInfo(
  config?: { order_cutoff?: { enabled?: boolean; time?: string; message?: string } } | null,
  nowMs: number = Date.now()
): CutoffInfo | null {
  if (!config?.order_cutoff?.enabled || !config.order_cutoff.time) {
    return null;
  }

  const timeStr = config.order_cutoff.time.trim();
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const now = new Date(nowMs);
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  const cutoffMs = cutoffDate.getTime();
  const diffMs = cutoffMs - nowMs;
  const passed = diffMs <= 0;

  return {
    passed,
    remainingMs: Math.max(0, diffMs),
    time: timeStr,
  };
}
