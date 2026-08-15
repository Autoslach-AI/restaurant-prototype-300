'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/budget-chart';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import PeriodFilter, { PeriodType } from '@/components/ui/period-filter';

const chartConfig = {
  rate: {
    label: 'Taux de conversion',
    color: '#B5451B', // terracotta — palette Chez Ami
  },
} satisfies ChartConfig;

function formatXOF(value: number, currency = 'XOF') {
  return `${value.toLocaleString('fr-FR')} ${currency}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      value: number;
      paidCount: number;
      totalCount: number;
      paidRevenue: number;
    };
  }>;
  currency?: string;
}

const CustomTooltip = ({ active, payload, currency = 'XOF' }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl p-3 shadow-lg space-y-1 text-xs">
        <div className="text-xs text-[#241F1B]/60 font-bold">{data.date}</div>
        <div className="text-base font-black text-[#B5451B]">
          Taux: {data.value.toFixed(1)}%
        </div>
        <div className="text-[11px] text-[#241F1B]/80 font-medium">
          {data.paidCount} / {data.totalCount} commande(s) payée(s)
        </div>
        <div className="text-[11px] text-[#1B4B4A] font-bold">
          Encaissé : {formatXOF(data.paidRevenue, currency)}
        </div>
      </div>
    );
  }
  return null;
};

export interface ConversionDetailSectionProps {
  orders: any[];
  currency?: string;
  onNavigateToOrders?: () => void;
}

export default function ConversionDetailSection({
  orders,
  currency = 'XOF',
}: ConversionDetailSectionProps) {
  const [period, setPeriod] = React.useState<PeriodType>('month');

  const {
    chartData,
    currentRate,
    rateDiff,
    currentPaidRevenue,
    revenueDiff,
    highRate,
    lowRate,
  } = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTodayMs = startOfToday.getTime();
    const endOfTodayMs = startOfTodayMs + 24 * 3600 * 1000 - 1;

    // Helper to calculate order stats in [startMs, endMs]
    const getStatsInWindow = (startMs: number, endMs: number) => {
      let createdCount = 0;
      let paidCount = 0;
      let paidRevenue = 0;
      let unpaidRevenue = 0;

      orders.forEach((o: any) => {
        if (!o.created_at) return;
        const t = new Date(o.created_at).getTime();
        if (t >= startMs && t <= endMs) {
          createdCount++;
          if (o.payment_status === 'paid' && o.status !== 'cancelled') {
            paidCount++;
            paidRevenue += Number(o.total_amount || 0);
          } else {
            unpaidRevenue += Number(o.total_amount || 0);
          }
        }
      });

      const rate = createdCount > 0 ? Number(((paidCount / createdCount) * 100).toFixed(1)) : 0;
      return { createdCount, paidCount, paidRevenue, unpaidRevenue, rate };
    };

    let data: {
      date: string;
      value: number;
      paidCount: number;
      totalCount: number;
      paidRevenue: number;
    }[] = [];

    let currentStartMs = 0;
    let currentEndMs = endOfTodayMs;
    let prevStartMs = 0;
    let prevEndMs = 0;

    if (period === 'day') {
      // "Jour" : 7 derniers jours, 1 point par jour
      const daysCount = 7;
      currentStartMs = startOfTodayMs - (daysCount - 1) * 24 * 3600 * 1000;
      currentEndMs = endOfTodayMs;
      prevStartMs = currentStartMs - daysCount * 24 * 3600 * 1000;
      prevEndMs = currentStartMs - 1;

      for (let i = daysCount - 1; i >= 0; i--) {
        const dayStartObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - i);
        const slotStart = dayStartObj.getTime();
        const slotEnd = slotStart + 24 * 3600 * 1000 - 1;
        const stats = getStatsInWindow(slotStart, slotEnd);

        const dayNum = String(dayStartObj.getDate()).padStart(2, '0');
        const monthShort = dayStartObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
        const label = `${dayNum} ${formattedMonth}`;

        data.push({
          date: label,
          value: stats.rate,
          paidCount: stats.paidCount,
          totalCount: stats.createdCount,
          paidRevenue: stats.paidRevenue,
        });
      }
    } else if (period === 'week') {
      // "Semaine" : 4 dernières semaines, 1 point par semaine
      const weeksCount = 4;
      currentStartMs = startOfTodayMs - (weeksCount * 7 - 1) * 24 * 3600 * 1000;
      currentEndMs = endOfTodayMs;
      prevStartMs = currentStartMs - weeksCount * 7 * 24 * 3600 * 1000;
      prevEndMs = currentStartMs - 1;

      for (let i = weeksCount - 1; i >= 0; i--) {
        const weekStartObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - (i * 7 + 6));
        const weekEndObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - i * 7);
        const slotStart = weekStartObj.getTime();
        const slotEnd = weekEndObj.getTime() + 24 * 3600 * 1000 - 1;
        const stats = getStatsInWindow(slotStart, slotEnd);

        const startDay = String(weekStartObj.getDate()).padStart(2, '0');
        const endDay = String(weekEndObj.getDate()).padStart(2, '0');
        const endMonth = weekEndObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = endMonth.charAt(0).toUpperCase() + endMonth.slice(1);
        const label = `${startDay}-${endDay} ${formattedMonth}`;

        data.push({
          date: label,
          value: stats.rate,
          paidCount: stats.paidCount,
          totalCount: stats.createdCount,
          paidRevenue: stats.paidRevenue,
        });
      }
    } else if (period === 'month') {
      // "Mois" : 12 derniers mois, 1 point par mois
      const monthsCount = 12;
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      currentStartMs = new Date(currentYear, currentMonth - (monthsCount - 1), 1).getTime();
      currentEndMs = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).getTime();
      prevStartMs = new Date(currentYear, currentMonth - (2 * monthsCount - 1), 1).getTime();
      prevEndMs = currentStartMs - 1;

      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const slotStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const slotEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        const stats = getStatsInWindow(slotStart, slotEnd);

        const monthName = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        const yearShort = String(d.getFullYear()).slice(-2);
        const label = `${formattedMonth} ${yearShort}`;

        data.push({
          date: label,
          value: stats.rate,
          paidCount: stats.paidCount,
          totalCount: stats.createdCount,
          paidRevenue: stats.paidRevenue,
        });
      }
    } else if (period === 'year') {
      // "Année" : 5 dernières années, 1 point par année
      const yearsCount = 5;
      const currentYear = now.getFullYear();

      currentStartMs = new Date(currentYear - (yearsCount - 1), 0, 1).getTime();
      currentEndMs = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime();
      prevStartMs = new Date(currentYear - (2 * yearsCount - 1), 0, 1).getTime();
      prevEndMs = currentStartMs - 1;

      for (let i = yearsCount - 1; i >= 0; i--) {
        const yr = currentYear - i;
        const slotStart = new Date(yr, 0, 1).getTime();
        const slotEnd = new Date(yr, 11, 31, 23, 59, 59, 999).getTime();
        const stats = getStatsInWindow(slotStart, slotEnd);

        data.push({
          date: `${yr}`,
          value: stats.rate,
          paidCount: stats.paidCount,
          totalCount: stats.createdCount,
          paidRevenue: stats.paidRevenue,
        });
      }
    } else {
      // "Tout" : historique complet
      let minMs = startOfTodayMs;
      orders.forEach((o: any) => {
        if (o.created_at) {
          const t = new Date(o.created_at).getTime();
          if (t < minMs) minMs = t;
        }
      });

      const earliestDate = new Date(minMs);
      const startYear = earliestDate.getFullYear();
      const currentYear = now.getFullYear();
      const yearsDiff = currentYear - startYear;

      if (yearsDiff > 2) {
        for (let yr = startYear; yr <= currentYear; yr++) {
          const slotStart = new Date(yr, 0, 1).getTime();
          const slotEnd = new Date(yr, 11, 31, 23, 59, 59, 999).getTime();
          const stats = getStatsInWindow(slotStart, slotEnd);
          data.push({
            date: `${yr}`,
            value: stats.rate,
            paidCount: stats.paidCount,
            totalCount: stats.createdCount,
            paidRevenue: stats.paidRevenue,
          });
        }
      } else {
        const startMonth = earliestDate.getMonth();
        const currentMonth = now.getMonth();
        const totalMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1;

        for (let i = totalMonths - 1; i >= 0; i--) {
          const d = new Date(currentYear, currentMonth - i, 1);
          const slotStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
          const slotEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
          const stats = getStatsInWindow(slotStart, slotEnd);

          const monthName = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
          const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
          const yearShort = String(d.getFullYear()).slice(-2);
          data.push({
            date: `${formattedMonth} ${yearShort}`,
            value: stats.rate,
            paidCount: stats.paidCount,
            totalCount: stats.createdCount,
            paidRevenue: stats.paidRevenue,
          });
        }
      }

      currentStartMs = minMs;
      currentEndMs = now.getTime();
      prevStartMs = 0;
      prevEndMs = 0;
    }

    const currentStats = getStatsInWindow(currentStartMs, currentEndMs);
    const prevStats = prevStartMs > 0 ? getStatsInWindow(prevStartMs, prevEndMs) : { createdCount: 0, paidCount: 0, paidRevenue: 0, unpaidRevenue: 0, rate: 0 };

    const cRate = currentStats.rate;
    const pRate = prevStats.rate;
    const rDiff = Number((cRate - pRate).toFixed(1));

    const cRevenue = currentStats.paidRevenue;
    const pRevenue = prevStats.paidRevenue;
    const revDiff = cRevenue - pRevenue;

    const high = data.length ? Math.max(...data.map((d) => d.value)) : 0;
    const low = data.length ? Math.min(...data.map((d) => d.value)) : 0;

    return {
      chartData: data,
      currentRate: cRate,
      rateDiff: rDiff,
      currentPaidRevenue: cRevenue,
      revenueDiff: revDiff,
      highRate: high,
      lowRate: low,
    };
  }, [orders, period]);

  return (
    <div className="space-y-6">
      {/* 1. Merged Header & Key Metrics Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-black text-[#B5451B] uppercase tracking-wider mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Analyse de Performance</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Taux de Conversion</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Commandes payées / commandes créées
          </p>
        </div>

        {/* Main figure % + variation */}
        <div className="flex items-baseline space-x-3 pt-1">
          <span className="text-4xl sm:text-5xl font-black text-slate-900">
            {currentRate.toFixed(1)}%
          </span>

          {period !== 'all' && (
            <div
              className={`flex items-center space-x-1 text-sm font-black px-2.5 py-1 rounded-xl border ${
                rateDiff >= 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                  : 'bg-rose-50 text-rose-700 border-rose-200/80'
              }`}
            >
              {rateDiff >= 0 ? (
                <TrendingUp className="w-4 h-4 shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 shrink-0" />
              )}
              <span>
                {rateDiff >= 0 ? '+' : ''}
                {rateDiff.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 font-normal ml-1">vs période préc.</span>
            </div>
          )}
        </div>

        {/* Revenue line: Revenu encaissé / Évolution du revenu */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-slate-700">
            <span>Revenu encaissé :</span>
            <span className="font-black text-slate-900">{formatXOF(currentPaidRevenue, currency)}</span>
          </div>

          {period !== 'all' && (
            <div className="flex items-center space-x-1 font-bold">
              <span className="text-slate-500">Évolution du revenu :</span>
              <span
                className={
                  revenueDiff >= 0
                    ? 'text-emerald-700 font-black flex items-center gap-0.5'
                    : 'text-rose-600 font-black flex items-center gap-0.5'
                }
              >
                {revenueDiff >= 0 ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 inline shrink-0" />
                    Revenu gagné : +{formatXOF(revenueDiff, currency)}
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-3.5 h-3.5 inline shrink-0" />
                    Revenu perdu : -{formatXOF(Math.abs(revenueDiff), currency)}
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Line Chart Card with Period Filter in Header */}
      <Card className="w-full">
        <CardContent className="flex flex-col items-stretch gap-4 pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#241F1B]">
                Évolution du Taux de Conversion (%)
              </h3>
              <p className="text-xs text-[#241F1B]/60">
                Suivi de la transformation des commandes au fil du temps
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 text-xs text-[#241F1B]/60 font-medium">
                <span>
                  Pic : <span className="font-bold text-[#241F1B]">{highRate.toFixed(1)}%</span>
                </span>
                <span>
                  Creux : <span className="font-bold text-[#241F1B]">{lowRate.toFixed(1)}%</span>
                </span>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} showLabel={true} />
            </div>
          </div>

          <ChartContainer config={chartConfig} className="h-72 w-full">
            <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="4 8" stroke="#E5DCD0" horizontal vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#241F1B99' }}
                tickMargin={15}
                minTickGap={12}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#241F1B99' }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                tickMargin={15}
              />
              <ChartTooltip
                content={<CustomTooltip currency={currency} />}
                cursor={{ strokeDasharray: '3 3', stroke: '#241F1B', strokeOpacity: 0.3 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartConfig.rate.color}
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.value === highRate || payload.value === lowRate) {
                    return (
                      <circle
                        key={`dot-${payload.date}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={chartConfig.rate.color}
                        stroke="#FAF7F2"
                        strokeWidth={2}
                      />
                    );
                  }
                  return <g key={`dot-${payload.date}`} />;
                }}
                activeDot={{ r: 5, fill: chartConfig.rate.color, stroke: '#FAF7F2', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
