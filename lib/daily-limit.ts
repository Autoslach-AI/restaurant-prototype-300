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
