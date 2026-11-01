import { OrderStatus, OrderType } from './types';

/**
 * Retourne le libellé utilisateur d'un statut de commande en fonction du type de commande.
 * 
 * - pending   : « En attente de paiement »
 * - confirmed : « Confirmée »
 * - preparing : « Confirmée » (alias d'affichage : la valeur existe en base mais n'est plus proposée)
 * - ready     : « Prête »
 * - delivered : « Livrée » si order_type = 'delivery', « Retirée » si order_type = 'pickup'
 * - cancelled : « Annulée »
 */
export function getOrderStatusLabel(
  status?: OrderStatus | string | null,
  orderType?: OrderType | string | null,
  driverInfo?: { driver_id?: string | null; assigned_to?: string | null } | null
): string {
  if (!status) return '';
  const s = status.toLowerCase();

  const hasDriver = Boolean(
    driverInfo &&
    ((driverInfo.driver_id && driverInfo.driver_id.trim()) ||
     (driverInfo.assigned_to && driverInfo.assigned_to.trim()))
  );

  if (
    orderType === 'delivery' &&
    hasDriver &&
    (s === 'pending' || s === 'confirmed' || s === 'preparing' || s === 'ready')
  ) {
    return 'En charge';
  }

  switch (s) {
    case 'pending':
      return 'En attente de paiement';
    case 'confirmed':
    case 'preparing':
      return 'Confirmée';
    case 'ready':
      return 'Prête';
    case 'delivered':
      return orderType === 'pickup' ? 'Retirée' : 'Livrée';
    case 'cancelled':
      return 'Annulée';
    default:
      return status;
  }
}
