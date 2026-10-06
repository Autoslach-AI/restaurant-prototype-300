'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Business, Order, Customer, AgentEvent } from '@/lib/types';

export interface OverviewSectionProps {
  business: Business;
  businessOrders: Order[];
  businessCustomers: Customer[];
  businessEvents: AgentEvent[];
  nowMs: number;
  urgentUndelivered: Order[];
  preparingOver45Min: Order[];
  newRecentOrders: Order[];
  totalSubAlertsCount: number;
  monthConversionMetrics: {
    currentOrders: Order[];
    previousOrders: Order[];
    currentRate: number;
    previousRate: number;
    rateDiff: number;
    currentPaidRevenue: number;
    previousPaidRevenue: number;
    revenueDiff: number;
    currentUnpaidRevenue: number;
    totalCount: number;
    paidCount: number;
    unpaidCount: number;
  };
  onNavigateToTab: (tab: any) => void;
  onNavigateToOrdersWithFilter: (filters?: {
    status?: string;
    alertCategory?: 'all' | 'urgent_undelivered' | 'preparing_45m' | 'new_orders';
    period?: 'day' | 'week' | 'month' | 'year' | 'all';
    paymentMethod?: 'all' | 'wave' | 'orange' | 'card';
    search?: string;
  }) => void;
  onNavigateToCustomersWithFilter: (
    filter?: 'all' | 'unread' | 'favorites' | 'recurrent' | 'inactive',
    customerId?: string
  ) => void;
}

