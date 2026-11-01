import { Business, Order } from './types';

/**
 * Retourne le seuil d'alerte en minutes défini pour le commerce (15 min par défaut).
 */
export function getWaitThresholdMinutes(business?: Business | null): number {
  return business?.config?.wait_alert_minutes ?? 15;
}

/**
 * Retourne le timestamp (en millisecondes) à partir duquel la commande est prête,
 * en lisant ready_at en priorité, sinon updated_at, sinon created_at.
 */
export function getReadySinceMs(order: Order): number {
  const departureStr = order.ready_at || order.updated_at || order.created_at;
  if (!departureStr) return 0;
  const timeMs = new Date(departureStr).getTime();
  return isNaN(timeMs) ? 0 : timeMs;
}

/**
 * Formate une durée d'attente en minutes :
 * - Moins de 60 min : "15 min", "16 min"...
 * - De 60 min à 24 h : "1 h 05"
 * - Au-delà de 24 h : "2 j 3 h"
 */
export function formatWaitDuration(elapsedMinutes: number): string {
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min`;
  }
  if (elapsedMinutes < 1440) {
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    return `${hours} h ${String(mins).padStart(2, '0')}`;
  }
  const days = Math.floor(elapsedMinutes / 1440);
  const remHours = Math.floor((elapsedMinutes % 1440) / 60);
  return `${days} j ${remHours} h`;
}
