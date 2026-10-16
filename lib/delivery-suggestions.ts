import { Order } from './types';

export interface DriverSuggestion {
  driverId?: string;
  driverName: string;
  source: 'customer' | 'zone';
  count: number;
  reason: string;
}

export interface CustomerDriverStat {
  driverId?: string;
  driverName: string;
  count: number;
}

export interface ZoneDriverStat {
  driverId?: string;
  driverName: string;
  count: number;
}

/**
 * 1. Historique client : pour chaque customer_id, le livreur (driver_id en priorité, sinon assigned_to)
 * qui a livré le plus de commandes livrées (status === 'delivered') de ce client, avec le nombre de fois.
 * Suggestion seulement à partir de 2 livraisons. Jamais de valeur fictive.
 */
export function buildCustomerDriverHistory(orders: Order[]): Map<string, CustomerDriverStat> {
  const result = new Map<string, CustomerDriverStat>();
  // Map<customerId, Map<driverKey, { driverId?: string; driverName: string; count: number }>>
  const countsByCustomer = new Map<string, Map<string, { driverId?: string; driverName: string; count: number }>>();

  for (const o of orders) {
    if (o.status !== 'delivered') continue;
    const customerId = o.customer_id;
    if (!customerId) continue;

    // Priorité à driver_id, sinon assigned_to
    const driverId = o.driver_id?.trim() || undefined;
    const driverName = o.assigned_to?.trim() || '';
    if (!driverId && !driverName) continue;

    const driverKey = driverId ? `id:${driverId}` : `name:${driverName.toLowerCase()}`;

    let driverMap = countsByCustomer.get(customerId);
    if (!driverMap) {
      driverMap = new Map();
      countsByCustomer.set(customerId, driverMap);
    }

    const current = driverMap.get(driverKey) || {
      driverId,
      driverName: driverName || 'Livreur',
      count: 0,
    };
    current.count += 1;
    if (driverName && (!current.driverName || current.driverName === 'Livreur')) {
      current.driverName = driverName;
    }
    if (driverId && !current.driverId) {
      current.driverId = driverId;
    }
    driverMap.set(driverKey, current);
  }

  for (const [customerId, driverMap] of countsByCustomer.entries()) {
    let bestStat: { driverId?: string; driverName: string; count: number } | null = null;
    let maxCount = 0;

    for (const stat of driverMap.values()) {
      if (stat.count > maxCount) {
        maxCount = stat.count;
        bestStat = stat;
      }
    }

    // Seuil strict : à partir de 2 livraisons
    if (maxCount >= 2 && bestStat && bestStat.driverName) {
      result.set(customerId, {
        driverId: bestStat.driverId,
        driverName: bestStat.driverName,
        count: maxCount,
      });
    }
  }

  return result;
}

/**
 * 2. Historique de zone : pour chaque zone, le livreur le plus fréquent
 * sur les 30 derniers jours (commandes delivered, même seuil de 2).
 * S'appuie sur driver_id, sinon sur assigned_to. Jamais de valeur fictive.
 */
export function buildZoneDriverHistory(
  orders: Order[],
  nowMs: number = Date.now()
): Map<string, ZoneDriverStat> {
  const result = new Map<string, ZoneDriverStat>();
  const countsByZone = new Map<string, Map<string, { driverId?: string; driverName: string; count: number }>>();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoffTime = nowMs - THIRTY_DAYS_MS;

  for (const o of orders) {
    if (o.status !== 'delivered') continue;
    const createdAtMs = new Date(o.created_at).getTime();
    if (isNaN(createdAtMs) || createdAtMs < cutoffTime) continue;

    const zoneKey = o.delivery_zone_id || (o.delivery_zone_name?.trim() ? `name:${o.delivery_zone_name.trim().toLowerCase()}` : '');
    if (!zoneKey) continue;

    // Priorité à driver_id, sinon assigned_to
    const driverId = o.driver_id?.trim() || undefined;
    const driverName = o.assigned_to?.trim() || '';
    if (!driverId && !driverName) continue;

    const driverKey = driverId ? `id:${driverId}` : `name:${driverName.toLowerCase()}`;

    let driverMap = countsByZone.get(zoneKey);
    if (!driverMap) {
      driverMap = new Map();
      countsByZone.set(zoneKey, driverMap);
    }

    const current = driverMap.get(driverKey) || {
      driverId,
      driverName: driverName || 'Livreur',
      count: 0,
    };
    current.count += 1;
    if (driverName && (!current.driverName || current.driverName === 'Livreur')) {
      current.driverName = driverName;
    }
    if (driverId && !current.driverId) {
      current.driverId = driverId;
    }
    driverMap.set(driverKey, current);
  }

  for (const [zoneKey, driverMap] of countsByZone.entries()) {
    let bestStat: { driverId?: string; driverName: string; count: number } | null = null;
    let maxCount = 0;

    for (const stat of driverMap.values()) {
      if (stat.count > maxCount) {
        maxCount = stat.count;
        bestStat = stat;
      }
    }

    // Seuil strict : à partir de 2 livraisons
    if (maxCount >= 2 && bestStat && bestStat.driverName) {
      result.set(zoneKey, {
        driverId: bestStat.driverId,
        driverName: bestStat.driverName,
        count: maxCount,
      });
    }
  }

  return result;
}

/**
 * 3. suggestForOrder(order, customerHistory, zoneHistory) :
 * Priorité à l'historique client, sinon à l'historique de zone, sinon aucune.
 * Données réelles uniquement, jamais de valeur fictive.
 */
export function suggestForOrder(
  order: Order,
  customerHistory: Map<string, CustomerDriverStat>,
  zoneHistory: Map<string, ZoneDriverStat>
): DriverSuggestion | null {
  // 1. Priorité à l'historique client
  if (order.customer_id) {
    const custStat = customerHistory.get(order.customer_id);
    if (custStat && custStat.driverName) {
      return {
        driverId: custStat.driverId,
        driverName: custStat.driverName,
        source: 'customer',
        count: custStat.count,
        reason: `Suggéré : ${custStat.driverName}, ${custStat.count} fois`,
      };
    }
  }

  // 2. Sinon historique de zone
  const zoneKey = order.delivery_zone_id || (order.delivery_zone_name?.trim() ? `name:${order.delivery_zone_name.trim().toLowerCase()}` : '');
  if (zoneKey) {
    const zoneStat = zoneHistory.get(zoneKey);
    if (zoneStat && zoneStat.driverName) {
      return {
        driverId: zoneStat.driverId,
        driverName: zoneStat.driverName,
        source: 'zone',
        count: zoneStat.count,
        reason: `Suggéré (zone) : ${zoneStat.driverName}, ${zoneStat.count} fois`,
      };
    }
  }

  // 3. Sinon aucune suggestion
  return null;
}