export default function OverviewSection({
  business,
  businessOrders,
  businessCustomers,
  businessEvents,
  nowMs,
  urgentUndelivered,
  preparingOver45Min,
  newRecentOrders,
  totalSubAlertsCount,
  monthConversionMetrics,
  onNavigateToTab,
  onNavigateToOrdersWithFilter,
  onNavigateToCustomersWithFilter,
}: OverviewSectionProps) {
  // Internal states exclusive to Overview
  const [activityPeriod, setActivityPeriod] = useState<'jour' | 'semaine' | 'mois' | 'annee'>('semaine');
  const [selectedModalOrderId, setSelectedModalOrderId] = useState<string | null>(null);

  // Sub-alerts categories exclusive to Overview display
  const alertCategories = [
    {
      id: 'new_orders' as const,
      title: 'Nouvelle commande',
      count: newRecentOrders.length,
      rank: 1,
      icon: Sparkles,
      activeColorClass: 'bg-[#EBF3F3] hover:bg-[#EBF3F3]/80 border-[#1B4B4A]/30 text-[#1B4B4A] font-black',
      activeBadgeClass: 'bg-[#1B4B4A] text-white font-extrabold',
      activeIconClass: 'text-[#1B4B4A]',
    },
    {
      id: 'urgent_undelivered' as const,
      title: 'Commande urgente non livrée',
      count: urgentUndelivered.length,
      rank: 2,
      icon: AlertTriangle,
      activeColorClass: 'bg-[#FCECEB] hover:bg-[#FCECEB]/80 border-[#A63A2F]/30 text-[#A63A2F] font-black',
      activeBadgeClass: 'bg-[#A63A2F] text-white font-extrabold',
      activeIconClass: 'text-[#A63A2F]',
    },
    {
      id: 'preparing_45m' as const,
      title: 'En cours depuis +45 min',
      count: preparingOver45Min.length,
      rank: 3,
      icon: AlertCircle,
      activeColorClass: 'bg-[#FBF4E8] hover:bg-[#FBF4E8]/80 border-[#C88A2E]/30 text-[#C88A2E] font-black',
      activeBadgeClass: 'bg-[#C88A2E] text-white font-extrabold',
      activeIconClass: 'text-[#C88A2E]',
    },
  ];

  // Today and Yesterday Timestamps
  const currentDateObj = new Date(nowMs);
  const startOfTodayMs = new Date(currentDateObj.getFullYear(), currentDateObj.getMonth(), currentDateObj.getDate()).getTime();
  const startOfYesterdayMs = startOfTodayMs - 24 * 60 * 60 * 1000;

  // Today's paid revenue (payment_status = paid, status != cancelled)
  const todayPaidOrders = businessOrders.filter((o) => {
    if (o.payment_status !== 'paid' || o.status === 'cancelled') return false;
    const createdAt = new Date(o.created_at).getTime();
    return createdAt >= startOfTodayMs;
  });
  const todayPaidRevenue = todayPaidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  // Yesterday's paid revenue
  const yesterdayPaidOrders = businessOrders.filter((o) => {
    if (o.payment_status !== 'paid' || o.status === 'cancelled') return false;
    const createdAt = new Date(o.created_at).getTime();
    return createdAt >= startOfYesterdayMs && createdAt < startOfTodayMs;
  });
  const yesterdayPaidRevenue = yesterdayPaidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const revenueDiffVsYesterday = todayPaidRevenue - yesterdayPaidRevenue;

  const loyalCustomers = businessCustomers.filter((cust) => {
    const custOrdersCount = businessOrders.filter(
      (o) => o.customer_id === cust.id || (o as any).customer_phone === cust.phone
    ).length;
    return custOrdersCount > 1;
  });

  const loyaltyRate =
    businessCustomers.length > 0 ? (loyalCustomers.length / businessCustomers.length) * 100 : 0;

  // Real payment methods distribution for donut chart
  const PAYMENT_PALETTE = ['#FF4B72', '#8B5CF6', '#F472B6', '#DDD6FE'];

  const paymentMethodsDistribution = useMemo(() => {
    const validOrders = businessOrders.filter((o) => o.status !== 'cancelled');
    const totalValid = validOrders.length;
    if (totalValid === 0) return [];

    const getPaymentLabel = (method?: string | null): string => {
      if (!method || !method.trim()) return 'Non précisé';
      const clean = method.trim().toLowerCase();
      if (clean === 'wave') return 'Wave';
      if (clean === 'orange_money' || clean === 'orange') return 'Orange Money';
      if (clean === 'card' || clean === 'paydunya' || clean === 'cinetpay') return 'Carte';
      if (clean === 'cash') return 'Espèces';
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    };

    const countsMap = new Map<string, number>();
    for (const order of validOrders) {
      const label = getPaymentLabel(order.payment_method);
      countsMap.set(label, (countsMap.get(label) || 0) + 1);
    }

    const sortedGroups = Array.from(countsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    let sumPercentages = 0;
    return sortedGroups.map((group, index) => {
      let pct: number;
      if (index === sortedGroups.length - 1) {
        pct = Math.max(0, 100 - sumPercentages);
      } else {
        pct = Math.round((group.count / totalValid) * 100);
        sumPercentages += pct;
      }
      return {
        name: group.name,
        count: group.count,
        value: group.count,
        pct: `${pct} %`,
        color: PAYMENT_PALETTE[index % PAYMENT_PALETTE.length],
      };
    });
  }, [businessOrders]);

  const getInitials = (name?: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getActivityChartData = () => {
    const validOrders = businessOrders.filter((o) => o.status !== 'cancelled');

    if (activityPeriod === 'jour') {
      const hours = ['00h', '04h', '08h', '12h', '16h', '20h'];
      return hours.map((h, i) => {
        const slotOrders = validOrders.filter((o) => {
          if (!o.created_at) return false;
          const hour = new Date(o.created_at).getHours();
          return hour >= i * 4 && hour < (i + 1) * 4;
        });
        const rev = slotOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const count = slotOrders.length;
        return { name: h, revenue: rev, orders: count };
      });
    }

    if (activityPeriod === 'semaine') {
      const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      return days.map((d, i) => {
        const dayOrders = validOrders.filter((o) => {
          if (!o.created_at) return false;
          const date = new Date(o.created_at);
          const dayIdx = (date.getDay() + 6) % 7;
          return dayIdx === i;
        });
        const realRev = dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const realCount = dayOrders.length;
        return {
          name: d,
          revenue: realRev,
          orders: realCount,
        };
      });
    }

    if (activityPeriod === 'mois') {
      const weeks = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
      return weeks.map((w, i) => {
        const weekOrders = validOrders.filter((o) => {
          if (!o.created_at) return false;
          const dayOfMonth = new Date(o.created_at).getDate();
          if (i === 0) return dayOfMonth >= 1 && dayOfMonth <= 7;
          if (i === 1) return dayOfMonth >= 8 && dayOfMonth <= 14;
          if (i === 2) return dayOfMonth >= 15 && dayOfMonth <= 21;
          return dayOfMonth >= 22;
        });
        const rev = weekOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const count = weekOrders.length;
        return { name: w, revenue: rev, orders: count };
      });
    }

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return months.map((m, i) => {
      const monthOrders = validOrders.filter((o) => {
        if (!o.created_at) return false;
        const monthIdx = new Date(o.created_at).getMonth();
        return monthIdx === i;
      });
      const rev = monthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const count = monthOrders.length;
      return { name: m, revenue: rev, orders: count };
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Encaissé */}
        <div
          onClick={() => {
            onNavigateToOrdersWithFilter({
              paymentMethod: 'all',
              period: 'day',
              status: 'all',
              alertCategory: 'all',
              search: '',
            });
          }}
          className="bg-white border border-slate-200/80 rounded-3xl p-6 relative flex flex-col justify-between shadow-2xs hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group min-h-[160px]"
          title="Cliquer pour voir le détail des encaissements"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Total Encaissé (Aujourd&apos;hui)
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 group-hover:text-emerald-700 transition-colors mt-2 block">
              {todayPaidRevenue.toLocaleString('fr-FR')} {business.currency}
            </span>
          </div>

          {todayPaidRevenue === 0 ? (
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">
                Aucune vente aujourd&apos;hui
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToTab('finance');
                }}
                className="text-slate-500 hover:text-indigo-600 font-semibold transition-colors inline-flex items-center gap-0.5 cursor-pointer"
              >
                Voir le détail complet →
              </button>
            </div>
          ) : (
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-extrabold">vs Hier :</span>
                <span className={revenueDiffVsYesterday >= 0 ? 'text-emerald-600 font-black flex items-center gap-0.5' : 'text-rose-600 font-black flex items-center gap-0.5'}>
                  {revenueDiffVsYesterday < 0 ? (
                    <>
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600 inline shrink-0" />
                      -{Math.abs(revenueDiffVsYesterday).toLocaleString('fr-FR')} {business.currency}
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                      +{revenueDiffVsYesterday.toLocaleString('fr-FR')} {business.currency}
                    </>
                  )}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToTab('finance');
                }}
                className="text-slate-500 hover:text-indigo-600 font-semibold transition-colors inline-flex items-center gap-0.5 cursor-pointer"
              >
                Voir le détail complet →
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Commandes en attente (Fixed order 1->2->3) */}
        <div
          onClick={() => {
            onNavigateToOrdersWithFilter({
              status: 'all',
              alertCategory: 'all',
              search: '',
            });
          }}
          className="bg-white border border-slate-200/80 rounded-3xl p-6 relative flex flex-col justify-between shadow-2xs hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group min-h-[160px]"
          title="Cliquer pour accéder à la liste complète des commandes"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Alertes actives
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-3xl font-black text-amber-600 group-hover:text-amber-700 transition-colors">{totalSubAlertsCount}</span>
              <span className="text-xs text-slate-500 font-extrabold">attention requise</span>
            </div>

            {/* 3 Categories Summary in Strict Fixed Order */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
              {totalSubAlertsCount === 0 && (
                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-2xl mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Aucune alerte en ce moment</span>
                </div>
              )}

              <div className="space-y-1.5">
                {alertCategories.map((cat) => {
                  const IconComp = cat.icon;
                  const isActive = cat.count > 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToOrdersWithFilter({
                          alertCategory: cat.id,
                          status: 'all',
                          search: '',
                        });
                      }}
                      className={`w-full text-left p-2.5 rounded-2xl border text-xs transition-all flex items-center justify-between shadow-2xs cursor-pointer ${
                        isActive
                          ? cat.activeColorClass
                          : 'bg-slate-50/70 border-slate-200/60 text-slate-400 font-medium opacity-60 hover:opacity-100 hover:bg-slate-100/80'
                      }`}
                      title={`Cliquer pour filtrer les commandes : ${cat.title}`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-1">
                        <IconComp
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? cat.activeIconClass : 'text-slate-400'
                          }`}
                        />
                        <span className="text-xs font-bold leading-tight">{cat.title}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] min-w-[20px] text-center ml-1.5 shrink-0 ${
                          isActive ? cat.activeBadgeClass : 'bg-slate-200/80 text-slate-500 font-bold'
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Total Clients */}
        <div
          onClick={() => {
            onNavigateToCustomersWithFilter('all');
          }}
          className="bg-white border border-slate-200/80 rounded-3xl p-6 relative flex flex-col justify-between shadow-2xs hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group min-h-[160px]"
          title="Cliquer pour accéder au répertoire clients"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Total Clients
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            {businessCustomers.length === 0 ? (
              <div className="py-2 text-center my-auto">
                <p className="text-xs font-bold text-slate-700">Aucun client pour l&apos;instant</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToTab('settings');
                  }}
                  className="text-[#B5451B] font-extrabold text-xs hover:underline mt-1 inline-block cursor-pointer"
                >
                  Partager ma boutique →
                </button>
              </div>
            ) : (
              <span className="text-3xl font-black text-slate-900 group-hover:text-[#B5451B] transition-colors mt-2 block cursor-pointer">
                {businessCustomers.length}
              </span>
            )}
          </div>

          {businessCustomers.length > 0 && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToCustomersWithFilter('recurrent');
              }}
              className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] hover:bg-emerald-50/80 p-1.5 -mx-1.5 rounded-xl transition-all cursor-pointer group/line"
              title="Cliquer pour afficher les clients récurrents"
            >
              <span className="text-slate-500 font-extrabold group-hover/line:text-emerald-800 transition-colors">
                Taux de fidélité :
              </span>
              <span className="font-black text-emerald-700 bg-emerald-50 group-hover/line:bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-md transition-all inline-flex items-center space-x-1">
                <span>{loyaltyRate.toFixed(1)}%</span>
                <ArrowUpRight className="w-3 h-3 text-emerald-600" />
              </span>
            </div>
          )}
        </div>

        {/* Card 4: Taux de conversion */}
        <div
          onClick={() => {
            onNavigateToTab('conversion');
          }}
          className="bg-white border border-slate-200/80 rounded-3xl p-6 relative flex flex-col justify-between shadow-2xs hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group min-h-[160px]"
          title="Cliquer pour voir l'analyse détaillée du Taux de Conversion"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Taux de paiement
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>

            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-3xl font-black text-emerald-700 group-hover:text-emerald-800 transition-colors">
                {monthConversionMetrics.currentRate.toFixed(1)}%
              </span>
              <div className="flex items-center space-x-1 text-xs font-black">
                {monthConversionMetrics.rateDiff >= 0 ? (
                  <span className="text-emerald-600 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5 shrink-0" />
                    +{monthConversionMetrics.rateDiff.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200/60">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5 shrink-0" />
                    {monthConversionMetrics.rateDiff.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
            <div className="text-[11px] font-extrabold text-slate-800 flex items-center justify-between">
              <span>Revenu gagné (30j) :</span>
              <span className="text-emerald-700 font-black">
                {monthConversionMetrics.currentPaidRevenue.toLocaleString()} {business.currency}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center justify-between">
              <span>Évolution vs période préc. :</span>
              <span className={monthConversionMetrics.revenueDiff >= 0 ? 'text-emerald-600 font-bold flex items-center gap-0.5' : 'text-rose-600 font-bold flex items-center gap-0.5'}>
                {monthConversionMetrics.revenueDiff < 0 ? (
                  <>
                    <TrendingDown className="w-3 h-3 text-rose-600 inline shrink-0" />
                    -{Math.abs(monthConversionMetrics.revenueDiff).toLocaleString()} {business.currency}
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-3 h-3 text-emerald-600 inline shrink-0" />
                    +{monthConversionMetrics.revenueDiff.toLocaleString()} {business.currency}
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Layout identique à l'image de référence (Performance Over Time + Top Formats) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Carte Gauche: Performance Over Time (Activité de la semaine) */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Performance Over Time</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Revenu encaissé et commandes confirmées
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto">
                {(['jour', 'semaine', 'mois', 'annee'] as const).map((p) => {
                  const label = p === 'jour' ? 'Jour' : p === 'semaine' ? 'Semaine' : p === 'mois' ? 'Mois' : 'Année';
                  const isActive = activityPeriod === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActivityPeriod(p)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer font-bold ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'bg-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend matching reference image with horizontal line pills */}
            <div className="flex items-center gap-6 mt-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 rounded-full bg-[#FF4B72] inline-block" />
                <span className="text-xs font-bold text-slate-700">Revenu ({business.currency || 'XOF'})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 rounded-full bg-[#8B5CF6] inline-block" />
                <span className="text-xs font-bold text-slate-700">Commandes</span>
              </div>
            </div>

            {/* Dual Area Chart */}
            <div className="h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={getActivityChartData()} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF4B72" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FF4B72" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }}
                    dy={6}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }}
                    tickFormatter={(val) =>
                      val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
                    }
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      name === 'revenue'
                        ? `${Number(value || 0).toLocaleString('fr-FR')} ${business.currency || 'XOF'}`
                        : `${value} commande(s)`,
                      name === 'revenue' ? 'Revenu' : 'Commandes',
                    ]}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '0.75rem',
                      border: 'none',
                      color: '#F8FAFC',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                      padding: '10px 14px',
                    }}
                    itemStyle={{ color: '#F8FAFC', padding: '2px 0' }}
                    labelStyle={{ color: '#94A3B8', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#FF4B72"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={{ r: 3.5, fill: '#FF4B72', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#FF4B72', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke="#8B5CF6"
                    strokeWidth={2.5}
                    fill="url(#ordersGrad)"
                    dot={{ r: 3.5, fill: '#8B5CF6', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#8B5CF6', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Carte Droite: Moyens de paiement (Donut Chart) */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg tracking-tight pb-4 border-b border-slate-100">
              Moyens de paiement
            </h3>

            {paymentMethodsDistribution.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-slate-400">
                  Aucune commande pour le moment
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Donut Chart */}
                <div className="w-44 h-44 shrink-0 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {paymentMethodsDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend list matching reference layout */}
                <div className="flex flex-col space-y-3 w-full sm:w-auto">
                  {paymentMethodsDistribution.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-700 whitespace-nowrap">
                          {item.name} — {item.pct} ({item.count})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Recent Orders Table (Left) + RAG Agent Messages Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
        {/* Left Column: Recent Orders (Commandes Récentes & Clients) */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Commandes Récentes</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Dernières commandes et clients ayant commandé
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab('orders')}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>Voir tout</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Table of Orders */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-3 font-semibold">Order ID</th>
                    <th className="pb-3 font-semibold">Client</th>
                    <th className="pb-3 font-semibold">Lieu</th>
                    <th className="pb-3 font-semibold">Priorité</th>
                    <th className="pb-3 font-semibold">Montant</th>
                    <th className="pb-3 font-semibold">Statut</th>
                    <th className="pb-3 font-semibold text-right">Heure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {(() => {
                    const recentOrders = [...businessOrders]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice(0, 5);

                    if (recentOrders.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-slate-400 font-medium">
                            Aucune commande enregistrée pour le moment.
                          </td>
                        </tr>
                      );
                    }

                    return recentOrders.map((ord) => {
                      const isPickup = ord.order_type === 'pickup' || (ord as any).delivery_type === 'pickup';

                      const formattedTime = ord.created_at
                        ? new Date(ord.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      const cleanOrderId = (() => {
                        if (!ord.id) return '#ORD';
                        const raw = String(ord.id).trim();
                        const parts = raw.split(/[-_]/).filter(Boolean);
                        const tail = parts.length > 1 ? parts[parts.length - 1] : raw;
                        const shortCode = tail.length > 6 ? tail.slice(-6) : tail;
                        return `#${shortCode.toUpperCase()}`;
                      })();

                      const locationLabel = isPickup
                        ? '—'
                        : (ord.delivery_zone_name || (ord as any).delivery_zone || (ord as any).pickup_point || ord.delivery_address || 'Livraison');

                      const priority = (ord.priority_level || '').toLowerCase();
                      let priorityBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FBF4E8] text-[#C88A2E]">
                          Moyen
                        </span>
                      );

                      if (isPickup) {
                        priorityBadge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#EBF3F3] text-[#1B4B4A]">
                            À récupérer
                          </span>
                        );
                      } else if (priority === 'urgent' || priority === 'haute' || priority === 'high') {
                        priorityBadge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FCECEB] text-[#A63A2F]">
                            Urgent
                          </span>
                        );
                      }

                      const itemCount = ord.items && ord.items.length > 0
                        ? ord.items.reduce((acc, item) => acc + (item.quantity || 1), 0)
                        : (ord as any).order_items && (ord as any).order_items.length > 0
                          ? (ord as any).order_items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0)
                          : (ord as any).items_count || 1;

                      const itemsLabel = `${itemCount} ${itemCount > 1 ? 'produits' : 'produit'}`;

                      return (
                        <tr
                          key={ord.id}
                          onClick={() => setSelectedModalOrderId(ord.id)}
                          className={`group transition-all duration-200 ease-out cursor-pointer text-xs ${
                            selectedModalOrderId === ord.id
                              ? 'bg-purple-50/90 border-l-4 border-l-purple-600 shadow-2xs font-semibold'
                              : 'hover:bg-slate-50/90 hover:translate-x-0.5 hover:shadow-2xs active:scale-[0.997]'
                          }`}
                        >
                          {/* Order ID */}
                          <td className="py-3.5 pr-2 pl-2 font-mono font-bold text-slate-600 group-hover:text-purple-700 transition-colors whitespace-nowrap">
                            {cleanOrderId}
                          </td>

                          {/* Customer Avatar + Name (Identique à OrdersSection) */}
                          <td className="py-3.5 px-2">
                            <div
                              className="flex items-center gap-2 cursor-pointer group/cust transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToCustomersWithFilter(undefined, ord.customer_id);
                              }}
                              title="Voir la fiche client"
                            >
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 font-medium text-xs flex items-center justify-center shrink-0">
                                {getInitials(ord.customer_name)}
                              </div>
                              <span className="font-bold text-slate-900 group-hover/cust:text-purple-600 group-hover/cust:underline underline-offset-2 transition-colors whitespace-nowrap">
                                {ord.customer_name || 'Client Inconnu'}
                              </span>
                            </div>
                          </td>

                          {/* Lieu */}
                          <td className="py-3.5 px-2 font-medium text-slate-600 whitespace-nowrap">
                            {locationLabel}
                          </td>

                          {/* Priorité */}
                          <td className="py-3.5 px-2 whitespace-nowrap">
                            {priorityBadge}
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-2 whitespace-nowrap">
                            <div className="font-black text-slate-900 tabular-nums text-xs">
                              {(ord.total_amount || 0).toLocaleString('fr-FR')} {business.currency || 'XOF'}
                            </div>
                            <div className="text-[11px] font-medium text-slate-400 leading-none mt-0.5">
                              {itemsLabel}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-2 whitespace-nowrap">
                            {ord.status === 'delivered' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100/70 text-emerald-800">
                                Livrée
                              </span>
                            ) : ord.status === 'preparing' || ord.status === 'ready' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100/70 text-blue-800">
                                En cours
                              </span>
                            ) : ord.status === 'confirmed' || ord.status === 'pending' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100/70 text-indigo-800">
                                Confirmée
                              </span>
                            ) : ord.status === 'cancelled' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100/70 text-rose-800">
                                Annulée
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700">
                                {ord.status}
                              </span>
                            )}
                          </td>

                          {/* Heure */}
                          <td className="py-3.5 pl-2 text-right font-medium text-slate-500 whitespace-nowrap">
                            {formattedTime}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Messages & Activity of Assistant IA */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Messages Assistant IA</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Assistance commerciale & Ventes AI</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[10px] font-black shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                En ligne
              </div>
            </div>

            {/* Messages / Events Feed */}
            <div className="mt-4 space-y-3">
              {(() => {
                const relevantEvents = businessEvents
                  .filter((evt) => {
                    const type = (evt.event_type || '').toLowerCase();
                    return type !== 'order_confirmed' && type !== 'order_created';
                  })
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 4);

                if (relevantEvents.length === 0) {
                  return (
                    <div className="py-8 text-center text-xs text-slate-400 font-medium bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      Aucune activité assistant pour le moment.
                    </div>
                  );
                }

                return relevantEvents.map((evt) => {
                  const eventDate = new Date(evt.created_at);
                  const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  const rawMsg = evt.payload?.message || evt.payload?.query || evt.event_type || 'Action assistant enregistrée';
                  const msgText = typeof rawMsg === 'string' ? rawMsg : String(rawMsg);

                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        if (evt.order_id) {
                          setSelectedModalOrderId(evt.order_id);
                        } else {
                          onNavigateToTab('agent');
                        }
                      }}
                      className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-purple-200/80 hover:bg-purple-50/40 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 ease-out cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-slate-800 text-xs group-hover:text-purple-700 transition-colors flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-purple-600 shrink-0 group-hover:scale-110 transition-transform duration-200" />
                          {evt.event_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">{timeStr}</span>
                      </div>
                      <p className="text-[11px] text-[#241F1B] font-medium line-clamp-2 leading-snug">
                        {msgText}
                      </p>
                    </div>
                  );
                });
              })()}
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab('agent')}
              className="w-full mt-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Ouvrir l&apos;Assistant IA</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
