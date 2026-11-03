'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, Clock } from 'lucide-react';
import { Order, Business } from '@/lib/types';
import { getOrderShortRef, getPaymentMethodLabel } from '@/lib/print-docs';
import { formatWaitDuration } from '@/lib/wait-alert';

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
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(false);

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

  return (
    <div className="space-y-3">
      {/* Barre de filtres */}
      <div className="bg-white p-3 rounded-xl border border-[#E5DCD0] flex flex-wrap xl:flex-nowrap items-center gap-2.5">
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

        {/* Dates personnalisées */}
        {periodFilter === 'custom' && (
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

        {/* Recherche client, téléphone, réf */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Recherche client, téléphone, réf..."
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
          />
        </div>

        {/* Menu Canal */}
        <div className="shrink-0 min-w-[130px]">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] cursor-pointer"
          >
            <option value="all">Tous les canaux</option>
            <option value="Wave">Wave</option>
            <option value="Orange Money">Orange Money</option>
            <option value="Carte">Carte</option>
            <option value="Espèces">Espèces</option>
          </select>
        </div>

        {/* Bandeau à droite : « n commandes récupérées · total X devise » */}
        <div className="shrink-0 whitespace-nowrap text-xs font-semibold text-slate-800 px-3 py-1 bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg ml-auto">
          <span className="tabular-nums font-bold text-slate-900">
            {filteredPickups.length}
          </span>{' '}
          commande{filteredPickups.length > 1 ? 's récupérées' : ' récupérée'} · total{' '}
          <span className="text-[#1B4B4A] font-bold tabular-nums">
            {totalFilteredAmount.toLocaleString()} {business.currency}
          </span>
        </div>
      </div>

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
            <span>Récapitulatif (par canal de paiement & attente)</span>
          </div>
          <span className="text-[11px] font-normal text-slate-500">
            {isSummaryExpanded ? 'Masquer' : 'Afficher'}
          </span>
        </button>

        {isSummaryExpanded && (
          <div className="p-4 border-t border-[#E5DCD0] bg-[#FAF7F2]/40">
            {filteredPickups.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">
                Aucune commande récupérée pour les filtres sélectionnés.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tableau par canal (2 colonnes de large sur desktop) */}
                <div className="md:col-span-2 bg-white rounded-lg border border-[#E5DCD0] overflow-hidden shadow-xs">
                  <div className="px-3 py-2 bg-[#FAF7F2] border-b border-[#E5DCD0] font-semibold text-xs text-slate-800">
                    Par canal
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Canal</th>
                          <th className="py-2 px-3 text-right">Commandes</th>
                          <th className="py-2 px-3 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {channelSummary.list.map((item) => (
                          <tr key={item.channelLabel} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-3 font-medium text-slate-800">{item.channelLabel}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-slate-600">{item.count}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                              {item.totalAmount.toLocaleString()} {business.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[#FAF7F2] border-t border-[#E5DCD0] font-bold text-slate-900">
                        <tr>
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-right tabular-nums">{channelSummary.totals.count}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#1B4B4A]">
                            {channelSummary.totals.totalAmount.toLocaleString()} {business.currency}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Indicateur Attente moyenne globale */}
                <div className="bg-white rounded-lg border border-[#E5DCD0] p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-2">
                      <Clock className="w-4 h-4 text-[#1B4B4A]" />
                      <span>Attente moyenne</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Durée moyenne écoulée entre la mise à disposition (prête) et la récupération effective par le client.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-2xl font-bold font-mono text-[#1B4B4A]">
                      {overallAverageWait.text}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {overallAverageWait.count > 0 ? (
                        <span>
                          calculée sur <strong className="text-slate-700">{overallAverageWait.count}</strong> commande{overallAverageWait.count > 1 ? 's récupérées' : ' récupérée'} avec heure valide
                        </span>
                      ) : (
                        <span>aucune heure de mise à disposition disponible</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
                <col className="w-[110px]" style={{ width: '110px' }} />
                <col />
                <col className="w-[140px]" style={{ width: '140px' }} />
                <col className="w-[120px]" style={{ width: '120px' }} />
                <col className="w-[130px]" style={{ width: '130px' }} />
                <col className="w-[100px]" style={{ width: '100px' }} />
                <col className="w-[85px]" style={{ width: '85px' }} />
              </colgroup>
              <thead className="bg-slate-50/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3">Récupérée le</th>
                  <th className="py-2 px-3">Client</th>
                  <th className="py-2 px-3">Téléphone</th>
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

                    {/* Lignes du groupe */}
                    {grp.orders.map((ord) => {
                      const refShort = getOrderShortRef(ord);
                      const { dateText, timeText, isApproximate } = formatPickupTime(ord);
                      const clientInitial = ((ord.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase();
                      const waitDurationMs = getPickupWaitDurationMs(ord);

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors bg-white">
                          {/* Récupérée le (date courte et heure de récupération) */}
                          <td className="py-2 px-3 align-top whitespace-nowrap">
                            <div className="font-medium text-slate-900 font-mono text-xs">{dateText}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{timeText}</div>
                            {isApproximate && (
                              <div className="text-[10px] text-amber-700 font-medium">date approximative</div>
                            )}
                          </td>

                          {/* Client (avatar et nom) */}
                          <td className="py-2 px-3 align-top min-w-0">
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
                              <span className="font-semibold text-slate-900 text-xs truncate">
                                {ord.customer_name || 'Client anonyme'}
                              </span>
                            </div>
                          </td>

                          {/* Téléphone (largeur fixe, monospace) */}
                          <td className="py-2 px-3 align-top whitespace-nowrap font-mono text-xs text-slate-600">
                            {ord.customer_phone || '—'}
                          </td>

                          {/* Montant (aligné à droite) */}
                          <td className="py-2 px-3 align-top text-right font-bold text-slate-900 text-xs tabular-nums whitespace-nowrap">
                            {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
                          </td>

                          {/* Canal (libellé lisible) */}
                          <td className="py-2 px-3 align-top whitespace-nowrap">
                            <span className="text-xs font-medium text-slate-800">
                              {getPaymentMethodLabel(ord.payment_method)}
                            </span>
                          </td>

                          {/* Attente (delivered_at - ready_at, sinon —) */}
                          <td className="py-2 px-3 align-top whitespace-nowrap font-mono text-xs text-slate-600">
                            {waitDurationMs !== null
                              ? formatWaitDuration(Math.round(waitDurationMs / 60000))
                              : '—'}
                          </td>

                          {/* Référence courte */}
                          <td className="py-2 px-3 align-top text-right whitespace-nowrap">
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
