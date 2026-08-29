'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import PeriodFilter, { PeriodType } from '@/components/ui/period-filter';
import { Expense } from '@/lib/types';
import { fetchExpensesForBusiness } from '@/lib/supabase';
import {
  Search,
  Moon,
  Bell,
  ChevronDown,
  MoreVertical,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  ReferenceLine,
} from 'recharts';

// --- DATASETS ---

const trackRevenueData = [
  { name: 'Jan', previous: 125, recent: 30 },
  { name: 'Feb', previous: 35, recent: 245 },
  { name: 'Mar', previous: 65, recent: 145 },
  { name: 'Apr', previous: 115, recent: 88 },
  { name: 'May', previous: 160, recent: 45 },
  { name: 'Jun', previous: 110, recent: 150 },
];

const DROPDOWN_PERIOD_OPTIONS = [
  { id: '7d', label: '7 derniers jours' },
  { id: '30d', label: '30 derniers jours' },
  { id: '6m', label: '6 derniers mois' },
  { id: '12m', label: '12 derniers mois' },
] as const;

type DropdownPeriodType = typeof DROPDOWN_PERIOD_OPTIONS[number]['id'];

const AVIS_PERIOD_OPTIONS = DROPDOWN_PERIOD_OPTIONS;
type AvisPeriodType = DropdownPeriodType;

const avisClientsDataMap: Record<AvisPeriodType, Array<{ name: string; avisPositifs: number; avisNegatifs: number; tendanceSatisfaction: number }>> = {
  '7d': [
    { name: 'Lun', avisPositifs: 12, avisNegatifs: -4, tendanceSatisfaction: 75 },
    { name: 'Mar', avisPositifs: 18, avisNegatifs: -2, tendanceSatisfaction: 88 },
    { name: 'Mer', avisPositifs: 15, avisNegatifs: -6, tendanceSatisfaction: 70 },
    { name: 'Jeu', avisPositifs: 22, avisNegatifs: -3, tendanceSatisfaction: 85 },
    { name: 'Ven', avisPositifs: 28, avisNegatifs: -5, tendanceSatisfaction: 82 },
    { name: 'Sam', avisPositifs: 35, avisNegatifs: -8, tendanceSatisfaction: 78 },
    { name: 'Dim', avisPositifs: 20, avisNegatifs: -1, tendanceSatisfaction: 94 },
  ],
  '30d': [
    { name: 'Sem 1', avisPositifs: 45, avisNegatifs: -12, tendanceSatisfaction: 78 },
    { name: 'Sem 2', avisPositifs: 58, avisNegatifs: -18, tendanceSatisfaction: 68 },
    { name: 'Sem 3', avisPositifs: 72, avisNegatifs: -8, tendanceSatisfaction: 89 },
    { name: 'Sem 4', avisPositifs: 64, avisNegatifs: -14, tendanceSatisfaction: 82 },
  ],
  '6m': [
    { name: 'Jan', avisPositifs: 70, avisNegatifs: -25, tendanceSatisfaction: 65 },
    { name: 'Fév', avisPositifs: 60, avisNegatifs: -15, tendanceSatisfaction: 75 },
    { name: 'Mar', avisPositifs: 85, avisNegatifs: -30, tendanceSatisfaction: 55 },
    { name: 'Avr', avisPositifs: 55, avisNegatifs: -20, tendanceSatisfaction: 70 },
    { name: 'Mai', avisPositifs: 78, avisNegatifs: -10, tendanceSatisfaction: 85 },
    { name: 'Juin', avisPositifs: 65, avisNegatifs: -25, tendanceSatisfaction: 60 },
  ],
  '12m': [
    { name: 'Jan', avisPositifs: 70, avisNegatifs: -25, tendanceSatisfaction: 65 },
    { name: 'Fév', avisPositifs: 60, avisNegatifs: -15, tendanceSatisfaction: 75 },
    { name: 'Mar', avisPositifs: 85, avisNegatifs: -30, tendanceSatisfaction: 55 },
    { name: 'Avr', avisPositifs: 55, avisNegatifs: -20, tendanceSatisfaction: 70 },
    { name: 'Mai', avisPositifs: 78, avisNegatifs: -10, tendanceSatisfaction: 85 },
    { name: 'Juin', avisPositifs: 65, avisNegatifs: -25, tendanceSatisfaction: 60 },
    { name: 'Juil', avisPositifs: 90, avisNegatifs: -18, tendanceSatisfaction: 80 },
    { name: 'Août', avisPositifs: 82, avisNegatifs: -22, tendanceSatisfaction: 73 },
    { name: 'Sep', avisPositifs: 95, avisNegatifs: -12, tendanceSatisfaction: 87 },
    { name: 'Oct', avisPositifs: 110, avisNegatifs: -28, tendanceSatisfaction: 74 },
    { name: 'Nov', avisPositifs: 105, avisNegatifs: -16, tendanceSatisfaction: 84 },
    { name: 'Déc', avisPositifs: 130, avisNegatifs: -35, tendanceSatisfaction: 72 },
  ],
};

