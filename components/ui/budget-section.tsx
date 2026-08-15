'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/budget-chart';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { getStore } from '@/lib/store';
import PeriodFilter, { PeriodType } from '@/components/ui/period-filter';

const chartConfig = {
  value: {
    label: 'Encaissé',
    color: '#B5451B', // terracotta — palette Chez Ami
  },
} satisfies ChartConfig;

function formatXOF(value: number) {
  return `${value.toLocaleString('fr-FR')} XOF`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { date: string; value: number } }>;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg p-3 shadow-lg">
        <div className="text-sm text-[#241F1B]/60 mb-1">{data.date}</div>
        <div className="text-base font-bold text-[#241F1B]">{formatXOF(data.value)}</div>
      </div>
    );
  }
  return null;
};

export interface BudgetSectionProps {
  businessId?: string;
  orders?: any[];
}

export default function BudgetSection({ businessId, orders: propOrders }: BudgetSectionProps) {
  const [period, setPeriod] = React.useState<PeriodType>('week');
  const [storeState, setStoreState] = React.useState(() => getStore());

  React.useEffect(() => {
    const store = getStore();
    const unsubscribe = store.subscribe(() => {
      setStoreState(store);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const targetBusinessId = businessId || storeState.activeBusinessId || 'biz_dakar_gourmet';
  const orders = React.useMemo(() => {
    const raw = propOrders || storeState.orders || [];
    if (targetBusinessId) {
      return raw.filter((o: any) => o.business_id === targetBusinessId);
    }
    return raw;
  }, [propOrders, storeState.orders, targetBusinessId]);

  const { budgetData, totalEncaisse, highValue, lowValue, variation } = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTodayMs = startOfToday.getTime();
    const endOfTodayMs = startOfTodayMs + 24 * 3600 * 1000 - 1;

    // Helper to calculate total paid revenue in [startMs, endMs]
    const getPaidSumInWindow = (startMs: number, endMs: number) => {
      let sum = 0;
      orders.forEach((o: any) => {
        if (o.payment_status === 'paid' && o.status !== 'cancelled' && o.created_at) {
          const t = new Date(o.created_at).getTime();
          if (t >= startMs && t <= endMs) {
            sum += Number(o.total_amount || 0);
          }
        }
      });
      return sum;
    };

    let data: { date: string; value: number }[] = [];
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
        const val = getPaidSumInWindow(slotStart, slotEnd);

        const dayNum = String(dayStartObj.getDate()).padStart(2, '0');
        const monthShort = dayStartObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
        const label = `${dayNum} ${formattedMonth}`;
        data.push({ date: label, value: val });
      }
    } else if (period === 'week') {
      // "Semaine" : 4 dernières semaines, 1 point par semaine
      const weeksCount = 4;
      currentStartMs = startOfTodayMs - (weeksCount * 7 - 1) * 24 * 3600 * 1000;
      currentEndMs = endOfTodayMs;
      prevStartMs = currentStartMs - (weeksCount * 7) * 24 * 3600 * 1000;
      prevEndMs = currentStartMs - 1;

      for (let i = weeksCount - 1; i >= 0; i--) {
        const weekStartObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - (i * 7 + 6));
        const weekEndObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - (i * 7));
        const slotStart = weekStartObj.getTime();
        const slotEnd = weekEndObj.getTime() + 24 * 3600 * 1000 - 1;
        const val = getPaidSumInWindow(slotStart, slotEnd);

        const startDay = String(weekStartObj.getDate()).padStart(2, '0');
        const endDay = String(weekEndObj.getDate()).padStart(2, '0');
        const endMonth = weekEndObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = endMonth.charAt(0).toUpperCase() + endMonth.slice(1);
        const label = `${startDay}-${endDay} ${formattedMonth}`;
        data.push({ date: label, value: val });
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
        const val = getPaidSumInWindow(slotStart, slotEnd);

        const monthName = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        const yearShort = String(d.getFullYear()).slice(-2);
        const label = `${formattedMonth} ${yearShort}`;
        data.push({ date: label, value: val });
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
        const val = getPaidSumInWindow(slotStart, slotEnd);

        data.push({ date: `${yr}`, value: val });
      }
    } else {
      // "Tout" : historique complet, agrégé par mois (ou par année si > 2 ans)
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
          const val = getPaidSumInWindow(slotStart, slotEnd);
          data.push({ date: `${yr}`, value: val });
        }
      } else {
        const startMonth = earliestDate.getMonth();
        const currentMonth = now.getMonth();
        const totalMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1;

        for (let i = totalMonths - 1; i >= 0; i--) {
          const d = new Date(currentYear, currentMonth - i, 1);
          const slotStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
          const slotEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
          const val = getPaidSumInWindow(slotStart, slotEnd);

          const monthName = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
          const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
          const yearShort = String(d.getFullYear()).slice(-2);
          data.push({ date: `${formattedMonth} ${yearShort}`, value: val });
        }
      }

      currentStartMs = minMs;
      currentEndMs = now.getTime();
      prevStartMs = 0;
      prevEndMs = 0;
    }

    const currentTotal = getPaidSumInWindow(currentStartMs, currentEndMs);
    const prevTotal = prevStartMs > 0 ? getPaidSumInWindow(prevStartMs, prevEndMs) : 0;

    let varVal = 0;
    if (prevTotal === 0) {
      varVal = currentTotal > 0 ? 100 : 0;
    } else {
      varVal = Number((((currentTotal - prevTotal) / prevTotal) * 100).toFixed(1));
    }

    const high = data.length ? Math.max(...data.map((d) => d.value)) : 0;
    const low = data.length ? Math.min(...data.map((d) => d.value)) : 0;

    return {
      budgetData: data,
      totalEncaisse: currentTotal,
      highValue: high,
      lowValue: low,
      variation: varVal,
    };
  }, [orders, period]);

  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-stretch gap-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
          <div>
            <h2 className="text-base font-semibold text-[#241F1B] mb-1">Budget</h2>
            <p className="text-sm text-[#241F1B]/60 mb-3">Évolution de votre trésorerie</p>
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-3.5">
              <span className="text-3xl font-bold tabular-nums text-[#241F1B]">
                {formatXOF(totalEncaisse)}
              </span>
              <div className="flex items-center gap-1 text-[#1B4B4A]">
                {variation >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="font-medium">
                  {variation >= 0 ? '+' : ''}{variation}%
                </span>
                <span className="text-[#241F1B]/50 font-normal">vs période précédente</span>
              </div>
            </div>
          </div>

          <PeriodFilter
            value={period}
            onChange={setPeriod}
            showLabel={true}
          />
        </div>

        <div className="flex items-center gap-6 text-sm text-[#241F1B]/60 mb-2">
          <span>Pic : <span className="font-medium text-[#241F1B]">{formatXOF(highValue)}</span></span>
          <span>Creux : <span className="font-medium text-[#241F1B]">{formatXOF(lowValue)}</span></span>
        </div>

        <ChartContainer config={chartConfig} className="h-72 w-full">
          <ComposedChart data={budgetData} margin={{ top: 20, right: 10, left: 5, bottom: 20 }}>
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
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tickMargin={15}
            />
            <ChartTooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: '#241F1B', strokeOpacity: 0.3 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartConfig.value.color}
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.value === highValue || payload.value === lowValue) {
                  return (
                    <circle
                      key={`dot-${payload.date}`}
                      cx={cx} cy={cy} r={5}
                      fill={chartConfig.value.color}
                      stroke="#FAF7F2"
                      strokeWidth={2}
                    />
                  );
                }
                return <g key={`dot-${payload.date}`} />;
              }}
              activeDot={{ r: 5, fill: chartConfig.value.color, stroke: '#FAF7F2', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
