'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, RefreshCw, AlertCircle, X, Star } from 'lucide-react';
import { Order, Business, Driver, OrderItem } from '@/lib/types';
import { getOrderShortRef, getPaymentMethodLabel } from '@/lib/print-docs';
import { formatWaitDuration } from '@/lib/wait-alert';
import { fetchOrderItemsForOrders } from '@/lib/supabase';

export interface DeliveredSectionProps {
  business: Business;
  orders: Order[];
  nowMs: number;
  drivers: Driver[];
}

export default function DeliveredSection({
  business,
  orders,
  nowMs,
  drivers,
}: DeliveredSectionProps) {
  // Filtres de l'onglet « Livrées »
  const [deliveredPeriodFilter, setDeliveredPeriodFilter] = useState<
    'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'all' | 'custom'
  >('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [deliveredDriverFilter, setDeliveredDriverFilter] = useState<string>('all');
  const [deliveredZoneFilter, setDeliveredZoneFilter] = useState<string>('all');
  const [deliveredChannelFilter, setDeliveredChannelFilter] = useState<string>('all');
  const [deliveredSearchQuery, setDeliveredSearchQuery] = useState<string>('');
  const [deliveredVisibleLimit, setDeliveredVisibleLimit] = useState<number>(50);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(false);

  // État de chargement par lot des articles de commande
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, OrderItem[]>>({});
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [itemsLoadError, setItemsLoadError] = useState<boolean>(false);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // État du volet de détail d'une commande
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailItemsLoading, setDetailItemsLoading] = useState<boolean>(false);
  const [detailItemsError, setDetailItemsError] = useState<boolean>(false);

  // Commandes livrées (traçabilité)
  const deliveredOrders = useMemo(() => {
    return orders.filter((o) => {
      const isBiz = o.business_id === business.id;
      const isDeliv = o.order_type === 'delivery';
      return isBiz && isDeliv && o.status === 'delivered';
    });
  }, [orders, business.id]);

  // Helper pour formater une Date en YYYY-MM-DD local
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Helper pour formater une chaîne YYYY-MM-DD en JJ/MM/AAAA
  const formatDateToDMY = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Helper pour formater une date ISO en JJ/MM/AAAA HH:mm
  const formatDateTimeDMY = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Calcul des bornes de la période sélectionnée (fuseau local de l'utilisateur)
  const deliveredDateBounds = useMemo(() => {
    const base = new Date(nowMs);
    const y = base.getFullYear();
    const m = base.getMonth();
    const d = base.getDate();

    if (deliveredPeriodFilter === 'today') {
      const start = new Date(y, m, d, 0, 0, 0, 0).getTime();
      const end = new Date(y, m, d, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (deliveredPeriodFilter === 'yesterday') {
      const yesterday = new Date(y, m, d - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (deliveredPeriodFilter === '7days') {
      const past7 = new Date(y, m, d - 6);
      const start = new Date(past7.getFullYear(), past7.getMonth(), past7.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(y, m, d, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (deliveredPeriodFilter === '30days') {
      const past30 = new Date(y, m, d - 29);
      const start = new Date(past30.getFullYear(), past30.getMonth(), past30.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(y, m, d, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (deliveredPeriodFilter === 'this_month') {
      const start = new Date(y, m, 1, 0, 0, 0, 0).getTime();
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (deliveredPeriodFilter === 'last_month') {
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
      const end = new Date(y, m, 0, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (deliveredPeriodFilter === 'custom') {
      let start = -Infinity;
      let end = Infinity;
      if (customStartDate) {
        const parts = customStartDate.split('-').map(Number);
        if (parts.length === 3) {
          start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
        }
      }
      if (customEndDate) {
        const parts = customEndDate.split('-').map(Number);
        if (parts.length === 3) {
          end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
        }
      }
      return { start, end };
    }

    // 'all' : aucune restriction temporelle
    return { start: -Infinity, end: Infinity };
  }, [deliveredPeriodFilter, customStartDate, customEndDate, nowMs]);

  // Navigation ‹ et › pour reculer ou avancer d'un jour
  const isSingleDayCustom =
    deliveredPeriodFilter === 'custom' &&
    Boolean(customStartDate) &&
    customStartDate === customEndDate;

  const isNavDisabled =
    deliveredPeriodFilter === 'all' ||
    deliveredPeriodFilter === '7days' ||
    deliveredPeriodFilter === '30days' ||
    deliveredPeriodFilter === 'this_month' ||
    deliveredPeriodFilter === 'last_month' ||
    (deliveredPeriodFilter === 'custom' && !isSingleDayCustom);

  const isNextDayDisabled =
    isNavDisabled || deliveredPeriodFilter === 'today';

  const isPrevDayDisabled = isNavDisabled;

  const handlePrevDay = () => {
    if (isPrevDayDisabled) return;
    const base = new Date(nowMs);
    const y = base.getFullYear();
    const m = base.getMonth();
    const d = base.getDate();

    if (deliveredPeriodFilter === 'today') {
      setDeliveredPeriodFilter('yesterday');
      return;
    }

    if (deliveredPeriodFilter === 'yesterday') {
      const dayBefore = new Date(y, m, d - 2);
      const s = formatLocalDate(dayBefore);
      setCustomStartDate(s);
      setCustomEndDate(s);
      setDeliveredPeriodFilter('custom');
      return;
    }

    if (isSingleDayCustom) {
      const parts = customStartDate.split('-').map(Number);
      const prevDate = new Date(parts[0], parts[1] - 1, parts[2] - 1);
      const s = formatLocalDate(prevDate);
      setCustomStartDate(s);
      setCustomEndDate(s);
    }
  };

  const handleNextDay = () => {
    if (isNextDayDisabled) return;
    const base = new Date(nowMs);
    const y = base.getFullYear();
    const m = base.getMonth();
    const d = base.getDate();
    const yesterdayStr = formatLocalDate(new Date(y, m, d - 1));
    const todayStr = formatLocalDate(base);

    if (deliveredPeriodFilter === 'yesterday') {
      setDeliveredPeriodFilter('today');
      return;
    }

    if (isSingleDayCustom) {
      const parts = customStartDate.split('-').map(Number);
      const nextDate = new Date(parts[0], parts[1] - 1, parts[2] + 1);
      const nextStr = formatLocalDate(nextDate);

      if (nextStr === todayStr) {
        setDeliveredPeriodFilter('today');
      } else if (nextStr === yesterdayStr) {
        setDeliveredPeriodFilter('yesterday');
      } else {
        setCustomStartDate(nextStr);
        setCustomEndDate(nextStr);
      }
    }
  };

  // Helper pour vérifier la correspondance du filtre livreur
  const matchesDriverFilter = (ord: Order, filterValue: string, driversList: Driver[]): boolean => {
    if (filterValue === 'all') return true;
    if (filterValue === '__unassigned__') {
      return !ord.driver_id && !(ord.assigned_to && ord.assigned_to.trim());
    }
    const cleanFilter = filterValue.startsWith('name:') ? filterValue.slice(5) : filterValue;
    const selectedDriver = driversList.find((d) => d.id === filterValue);
    const matchesId = ord.driver_id === filterValue;
    const matchesName =
      (ord.assigned_to && ord.assigned_to.trim().toLowerCase() === cleanFilter.toLowerCase()) ||
      (selectedDriver && ord.assigned_to?.trim().toLowerCase() === selectedDriver.name.trim().toLowerCase());
    return !!(matchesId || matchesName);
  };

  // Commandes filtrées par période, zone et recherche (base pour les pastilles)
  const baseFilteredOrders = useMemo(() => {
    return deliveredOrders.filter((ord) => {
      // 1. Période (utilise delivered_at, sinon updated_at)
      if (deliveredPeriodFilter !== 'all') {
        const dateStr = ord.delivered_at || ord.updated_at;
        if (!dateStr) return false;
        const timeMs = new Date(dateStr).getTime();
        if (isNaN(timeMs)) return false;
        if (timeMs < deliveredDateBounds.start || timeMs > deliveredDateBounds.end) {
          return false;
        }
      }

      // 2. Filtre zone
      if (deliveredZoneFilter !== 'all') {
        const ordZoneId = ord.delivery_zone_id || '__no_zone__';
        if (ordZoneId !== deliveredZoneFilter) return false;
      }

      // 3. Recherche client, tél, réf, adresse, livreur
      if (deliveredSearchQuery.trim()) {
        const q = deliveredSearchQuery.toLowerCase().trim();
        const matchesClient = ord.customer_name?.toLowerCase().includes(q) ?? false;
        const matchesPhone = ord.customer_phone?.toLowerCase().includes(q) ?? false;
        const matchesRef =
          ord.id.toLowerCase().includes(q) ||
          (ord.payment_reference?.toLowerCase().includes(q) ?? false);
        const matchesAddress = ord.delivery_address?.toLowerCase().includes(q) ?? false;
        const matchesDriver = ord.assigned_to?.toLowerCase().includes(q) ?? false;
        if (!matchesClient && !matchesPhone && !matchesRef && !matchesAddress && !matchesDriver) {
          return false;
        }
      }

      return true;
    });
  }, [
    deliveredOrders,
    deliveredPeriodFilter,
    deliveredDateBounds,
    deliveredZoneFilter,
    deliveredSearchQuery,
  ]);

  // Commandes pour calculer les pastilles canaux (sans appliquer le filtre canal)
  const ordersForChannelPills = useMemo(() => {
    if (deliveredDriverFilter === 'all') return baseFilteredOrders;
    return baseFilteredOrders.filter((ord) => matchesDriverFilter(ord, deliveredDriverFilter, drivers));
  }, [baseFilteredOrders, deliveredDriverFilter, drivers]);

  // Commandes pour calculer les pastilles livreurs (sans appliquer le filtre livreur)
  const ordersForDriverPills = useMemo(() => {
    if (deliveredChannelFilter === 'all') return baseFilteredOrders;
    return baseFilteredOrders.filter((ord) => getPaymentMethodLabel(ord.payment_method) === deliveredChannelFilter);
  }, [baseFilteredOrders, deliveredChannelFilter]);

  // Pastilles canaux de paiement
  const channelPills = useMemo(() => {
    const map = new Map<string, { channelLabel: string; count: number; totalAmount: number }>();
    for (const ord of ordersForChannelPills) {
      const channelLabel = getPaymentMethodLabel(ord.payment_method);
      let item = map.get(channelLabel);
      if (!item) {
        item = { channelLabel, count: 0, totalAmount: 0 };
        map.set(channelLabel, item);
      }
      item.count += 1;
      item.totalAmount += Number(ord.total_amount || 0);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => b.totalAmount - a.totalAmount);
    return list;
  }, [ordersForChannelPills]);

  // Pastilles livreurs
  const driverPills = useMemo(() => {
    const map = new Map<
      string,
      { driverKey: string; driverName: string; count: number; totalAmount: number }
    >();

    for (const ord of ordersForDriverPills) {
      let driverName = 'Non assigné';
      let driverKey = '__unassigned__';

      if (ord.driver_id) {
        const matched = drivers.find((d) => d.id === ord.driver_id);
        if (matched) {
          driverName = matched.name;
          driverKey = matched.id;
        } else if (ord.assigned_to && ord.assigned_to.trim()) {
          driverName = ord.assigned_to.trim();
          driverKey = ord.driver_id;
        }
      } else if (ord.assigned_to && ord.assigned_to.trim()) {
        const trimmed = ord.assigned_to.trim();
        const matched = drivers.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
        if (matched) {
          driverName = matched.name;
          driverKey = matched.id;
        } else {
          driverName = trimmed;
          driverKey = `name:${trimmed.toLowerCase()}`;
        }
      }

      let item = map.get(driverKey);
      if (!item) {
        item = { driverKey, driverName, count: 0, totalAmount: 0 };
        map.set(driverKey, item);
      }
      item.count += 1;
      item.totalAmount += Number(ord.total_amount || 0);
    }

    const list = Array.from(map.values());
    list.sort((a, b) => b.totalAmount - a.totalAmount);
    return list;
  }, [ordersForDriverPills, drivers]);

  // Montant total pour l'option « Tous les canaux »
  const totalChannelsPillsAmount = useMemo(() => {
    return channelPills.reduce((sum, ch) => sum + ch.totalAmount, 0);
  }, [channelPills]);

  // Montant total pour l'option « Tous les livreurs »
  const totalDriversPillsAmount = useMemo(() => {
    return driverPills.reduce((sum, drv) => sum + drv.totalAmount, 0);
  }, [driverPills]);

  // Filtrage complet et tri des commandes livrées
  const filteredDeliveredOrders = useMemo(() => {
    const list = baseFilteredOrders.filter((ord) => {
      // Filtre livreur
      if (deliveredDriverFilter !== 'all') {
        if (!matchesDriverFilter(ord, deliveredDriverFilter, drivers)) return false;
      }

      // Filtre canal de paiement
      if (deliveredChannelFilter !== 'all') {
        const methodLabel = getPaymentMethodLabel(ord.payment_method);
        if (methodLabel !== deliveredChannelFilter) return false;
      }

      return true;
    });

    // Tri par date de livraison décroissante (delivered_at, sinon updated_at)
    list.sort((a, b) => {
      const timeA = a.delivered_at || a.updated_at ? new Date(a.delivered_at || a.updated_at!).getTime() : 0;
      const timeB = b.delivered_at || b.updated_at ? new Date(b.delivered_at || b.updated_at!).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [
    baseFilteredOrders,
    deliveredDriverFilter,
    deliveredChannelFilter,
    drivers,
  ]);

  // Montant total des commandes livrées filtrées
  const totalDeliveredFilteredAmount = useMemo(() => {
    return filteredDeliveredOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  }, [filteredDeliveredOrders]);

  // Total des frais de livraison des commandes livrées filtrées
  const totalDeliveredFilteredFees = useMemo(() => {
    return filteredDeliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0);
  }, [filteredDeliveredOrders]);

  // Calcul de la durée de livraison en ms (uniquement si delivered_at et ready_at existent et delivered_at >= ready_at)
  const getOrderDeliveryDurationMs = (ord: Order): number | null => {
    if (!ord.delivered_at || !ord.ready_at) return null;
    const dMs = new Date(ord.delivered_at).getTime();
    const rMs = new Date(ord.ready_at).getTime();
    if (isNaN(dMs) || isNaN(rMs) || dMs < rMs) return null;
    return dMs - rMs;
  };

  // Récapitulatif par livreur sur TOUTES les livraisons filtrées
  const deliveredDriverSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        driverKey: string;
        driverName: string;
        count: number;
        totalAmount: number;
        deliveryFee: number;
        validDurationCount: number;
        totalDurationMs: number;
      }
    >();

    for (const ord of filteredDeliveredOrders) {
      let driverName = 'Non assigné';
      let driverKey = '__unassigned__';

      if (ord.driver_id) {
        const matched = drivers.find((d) => d.id === ord.driver_id);
        if (matched) {
          driverName = matched.name;
          driverKey = matched.id;
        } else if (ord.assigned_to && ord.assigned_to.trim()) {
          driverName = ord.assigned_to.trim();
          driverKey = ord.driver_id;
        }
      } else if (ord.assigned_to && ord.assigned_to.trim()) {
        const trimmed = ord.assigned_to.trim();
        const matched = drivers.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
        if (matched) {
          driverName = matched.name;
          driverKey = matched.id;
        } else {
          driverName = trimmed;
          driverKey = `name:${trimmed.toLowerCase()}`;
        }
      }

      let item = map.get(driverKey);
      if (!item) {
        item = {
          driverKey,
          driverName,
          count: 0,
          totalAmount: 0,
          deliveryFee: 0,
          validDurationCount: 0,
          totalDurationMs: 0,
        };
        map.set(driverKey, item);
      }
      item.count += 1;
      item.totalAmount += Number(ord.total_amount || 0);
      item.deliveryFee += Number(ord.delivery_fee || 0);

      const durationMs = getOrderDeliveryDurationMs(ord);
      if (durationMs !== null) {
        item.validDurationCount += 1;
        item.totalDurationMs += durationMs;
      }
    }

    const list = Array.from(map.values()).map((item) => ({
      ...item,
      avgDurationText:
        item.validDurationCount > 0
          ? formatWaitDuration(Math.round(item.totalDurationMs / item.validDurationCount / 60000))
          : '—',
    }));
    list.sort((a, b) => b.totalAmount - a.totalAmount);

    const totalsBase = list.reduce(
      (acc, cur) => {
        acc.count += cur.count;
        acc.totalAmount += cur.totalAmount;
        acc.deliveryFee += cur.deliveryFee;
        acc.validDurationCount += cur.validDurationCount;
        acc.totalDurationMs += cur.totalDurationMs;
        return acc;
      },
      { count: 0, totalAmount: 0, deliveryFee: 0, validDurationCount: 0, totalDurationMs: 0 }
    );

    const totals = {
      ...totalsBase,
      avgDurationText:
        totalsBase.validDurationCount > 0
          ? formatWaitDuration(Math.round(totalsBase.totalDurationMs / totalsBase.validDurationCount / 60000))
          : '—',
    };

    return { list, totals };
  }, [filteredDeliveredOrders, drivers]);

  // Récapitulatif par canal sur TOUTES les livraisons filtrées
  const deliveredChannelSummary = useMemo(() => {
    const map = new Map<string, { channelLabel: string; count: number; totalAmount: number }>();

    for (const ord of filteredDeliveredOrders) {
      const channelLabel = getPaymentMethodLabel(ord.payment_method);
      let item = map.get(channelLabel);
      if (!item) {
        item = { channelLabel, count: 0, totalAmount: 0 };
        map.set(channelLabel, item);
      }
      item.count += 1;
      item.totalAmount += Number(ord.total_amount || 0);
    }

    const list = Array.from(map.values());
    list.sort((a, b) => b.totalAmount - a.totalAmount);

    const totals = list.reduce(
      (acc, cur) => {
        acc.count += cur.count;
        acc.totalAmount += cur.totalAmount;
        return acc;
      },
      { count: 0, totalAmount: 0 }
    );

    return { list, totals };
  }, [filteredDeliveredOrders]);

  // Extraction des zones distinctes pour le filtre Livrées
  const deliveredZonesList = useMemo(() => {
    const map = new Map<string, string>();
    for (const ord of deliveredOrders) {
      const zId = ord.delivery_zone_id || '__no_zone__';
      const zName = ord.delivery_zone_name || (zId === '__no_zone__' ? 'Sans zone' : 'Zone non nommée');
      map.set(zId, zName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [deliveredOrders]);

  // Formatage de la date et heure de livraison pour l'onglet « Livrées »
  const formatDeliveryTime = (ord: Order) => {
    const dateStr = ord.delivered_at || ord.updated_at;
    if (!dateStr) {
      return { dateText: '—', timeText: '—', isApproximate: true };
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { dateText: '—', timeText: '—', isApproximate: true };
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return {
        dateText: `${day}/${m}/${y}`,
        timeText: `${hours}:${minutes}`,
        isApproximate: !ord.delivered_at,
      };
    } catch {
      return { dateText: '—', timeText: '—', isApproximate: true };
    }
  };

  // Groupement de TOUTES les commandes livrées filtrées par jour, avec totaux réels et pagination (50 lignes visibles à la fois)
  const deliveredDayGroups = useMemo(() => {
    const fullGroupsMap = new Map<
      string,
      { dayKey: string; dayLabel: string; allOrders: Order[]; totalAmount: number; totalCount: number }
    >();

    for (const ord of filteredDeliveredOrders) {
      const dateStr = ord.delivered_at || ord.updated_at;
      let dayKey = '__no_date__';
      let dayLabel = 'Sans date';

      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dayKey = `${y}-${m}-${day}`;

          const formattedDate = `${day}/${m}/${y}`;
          const nowD = new Date(nowMs);
          const todayKey = formatLocalDate(nowD);
          const yesterdayKey = formatLocalDate(new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() - 1));

          if (dayKey === todayKey) {
            dayLabel = `Aujourd'hui · ${formattedDate}`;
          } else if (dayKey === yesterdayKey) {
            dayLabel = `Hier · ${formattedDate}`;
          } else {
            dayLabel = formattedDate;
          }
        }
      }

      let grp = fullGroupsMap.get(dayKey);
      if (!grp) {
        grp = { dayKey, dayLabel, allOrders: [], totalAmount: 0, totalCount: 0 };
        fullGroupsMap.set(dayKey, grp);
      }
      grp.allOrders.push(ord);
      grp.totalAmount += Number(ord.total_amount || 0);
      grp.totalCount += 1;
    }

    let remainingSlots = deliveredVisibleLimit;
    const visibleGroups: {
      dayKey: string;
      dayLabel: string;
      orders: Order[];
      totalAmount: number;
      totalCount: number;
    }[] = [];

    for (const grp of fullGroupsMap.values()) {
      if (remainingSlots <= 0) break;
      const countToTake = Math.min(grp.allOrders.length, remainingSlots);
      const visibleOrdersForDay = grp.allOrders.slice(0, countToTake);
      visibleGroups.push({
        dayKey: grp.dayKey,
        dayLabel: grp.dayLabel,
        orders: visibleOrdersForDay,
        totalAmount: grp.totalAmount,
        totalCount: grp.totalCount,
      });
      remainingSlots -= countToTake;
    }

    return visibleGroups;
  }, [filteredDeliveredOrders, deliveredVisibleLimit, nowMs]);

  // Réinitialiser à 50 commandes visibles lorsque les filtres changent
  useEffect(() => {
    setDeliveredVisibleLimit(50);
  }, [
    deliveredPeriodFilter,
    customStartDate,
    customEndDate,
    deliveredDriverFilter,
    deliveredZoneFilter,
    deliveredChannelFilter,
    deliveredSearchQuery,
  ]);

  // Identifiants des commandes visibles à l'écran
  const visibleOrderIds = useMemo(() => {
    const ids: string[] = [];
    for (const grp of deliveredDayGroups) {
      for (const ord of grp.orders) {
        ids.push(ord.id);
      }
    }
    return ids;
  }, [deliveredDayGroups]);

  // Chargement par lot des articles pour les commandes visibles sans articles en cache
  useEffect(() => {
    const missingIds = visibleOrderIds.filter((id) => !(id in itemsByOrderId));
    if (missingIds.length === 0) return;

    let isMounted = true;
    setIsLoadingItems(true);
    setItemsLoadError(false);

    fetchOrderItemsForOrders(missingIds)
      .then((itemsMap) => {
        if (!isMounted) return;
        setItemsByOrderId((prev) => ({
          ...prev,
          ...itemsMap,
        }));
        setIsLoadingItems(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Erreur lors du chargement des articles de commande:', err);
        setItemsLoadError(true);
        setIsLoadingItems(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visibleOrderIds, retryTrigger]);

  const handleRetryLoadItems = () => {
    setItemsLoadError(false);
    setRetryTrigger((prev) => prev + 1);
  };

  // Commande sélectionnée pour le panneau de détail
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return deliveredOrders.find((o) => o.id === selectedOrderId) || null;
  }, [selectedOrderId, deliveredOrders]);

  // Chargement spécifique des articles pour la commande du panneau de détail si nécessaire
  const loadDetailOrderItems = (orderId: string) => {
    setDetailItemsLoading(true);
    setDetailItemsError(false);
    fetchOrderItemsForOrders([orderId])
      .then((itemsMap) => {
        setItemsByOrderId((prev) => ({
          ...prev,
          ...itemsMap,
        }));
        setDetailItemsLoading(false);
      })
      .catch((err) => {
        console.warn('Erreur chargement articles pour le détail:', err);
        setDetailItemsError(true);
        setDetailItemsLoading(false);
      });
  };

  useEffect(() => {
    if (!selectedOrderId) {
      setDetailItemsError(false);
      setDetailItemsLoading(false);
      return;
    }
    const hasCached = selectedOrderId in itemsByOrderId;
    const hasOrderItems = selectedOrder?.items && selectedOrder.items.length > 0;
    if (!hasCached && !hasOrderItems) {
      loadDetailOrderItems(selectedOrderId);
    }
  }, [selectedOrderId, selectedOrder]);

  // Fermeture du volet avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedOrderId(null);
      }
    };
    if (selectedOrderId) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrderId]);

  // Helper pour afficher le récapitulatif des produits d'une commande
  const formatOrderItemsSummary = (ord: Order): string => {
    const items = itemsByOrderId[ord.id] ?? (ord.items && ord.items.length > 0 ? ord.items : undefined);
    if (!items || items.length === 0) {
      if (isLoadingItems && !(ord.id in itemsByOrderId)) {
        return '…';
      }
      return '—';
    }

    const first = items[0];
    const qty = first.quantity || 1;
    const name = first.product_name || 'Article';
    const firstPart = `${qty}× ${name}`;

    if (items.length === 1) {
      return firstPart;
    }
    const extraCount = items.length - 1;
    return `${firstPart}, +${extraCount} autre${extraCount > 1 ? 's' : ''}`;
  };

  // Badge du canal de paiement
  const renderChannelBadge = (method?: string | null) => {
    const label = getPaymentMethodLabel(method);
    let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    if (label === 'Wave') {
      colorClasses = 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
    } else if (label === 'Orange Money') {
      colorClasses = 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]';
    } else if (label === 'Carte') {
      colorClasses = 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]';
    } else if (label === 'Espèces') {
      colorClasses = 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]';
    }

    return (
      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClasses} whitespace-nowrap`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Barre de filtres */}
      <div className="bg-white p-3 rounded-xl border border-[#E5DCD0] flex flex-wrap items-center gap-2.5">
        {/* Menu déroulant Période */}
        <div className="shrink-0">
          <select
            value={deliveredPeriodFilter}
            onChange={(e) => {
              const val = e.target.value as typeof deliveredPeriodFilter;
              setDeliveredPeriodFilter(val);
            }}
            className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#1B4B4A] cursor-pointer"
          >
            <option value="today">{"Aujourd'hui"}</option>
            <option value="yesterday">Hier</option>
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="this_month">Ce mois</option>
            <option value="last_month">Mois dernier</option>
            <option value="all">Toutes</option>
            {deliveredPeriodFilter === 'custom' && (
              <option value="custom">
                {isSingleDayCustom && customStartDate
                  ? formatDateToDMY(customStartDate)
                  : customStartDate && customEndDate && customStartDate !== customEndDate
                  ? `Du ${formatDateToDMY(customStartDate)} au ${formatDateToDMY(customEndDate)}`
                  : 'Personnalisée'}
              </option>
            )}
          </select>
        </div>

        {/* Boutons ‹ et › pour avancer / reculer d'un jour */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handlePrevDay}
            disabled={isPrevDayDisabled}
            className="px-2 py-1 rounded-md border border-[#E5DCD0] bg-[#FAF7F2] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            title="Jour précédent"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={handleNextDay}
            disabled={isNextDayDisabled}
            className="px-2 py-1 rounded-md border border-[#E5DCD0] bg-[#FAF7F2] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 text-xs font-bold cursor-pointer transition-colors"
            title="Jour suivant"
          >
            ›
          </button>
        </div>

        {/* Barre de recherche (flexible) */}
        <div className="relative flex-1 min-w-[140px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={deliveredSearchQuery}
            onChange={(e) => setDeliveredSearchQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
          />
        </div>

        {/* Menu Livreur */}
        <div className="shrink-0 max-w-[150px]">
          <select
            value={deliveredDriverFilter}
            onChange={(e) => setDeliveredDriverFilter(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] cursor-pointer truncate"
          >
            <option value="all">Livreur : tous</option>
            {driverPills.map((drv) => {
              const matched = drivers.find((d) => d.id === drv.driverKey);
              const isArchived = matched ? !matched.is_active : false;
              const nameDisplay = isArchived ? `${drv.driverName} (archivé)` : drv.driverName;
              return (
                <option key={drv.driverKey} value={drv.driverKey}>
                  {nameDisplay} · {drv.count} · {drv.totalAmount.toLocaleString()}
                </option>
              );
            })}
            {deliveredDriverFilter !== 'all' && !driverPills.some((d) => d.driverKey === deliveredDriverFilter) && (
              <option value={deliveredDriverFilter}>
                {(() => {
                  const matched = drivers.find((d) => d.id === deliveredDriverFilter);
                  if (matched) return `${matched.name}${matched.is_active ? '' : ' (archivé)'}`;
                  if (deliveredDriverFilter === '__unassigned__') return 'Non assigné';
                  if (deliveredDriverFilter.startsWith('name:')) return deliveredDriverFilter.slice(5);
                  return deliveredDriverFilter;
                })()} · 0 · 0
              </option>
            )}
          </select>
        </div>

        {/* Menu Canal */}
        <div className="shrink-0 max-w-[150px]">
          <select
            value={deliveredChannelFilter}
            onChange={(e) => setDeliveredChannelFilter(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] cursor-pointer truncate"
          >
            <option value="all">Canal : tous</option>
            {channelPills.map((ch) => (
              <option key={ch.channelLabel} value={ch.channelLabel}>
                {ch.channelLabel} · {ch.count} · {ch.totalAmount.toLocaleString()}
              </option>
            ))}
            {deliveredChannelFilter !== 'all' && !channelPills.some((c) => c.channelLabel === deliveredChannelFilter) && (
              <option value={deliveredChannelFilter}>
                {deliveredChannelFilter} · 0 · 0
              </option>
            )}
          </select>
        </div>

        {/* À droite : bouton Effacer les filtres (si actif) + bandeau total */}
        <div className="shrink-0 flex items-center gap-2 ml-auto">
          {(deliveredChannelFilter !== 'all' || deliveredDriverFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setDeliveredChannelFilter('all');
                setDeliveredDriverFilter('all');
                setDeliveredZoneFilter('all');
              }}
              className="px-2 py-1 text-xs text-[#8A7A68] hover:text-slate-900 border border-dashed border-[#C5B7A5] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
            >
              Effacer les filtres
            </button>
          )}

          <div className="shrink-0 whitespace-nowrap text-xs font-semibold text-slate-800 px-3 py-1 bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg truncate">
            <span className="tabular-nums font-bold text-slate-900">
              {filteredDeliveredOrders.length}
            </span>{' '}
            livr. ·{' '}
            <span className="text-[#1B4B4A] font-bold tabular-nums">
              {totalDeliveredFilteredAmount.toLocaleString()} {business.currency}
            </span>
            {totalDeliveredFilteredFees > 0 && (
              <span className="text-slate-600 font-normal">
                {' '}· dont{' '}
                <span className="tabular-nums font-semibold text-slate-800">
                  {totalDeliveredFilteredFees.toLocaleString()}
                </span>{' '}
                de frais
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerte discrète si erreur de chargement des articles */}
      {itemsLoadError && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Articles indisponibles pour certaines commandes.</span>
          </div>
          <button
            type="button"
            onClick={handleRetryLoadItems}
            className="inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline cursor-pointer ml-3"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Réessayer</span>
          </button>
        </div>
      )}

      {/* Liste en lecture seule des commandes livrées groupée par jour */}
      {filteredDeliveredOrders.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-[#E5DCD0] text-center text-xs text-slate-500">
          Aucune commande livrée ne correspond aux filtres.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5DCD0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 table-fixed">
              <colgroup>
                {/* 1. Livrée le */}
                <col className="w-[105px]" style={{ width: '105px' }} />
                {/* 2. Client */}
                <col className="w-[175px]" style={{ width: '175px' }} />
                {/* 3. Adresse */}
                <col className="w-[210px]" style={{ width: '210px' }} />
                {/* 4. Produits */}
                <col className="w-[190px]" style={{ width: '190px' }} />
                {/* 5. Montant */}
                <col className="w-[110px]" style={{ width: '110px' }} />
                {/* 6. Canal */}
                <col className="w-[110px]" style={{ width: '110px' }} />
                {/* 7. Livreur */}
                <col className="w-[130px]" style={{ width: '130px' }} />
                {/* 8. Durée */}
                <col className="w-[85px]" style={{ width: '85px' }} />
                {/* 9. Réf */}
                <col className="w-[80px]" style={{ width: '80px' }} />
              </colgroup>
              <thead className="bg-slate-50/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Livrée le</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Adresse</th>
                  <th className="py-2.5 px-3">Produits</th>
                  <th className="py-2.5 px-3 text-right">Montant</th>
                  <th className="py-2.5 px-3">Canal</th>
                  <th className="py-2.5 px-3">Livreur</th>
                  <th className="py-2.5 px-3">Durée</th>
                  <th className="py-2.5 px-3 text-right">Réf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveredDayGroups.map((grp) => (
                  <React.Fragment key={grp.dayKey}>
                    {/* En-tête de jour : « Mercredi 15 oct. · n livraisons · total X » (porte sur TOUTES les livraisons filtrées de ce jour) */}
                    <tr className="bg-[#FAF7F2] border-y border-[#E5DCD0]">
                      <td colSpan={9} className="py-2 px-3 text-xs font-bold text-slate-800">
                        <span>{grp.dayLabel}</span>
                        <span className="text-slate-400 font-normal mx-1.5">·</span>
                        <span className="font-semibold text-slate-700">
                          {grp.totalCount} livraison{grp.totalCount > 1 ? 's' : ''}
                        </span>
                        <span className="text-slate-400 font-normal mx-1.5">·</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          total {grp.totalAmount.toLocaleString()} {business.currency}
                        </span>
                      </td>
                    </tr>

                    {/* Lignes du groupe : UNE commande = UNE ligne */}
                    {grp.orders.map((ord) => {
                      const refShort = getOrderShortRef(ord);
                      const { dateText, timeText, isApproximate } = formatDeliveryTime(ord);
                      const clientInitial = ((ord.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase();
                      const matchedDriver = ord.driver_id ? drivers.find((d) => d.id === ord.driver_id) : null;
                      const driverName = matchedDriver?.name || ord.assigned_to || 'Non assigné';
                      const durationMs = getOrderDeliveryDurationMs(ord);
                      const durationText = durationMs !== null ? formatWaitDuration(Math.round(durationMs / 60000)) : '—';
                      const itemsSummary = formatOrderItemsSummary(ord);
                      const zoneText = ord.delivery_zone_name || (ord.delivery_zone_id ? ord.delivery_zone_id : 'Sans zone');

                      return (
                        <tr
                          key={ord.id}
                          onClick={() => setSelectedOrderId(ord.id)}
                          className="hover:bg-slate-50 transition-colors bg-white cursor-pointer"
                        >
                          {/* 1. Livrée le */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            <div className="font-medium text-slate-900 font-mono text-xs">{dateText}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{timeText}</div>
                            {isApproximate && (
                              <div className="text-[10px] text-amber-700 font-medium">date approximative</div>
                            )}
                          </td>

                          {/* 2. Client (avatar, nom, tél en dessous) */}
                          <td className="py-2.5 px-3 align-top min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              {ord.customer_avatar ? (
                                <img
                                  src={ord.customer_avatar}
                                  alt={ord.customer_name || 'Client'}
                                  className="w-6 h-6 rounded-full object-cover shrink-0 border border-[#E5DCD0]"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {clientInitial}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-900 text-xs truncate" title={ord.customer_name || 'Client anonyme'}>
                                  {ord.customer_name || 'Client anonyme'}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 truncate">
                                  {ord.customer_phone || '—'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 3. Adresse (tronquée avec tooltip, zone en dessous) */}
                          <td className="py-2.5 px-3 align-top min-w-0">
                            <div
                              className="text-xs text-slate-800 font-medium truncate"
                              title={ord.delivery_address || 'Adresse non spécifiée'}
                            >
                              {ord.delivery_address || '—'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate" title={zoneText}>
                              {zoneText}
                            </div>
                          </td>

                          {/* 4. Produits (récapitulatif articles en 1 ligne) */}
                          <td className="py-2.5 px-3 align-top min-w-0">
                            <div
                              className="text-xs text-slate-700 truncate"
                              title={itemsSummary}
                            >
                              {itemsSummary}
                            </div>
                          </td>

                          {/* 5. Montant */}
                          <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                            <div className="font-bold text-slate-900 text-xs tabular-nums">
                              {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
                            </div>
                            {Number(ord.delivery_fee || 0) > 0 && (
                              <div className="text-[10px] text-slate-500 tabular-nums">
                                dont {Number(ord.delivery_fee).toLocaleString()} livraison
                              </div>
                            )}
                          </td>

                          {/* 6. Canal */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            {renderChannelBadge(ord.payment_method)}
                          </td>

                          {/* 7. Livreur */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap truncate">
                            <span className="text-xs font-medium text-slate-800" title={driverName}>
                              {driverName}
                            </span>
                          </td>

                          {/* 8. Durée */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap font-mono text-xs text-slate-600">
                            {durationText}
                          </td>

                          {/* 9. Réf */}
                          <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                            <span className="font-mono text-xs text-slate-400 font-medium">
                              #{refShort}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bouton Voir plus (50 lignes à la fois) */}
          {filteredDeliveredOrders.length > deliveredVisibleLimit && (
            <div className="p-3 text-center bg-white border-t border-[#E5DCD0]">
              <button
                type="button"
                onClick={() => setDeliveredVisibleLimit((prev) => prev + 50)}
                className="px-4 py-1.5 rounded-lg border border-[#E5DCD0] bg-[#FAF7F2] hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer transition-colors"
              >
                Voir plus ({filteredDeliveredOrders.length - deliveredVisibleLimit} restante{filteredDeliveredOrders.length - deliveredVisibleLimit > 1 ? 's' : ''})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Panneau coulissant de détail d'une commande livrée */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Fond assombri cliquable */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setSelectedOrderId(null)}
            aria-label="Fermer le panneau"
          />

          {/* Panneau latéral droit */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-[#E5DCD0] max-h-screen">
            {/* 1. En-tête : Référence, date/heure livraison, badge canal, bouton fermeture */}
            <div className="p-4 border-b border-[#E5DCD0] bg-[#FAF7F2] flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    Commande #{getOrderShortRef(selectedOrder.id)}
                  </h3>
                  {renderChannelBadge(selectedOrder.payment_method)}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Livrée le{' '}
                  <span className="font-medium text-slate-800">
                    {formatDateTimeDMY(selectedOrder.delivered_at || selectedOrder.updated_at)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-[#E5DCD0]/60 transition-colors cursor-pointer shrink-0"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps défilable */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs divide-y divide-[#E5DCD0]/60">
              {/* 2. Client */}
              <div className="pt-1 first:pt-0">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Client
                </div>
                <div className="flex items-center gap-3">
                  {selectedOrder.customer_avatar ? (
                    <img
                      src={selectedOrder.customer_avatar}
                      alt={selectedOrder.customer_name || 'Client'}
                      className="w-10 h-10 rounded-full object-cover border border-[#E5DCD0] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-sm shrink-0">
                      {((selectedOrder.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">
                      {selectedOrder.customer_name || 'Client anonyme'}
                    </div>
                    <div className="text-slate-600 font-mono mt-0.5">
                      {selectedOrder.customer_phone || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Adresse & Zone */}
              <div className="pt-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Livraison
                </div>
                <div className="space-y-1.5 bg-[#FAF7F2] p-3 rounded-lg border border-[#E5DCD0]">
                  <div>
                    <span className="text-slate-500 text-[11px]">Adresse :</span>
                    <p className="font-medium text-slate-900 break-words mt-0.5">
                      {selectedOrder.delivery_address || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Zone :</span>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {selectedOrder.delivery_zone_name || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Produits */}
              <div className="pt-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Articles commandés
                </div>
                {(() => {
                  const items =
                    itemsByOrderId[selectedOrder.id] ??
                    (selectedOrder.items && selectedOrder.items.length > 0 ? selectedOrder.items : undefined);

                  if (detailItemsLoading && !items) {
                    return (
                      <div className="p-4 text-center text-slate-500 bg-[#FAF7F2] rounded-lg border border-[#E5DCD0]">
                        Chargement...
                      </div>
                    );
                  }

                  if (detailItemsError && !items) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-800">
                        <span>Articles indisponibles.</span>
                        <button
                          type="button"
                          onClick={() => loadDetailOrderItems(selectedOrder.id)}
                          className="font-semibold underline cursor-pointer text-amber-900"
                        >
                          Réessayer
                        </button>
                      </div>
                    );
                  }

                  if (!items || items.length === 0) {
                    return (
                      <div className="p-3 text-center text-slate-400 italic bg-[#FAF7F2] rounded-lg border border-[#E5DCD0]">
                        Aucun article enregistré.
                      </div>
                    );
                  }

                  return (
                    <div className="bg-white rounded-lg border border-[#E5DCD0] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF7F2] text-slate-600 border-b border-[#E5DCD0]">
                          <tr>
                            <th className="py-1.5 px-2.5 font-medium">Article</th>
                            <th className="py-1.5 px-2.5 text-center font-medium w-12">Qté</th>
                            <th className="py-1.5 px-2.5 text-right font-medium">P.U.</th>
                            <th className="py-1.5 px-2.5 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5DCD0]/60">
                          {items.map((it, idx) => {
                            const qty = it.quantity || 1;
                            const unitPrice = Number(it.unit_price || 0);
                            const lineTotal = qty * unitPrice;
                            return (
                              <tr key={it.id || idx}>
                                <td className="py-2 px-2.5 font-medium text-slate-900 break-words">
                                  {it.product_name || 'Article'}
                                </td>
                                <td className="py-2 px-2.5 text-center font-mono text-slate-700">
                                  {qty}
                                </td>
                                <td className="py-2 px-2.5 text-right font-mono text-slate-600 tabular-nums">
                                  {unitPrice.toLocaleString()}
                                </td>
                                <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                                  {lineTotal.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* 5. Montants : Plats, Frais de livraison (si > 0), Total payé */}
              <div className="pt-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Montants
                </div>
                {(() => {
                  const total = Number(selectedOrder.total_amount || 0);
                  const fee = Number(selectedOrder.delivery_fee || 0);
                  const plats = total - fee;
                  return (
                    <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#E5DCD0] space-y-1.5">
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Plats</span>
                        <span className="font-mono tabular-nums">
                          {plats.toLocaleString()} {business.currency}
                        </span>
                      </div>
                      {fee > 0 && (
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Frais de livraison</span>
                          <span className="font-mono tabular-nums">
                            {fee.toLocaleString()} {business.currency}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1.5 border-t border-[#E5DCD0] font-bold text-slate-900 text-sm">
                        <span>Total payé</span>
                        <span className="text-[#1B4B4A] font-mono tabular-nums">
                          {total.toLocaleString()} {business.currency}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 6. Chronologie */}
              <div className="pt-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Chronologie
                </div>
                {(() => {
                  const durMs = getOrderDeliveryDurationMs(selectedOrder);
                  const durText = durMs !== null ? formatWaitDuration(Math.round(durMs / 60000)) : '—';
                  return (
                    <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#E5DCD0] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Commandée :</span>
                        <span className="font-mono font-medium text-slate-900">
                          {formatDateTimeDMY(selectedOrder.created_at)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Prête :</span>
                        <span className="font-mono font-medium text-slate-900">
                          {formatDateTimeDMY(selectedOrder.ready_at)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Livrée :</span>
                        <span className="font-mono font-medium text-slate-900">
                          {formatDateTimeDMY(selectedOrder.delivered_at)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-[#E5DCD0]">
                        <span className="text-slate-700 font-semibold">Durée :</span>
                        <span className="font-mono font-bold text-[#1B4B4A]">
                          {durText}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 7. Paiement */}
              <div className="pt-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Paiement
                </div>
                <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#E5DCD0] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Canal :</span>
                    <span className="font-semibold text-slate-900">
                      {getPaymentMethodLabel(selectedOrder.payment_method)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Référence de paiement :</span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedOrder.payment_reference || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 8. Livreur */}
              <div className="pt-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Livreur
                </div>
                {(() => {
                  let matchedDriver: Driver | undefined;
                  if (selectedOrder.driver_id) {
                    matchedDriver = drivers.find((d) => d.id === selectedOrder.driver_id);
                  }
                  if (!matchedDriver && selectedOrder.assigned_to) {
                    const assignedLower = selectedOrder.assigned_to.trim().toLowerCase();
                    matchedDriver = drivers.find((d) => d.name.trim().toLowerCase() === assignedLower);
                  }

                  const driverName = matchedDriver
                    ? matchedDriver.name
                    : selectedOrder.assigned_to?.trim() || 'Non assigné';
                  const driverPhone = matchedDriver?.phone?.trim() || '—';

                  return (
                    <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#E5DCD0] space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Nom :</span>
                        <span className="font-semibold text-slate-900">{driverName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Téléphone :</span>
                        <span className="font-mono text-slate-800">{driverPhone}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 9. Avis client (si rating existe) */}
              {typeof selectedOrder.rating === 'number' && selectedOrder.rating > 0 && (
                <div className="pt-3 pb-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Avis client
                  </div>
                  <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#E5DCD0] space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center text-amber-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= (selectedOrder.rating || 0)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-bold text-slate-800 text-xs ml-1">
                        {selectedOrder.rating} / 5
                      </span>
                    </div>
                    {selectedOrder.rating_comment && (
                      <p className="text-xs text-slate-700 italic border-l-2 border-[#1B4B4A]/40 pl-2.5 mt-1">
                        &laquo; {selectedOrder.rating_comment} &raquo;
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