const invoicesPieData = [
  { name: 'Paid', value: 47, color: '#06b6d4' },
  { name: 'Overdue', value: 28, color: '#38bdf8' },
  { name: 'Unpaid', value: 18, color: '#6366f1' },
  { name: 'Others', value: 7, color: '#e2e8f0' },
];

const recentlyPaidInvoicesData = [
  { name: 'Jan', purchase: 50, paid: 25, averageCredit: 80 },
  { name: 'Feb', purchase: 30, paid: 15, averageCredit: 80 },
  { name: 'Mar', purchase: 10, paid: 5, averageCredit: 30 },
  { name: 'Apr', purchase: 30, paid: 20, averageCredit: 80 },
  { name: 'May', purchase: 5, paid: 2, averageCredit: 20 },
  { name: 'Jun', purchase: 20, paid: 10, averageCredit: 80 },
];

interface FinanceSectionProps {
  orders?: any[];
  currency?: string;
  nowMs?: number;
  businessId?: string;
  onNavigateToExpenses?: () => void;
}

export default function FinanceSection({
  orders = [],
  currency = 'XOF',
  nowMs = 0,
  businessId,
  onNavigateToExpenses,
}: FinanceSectionProps) {
  const [periodFilter, setPeriodFilter] = useState<PeriodType>('month');
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadExpenses() {
      if (!businessId) return;
      try {
        const data = await fetchExpensesForBusiness(businessId);
        if (isMounted) {
          setAllExpenses(data || []);
        }
      } catch (err) {
        console.warn('Error loading expenses in FinanceSection:', err);
      }
    }
    loadExpenses();
    return () => {
      isMounted = false;
    };
  }, [businessId]);

  const [budgetPeriod, setBudgetPeriod] = useState<PeriodType>('week');
  const [beneficePeriod, setBeneficePeriod] = useState<DropdownPeriodType>('7d');
  const [isBeneficeDropdownOpen, setIsBeneficeDropdownOpen] = useState(false);
  const beneficeDropdownRef = React.useRef<HTMLDivElement>(null);

  const [pertePeriod, setPertePeriod] = useState<DropdownPeriodType>('7d');
  const [isPerteDropdownOpen, setIsPerteDropdownOpen] = useState(false);
  const perteDropdownRef = React.useRef<HTMLDivElement>(null);

  const [paidPeriod, setPaidPeriod] = useState('Last 6 Months');
  const [avisPeriod, setAvisPeriod] = useState<AvisPeriodType>('6m');
  const [isAvisDropdownOpen, setIsAvisDropdownOpen] = useState(false);
  const avisDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avisDropdownRef.current && !avisDropdownRef.current.contains(e.target as Node)) {
        setIsAvisDropdownOpen(false);
      }
      if (beneficeDropdownRef.current && !beneficeDropdownRef.current.contains(e.target as Node)) {
        setIsBeneficeDropdownOpen(false);
      }
      if (perteDropdownRef.current && !perteDropdownRef.current.contains(e.target as Node)) {
        setIsPerteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculation for Budget Chart using paid orders
  const budgetChartData = React.useMemo(() => {
    const now = nowMs ? new Date(nowMs) : new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTodayMs = startOfToday.getTime();
    const endOfTodayMs = startOfTodayMs + 24 * 3600 * 1000 - 1;

    const getPaidSumInWindow = (startMs: number, endMs: number) => {
      let sum = 0;
      (orders || []).forEach((o: any) => {
        if (o.payment_status === 'paid' && o.status !== 'cancelled' && o.created_at) {
          const t = new Date(o.created_at).getTime();
          if (t >= startMs && t <= endMs) {
            sum += Number(o.total_amount || 0);
          }
        }
      });
      return sum;
    };

    let data: { name: string; recent: number; previous: number }[] = [];

    if (budgetPeriod === 'day') {
      const daysCount = 7;
      for (let i = daysCount - 1; i >= 0; i--) {
        const dayStartObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - i);
        const slotStart = dayStartObj.getTime();
        const slotEnd = slotStart + 24 * 3600 * 1000 - 1;
        const recentVal = getPaidSumInWindow(slotStart, slotEnd);

        const prevSlotStart = slotStart - 7 * 24 * 3600 * 1000;
        const prevSlotEnd = slotEnd - 7 * 24 * 3600 * 1000;
        const previousVal = getPaidSumInWindow(prevSlotStart, prevSlotEnd);

        const dayNum = String(dayStartObj.getDate()).padStart(2, '0');
        const monthShort = dayStartObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
        data.push({ name: `${dayNum} ${formattedMonth}`, recent: recentVal, previous: previousVal });
      }
    } else if (budgetPeriod === 'week') {
      const weeksCount = 4;
      for (let i = weeksCount - 1; i >= 0; i--) {
        const weekStartObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - (i * 7 + 6));
        const weekEndObj = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - (i * 7));
        const slotStart = weekStartObj.getTime();
        const slotEnd = weekEndObj.getTime() + 24 * 3600 * 1000 - 1;
        const recentVal = getPaidSumInWindow(slotStart, slotEnd);

        const prevSlotStart = slotStart - 28 * 24 * 3600 * 1000;
        const prevSlotEnd = slotEnd - 28 * 24 * 3600 * 1000;
        const previousVal = getPaidSumInWindow(prevSlotStart, prevSlotEnd);

        const startDay = String(weekStartObj.getDate()).padStart(2, '0');
        const endDay = String(weekEndObj.getDate()).padStart(2, '0');
        const endMonth = weekEndObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = endMonth.charAt(0).toUpperCase() + endMonth.slice(1);
        data.push({ name: `${startDay}-${endDay} ${formattedMonth}`, recent: recentVal, previous: previousVal });
      }
    } else if (budgetPeriod === 'month') {
      const monthsCount = 12;
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const slotStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const slotEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        const recentVal = getPaidSumInWindow(slotStart, slotEnd);

        const prevStart = new Date(d.getFullYear() - 1, d.getMonth(), 1).getTime();
        const prevEnd = new Date(d.getFullYear() - 1, d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        const previousVal = getPaidSumInWindow(prevStart, prevEnd);

        const monthName = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        const yearShort = String(d.getFullYear()).slice(-2);
        data.push({ name: `${formattedMonth} ${yearShort}`, recent: recentVal, previous: previousVal });
      }
    } else if (budgetPeriod === 'year') {
      const yearsCount = 5;
      const currentYear = now.getFullYear();

      for (let i = yearsCount - 1; i >= 0; i--) {
        const yr = currentYear - i;
        const slotStart = new Date(yr, 0, 1).getTime();
        const slotEnd = new Date(yr, 11, 31, 23, 59, 59, 999).getTime();
        const recentVal = getPaidSumInWindow(slotStart, slotEnd);

        const prevStart = new Date(yr - 5, 0, 1).getTime();
        const prevEnd = new Date(yr - 5, 11, 31, 23, 59, 59, 999).getTime();
        const previousVal = getPaidSumInWindow(prevStart, prevEnd);

        data.push({ name: `${yr}`, recent: recentVal, previous: previousVal });
      }
    } else {
      let minMs = startOfTodayMs;
      (orders || []).forEach((o: any) => {
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
          const recentVal = getPaidSumInWindow(slotStart, slotEnd);

          const prevShift = (yearsDiff + 1);
          const prevStart = new Date(yr - prevShift, 0, 1).getTime();
          const prevEnd = new Date(yr - prevShift, 11, 31, 23, 59, 59, 999).getTime();
          const previousVal = getPaidSumInWindow(prevStart, prevEnd);

          data.push({ name: `${yr}`, recent: recentVal, previous: previousVal });
        }
      } else {
        const startMonth = earliestDate.getMonth();
        const currentMonth = now.getMonth();
        const totalMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1;

        for (let i = totalMonths - 1; i >= 0; i--) {
          const d = new Date(currentYear, currentMonth - i, 1);
          const slotStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
          const slotEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
          const recentVal = getPaidSumInWindow(slotStart, slotEnd);

          const prevStart = new Date(d.getFullYear(), d.getMonth() - totalMonths, 1).getTime();
          const prevEnd = new Date(d.getFullYear(), d.getMonth() - totalMonths + 1, 0, 23, 59, 59, 999).getTime();
          const previousVal = getPaidSumInWindow(prevStart, prevEnd);

          const monthName = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
          const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
          const yearShort = String(d.getFullYear()).slice(-2);
          data.push({ name: `${formattedMonth} ${yearShort}`, recent: recentVal, previous: previousVal });
        }
      }
    }

    return data;
  }, [orders, nowMs, budgetPeriod]);

  // Helper to extract timestamp from Expense
  const getExpenseTime = (e: Expense) => {
    if (e.date) {
      const parsed = new Date(e.date.includes('T') ? e.date : `${e.date}T12:00:00`).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    if (e.created_at) {
      const parsed = new Date(e.created_at).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  };

  // Helper to aggregate revenue, expenses, and net profit by timeline slots for DropdownPeriodType ('7d', '30d', '6m', '12m')
  const getPeriodTimelinePoints = (
    period: DropdownPeriodType
  ): {
    points: Array<{ name: string; revenue: number; expenses: number; net: number }>;
    hasData: boolean;
  } => {
    const now = nowMs ? new Date(nowMs) : new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const getPaidOrdersSum = (startMs: number, endMs: number) => {
      let sum = 0;
      let count = 0;
      (orders || []).forEach((o: any) => {
        if (o.payment_status === 'paid' && o.status !== 'cancelled' && o.created_at) {
          const t = new Date(o.created_at).getTime();
          if (t >= startMs && t <= endMs) {
            sum += Number(o.total_amount || 0);
            count++;
          }
        }
      });
      return { sum, count };
    };

    const getExpensesSum = (startMs: number, endMs: number) => {
      let sum = 0;
      let count = 0;
      (allExpenses || []).forEach((e: Expense) => {
        const t = getExpenseTime(e);
        if (t >= startMs && t <= endMs) {
          sum += Number(e.amount || 0);
          count++;
        }
      });
      return { sum, count };
    };

    const points: Array<{ name: string; revenue: number; expenses: number; net: number }> = [];
    let totalCount = 0;

    if (period === '7d') {
      const daysCount = 7;
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - i);
        const slotStart = d.getTime();
        const slotEnd = slotStart + 24 * 3600 * 1000 - 1;

        const rev = getPaidOrdersSum(slotStart, slotEnd);
        const exp = getExpensesSum(slotStart, slotEnd);
        totalCount += rev.count + exp.count;

        const rawDay = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
        const formattedDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1);
        points.push({
          name: formattedDay,
          revenue: rev.sum,
          expenses: exp.sum,
          net: rev.sum - exp.sum,
        });
      }
    } else if (period === '30d') {
      const weeksCount = 4;
      for (let i = weeksCount - 1; i >= 0; i--) {
        const weekStart = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - (i * 7 + 6));
        const weekEnd = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - (i * 7));
        const slotStart = weekStart.getTime();
        const slotEnd = weekEnd.getTime() + 24 * 3600 * 1000 - 1;

        const rev = getPaidOrdersSum(slotStart, slotEnd);
        const exp = getExpensesSum(slotStart, slotEnd);
        totalCount += rev.count + exp.count;

        points.push({
          name: `Sem ${weeksCount - i}`,
          revenue: rev.sum,
          expenses: exp.sum,
          net: rev.sum - exp.sum,
        });
      }
    } else if (period === '6m') {
      const monthsCount = 6;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const slotStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const slotEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

        const rev = getPaidOrdersSum(slotStart, slotEnd);
        const exp = getExpensesSum(slotStart, slotEnd);
        totalCount += rev.count + exp.count;

        const rawMonth = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
        points.push({
          name: formattedMonth,
          revenue: rev.sum,
          expenses: exp.sum,
          net: rev.sum - exp.sum,
        });
      }
    } else if (period === '12m') {
      const monthsCount = 12;
      for (let i = monthsCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const slotStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const slotEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

        const rev = getPaidOrdersSum(slotStart, slotEnd);
        const exp = getExpensesSum(slotStart, slotEnd);
        totalCount += rev.count + exp.count;

        const rawMonth = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const formattedMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
        points.push({
          name: formattedMonth,
          revenue: rev.sum,
          expenses: exp.sum,
          net: rev.sum - exp.sum,
        });
      }
    }

    return {
      points,
      hasData: totalCount > 0,
    };
  };

  // Real data for Bénéfice Net chart
  const beneficeNetChartResult = React.useMemo(() => {
    const { points, hasData } = getPeriodTimelinePoints(beneficePeriod);
    const data: Array<{ name: string; val: number }> = points.map((p) => ({
      name: p.name,
      val: p.net,
    }));
    return { data, hasData };
  }, [beneficePeriod, orders, allExpenses, nowMs]);

  // Real data for Perte chart (val = net < 0 ? net : 0)
  const perteChartResult = React.useMemo(() => {
    const { points, hasData } = getPeriodTimelinePoints(pertePeriod);
    const data: Array<{ name: string; val: number }> = points.map((p) => ({
      name: p.name,
      val: p.net < 0 ? p.net : 0,
    }));
    const totalLoss = points.reduce((sum, p) => (p.net < 0 ? sum + Math.abs(p.net) : sum), 0);
    return { data, hasData, totalLoss };
  }, [pertePeriod, orders, allExpenses, nowMs]);

  // Period ranges calculation based on periodFilter
  const { periodRange, previousPeriodRange } = React.useMemo(() => {
    const now = nowMs ? new Date(nowMs) : new Date();
    const currentNowMs = now.getTime();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 3600 * 1000 - 1;

    if (periodFilter === 'day') {
      const start = startOfToday;
      const end = endOfToday;
      const prevStart = start - 24 * 3600 * 1000;
      const prevEnd = end - 24 * 3600 * 1000;
      return {
        periodRange: { start, end, label: 'aujourd\'hui', prevLabel: 'hier' },
        previousPeriodRange: { start: prevStart, end: prevEnd },
      };
    }

    if (periodFilter === 'week') {
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon = 0
      const start = startOfToday - dayOfWeek * 24 * 3600 * 1000;
      const end = endOfToday;
      const prevStart = start - 7 * 24 * 3600 * 1000;
      const prevEnd = start - 1;
      return {
        periodRange: { start, end, label: 'cette semaine', prevLabel: 'semaine dernière' },
        previousPeriodRange: { start: prevStart, end: prevEnd },
      };
    }

    if (periodFilter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const end = endOfToday;
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
      return {
        periodRange: { start, end, label: 'ce mois', prevLabel: 'mois dernier' },
        previousPeriodRange: { start: prevStart, end: prevEnd },
      };
    }

    if (periodFilter === 'year') {
      const start = new Date(now.getFullYear(), 0, 1).getTime();
      const end = endOfToday;
      const prevStart = new Date(now.getFullYear() - 1, 0, 1).getTime();
      const prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime();
      return {
        periodRange: { start, end, label: 'cette année', prevLabel: 'année dernière' },
        previousPeriodRange: { start: prevStart, end: prevEnd },
      };
    }

    // 'all'
    return {
      periodRange: { start: 0, end: currentNowMs + 86400000, label: 'au total', prevLabel: 'période précédente' },
      previousPeriodRange: { start: 0, end: 0 },
    };
  }, [periodFilter, nowMs]);

  // Synchronized metrics for Revenue, Expenses and Net Profit using periodRange & previousPeriodRange
  const {
    filteredOrders,
    totalRevenue,
    prevRevenue,
    revenueDiff,
    revenuePctChange,
    filteredExpenses,
    totalExpenses,
    prevExpenses,
    expensesDiff,
    expensesPctChange,
    totalAllTimeExpenses,
    netProfit,
    prevNetProfit,
    netProfitDiff,
    netProfitPctChange,
  } = React.useMemo(() => {
    // 1. REVENUE (Paid & Non-cancelled Orders)
    const paidOrders = orders.filter(
      (o) => o.payment_status === 'paid' && o.status !== 'cancelled'
    );

    const currOrders = paidOrders.filter((o) => {
      if (periodFilter === 'all') return true;
      const t = o.created_at ? new Date(o.created_at).getTime() : 0;
      return t >= periodRange.start && t <= periodRange.end;
    });

    const prevOrders = paidOrders.filter((o) => {
      if (periodFilter === 'all') return false;
      const t = o.created_at ? new Date(o.created_at).getTime() : 0;
      return t >= previousPeriodRange.start && t <= previousPeriodRange.end;
    });

    const totRev = currOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const pRev = prevOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const rDiff = totRev - pRev;
    const rPct = pRev > 0
      ? ((totRev - pRev) / pRev) * 100
      : (totRev > 0 ? 100 : 0);

    // 2. EXPENSES
    const currExpList = allExpenses.filter((e) => {
      if (periodFilter === 'all') return true;
      const t = getExpenseTime(e);
      return t >= periodRange.start && t <= periodRange.end;
    });

    const prevExpList = allExpenses.filter((e) => {
      if (periodFilter === 'all') return false;
      const t = getExpenseTime(e);
      return t >= previousPeriodRange.start && t <= previousPeriodRange.end;
    });

    const totExp = currExpList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pExp = prevExpList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const eDiff = totExp - pExp;
    const ePct = pExp > 0
      ? ((totExp - pExp) / pExp) * 100
      : (totExp > 0 ? 100 : 0);

    const allTimeExp = allExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // 3. NET PROFIT (totalRevenue - totalExpenses)
    const np = totRev - totExp;
    const pNp = pRev - pExp;
    const npDiff = np - pNp;
    const npPct = pNp !== 0
      ? ((np - pNp) / Math.abs(pNp)) * 100
      : (np > 0 ? 100 : np < 0 ? -100 : 0);

    return {
      filteredOrders: currOrders,
      totalRevenue: totRev,
      prevRevenue: pRev,
      revenueDiff: rDiff,
      revenuePctChange: rPct,
      filteredExpenses: currExpList,
      totalExpenses: totExp,
      prevExpenses: pExp,
      expensesDiff: eDiff,
      expensesPctChange: ePct,
      totalAllTimeExpenses: allTimeExp,
      netProfit: np,
      prevNetProfit: pNp,
      netProfitDiff: npDiff,
      netProfitPctChange: npPct,
    };
  }, [orders, allExpenses, periodFilter, periodRange, previousPeriodRange]);

  // Cumulative All-time Net Worth (Total all-time paid revenue - Total all-time expenses)
  const cumulativeNetWorth = React.useMemo(() => {
    const totalAllTimeRevenue = orders
      .filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    return totalAllTimeRevenue - totalAllTimeExpenses;
  }, [orders, totalAllTimeExpenses]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 md:p-8 space-y-8 bg-slate-50/50 min-h-screen text-slate-800 font-sans"
    >
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finance</h1>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          {/* Global Period Filter */}
          <PeriodFilter
            value={periodFilter}
            onChange={setPeriodFilter}
            showLabel={true}
          />

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-slate-100/80 border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:bg-white transition-all"
            />
          </div>

          {/* Action Icons & Profile */}
          <div className="flex items-center gap-3 shrink-0">
            <button className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              <Moon className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                  alt="User"
                  width={32}
                  height={32}
                  unoptimized
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 1.5 KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Revenu */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Revenu</span>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalRevenue.toLocaleString('fr-FR')} {currency}
            </span>
          </div>
          <div>
            {periodFilter === 'all' ? (
              <div className="text-xs font-medium text-slate-400">
                <span>{filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''} payée{filteredOrders.length > 1 ? 's' : ''}</span>
              </div>
            ) : revenueDiff >= 0 ? (
              <div className="flex items-center text-xs font-semibold text-emerald-500">
                <span className="mr-1">↗</span>
                <span>
                  {prevRevenue === 0 && totalRevenue > 0
                    ? `+100% vs ${periodRange.prevLabel}`
                    : prevRevenue === 0 && totalRevenue === 0
                    ? `0% vs ${periodRange.prevLabel}`
                    : `+${revenuePctChange.toFixed(1)}% vs ${periodRange.prevLabel}`}
                </span>
              </div>
            ) : (
              <div className="flex items-center text-xs font-semibold text-rose-500">
                <span className="mr-1">↘</span>
                <span>{revenuePctChange.toFixed(1)}% vs {periodRange.prevLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Dépenses */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Dépenses</span>
            {filteredExpenses.length === 0 ? (
              <div>
                <span className="text-2xl font-bold text-slate-400 tracking-tight">0 {currency}</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">Aucune dépense enregistrée</span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-slate-900 tracking-tight">
                {totalExpenses.toLocaleString('fr-FR')} {currency}
              </span>
            )}
          </div>
          <div>
            {filteredExpenses.length === 0 ? (
              <div className="text-xs font-medium text-slate-400">
                <span>0 enregistrement</span>
              </div>
            ) : periodFilter === 'all' ? (
              <div className="text-xs font-medium text-slate-400">
                <span>{filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}</span>
              </div>
            ) : expensesDiff > 0 ? (
              <div className="flex items-center text-xs font-semibold text-rose-500">
                <span className="mr-1">↗</span>
                <span>
                  {prevExpenses === 0
                    ? `+100% vs ${periodRange.prevLabel}`
                    : `+${expensesPctChange.toFixed(1)}% vs ${periodRange.prevLabel}`}
                </span>
              </div>
            ) : expensesDiff < 0 ? (
              <div className="flex items-center text-xs font-semibold text-emerald-500">
                <span className="mr-1">↘</span>
                <span>{expensesPctChange.toFixed(1)}% vs {periodRange.prevLabel}</span>
              </div>
            ) : (
              <div className="flex items-center text-xs font-semibold text-slate-400">
                <span>0% vs {periodRange.prevLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Bénéfice Net */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Bénéfice Net</span>
            <span
              className={`text-2xl font-bold tracking-tight ${
                netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {netProfit.toLocaleString('fr-FR')} {currency}
            </span>
          </div>
          <div>
            {periodFilter === 'all' ? (
              <div className="text-xs font-medium text-slate-400">
                <span>Total historique (Revenu - Dépenses)</span>
              </div>
            ) : netProfitDiff >= 0 ? (
              <div className="flex items-center text-xs font-semibold text-emerald-500">
                <span className="mr-1">↗</span>
                <span>
                  {prevNetProfit === 0 && netProfit > 0
                    ? `+100% vs ${periodRange.prevLabel}`
                    : prevNetProfit === 0 && netProfit === 0
                    ? `0% vs ${periodRange.prevLabel}`
                    : `+${netProfitPctChange.toFixed(1)}% vs ${periodRange.prevLabel}`}
                </span>
              </div>
            ) : (
              <div className="flex items-center text-xs font-semibold text-rose-500">
                <span className="mr-1">↘</span>
                <span>{netProfitPctChange.toFixed(1)}% vs {periodRange.prevLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Patrimoine */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Patrimoine</span>
            <span
              className={`text-2xl font-bold tracking-tight ${
                cumulativeNetWorth >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              {cumulativeNetWorth.toLocaleString('fr-FR')} {currency}
            </span>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">
              Cumul depuis le début de l&apos;activité
            </span>
          </div>
        </div>
      </div>

      {/* 2. ROW 1: TRACK REVENUE & PROFIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BUDGET (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Budget</h3>
              <p className="text-xs text-slate-400 font-medium">Évolution de votre trésorerie</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                Période précédente
              </div>
              <div className="flex items-center gap-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9] inline-block" />
                Période actuelle
              </div>

              {/* Filter Buttons */}
              <PeriodFilter value={budgetPeriod} onChange={setBudgetPeriod} showLabel={false} />
            </div>
          </div>

          {/* Chart */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={budgetChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="recentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.10} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${Number(val || 0).toLocaleString('fr-FR')} ${currency}`,
                    name === 'recent' ? 'Période actuelle' : 'Période précédente',
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="recent"
                  stroke="#0EA5E9"
                  strokeWidth={2.5}
                  fill="url(#recentGradient)"
                  dot={{ r: 4, fill: '#0EA5E9', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#94a3b8' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BÉNÉFICE NET (1 col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Bénéfice Net</h3>
              <p className="text-xs text-slate-400 font-medium">Revenu moins dépenses sur la période</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative" ref={beneficeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsBeneficeDropdownOpen((prev) => !prev)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-between gap-2 cursor-pointer focus:outline-none transition-colors"
                >
                  <span>{DROPDOWN_PERIOD_OPTIONS.find((o) => o.id === beneficePeriod)?.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isBeneficeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isBeneficeDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-30 flex flex-col">
                    {DROPDOWN_PERIOD_OPTIONS.map((opt) => {
                      const isSelected = beneficePeriod === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setBeneficePeriod(opt.id);
                            setIsBeneficeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-slate-100 text-slate-900 font-bold'
                              : 'text-slate-600 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!beneficeNetChartResult.hasData ? (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-500">Pas encore de données pour cette période</p>
              <p className="text-[11px] text-slate-400 mt-1">Aucune commande payée ni dépense enregistrée sur cet intervalle.</p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={beneficeNetChartResult.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                    dy={4}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(val) => {
                      if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                      if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <Tooltip
                    formatter={(val: any) => [
                      `${Number(val || 0).toLocaleString('fr-FR')} ${currency}`,
                      Number(val) >= 0 ? 'Bénéfice net' : 'Déficit net'
                    ]}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                  <Bar dataKey="val" radius={[4, 4, 4, 4]} barSize={24}>
                    {beneficeNetChartResult.data.map((entry, index) => (
                      <Cell
                        key={`benefice-cell-${index}`}
                        fill={entry.val >= 0 ? '#1B4B4A' : '#B5451B'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 2.5 PERTE CHART */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Perte</h3>
            <p className="text-xs text-slate-400 font-medium">Jours où les dépenses dépassent le revenu</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={perteDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPerteDropdownOpen((prev) => !prev)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-between gap-2 cursor-pointer focus:outline-none transition-colors"
              >
                <span>{DROPDOWN_PERIOD_OPTIONS.find((o) => o.id === pertePeriod)?.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isPerteDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPerteDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-30 flex flex-col">
                  {DROPDOWN_PERIOD_OPTIONS.map((opt) => {
                    const isSelected = pertePeriod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setPertePeriod(opt.id);
                          setIsPerteDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-100 text-slate-900 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Total des pertes indicator */}
        <div className="mb-4">
          {perteChartResult.totalLoss === 0 ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Aucune perte sur cette période</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-100">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>
                Total des pertes sur la période : {perteChartResult.totalLoss.toLocaleString('fr-FR')} {currency}
              </span>
            </div>
          )}
        </div>

        {!perteChartResult.hasData ? (
          <div className="h-64 w-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500">Pas encore de données pour cette période</p>
            <p className="text-[11px] text-slate-400 mt-1">Aucune commande payée ni dépense enregistrée sur cet intervalle.</p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perteChartResult.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(val) => {
                    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                />
                <Tooltip
                  formatter={(val: any) => [
                    `${Number(val || 0).toLocaleString('fr-FR')} ${currency}`,
                    Number(val) < 0 ? 'Déficit / Perte' : 'Aucune perte'
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                <Bar dataKey="val" radius={[4, 4, 4, 4]} barSize={32}>
                  {perteChartResult.data.map((entry, index) => (
                    <Cell
                      key={`perte-cell-${index}`}
                      fill={entry.val >= 0 ? '#10B981' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 3. ROW 2: AVIS CLIENTS */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Avis Clients</h3>
            <p className="text-xs text-slate-400 font-medium">Volume et tendance de satisfaction par période</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500 text-white font-bold text-[11px] shadow-xs tracking-wide whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
              APERÇU — Données d&apos;exemple
            </div>

            <div className="relative" ref={avisDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAvisDropdownOpen((prev) => !prev)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center justify-between gap-2 cursor-pointer focus:outline-none transition-colors"
              >
                <span>{AVIS_PERIOD_OPTIONS.find((o) => o.id === avisPeriod)?.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isAvisDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isAvisDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-30 flex flex-col">
                  {AVIS_PERIOD_OPTIONS.map((opt) => {
                    const isSelected = avisPeriod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAvisPeriod(opt.id);
                          setIsAvisDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-100 text-slate-900 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-3 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C85A32]" /> Avis négatifs
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1B4B4A]" /> Avis positifs
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-[#F59E0B]" /> Tendance satisfaction
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={avisClientsDataMap[avisPeriod]} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <Tooltip
                formatter={(value: any, name: any) => {
                  const valNum = Number(value || 0);
                  if (name === 'avisPositifs') return [`${valNum} avis`, 'Avis positifs'];
                  if (name === 'avisNegatifs') return [`${Math.abs(valNum)} avis`, 'Avis négatifs'];
                  if (name === 'tendanceSatisfaction') return [`${valNum}%`, 'Tendance satisfaction'];
                  return [value, name];
                }}
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', border: 'none', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="avisPositifs" fill="#1B4B4A" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="avisNegatifs" fill="#C85A32" radius={[0, 0, 4, 4]} barSize={12} />
              <Line
                type="monotone"
                dataKey="tendanceSatisfaction"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. ROW 3: INVOICES & RECENTLY PAID INVOICES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* INVOICES (1 col) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-slate-900">Invoices</h3>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Donut Chart with center label */}
          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={invoicesPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {invoicesPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Donut Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">1.135</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Invoices</span>
            </div>
          </div>

          {/* Footer metrics */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Total Paid</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-slate-800">234</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Total Overdue</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-xs font-bold text-slate-800">234</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Total Unpaid</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-xs font-bold text-slate-800">234</span>
              </div>
            </div>
          </div>
        </div>

        {/* RECENTLY PAID INVOICES (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-bold text-slate-900">Recently paid invoices</h3>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Purchase
              </div>
              <div className="flex items-center gap-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-200" /> Paid
              </div>
              <div className="flex items-center gap-1.5 font-medium text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Average credit
              </div>

              <div className="relative">
                <select
                  value={paidPeriod}
                  onChange={(e) => setPaidPeriod(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none"
                >
                  <option value="Last 6 Months">Last 6 Months</option>
                  <option value="Last Year">Last Year</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={recentlyPaidInvoicesData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="purchase" fill="#06b6d4" barSize={18} radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" fill="#bae6fd" barSize={18} radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="averageCredit"
                  stroke="#4338ca"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#4338ca' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
