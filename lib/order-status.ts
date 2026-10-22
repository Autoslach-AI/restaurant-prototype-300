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
  orderType?: OrderType | string | null
): string {
  if (!status) return '';
  const s = status.toLowerCase();

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
