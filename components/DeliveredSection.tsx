'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
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
      {/* Barre de filtres sur UNE seule ligne (flex-wrap sous xl) */}
      <div className="bg-white p-3 rounded-xl border border-[#E5DCD0] flex flex-wrap xl:flex-nowrap items-center gap-2.5">
        {/* Menu déroulant Période */}
        <div className="shrink-0">
          <select
            value={deliveredPeriodFilter}
            onChange={(e) => {
              const val = e.target.value as typeof deliveredPeriodFilter;
              setDeliveredPeriodFilter(val);
              if (val === 'custom') {
                const todayStr = formatLocalDate(new Date(nowMs));
                if (!customStartDate) setCustomStartDate(todayStr);
                if (!customEndDate) setCustomEndDate(todayStr);
              }
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
            <option value="custom">
              {isSingleDayCustom && customStartDate
                ? formatDateToDMY(customStartDate)
                : customStartDate && customEndDate && customStartDate !== customEndDate
                ? `Du ${formatDateToDMY(customStartDate)} au ${formatDateToDMY(customEndDate)}`
                : 'Personnalisée'}
            </option>
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

        {/* Si Personnalisée : deux champs date début et fin */}
        {deliveredPeriodFilter === 'custom' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
              title="Date de début"
            />
            <span className="text-xs text-slate-400">à</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
              title="Date de fin"
            />
          </div>
        )}

        {/* Barre de recherche (flexible) */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={deliveredSearchQuery}
            onChange={(e) => setDeliveredSearchQuery(e.target.value)}
            placeholder="Recherche client, téléphone, réf, livreur..."
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
          />
        </div>

        {/* Menu Livreur */}
        <div className="shrink-0 min-w-[140px]">
          <select
            value={deliveredDriverFilter}
            onChange={(e) => setDeliveredDriverFilter(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] cursor-pointer"
          >
            <option value="all">Tous les livreurs</option>
            {drivers.map((drv) => (
              <option key={drv.id} value={drv.id}>
                {drv.name} {drv.is_active ? '' : '(archivé)'}
              </option>
            ))}
            <option value="__unassigned__">Non assigné</option>
            {deliveredDriverFilter.startsWith('name:') && (
              <option value={deliveredDriverFilter}>
                {deliveredDriverFilter.slice(5)}
              </option>
            )}
          </select>
        </div>

        {/* Menu Zone */}
        <div className="shrink-0 min-w-[130px]">
          <select
            value={deliveredZoneFilter}
            onChange={(e) => setDeliveredZoneFilter(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] cursor-pointer"
          >
            <option value="all">Toutes les zones</option>
            {deliveredZonesList.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        {/* Menu Canal */}
        <div className="shrink-0 min-w-[130px]">
          <select
            value={deliveredChannelFilter}
            onChange={(e) => setDeliveredChannelFilter(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] cursor-pointer"
          >
            <option value="all">Tous les canaux</option>
            <option value="Wave">Wave</option>
            <option value="Orange Money">Orange Money</option>
            <option value="Carte">Carte</option>
            <option value="Espèces">Espèces</option>
          </select>
        </div>

        {/* À droite : « n livraisons · total X devise » */}
        <div className="shrink-0 whitespace-nowrap text-xs font-semibold text-slate-800 px-3 py-1 bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg ml-auto">
          <span className="tabular-nums font-bold text-slate-900">
            {filteredDeliveredOrders.length}
          </span>{' '}
          livraison{filteredDeliveredOrders.length > 1 ? 's' : ''} · total{' '}
          <span className="text-[#1B4B4A] font-bold tabular-nums">
            {totalDeliveredFilteredAmount.toLocaleString()} {business.currency}
          </span>
        </div>
      </div>

      {/* Rangée de pastilles : canaux de paiement et livreurs */}
      {(channelPills.length > 0 ||
        driverPills.length > 0 ||
        deliveredChannelFilter !== 'all' ||
        deliveredDriverFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-1.5 py-1">
          {/* Pastilles Canaux de paiement */}
          {channelPills.map((ch) => {
            const isActive = deliveredChannelFilter === ch.channelLabel;
            return (
              <button
                key={`channel-${ch.channelLabel}`}
                type="button"
                onClick={() => setDeliveredChannelFilter(isActive ? 'all' : ch.channelLabel)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border cursor-pointer ${
                  isActive
                    ? 'bg-[#1B4B4A] text-white border-[#1B4B4A] font-medium shadow-xs'
                    : 'bg-white hover:bg-[#FAF7F2] text-slate-700 border-[#E5DCD0]'
                }`}
                title={`Filtrer par canal ${ch.channelLabel}`}
              >
                <span>{ch.channelLabel}</span>
                <span className={isActive ? 'text-white/70' : 'text-slate-400'}>·</span>
                <span className="tabular-nums">{ch.count}</span>
                <span className={isActive ? 'text-white/70' : 'text-slate-400'}>·</span>
                <span className={`font-semibold tabular-nums ${isActive ? 'text-white' : 'text-slate-900'}`}>
                  {ch.totalAmount.toLocaleString()} {business.currency}
                </span>
              </button>
            );
          })}

          {/* Séparateur discret si les deux listes ont des éléments */}
          {channelPills.length > 0 && driverPills.length > 0 && (
            <span className="w-px h-4 bg-[#E5DCD0] mx-1 shrink-0" aria-hidden="true" />
          )}

          {/* Pastilles Livreurs */}
          {driverPills.map((drv) => {
            const isActive = deliveredDriverFilter === drv.driverKey;
            return (
              <button
                key={`driver-${drv.driverKey}`}
                type="button"
                onClick={() => setDeliveredDriverFilter(isActive ? 'all' : drv.driverKey)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border cursor-pointer ${
                  isActive
                    ? 'bg-[#1B4B4A] text-white border-[#1B4B4A] font-medium shadow-xs'
                    : 'bg-white hover:bg-[#FAF7F2] text-slate-700 border-[#E5DCD0]'
                }`}
                title={`Filtrer par livreur ${drv.driverName}`}
              >
                <span>{drv.driverName}</span>
                <span className={isActive ? 'text-white/70' : 'text-slate-400'}>·</span>
                <span className="tabular-nums">{drv.count}</span>
                <span className={isActive ? 'text-white/70' : 'text-slate-400'}>·</span>
                <span className={`font-semibold tabular-nums ${isActive ? 'text-white' : 'text-slate-900'}`}>
                  {drv.totalAmount.toLocaleString()} {business.currency}
                </span>
              </button>
            );
          })}

          {/* Bouton Tout effacer si un filtre canal ou livreur est actif */}
          {(deliveredChannelFilter !== 'all' || deliveredDriverFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setDeliveredChannelFilter('all');
                setDeliveredDriverFilter('all');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-[#8A7A68] hover:text-slate-900 hover:bg-[#FAF7F2] border border-dashed border-[#C5B7A5] transition-colors cursor-pointer ml-auto"
            >
              <span>Tout effacer</span>
            </button>
          )}
        </div>
      )}

      {/* Bloc Récapitulatif repliable (replié par défaut) */}
      <div className="bg-white rounded-xl border border-[#E5DCD0] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsSummaryExpanded((prev) => !prev)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                isSummaryExpanded ? 'rotate-180' : ''
              }`}
            />
            <span>Récapitulatif (par livreur et par canal)</span>
          </div>
          <span className="text-[11px] font-normal text-slate-500">
            {isSummaryExpanded ? 'Masquer' : 'Afficher'}
          </span>
        </button>

        {isSummaryExpanded && (
          <div className="p-4 border-t border-[#E5DCD0] bg-[#FAF7F2]/40">
            {filteredDeliveredOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">
                Aucune livraison pour les filtres sélectionnés.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Tableau a : Par livreur */}
                <div className="bg-white rounded-lg border border-[#E5DCD0] overflow-hidden shadow-xs">
                  <div className="px-3 py-2 bg-[#FAF7F2] border-b border-[#E5DCD0] font-semibold text-xs text-slate-800">
                    Par livreur
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Livreur</th>
                          <th className="py-2 px-3 text-center">Livraisons</th>
                          <th className="py-2 px-3 text-right">Montant</th>
                          <th className="py-2 px-3 text-right">Frais</th>
                          <th className="py-2 px-3 text-right">Durée moy.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {deliveredDriverSummary.list.map((row) => (
                          <tr key={row.driverKey} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3 font-medium text-slate-900">{row.driverName}</td>
                            <td className="py-2 px-3 text-center tabular-nums">{row.count}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">
                              {row.totalAmount.toLocaleString()} {business.currency}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                              {row.deliveryFee.toLocaleString()} {business.currency}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-slate-600 font-mono">
                              {row.avgDurationText}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#FAF7F2] border-t-2 border-[#E5DCD0] font-bold text-slate-900">
                        <tr>
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-center tabular-nums">
                            {deliveredDriverSummary.totals.count}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#1B4B4A]">
                            {deliveredDriverSummary.totals.totalAmount.toLocaleString()} {business.currency}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {deliveredDriverSummary.totals.deliveryFee.toLocaleString()} {business.currency}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-mono">
                            {deliveredDriverSummary.totals.avgDurationText}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Tableau b : Par canal */}
                <div className="bg-white rounded-lg border border-[#E5DCD0] overflow-hidden shadow-xs">
                  <div className="px-3 py-2 bg-[#FAF7F2] border-b border-[#E5DCD0] font-semibold text-xs text-slate-800">
                    Par canal
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Canal</th>
                          <th className="py-2 px-3 text-center">Livraisons</th>
                          <th className="py-2 px-3 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {deliveredChannelSummary.list.map((row) => (
                          <tr key={row.channelLabel} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3 font-medium text-slate-900">{row.channelLabel}</td>
                            <td className="py-2 px-3 text-center tabular-nums">{row.count}</td>
                            <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">
                              {row.totalAmount.toLocaleString()} {business.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#FAF7F2] border-t-2 border-[#E5DCD0] font-bold text-slate-900">
                        <tr>
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-center tabular-nums">
                            {deliveredChannelSummary.totals.count}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#1B4B4A]">
                            {deliveredChannelSummary.totals.totalAmount.toLocaleString()} {business.currency}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors bg-white">
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
                          <td className="py-2.5 px-3 align-top text-right font-bold text-slate-900 text-xs tabular-nums whitespace-nowrap">
                            {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
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
    </div>
  );
}
