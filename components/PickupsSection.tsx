'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, AlertCircle, RefreshCw, Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, Business, OrderItem } from '@/lib/types';
import { getOrderShortRef, getPaymentMethodLabel } from '@/lib/print-docs';
import { formatWaitDuration } from '@/lib/wait-alert';
import { fetchOrderItemsForOrders } from '@/lib/supabase';

export interface PickupsSectionProps {
  business: Business;
  orders: Order[];
  nowMs: number;
}

export default function PickupsSection({
  business,
  orders,
  nowMs,
}: PickupsSectionProps) {
  // Filtres de l'onglet « Récupérées »
  const [periodFilter, setPeriodFilter] = useState<
    'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'all' | 'custom'
  >('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(50);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // État de chargement par lot des articles de commande
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, OrderItem[]>>({});
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [itemsLoadError, setItemsLoadError] = useState<boolean>(false);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Retraits terminés (order_type = pickup, status = delivered)
  const completedPickups = useMemo(() => {
    return orders.filter(
      (o) =>
        o.business_id === business.id &&
        o.order_type === 'pickup' &&
        o.status === 'delivered'
    );
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

  // Calcul des bornes de la période sélectionnée
  const dateBounds = useMemo(() => {
    const base = new Date(nowMs);
    const y = base.getFullYear();
    const m = base.getMonth();
    const d = base.getDate();

    if (periodFilter === 'today') {
      const start = new Date(y, m, d, 0, 0, 0, 0).getTime();
      const end = new Date(y, m, d, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (periodFilter === 'yesterday') {
      const yesterday = new Date(y, m, d - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (periodFilter === '7days') {
      const past7 = new Date(y, m, d - 6);
      const start = new Date(past7.getFullYear(), past7.getMonth(), past7.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(y, m, d, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (periodFilter === '30days') {
      const past30 = new Date(y, m, d - 29);
      const start = new Date(past30.getFullYear(), past30.getMonth(), past30.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(y, m, d, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (periodFilter === 'this_month') {
      const start = new Date(y, m, 1, 0, 0, 0, 0).getTime();
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (periodFilter === 'last_month') {
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
      const end = new Date(y, m, 0, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    if (periodFilter === 'custom') {
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
  }, [periodFilter, customStartDate, customEndDate, nowMs]);

  // Navigation ‹ et › pour reculer ou avancer d'un jour
  const isSingleDayCustom =
    periodFilter === 'custom' &&
    Boolean(customStartDate) &&
    customStartDate === customEndDate;

  const isNavDisabled =
    periodFilter === 'all' ||
    periodFilter === '7days' ||
    periodFilter === '30days' ||
    periodFilter === 'this_month' ||
    periodFilter === 'last_month' ||
    (periodFilter === 'custom' && !isSingleDayCustom);

  const isNextDayDisabled = isNavDisabled || periodFilter === 'today';
  const isPrevDayDisabled = isNavDisabled;

  const handlePrevDay = () => {
    if (isPrevDayDisabled) return;
    const base = new Date(nowMs);
    const y = base.getFullYear();
    const m = base.getMonth();
    const d = base.getDate();

    if (periodFilter === 'today') {
      setPeriodFilter('yesterday');
      return;
    }

    if (periodFilter === 'yesterday') {
      const dayBefore = new Date(y, m, d - 2);
      const s = formatLocalDate(dayBefore);
      setCustomStartDate(s);
      setCustomEndDate(s);
      setPeriodFilter('custom');
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

    if (periodFilter === 'yesterday') {
      setPeriodFilter('today');
      return;
    }

    if (isSingleDayCustom) {
      const parts = customStartDate.split('-').map(Number);
      const nextDate = new Date(parts[0], parts[1] - 1, parts[2] + 1);
      const nextStr = formatLocalDate(nextDate);

      if (nextStr === todayStr) {
        setPeriodFilter('today');
      } else if (nextStr === yesterdayStr) {
        setPeriodFilter('yesterday');
      } else {
        setCustomStartDate(nextStr);
        setCustomEndDate(nextStr);
      }
    }
  };

  // Réinitialisation du nombre de lignes affichées au changement de filtre
  useEffect(() => {
    setVisibleLimit(50);
  }, [periodFilter, customStartDate, customEndDate, channelFilter, searchQuery]);

  // Durée d'attente en ms (delivered_at - ready_at, uniquement si les deux existent et delivered_at >= ready_at)
  // Aucun repli sur updated_at ou created_at
  const getPickupWaitDurationMs = (ord: Order): number | null => {
    if (!ord.delivered_at || !ord.ready_at) return null;
    const dMs = new Date(ord.delivered_at).getTime();
    const rMs = new Date(ord.ready_at).getTime();
    if (isNaN(dMs) || isNaN(rMs) || dMs < rMs) return null;
    return dMs - rMs;
  };

  // Filtrage et tri des commandes récupérées (triées par delivered_at, sinon updated_at décroissant)
  const filteredPickups = useMemo(() => {
    const list = completedPickups.filter((ord) => {
      // 1. Période (calcule sur delivered_at, sinon updated_at)
      if (periodFilter !== 'all') {
        const dateStr = ord.delivered_at || ord.updated_at;
        if (!dateStr) return false;
        const timeMs = new Date(dateStr).getTime();
        if (isNaN(timeMs)) return false;
        if (timeMs < dateBounds.start || timeMs > dateBounds.end) {
          return false;
        }
      }

      // 2. Filtre canal de paiement (via getPaymentMethodLabel)
      if (channelFilter !== 'all') {
        const methodLabel = getPaymentMethodLabel(ord.payment_method);
        if (methodLabel !== channelFilter) return false;
      }

      // 3. Recherche (client, téléphone, réf)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesClient = ord.customer_name?.toLowerCase().includes(q) ?? false;
        const matchesPhone = ord.customer_phone?.toLowerCase().includes(q) ?? false;
        const shortRef = getOrderShortRef(ord).toLowerCase();
        const matchesRef =
          ord.id.toLowerCase().includes(q) ||
          shortRef.includes(q) ||
          (ord.payment_reference?.toLowerCase().includes(q) ?? false);
        if (!matchesClient && !matchesPhone && !matchesRef) {
          return false;
        }
      }

      return true;
    });

    // Tri par date décroissante (plus récent d'abord)
    list.sort((a, b) => {
      const timeA = a.delivered_at || a.updated_at ? new Date(a.delivered_at || a.updated_at!).getTime() : 0;
      const timeB = b.delivered_at || b.updated_at ? new Date(b.delivered_at || b.updated_at!).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [completedPickups, periodFilter, dateBounds, channelFilter, searchQuery]);

  // Retraits de la période sélectionnée (sans le filtre canal) pour alimenter dynamiquement le menu Canal
  const periodPickups = useMemo(() => {
    return completedPickups.filter((ord) => {
      if (periodFilter !== 'all') {
        const dateStr = ord.delivered_at || ord.updated_at;
        if (!dateStr) return false;
        const timeMs = new Date(dateStr).getTime();
        if (isNaN(timeMs)) return false;
        if (timeMs < dateBounds.start || timeMs > dateBounds.end) {
          return false;
        }
      }
      return true;
    });
  }, [completedPickups, periodFilter, dateBounds]);

  // Options du menu Canal calculées sur les commandes de la période (sans le filtre canal)
  const channelOptions = useMemo(() => {
    const map = new Map<string, { channelLabel: string; count: number; totalAmount: number }>();
    for (const ord of periodPickups) {
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
  }, [periodPickups]);

  // Montant total sur TOUTES les commandes récupérées filtrées
  const totalFilteredAmount = useMemo(() => {
    return filteredPickups.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  }, [filteredPickups]);

  // Récapitulatif par canal sur TOUTES les commandes récupérées filtrées
  const channelSummary = useMemo(() => {
    const map = new Map<string, { channelLabel: string; count: number; totalAmount: number }>();

    for (const ord of filteredPickups) {
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
  }, [filteredPickups]);

  // Attente moyenne globale sur les commandes récupérées filtrées ayant une durée valide
  const overallAverageWait = useMemo(() => {
    let validCount = 0;
    let totalMs = 0;

    for (const ord of filteredPickups) {
      const dMs = getPickupWaitDurationMs(ord);
      if (dMs !== null) {
        validCount += 1;
        totalMs += dMs;
      }
    }

    if (validCount === 0) {
      return { text: '—', count: 0 };
    }

    const avgMinutes = Math.round(totalMs / validCount / 60000);
    return {
      text: formatWaitDuration(avgMinutes),
      count: validCount,
    };
  }, [filteredPickups]);

  // Formatage date et heure de récupération
  const formatPickupTime = (ord: Order) => {
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

  // Groupement par jour pour affichage avec pagination (50 lignes visibles à la fois)
  const pickupDayGroups = useMemo(() => {
    const fullGroupsMap = new Map<
      string,
      { dayKey: string; dayLabel: string; allOrders: Order[]; totalAmount: number; totalCount: number }
    >();

    for (const ord of filteredPickups) {
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

    let remainingSlots = visibleLimit;
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
  }, [filteredPickups, visibleLimit, nowMs]);

  // Identifiants des commandes visibles à l'écran
  const visibleOrderIds = useMemo(() => {
    const ids: string[] = [];
    for (const grp of pickupDayGroups) {
      for (const ord of grp.orders) {
        ids.push(ord.id);
      }
    }
    return ids;
  }, [pickupDayGroups]);

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

  // Fermeture du menu d'export au clic extérieur ou avec la touche Échap
  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

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

  // Helper pour formater la date/heure d'édition du rapport : Édité le JJ/MM/AAAA à HH:mm
  const formatEditedAt = (d: Date = new Date()) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `Édité le ${day}/${month}/${year} à ${hours}:${minutes}`;
  };

  // Helper pour formater les montants dans le PDF avec un espace standard U+0020 comme séparateur de milliers
  const formatAmountPdf = (n: number | string | null | undefined): string => {
    const val = Math.round(Number(n || 0));
    const sign = val < 0 ? '-' : '';
    const str = Math.abs(val).toString();
    return sign + str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Nettoyage des espaces insécables (U+00A0, U+202F) pour jsPDF
  const cleanPdfText = (text: string | null | undefined): string => {
    if (!text) return '';
    return String(text).replace(/[\u00A0\u202F]/g, ' ');
  };

  // Nom de base du fichier exporté : recuperees_AAAA-MM-JJ (date de début de période ; "toutes" si aucune borne)
  const getExportBaseFilename = (): string => {
    if (dateBounds.start !== -Infinity) {
      const startD = new Date(dateBounds.start);
      return `recuperees_${formatLocalDate(startD)}`;
    }
    return 'recuperees_toutes';
  };

  // Informations d'en-tête pour les exports
  const getExportHeaderInfo = () => {
    let periodText = 'Période : toutes';
    if (dateBounds.start !== -Infinity && dateBounds.end !== Infinity) {
      const dStart = formatDateToDMY(formatLocalDate(new Date(dateBounds.start)));
      const dEnd = formatDateToDMY(formatLocalDate(new Date(dateBounds.end)));
      if (dStart === dEnd) {
        periodText = `Période : ${dStart}`;
      } else {
        periodText = `Période : du ${dStart} au ${dEnd}`;
      }
    } else if (filteredPickups.length > 0) {
      const dates = filteredPickups
        .map((o) => o.delivered_at || o.updated_at || o.created_at)
        .filter(Boolean) as string[];
      if (dates.length > 0) {
        const timestamps = dates.map((d) => new Date(d).getTime()).filter((t) => !isNaN(t));
        if (timestamps.length > 0) {
          const minT = Math.min(...timestamps);
          const maxT = Math.max(...timestamps);
          const dMin = formatDateToDMY(formatLocalDate(new Date(minT)));
          const dMax = formatDateToDMY(formatLocalDate(new Date(maxT)));
          periodText = dMin === dMax ? `Période : ${dMin}` : `Période : du ${dMin} au ${dMax}`;
        }
      }
    }

    const exportDateText = formatEditedAt(new Date());

    const activeFilters: string[] = [];
    if (channelFilter !== 'all') {
      activeFilters.push(`Canal : ${channelFilter}`);
    }
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' · ') : '';

    return {
      businessName: business.name || 'Commerce',
      periodText,
      exportDateText,
      filtersText,
    };
  };

  // Export Excel (.xlsx) avec 2 feuilles : Synthèse paiements, Détail
  const handleExportExcel = () => {
    try {
      setExportError(null);
      const { businessName, periodText, exportDateText, filtersText } = getExportHeaderInfo();
      const filename = `${getExportBaseFilename()}.xlsx`;

      const headerAOA = [
        [businessName],
        ['Rapport des commandes récupérées'],
        [periodText],
        [exportDateText + (filtersText ? ` · ${filtersText}` : '')],
        [],
      ];

      // 1. Feuille « Synthèse paiements »
      const channelAOA = [
        ...headerAOA,
        ['Mode de paiement', 'Nb de commandes', `Montant encaissé (${business.currency})`],
        ...channelSummary.list.map((c) => [
          c.channelLabel,
          c.count,
          c.totalAmount,
        ]),
        [
          'Total',
          channelSummary.totals.count,
          channelSummary.totals.totalAmount,
        ],
      ];
      const wsChannel = XLSX.utils.aoa_to_sheet(channelAOA);

      // 2. Feuille « Détail »
      const detailRows = filteredPickups.map((ord) => {
        const waitDurationMs = getPickupWaitDurationMs(ord);
        const attenteText = waitDurationMs !== null ? formatWaitDuration(Math.round(waitDurationMs / 60000)) : '—';

        return [
          formatDateTimeDMY(ord.delivered_at || ord.updated_at),
          ord.customer_name || 'Client anonyme',
          ord.customer_phone || '—',
          Number(ord.total_amount || 0),
          getPaymentMethodLabel(ord.payment_method),
          attenteText,
          getOrderShortRef(ord),
        ];
      });

      const detailAOA = [
        ...headerAOA,
        [
          'Récupérée le',
          'Client',
          'Téléphone',
          `Montant (${business.currency})`,
          'Mode de paiement',
          'Attente',
          'Réf',
        ],
        ...detailRows,
      ];
      const wsDetail = XLSX.utils.aoa_to_sheet(detailAOA);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsChannel, 'Synthèse paiements');
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail');

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Erreur lors de l’export Excel:', err);
      setExportError("Une erreur est survenue lors de l'export Excel.");
    }
  };

  // Export PDF (.pdf) en A4 paysage avec 2 tableaux
  const handleExportPdf = () => {
    try {
      setExportError(null);
      const { businessName, periodText, exportDateText, filtersText } = getExportHeaderInfo();
      const filename = `${getExportBaseFilename()}.pdf`;

      const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

      // En-tête sur la première page
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(cleanPdfText(businessName), 14, 15);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Rapport des commandes récupérées', 14, 21);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(cleanPdfText(periodText), 14, 27);

      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const subHeader = cleanPdfText(exportDateText + (filtersText ? ` · ${filtersText}` : ''));
      doc.text(subHeader, 14, 33);
      doc.setTextColor(0, 0, 0);

      // Tableau 1 : Synthèse par mode de paiement
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Synthèse par mode de paiement', 14, 40);

      autoTable(doc, {
        startY: 43,
        head: [['Mode de paiement', 'Nb de commandes', `Montant encaissé (${business.currency})`]],
        body: [
          ...channelSummary.list.map((c) => [
            cleanPdfText(c.channelLabel),
            String(c.count),
            formatAmountPdf(c.totalAmount),
          ]),
          [
            'Total',
            String(channelSummary.totals.count),
            formatAmountPdf(channelSummary.totals.totalAmount),
          ],
        ],
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          lineColor: [229, 220, 208],
          lineWidth: 0.1,
          overflow: 'ellipsize',
        },
        headStyles: {
          fillColor: [27, 75, 74],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: [250, 247, 242],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
        },
        columnStyles: {
          2: { halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      });

      // Tableau 2 : Détail des commandes récupérées (sur une nouvelle page)
      doc.addPage();
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Détail des commandes récupérées', 14, 15);

      const detailBody = filteredPickups.map((ord) => {
        const waitDurationMs = getPickupWaitDurationMs(ord);
        const attenteText = waitDurationMs !== null ? formatWaitDuration(Math.round(waitDurationMs / 60000)) : '—';

        return [
          cleanPdfText(formatDateTimeDMY(ord.delivered_at || ord.updated_at)),
          cleanPdfText(ord.customer_name || 'Client anonyme'),
          cleanPdfText(ord.customer_phone || '—'),
          formatAmountPdf(ord.total_amount),
          cleanPdfText(getPaymentMethodLabel(ord.payment_method)),
          cleanPdfText(attenteText),
          cleanPdfText(`#${getOrderShortRef(ord)}`),
        ];
      });

      autoTable(doc, {
        startY: 19,
        head: [[
          'Récupérée le',
          'Client',
          'Téléphone',
          `Montant (${business.currency})`,
          'Mode de paiement',
          'Attente',
          'Réf',
        ]],
        body: detailBody,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          lineColor: [229, 220, 208],
          lineWidth: 0.1,
          overflow: 'ellipsize',
        },
        headStyles: {
          fillColor: [27, 75, 74],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 45 },
          2: { cellWidth: 32 },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 45 },
          5: { cellWidth: 40 },
          6: { cellWidth: 40, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      });

      // Numérotation des pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text(
          `Page ${i} sur ${totalPages}`,
          doc.internal.pageSize.getWidth() - 14,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'right' }
        );
      }

      doc.save(filename);
    } catch (err) {
      console.error('Erreur lors de l’export PDF:', err);
      setExportError("Une erreur est survenue lors de l'export PDF.");
    }
  };

  return (
    <div className="space-y-3">
      {/* Barre de filtres */}
      <div className="bg-white p-3 rounded-xl border border-[#E5DCD0] flex flex-wrap items-center gap-2.5">
        {/* Menu Période */}
        <div className="shrink-0">
          <select
            value={periodFilter}
            onChange={(e) => {
              const val = e.target.value as typeof periodFilter;
              setPeriodFilter(val);
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

        {/* Recherche client, téléphone, réf */}
        <div className="relative flex-1 min-w-[140px] max-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
          />
        </div>

        {/* Menu Canal */}
        <div className="shrink-0 max-w-[150px]">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] cursor-pointer truncate"
          >
            <option value="all">Canal : tous</option>
            {channelOptions.map((ch) => (
              <option key={ch.channelLabel} value={ch.channelLabel}>
                {ch.channelLabel} · {ch.count} · {ch.totalAmount.toLocaleString()}
              </option>
            ))}
            {channelFilter !== 'all' && !channelOptions.some((c) => c.channelLabel === channelFilter) && (
              <option value={channelFilter}>
                {channelFilter} · 0 · 0
              </option>
            )}
          </select>
        </div>

        {/* À droite : bouton Effacer les filtres (si actif) + bandeau total + bouton Exporter */}
        <div className="shrink-0 flex items-center gap-2 ml-auto">
          {channelFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setChannelFilter('all')}
              className="px-2 py-1 text-xs text-[#8A7A68] hover:text-slate-900 border border-dashed border-[#C5B7A5] hover:bg-[#FAF7F2] rounded-lg transition-colors cursor-pointer"
            >
              Effacer les filtres
            </button>
          )}

          <div className="shrink-0 whitespace-nowrap text-xs font-semibold text-slate-800 px-3 py-1 bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg">
            <span className="tabular-nums font-bold text-slate-900">
              {filteredPickups.length}
            </span>{' '}
            récup. ·{' '}
            <span className="text-[#1B4B4A] font-bold tabular-nums">
              {totalFilteredAmount.toLocaleString()} {business.currency}
            </span>
          </div>

          {/* Bouton Exporter avec menu à deux choix (Excel, PDF) */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => {
                if (filteredPickups.length === 0) return;
                setIsExportMenuOpen((prev) => !prev);
              }}
              disabled={filteredPickups.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                filteredPickups.length === 0
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-800 border-[#E5DCD0] hover:bg-[#FAF7F2] hover:border-[#1B4B4A] cursor-pointer'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-[#E5DCD0] rounded-lg shadow-lg py-1 z-30 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportExcel();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#FAF7F2] text-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportPdf();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#FAF7F2] text-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>PDF (.pdf)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerte discrète si erreur d'export */}
      {exportError && (
        <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-800">
          <span>{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-rose-900 font-semibold hover:underline cursor-pointer ml-3"
          >
            Fermer
          </button>
        </div>
      )}

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

      {/* Tableau en lecture seule des commandes récupérées groupé par jour */}
      {filteredPickups.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-[#E5DCD0] text-center text-xs text-slate-500">
          Aucune commande récupérée ne correspond aux filtres.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5DCD0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 table-fixed">
              <colgroup>
                <col className="w-[105px]" style={{ width: '105px' }} />
                <col className="w-[185px]" style={{ width: '185px' }} />
                <col className="w-[230px]" style={{ width: '230px' }} />
                <col className="w-[110px]" style={{ width: '110px' }} />
                <col className="w-[110px]" style={{ width: '110px' }} />
                <col className="w-[85px]" style={{ width: '85px' }} />
                <col className="w-[80px]" style={{ width: '80px' }} />
              </colgroup>
              <thead className="bg-slate-50/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3">Récupérée le</th>
                  <th className="py-2 px-3">Client</th>
                  <th className="py-2 px-3">Produits</th>
                  <th className="py-2 px-3 text-right">Montant</th>
                  <th className="py-2 px-3">Canal</th>
                  <th className="py-2 px-3">Attente</th>
                  <th className="py-2 px-3 text-right">Réf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pickupDayGroups.map((grp) => (
                  <React.Fragment key={grp.dayKey}>
                    {/* En-tête de jour : porte sur TOUTES les commandes récupérées filtrées de ce jour */}
                    <tr className="bg-[#FAF7F2] border-y border-[#E5DCD0]">
                      <td colSpan={7} className="py-2 px-3 text-xs font-bold text-slate-800">
                        <span>{grp.dayLabel}</span>
                        <span className="text-slate-400 font-normal mx-1.5">·</span>
                        <span className="font-semibold text-slate-700">
                          {grp.totalCount} commande{grp.totalCount > 1 ? 's récupérées' : ' récupérée'}
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
                      const { dateText, timeText, isApproximate } = formatPickupTime(ord);
                      const clientInitial = ((ord.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase();
                      const waitDurationMs = getPickupWaitDurationMs(ord);
                      const itemsSummary = formatOrderItemsSummary(ord);

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors bg-white">
                          {/* 1. Récupérée le (date courte et heure de récupération) */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            <div className="font-medium text-slate-900 font-mono text-xs">{dateText}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{timeText}</div>
                            {isApproximate && (
                              <div className="text-[10px] text-amber-700 font-medium">date approximative</div>
                            )}
                          </td>

                          {/* 2. Client (avatar/initial, nom en gras, téléphone en dessous) */}
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

                          {/* 3. Produits (récapitulatif articles en 1 ligne) */}
                          <td className="py-2.5 px-3 align-top min-w-0">
                            <div
                              className="text-xs text-slate-700 truncate"
                              title={itemsSummary}
                            >
                              {itemsSummary}
                            </div>
                          </td>

                          {/* 4. Montant (en gras tabular-nums, aligné à droite) */}
                          <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                            <span className="font-bold text-slate-900 text-xs tabular-nums">
                              {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
                            </span>
                          </td>

                          {/* 5. Canal (badge coloré sobre) */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            {renderChannelBadge(ord.payment_method)}
                          </td>

                          {/* 6. Attente (delivered_at - ready_at, sinon —) */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap font-mono text-xs text-slate-600">
                            {waitDurationMs !== null
                              ? formatWaitDuration(Math.round(waitDurationMs / 60000))
                              : '—'}
                          </td>

                          {/* 7. Réf (référence courte) */}
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
          {filteredPickups.length > visibleLimit && (
            <div className="p-3 text-center bg-white border-t border-[#E5DCD0]">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 50)}
                className="px-4 py-1.5 rounded-lg border border-[#E5DCD0] bg-[#FAF7F2] hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer transition-colors"
              >
                Voir plus ({filteredPickups.length - visibleLimit} restante{filteredPickups.length - visibleLimit > 1 ? 's' : ''})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
