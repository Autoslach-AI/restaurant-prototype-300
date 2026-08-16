'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  ListFilter,
  Package,
  Users,
  Bot,
  Settings,
  User,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Send,
  Lock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Smartphone,
  Sparkles,
  Check,
  X,
  CreditCard,
  Building2,
  Mail,
  Shield,
  ShieldCheck,
  UserPlus,
  Clock,
  Phone,
  Key,
  Bell,
  Eye,
  EyeOff,
  Menu,
  ArrowLeft,
  ArrowUpRight,
  AlertCircle,
  AlertTriangle,
  Info,
  MessageSquareWarning,
  TrendingDown,
  Percent,
  Truck,
  Navigation,
  Store,
  Star,
  MapPin,
  Calendar,
  FileText,
  Video,
  Smile,
  Paperclip,
  Mic,
  SquarePen,
  ShoppingBag,
  Globe,
  Cpu,
  RotateCcw,
  FolderPlus,
  Folder,
  FolderOpen,
  MessageSquare,
  Camera,
  Upload,
  Loader2,
} from 'lucide-react';
import { uploadStaffAvatar, fetchAttendanceRecords, upsertAttendanceRecord, updateStaffProfile, supabase } from '@/lib/supabase';
import {
  Business,
  Category,
  Product,
  Order,
  AgentEvent,
  OrderStatus,
  StaffPermissions,
  Staff,
  DeliveryZone,
  AgentChatMessageAttachment,
  AttendanceRecord,
  AttendanceStatus,
} from '@/lib/types';
import { getStore } from '@/lib/store';
import PeriodFilter from '@/components/ui/period-filter';
import ConversionDetailSection from '@/components/ui/conversion-detail-section';
import FinanceSection from '@/components/FinanceSection';
import { ImageCropperModal } from '@/components/ImageCropperModal';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface MerchantDashboardProps {
  business: Business;
  categories: Category[];
  products: Product[];
  orders: Order[];
  agentEvents: AgentEvent[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onProcessPayment: (orderId: string, reference: string) => void;
  onTriggerRelance: (orderId: string) => void;
  onSaveProduct: (productData: Partial<Product> & { name: string; price: number; category_id: string }) => void;
  onDeleteProduct: (productId: string) => void;
  onSaveCategory: (name: string, categoryId?: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onUpdateConfig: (newConfig: Partial<Business['config']>, newDetails?: Partial<Business>) => void;
  onToggleWhatsAppSim: () => void;
}

type TabType = 'overview' | 'finance' | 'orders' | 'products' | 'customers' | 'agent' | 'settings' | 'profile' | 'conversion' | 'team' | 'attendance';

export default function MerchantDashboard({
  business,
  categories,
  products,
  orders,
  agentEvents,
  onUpdateOrderStatus,
  onProcessPayment,
  onTriggerRelance,
  onSaveProduct,
  onDeleteProduct,
  onSaveCategory,
  onDeleteCategory,
  onUpdateConfig,
  onToggleWhatsAppSim,
}: MerchantDashboardProps) {
  const store = getStore();

  // Active Tab & Collapsible Sidebar State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activityPeriod, setActivityPeriod] = useState<'jour' | 'semaine' | 'mois' | 'annee'>('semaine');
  const [showSecretKey, setShowSecretKey] = useState(false);

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

  // Status helper mapping functions for consistent French labels & colors across the page
  const getStatusLabel = (status: OrderStatus | string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'Confirmée';
      case 'preparing':
      case 'ready':
        return 'En cours';
      case 'delivered':
        return 'Livrée';
      case 'cancelled':
        return 'Annulée';
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: OrderStatus | string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'bg-[#EBF3F3] text-[#1B4B4A] border-[#1B4B4A]/30';
      case 'preparing':
      case 'ready':
        return 'bg-[#FBF4E8] text-[#C88A2E] border-[#C88A2E]/30';
      case 'delivered':
        return 'bg-[#F8EFEA] text-[#B5451B] border-[#B5451B]/30';
      case 'cancelled':
        return 'bg-[#FCECEB] text-[#A63A2F] border-[#A63A2F]/30';
      default:
        return 'bg-[#F4EFE6] text-[#6B6259] border-[#E5DCD0]';
    }
  };

  const getStatusSelectClass = (status: OrderStatus | string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'bg-[#EBF3F3] text-[#1B4B4A] border-[#1B4B4A]/40 focus:border-[#1B4B4A]';
      case 'preparing':
      case 'ready':
        return 'bg-[#FBF4E8] text-[#C88A2E] border-[#C88A2E]/40 focus:border-[#C88A2E]';
      case 'delivered':
        return 'bg-[#F8EFEA] text-[#B5451B] border-[#B5451B]/40 focus:border-[#B5451B]';
      case 'cancelled':
        return 'bg-[#FCECEB] text-[#A63A2F] border-[#A63A2F]/40 focus:border-[#A63A2F]';
      default:
        return 'bg-[#F4EFE6] text-[#241F1B] border-[#E5DCD0]';
    }
  };

  const getStatusTabActiveClass = (status: string) => {
    switch (status) {
      case 'all':
        return 'bg-[#241F1B] text-white shadow-2xs font-black';
      case 'pending':
      case 'confirmed':
        return 'bg-[#1B4B4A] text-white shadow-2xs font-black';
      case 'preparing':
      case 'ready':
        return 'bg-[#C88A2E] text-white shadow-2xs font-black';
      case 'delivered':
        return 'bg-[#B5451B] text-white shadow-2xs font-black';
      case 'cancelled':
        return 'bg-[#A63A2F] text-white shadow-2xs font-black';
      default:
        return 'bg-[#241F1B] text-white shadow-2xs font-black';
    }
  };

  const getStatusTabInactiveClass = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'bg-[#EBF3F3] text-[#1B4B4A] hover:bg-[#1B4B4A]/15 border border-[#1B4B4A]/20';
      case 'preparing':
      case 'ready':
        return 'bg-[#FBF4E8] text-[#C88A2E] hover:bg-[#C88A2E]/15 border border-[#C88A2E]/20';
      case 'delivered':
        return 'bg-[#F8EFEA] text-[#B5451B] hover:bg-[#B5451B]/15 border border-[#B5451B]/20';
      case 'cancelled':
        return 'bg-[#FCECEB] text-[#A63A2F] hover:bg-[#A63A2F]/15 border border-[#A63A2F]/20';
      default:
        return 'bg-[#F4EFE6] text-[#6B6259] hover:text-[#241F1B] hover:bg-[#E5DCD0]/60';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getOrderAlert = (ord: Order) => {
    const startTime = new Date(ord.updated_at || ord.created_at).getTime();

    const hasRelance = businessEvents.some((e) => e.order_id === ord.id && (e.event_type === 'relance_sent' || e.event_type === 'follow_up_sent'));
    if ((ord.status === 'confirmed' || ord.status === 'preparing') && hasRelance) {
      return {
        type: 'relance',
        title: '💬 Relance WhatsApp transmise (sans réponse)',
        description: "L'agent commercial a envoyé un message de relance au client. En attente de réponse.",
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
        iconClass: 'text-amber-600',
      };
    }

    if ((ord.status === 'preparing' || ord.status === 'ready') && nowMs - startTime >= 45 * 60 * 1000) {
      const minutes = Math.floor((nowMs - startTime) / 60000);
      return {
        type: 'preparing_45m',
        title: '⏳ En cours depuis plus de 45 min',
        description: `En cours depuis ${minutes} minute${minutes > 1 ? 's' : ''}. Risque d'insatisfaction client.`,
        badgeClass: 'bg-orange-50 text-orange-900 border-orange-300',
        iconClass: 'text-orange-600',
      };
    }

    return null;
  };

  // Active Staff Member & Staff List
  const activeStaff = store.getActiveStaff();
  const businessStaff = store.getStaffForBusiness(business.id);

  // Order Detail Card Modal state
  const [selectedModalOrderId, setSelectedModalOrderId] = useState<string | null>(null);

  // Double-click enlarged modals state for photo & comment cells
  const [enlargedPhoto, setEnlargedPhoto] = useState<{ url?: string; name: string } | null>(null);
  const [enlargedComment, setEnlargedComment] = useState<{
    comment: string;
    rating?: number | null;
    internalNote?: string | null;
    name: string;
    orderId: string;
  } | null>(null);

  // Order filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [alertCategoryFilter, setAlertCategoryFilter] = useState<'all' | 'urgent_undelivered' | 'preparing_45m'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'wave' | 'orange' | 'card'>('all');
  const [orderPeriodFilter, setOrderPeriodFilter] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('all');
  const [hasRatingFilter, setHasRatingFilter] = useState<boolean>(false);
  const [ordersCurrentPage, setOrdersCurrentPage] = useState<number>(1);

  // Conversion filter
  const [conversionPeriod, setConversionPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'recurrent' | 'inactive'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Team page state
  const [teamSearch, setTeamSearch] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState<string>('all');
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
  const [teamSortActive, setTeamSortActive] = useState<boolean>(true);

  // Attendance / Pointage state
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<Record<string, AttendanceRecord>>({});
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all');
  const [selectedAttendanceMember, setSelectedAttendanceMember] = useState<(typeof allTeamRows)[number] | null>(null);
  const [attendanceHistoryFilter, setAttendanceHistoryFilter] = useState<string>('all');
  const [attendance30DaysRecords, setAttendance30DaysRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceReasonModal, setAttendanceReasonModal] = useState<{
    isOpen: boolean;
    staff: Staff | null;
    status: 'absent' | 'late';
    reason: string;
  }>({
    isOpen: false,
    staff: null,
    status: 'absent',
    reason: '',
  });

  // Product modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Staff Invite / Edit Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const [staffTab, setStaffTab] = useState<'active' | 'revoked'>('active');
  const [revokingStaffMember, setRevokingStaffMember] = useState<Staff | null>(null);
  const [revocationReasonInput, setRevocationReasonInput] = useState('');
  const [viewingReasonStaff, setViewingReasonStaff] = useState<Staff | null>(null);
  const [invitePhotoUrl, setInvitePhotoUrl] = useState('');
  const [invitePhotoUploading, setInvitePhotoUploading] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRoleTitle, setInviteRoleTitle] = useState('');
  const [inviteSalary, setInviteSalary] = useState<number | string>(250000);
  const [invitePerms, setInvitePerms] = useState<StaffPermissions>({
    orders: true,
    products: true,
    customers: true,
    agent: false,
    settings: false,
    staff: false,
    finance: false,
  });

  // Staff Edit Modal
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editRoleTitle, setEditRoleTitle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSalary, setEditSalary] = useState<number | string>(0);
  const [editPerms, setEditPerms] = useState<StaffPermissions>({
    orders: false,
    products: false,
    customers: false,
    agent: false,
    settings: false,
    staff: false,
    finance: false,
  });

  // Team Member Slide-over detail panel
  const [selectedTeamMemberForDetail, setSelectedTeamMemberForDetail] = useState<(typeof allTeamRows)[number] | null>(null);

  // Delivery Zone Modal state
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone> | null>(null);
  const [deletingZone, setDeletingZone] = useState<DeliveryZone | null>(null);

  // Order Cancellation Reason Modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');

  // Business Profile Settings Form
  const [bizName, setBizName] = useState(business.name);
  const [bizWhatsapp, setBizWhatsapp] = useState(business.whatsapp_number);
  const [bizCurrency, setBizCurrency] = useState(business.currency);

  // Payment Gateway Form state
  const initialGw = store.getPaymentGateway(business.id);
  const initialChs = store.getPaymentChannels(business.id);

  const [gwProvider, setGwProvider] = useState<'paydunya' | 'cinetpay'>(initialGw.provider);
  const [gwPublicKey, setGwPublicKey] = useState(initialGw.public_key || '');
  const [gwSecretKey, setGwSecretKey] = useState(initialGw.secret_key || '');

  // Payment Channels Form state
  const [channelStates, setChannelStates] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    initialChs.forEach((c) => {
      map[c.id] = c.enabled;
    });
    return map;
  });

  // Sync settings state when business changes (React recommended pattern: adjust state during render on key change)
  const [prevBizId, setPrevBizId] = useState(business.id);
  if (prevBizId !== business.id) {
    setPrevBizId(business.id);
    setBizName(business.name);
    setBizWhatsapp(business.whatsapp_number);
    setBizCurrency(business.currency);
    const gw = store.getPaymentGateway(business.id);
    setGwProvider(gw.provider);
    setGwPublicKey(gw.public_key || '');
    setGwSecretKey(gw.secret_key || '');
    const chs = store.getPaymentChannels(business.id);
    const map: Record<string, boolean> = {};
    chs.forEach((c) => {
      map[c.id] = c.enabled;
    });
    setChannelStates(map);
  }

  // Attendance logic and effect
  const todayStr = new Date().toISOString().split('T')[0];
  const canMarkAttendance =
    activeStaff.role === 'owner' ||
    Boolean(activeStaff.permissions?.staff) ||
    Boolean(activeStaff.permissions?.settings);

  useEffect(() => {
    let isMounted = true;
    async function loadTodayAttendance() {
      if (!business?.id) return;
      const records = await fetchAttendanceRecords(business.id, todayStr, todayStr);
      if (!isMounted) return;
      const map: Record<string, AttendanceRecord> = {};
      records.forEach((r) => {
        map[r.staff_id] = r;
      });
      setTodayAttendanceMap(map);
    }
    loadTodayAttendance();
    return () => {
      isMounted = false;
    };
  }, [business.id, activeTab, todayStr]);

  // Load 30-day attendance history for selected member
  useEffect(() => {
    let isMounted = true;
    async function load30DaysHistory() {
      if (!business?.id || !selectedAttendanceMember) return;
      const endDateStr = todayStr;
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - 29);
      const startDateStr = startDateObj.toISOString().split('T')[0];

      const records = await fetchAttendanceRecords(business.id, startDateStr, endDateStr);
      if (!isMounted) return;
      setAttendance30DaysRecords(records);
    }
    load30DaysHistory();
    return () => {
      isMounted = false;
    };
  }, [business?.id, selectedAttendanceMember, todayStr]);

  const last30DaysList = React.useMemo(() => {
    if (!selectedAttendanceMember) return [];
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const rec30 = attendance30DaysRecords.find(
        (r) => r.staff_id === selectedAttendanceMember.id && r.date === dateStr
      );
      const recToday = dateStr === todayStr ? todayAttendanceMap[selectedAttendanceMember.id] : null;
      const effectiveRecord = recToday || rec30;

      days.push({
        dateStr,
        dateObj: d,
        status: (effectiveRecord?.status as 'present' | 'absent' | 'late' | 'unmarked') || 'unmarked',
        reason: effectiveRecord?.reason || null,
      });
    }
    return days;
  }, [selectedAttendanceMember, attendance30DaysRecords, todayAttendanceMap, todayStr]);

  const historySummary = React.useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let unmarked = 0;

    last30DaysList.forEach((item) => {
      if (item.status === 'present') present++;
      else if (item.status === 'absent') absent++;
      else if (item.status === 'late') late++;
      else unmarked++;
    });

    return { present, absent, late, unmarked };
  }, [last30DaysList]);

  const filtered30DaysList = React.useMemo(() => {
    if (attendanceHistoryFilter === 'all') return last30DaysList;
    return last30DaysList.filter((item) => item.status === attendanceHistoryFilter);
  }, [last30DaysList, attendanceHistoryFilter]);

  const formatDateFr = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      const formatted = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return dateStr;
    }
  };

  const handleMarkAttendanceStatus = async (
    staffId: string,
    status: 'present' | 'absent' | 'late',
    reason?: string | null
  ) => {
    if (!canMarkAttendance) return;
    const trimmedReason = reason?.trim() || null;

    const optimisticRecord: AttendanceRecord = {
      id: todayAttendanceMap[staffId]?.id || 'temp_' + Date.now(),
      business_id: business.id,
      staff_id: staffId,
      date: todayStr,
      status,
      reason: trimmedReason,
      created_at: new Date().toISOString(),
    };
    setTodayAttendanceMap((prev) => ({ ...prev, [staffId]: optimisticRecord }));

    const saved = await upsertAttendanceRecord({
      business_id: business.id,
      staff_id: staffId,
      date: todayStr,
      status,
      reason: trimmedReason,
    });

    if (saved) {
      setTodayAttendanceMap((prev) => ({ ...prev, [staffId]: saved }));
    }
  };

  const handleOpenAttendanceReasonModal = (staff: Staff, status: 'absent' | 'late') => {
    if (!canMarkAttendance) return;
    const existing = todayAttendanceMap[staff.id];
    setAttendanceReasonModal({
      isOpen: true,
      staff,
      status,
      reason: existing?.reason || '',
    });
  };

  const handleSaveAttendanceReasonModal = async () => {
    if (!attendanceReasonModal.staff) return;
    await handleMarkAttendanceStatus(
      attendanceReasonModal.staff.id,
      attendanceReasonModal.status,
      attendanceReasonModal.reason
    );
    setAttendanceReasonModal({ isOpen: false, staff: null, status: 'absent', reason: '' });
  };

  // Settings modification detection
  const currentGw = store.getPaymentGateway(business.id);
  const currentChs = store.getPaymentChannels(business.id);

  const isGeneralChanged =
    bizName !== business.name ||
    bizWhatsapp !== business.whatsapp_number ||
    bizCurrency !== business.currency;

  const isGatewayChanged =
    gwProvider !== currentGw.provider ||
    gwPublicKey !== (currentGw.public_key || '') ||
    gwSecretKey !== (currentGw.secret_key || '');

  const isChannelsChanged = currentChs.some(
    (c) => (channelStates[c.id] ?? c.enabled) !== c.enabled
  );

  const hasSettingsChanges = isGeneralChanged || isGatewayChanged || isChannelsChanged;

  const handleSaveAllSettings = () => {
    if (isGeneralChanged) {
      onUpdateConfig({}, { name: bizName, whatsapp_number: bizWhatsapp, currency: bizCurrency });
    }
    if (isGatewayChanged) {
      store.updatePaymentGateway(gwProvider, gwPublicKey, gwSecretKey);
    }
    currentChs.forEach((c) => {
      const isEnabled = channelStates[c.id] ?? c.enabled;
      if (isEnabled !== c.enabled) {
        store.updatePaymentChannel(c.id, isEnabled);
      }
    });
  };

  const handleCancelSettingsChanges = () => {
    setBizName(business.name);
    setBizWhatsapp(business.whatsapp_number);
    setBizCurrency(business.currency);
    const gw = store.getPaymentGateway(business.id);
    setGwProvider(gw.provider);
    setGwPublicKey(gw.public_key || '');
    setGwSecretKey(gw.secret_key || '');
    const chs = store.getPaymentChannels(business.id);
    const map: Record<string, boolean> = {};
    chs.forEach((c) => {
      map[c.id] = c.enabled;
    });
    setChannelStates(map);
  };

  // Message template editor states
  const [templates, setTemplates] = useState(business.config.message_templates);

  // Webhook tester form
  const [testOrderId, setTestOrderId] = useState('');
  const [testPaymentRef, setTestPaymentRef] = useState(() => 'WAVE_REF_' + Math.floor(100000 + Math.random() * 900000));
  const [webhookLogs, setWebhookLogs] = useState<string[]>([]);

  // Profile Edit Form States
  const [activeProfileSection, setActiveProfileSection] = useState<'personal' | 'security' | 'notifications' | 'billing'>('personal');
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const [isProfileAvatarZoomOpen, setIsProfileAvatarZoomOpen] = useState(false);
  // Shared Image Cropper state for Profile & Staff Invite
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'profile' | 'staff_invite'>('profile');
  const [cropSaving, setCropSaving] = useState(false);

  // Split Name helper
  const splitStaffName = (fullName: string) => {
    const parts = (fullName || '').trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  };

  // Personal Info Form State
  const initialNames = splitStaffName(activeStaff.name);
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [profileEditFirstName, setProfileEditFirstName] = useState(initialNames.firstName);
  const [profileEditLastName, setProfileEditLastName] = useState(initialNames.lastName);
  const [profileEditEmail, setProfileEditEmail] = useState(activeStaff.email || '');
  const [profileEditPhone, setProfileEditPhone] = useState(activeStaff.phone || '');
  const [personalInfoSaving, setPersonalInfoSaving] = useState(false);
  const [personalInfoError, setPersonalInfoError] = useState<string | null>(null);
  const [personalInfoSuccess, setPersonalInfoSuccess] = useState(false);

  // Synchronize personal info with activeStaff when not actively editing
  useEffect(() => {
    if (!isEditingPersonalInfo) {
      const names = splitStaffName(activeStaff.name);
      setProfileEditFirstName(names.firstName);
      setProfileEditLastName(names.lastName);
      setProfileEditEmail(activeStaff.email || '');
      setProfileEditPhone(activeStaff.phone || '');
      setPersonalInfoError(null);
    }
  }, [activeStaff.name, activeStaff.email, activeStaff.phone, isEditingPersonalInfo]);

  const handleCancelPersonalInfo = () => {
    const names = splitStaffName(activeStaff.name);
    setProfileEditFirstName(names.firstName);
    setProfileEditLastName(names.lastName);
    setProfileEditEmail(activeStaff.email || '');
    setProfileEditPhone(activeStaff.phone || '');
    setPersonalInfoError(null);
    setIsEditingPersonalInfo(false);
  };

  const handleSavePersonalInfo = async () => {
    setPersonalInfoError(null);
    const trimmedFirst = profileEditFirstName.trim();
    const trimmedLast = profileEditLastName.trim();
    const trimmedEmail = profileEditEmail.trim();
    const trimmedPhone = profileEditPhone.trim();

    // Validation
    if (!trimmedLast) {
      setPersonalInfoError('Le nom est obligatoire.');
      return;
    }
    if (!trimmedFirst) {
      setPersonalInfoError('Le prénom est obligatoire.');
      return;
    }
    if (!trimmedEmail) {
      setPersonalInfoError('L\'adresse email est obligatoire.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setPersonalInfoError('Veuillez saisir une adresse email valide (ex: amadou@example.com).');
      return;
    }
    if (!trimmedPhone) {
      setPersonalInfoError('Le numéro de téléphone est obligatoire.');
      return;
    }

    setPersonalInfoSaving(true);
    const combinedName = `${trimmedFirst} ${trimmedLast}`;

    try {
      const res = await updateStaffProfile(activeStaff.id, activeStaff.auth_uid, {
        name: combinedName,
        email: trimmedEmail,
        phone: trimmedPhone,
      });

      if (!res.success) {
        setPersonalInfoError(res.error || 'Erreur lors de la mise à jour des informations.');
      } else {
        setIsEditingPersonalInfo(false);
        setPersonalInfoSuccess(true);
        setTimeout(() => setPersonalInfoSuccess(false), 3500);
      }
    } catch (err: any) {
      setPersonalInfoError(err?.message || 'Une erreur inattendue est survenue.');
    } finally {
      setPersonalInfoSaving(false);
    }
  };

  // Security / Password State
  const [securityCurrentPassword, setSecurityCurrentPassword] = useState('');
  const [securityNewPassword, setSecurityNewPassword] = useState('');
  const [securityConfirmPassword, setSecurityConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  const formatLastLogin = (isoString?: string | null) => {
    if (!isoString) return 'Non disponible';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Non disponible';
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Non disponible';
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    const currentPass = securityCurrentPassword.trim();
    const newPassVal = securityNewPassword.trim();
    const confirmPassVal = securityConfirmPassword.trim();

    if (!currentPass) {
      setSecurityError('Veuillez renseigner votre mot de passe actuel pour confirmer votre identité.');
      return;
    }
    if (!newPassVal) {
      setSecurityError('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (newPassVal.length < 8) {
      setSecurityError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassVal !== confirmPassVal) {
      setSecurityError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSecuritySaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassVal,
      });

      if (error) {
        setSecurityError(error.message || 'Erreur lors de la mise à jour du mot de passe.');
      } else {
        setSecuritySuccess('Votre mot de passe a été mis à jour avec succès.');
        setSecurityCurrentPassword('');
        setSecurityNewPassword('');
        setSecurityConfirmPassword('');
        setTimeout(() => setSecuritySuccess(null), 5000);
      }
    } catch (err: any) {
      setSecurityError(err?.message || 'Une erreur inattendue est survenue.');
    } finally {
      setSecuritySaving(false);
    }
  };

  const [profileName, setProfileName] = useState(activeStaff.name);
  const [profileEmail, setProfileEmail] = useState(activeStaff.email);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Agent Chat / Claude-style Sidebar UI State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [newProjectInput, setNewProjectInput] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showTrashSection, setShowTrashSection] = useState(false);
  const [isTrashViewOpen, setIsTrashViewOpen] = useState(false);
  const [agentChatInput, setAgentChatInput] = useState('');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<AgentChatMessageAttachment[]>([]);
  const agentFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeConversations = store.agentConversations.filter((c) => c.status === 'active');
  const trashedConversations = store.agentConversations.filter((c) => c.status === 'trashed');
  const currentConversation = activeConversations.find((c) => c.id === selectedConversationId);
  const currentMessages = selectedConversationId
    ? store.agentMessages.filter((m) => m.conversation_id === selectedConversationId)
    : [];

  const handleAgentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newAttachment: AgentChatMessageAttachment = {
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: dataUrl,
        };
        setStagedAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    if (agentFileInputRef.current) {
      agentFileInputRef.current.value = '';
    }
  };

  const handleSendAgentMessage = (promptText?: string) => {
    const textToSend = (promptText || agentChatInput).trim();
    if (!textToSend && stagedAttachments.length === 0) return;

    const currentAttachments = [...stagedAttachments];

    let targetConvId = selectedConversationId;
    const currentConv = activeConversations.find((c) => c.id === targetConvId);

    if (!currentConv) {
      const fallbackTitle = textToSend
        ? (textToSend.length > 30 ? textToSend.substring(0, 30) + '...' : textToSend)
        : (currentAttachments[0]?.name || 'Nouvelle discussion');
      const newConv = store.createAgentConversation(null, fallbackTitle);
      targetConvId = newConv.id;
      setSelectedConversationId(newConv.id);
    }

    const displayText = textToSend || (currentAttachments.length === 1 ? `Fichier joint : ${currentAttachments[0].name}` : `${currentAttachments.length} fichiers joints`);

    store.addAgentChatMessage(targetConvId!, 'user', displayText, currentAttachments);

    const lower = textToSend.toLowerCase();
    let responseText = "Cette fonctionnalité n'est pas encore connectée à un moteur de réponse conversationnel — disponible prochainement.";

    if (currentAttachments.length > 0) {
      responseText = `J'ai bien reçu vos ${currentAttachments.length} pièce(s) jointe(s) (${currentAttachments.map(a => a.name).join(', ')}). Le document a été analysé.`;
      if (textToSend) {
        responseText += `\n\nEn ce qui concerne votre message : "${textToSend}" — l'analyse est en cours.`;
      }
    } else if (lower.includes('commande') || lower.includes('order')) {
      responseText = `Vous avez actuellement ${businessOrders.length} commande(s) enregistrée(s) dans votre espace gérant.`;
    } else if (lower.includes('client') || lower.includes('customer')) {
      responseText = `Votre base client compte ${businessCustomers.length} client(s) répertorié(s).`;
    } else if (lower.includes('produit') || lower.includes('stock') || lower.includes('catalog')) {
      responseText = `Votre catalogue contient ${businessProducts.length} produit(s) actif(s).`;
    } else if (lower.includes('projet') || lower.includes('ia') || lower.includes('lancer')) {
      responseText = `Projet IA initié pour ${business.name}. Votre assistant virtuel surveille vos commandes et interactions clients en temps réel.`;
    }

    store.addAgentChatMessage(targetConvId!, 'assistant', responseText);
    setAgentChatInput('');
    setStagedAttachments([]);
    setShowPlusMenu(false);
  };

  const handleStartNewConversation = (projectId: string | null = null) => {
    setIsTrashViewOpen(false);
    const newConv = store.createAgentConversation(projectId, 'Nouvelle discussion');
    setSelectedConversationId(newConv.id);
  };

  const handleCreateProject = () => {
    if (!newProjectInput.trim()) return;
    store.createAgentProject(newProjectInput.trim());
    setNewProjectInput('');
    setShowNewProjectForm(false);
  };

  const handleRenameProject = (projectId: string) => {
    if (!editingProjectName.trim()) return;
    store.renameAgentProject(projectId, editingProjectName.trim());
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  // Filtered lists
  const businessOrders = orders.filter((o) => o.business_id === business.id);
  const businessProducts = products.filter((p) => p.business_id === business.id);
  const businessCategories = categories.filter((c) => c.business_id === business.id);
  const businessEvents = agentEvents.filter((e) => e.business_id === business.id);
  const businessCustomers = store.customers.filter((c) => c.business_id === business.id);

  // Filter agent events for manager attention only (anomalies, errors, relance failures, payment discrepancies)
  const attentionAgentEvents = businessEvents.filter((evt) => {
    const type = (evt.event_type || '').toLowerCase();
    const msg = (evt.payload?.message || '').toLowerCase();

    // Exclude routine order confirmations
    if (type === 'order_confirmed' || type === 'order_alert_sent' || type === 'order_created') {
      return false;
    }

    // Include error/alert/anomaly/unanswered events
    if (
      type.includes('error') ||
      type.includes('fail') ||
      type.includes('anomaly') ||
      type.includes('mismatch') ||
      type.includes('alert') ||
      type.includes('warning') ||
      type.includes('discrepancy') ||
      type.includes('no_response') ||
      type.includes('unanswered')
    ) {
      return true;
    }

    if (
      msg.includes('échec') ||
      msg.includes('erreur') ||
      msg.includes('sans réponse') ||
      msg.includes('écart') ||
      msg.includes('anomalie') ||
      msg.includes('problème') ||
      msg.includes('non reçu') ||
      msg.includes('mismatch') ||
      msg.includes('impayé')
    ) {
      return true;
    }

    return false;
  });

  // Helper to render staff avatar (image or letter initial with distinct color palette)
  const renderStaffAvatar = (staffName: string) => {
    const member = businessStaff.find(
      (s) => s.name.toLowerCase() === staffName.toLowerCase()
    );
    const photo = member?.photo_url || member?.avatar_url;
    const initial = (staffName.trim().charAt(0) || 'M').toUpperCase();

    if (photo) {
      return (
        <img
          src={photo}
          alt={staffName}
          className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200"
        />
      );
    }

    const key = staffName.toLowerCase();
    let colorClass = 'bg-[#B5451B]/15 text-[#B5451B] border-[#B5451B]/30'; // Terracotta
    if (key.includes('aïssatou') || key.includes('aissatou')) {
      colorClass = 'bg-[#B5451B]/15 text-[#B5451B] border-[#B5451B]/30'; // Terracotta
    } else if (key.includes('amadou')) {
      colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-300'; // Vert / Emerald
    } else if (key.includes('fatou') || key.includes('moussa')) {
      colorClass = 'bg-amber-100 text-amber-900 border-amber-300'; // Moutarde
    } else {
      colorClass = 'bg-cyan-100 text-cyan-900 border-cyan-300'; // Bleu-vert
    }

    return (
      <div
        className={`w-5 h-5 rounded-full ${colorClass} border flex items-center justify-center font-black text-[9px] shrink-0`}
      >
        {initial}
      </div>
    );
  };

  // Live timestamp state for real-time sub-alerts
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

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

  const filteredOrders = businessOrders.filter((o) => {
    // 1. Payment channel filter
    if (paymentMethodFilter !== 'all') {
      const m = (o.payment_method || '').toLowerCase();
      if (paymentMethodFilter === 'wave' && !m.includes('wave')) return false;
      if (paymentMethodFilter === 'orange' && !m.includes('orange') && !m.includes('om')) return false;
      if (paymentMethodFilter === 'card' && !m.includes('card') && !m.includes('carte')) return false;
    }

    // 2. Order date period filter
    const orderTime = new Date(o.created_at).getTime();
    if (orderPeriodFilter === 'day') {
      if (orderTime < startOfTodayMs) return false;
    } else if (orderPeriodFilter === 'week') {
      if (orderTime < nowMs - 7 * 24 * 60 * 60 * 1000) return false;
    } else if (orderPeriodFilter === 'month') {
      if (orderTime < nowMs - 30 * 24 * 60 * 60 * 1000) return false;
    } else if (orderPeriodFilter === 'year') {
      if (orderTime < nowMs - 365 * 24 * 60 * 60 * 1000) return false;
    }

    // 3. Alert category filter
    if (alertCategoryFilter === 'urgent_undelivered') {
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      if ((o.priority_level || '').toLowerCase() !== 'urgent') return false;
    } else if (alertCategoryFilter === 'preparing_45m') {
      if (o.status !== 'preparing' && o.status !== 'ready') return false;
      const startTime = new Date(o.updated_at || o.created_at).getTime();
      if (nowMs - startTime < 45 * 60 * 1000) return false;
    } else {
      if (statusFilter !== 'all') {
        if (statusFilter === 'preparing') {
          if (o.status !== 'preparing' && o.status !== 'ready') return false;
        } else if (o.status !== statusFilter) {
          return false;
        }
      }
    }

    // 3.5 Rating filter
    if (hasRatingFilter) {
      if (o.status !== 'delivered' || o.rating == null || typeof o.rating !== 'number' || o.rating <= 0) {
        return false;
      }
    }

    // 4. Search query
    if (orderSearch.trim() !== '') {
      const q = orderSearch.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.includes(q))
      );
    }
    return true;
  });

  const loyalCustomers = businessCustomers.filter((cust) => {
    const custOrdersCount = businessOrders.filter(
      (o) => o.customer_id === cust.id || o.customer_phone === cust.phone
    ).length;
    return custOrdersCount > 1;
  });

  const inactiveCustomers = businessCustomers.filter((cust) => {
    const custOrders = businessOrders.filter(
      (o) => o.customer_id === cust.id || o.customer_phone === cust.phone
    );
    if (custOrders.length < 2) return false;
    const latestOrderMs = Math.max(...custOrders.map((o) => new Date(o.created_at).getTime()));
    const daysSinceLast = Math.floor((nowMs - latestOrderMs) / (24 * 60 * 60 * 1000));
    return daysSinceLast > 21;
  });

  const loyaltyRate =
    businessCustomers.length > 0 ? (loyalCustomers.length / businessCustomers.length) * 100 : 0;

  // Rated orders metrics (delivered + rating != null)
  const allRatedOrders = businessOrders.filter(
    (o) => o.status === 'delivered' && o.rating != null && typeof o.rating === 'number' && o.rating > 0
  );
  const totalRatedCount = allRatedOrders.length;
  const avgRatingAllTime =
    totalRatedCount > 0
      ? allRatedOrders.reduce((sum, o) => sum + Number(o.rating || 0), 0) / totalRatedCount
      : 0;

  // Variation vs previous period (30 days vs 30 days prior)
  const last30Ms = 30 * 24 * 60 * 60 * 1000;
  const prev30Ms = 60 * 24 * 60 * 60 * 1000;
  const recent30RatedOrders = allRatedOrders.filter(
    (o) => new Date(o.created_at).getTime() >= nowMs - last30Ms
  );
  const prev30RatedOrders = allRatedOrders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return t < nowMs - last30Ms && t >= nowMs - prev30Ms;
  });

  const recent30Avg =
    recent30RatedOrders.length > 0
      ? recent30RatedOrders.reduce((sum, o) => sum + Number(o.rating || 0), 0) /
        recent30RatedOrders.length
      : 0;
  const prev30Avg =
    prev30RatedOrders.length > 0
      ? prev30RatedOrders.reduce((sum, o) => sum + Number(o.rating || 0), 0) /
        prev30RatedOrders.length
      : 0;

  const ratingDiffVsPrev30 = recent30Avg - prev30Avg;

  const filteredCustomers = businessCustomers.filter((c) => {
    const custOrders = businessOrders.filter(
      (o) => o.customer_id === c.id || o.customer_phone === c.phone
    );

    if (customerFilter === 'recurrent' && custOrders.length <= 1) {
      return false;
    }

    if (customerFilter === 'inactive') {
      if (custOrders.length < 2) return false;
      const latestOrderMs = Math.max(...custOrders.map((o) => new Date(o.created_at).getTime()));
      const daysSinceLast = Math.floor((nowMs - latestOrderMs) / (24 * 60 * 60 * 1000));
      if (daysSinceLast <= 21) return false;
    }

    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  // Analytics Metrics
  const totalRevenue = businessOrders
    .filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const relanceCount = businessEvents.filter((e) => e.event_type === 'relance_sent').length;

  // 1. Commandes urgentes non livrées (priority_level = urgent et status != delivered/cancelled)
  const urgentUndelivered = businessOrders.filter((o) => {
    if (o.status === 'delivered' || o.status === 'cancelled') return false;
    return (o.priority_level || '').toLowerCase() === 'urgent';
  });

  // 2. Commandes en cours depuis plus de 45 minutes (status = preparing ou ready)
  const preparingOver45Min = businessOrders.filter((o) => {
    if (o.status !== 'preparing' && o.status !== 'ready') return false;
    const startTime = new Date(o.updated_at || o.created_at).getTime();
    return nowMs - startTime >= 45 * 60 * 1000;
  });

  const totalSubAlertsCount =
    urgentUndelivered.length +
    preparingOver45Min.length;

  const alertCategories = [
    {
      id: 'urgent_undelivered' as const,
      title: 'Commande urgente non livrée',
      count: urgentUndelivered.length,
      rank: 1,
      icon: AlertTriangle,
      activeColorClass: 'bg-[#FCECEB] hover:bg-[#FCECEB]/80 border-[#A63A2F]/30 text-[#A63A2F] font-black',
      activeBadgeClass: 'bg-[#A63A2F] text-white font-extrabold',
      activeIconClass: 'text-[#A63A2F]',
    },
    {
      id: 'preparing_45m' as const,
      title: 'En cours depuis +45 min',
      count: preparingOver45Min.length,
      rank: 2,
      icon: AlertCircle,
      activeColorClass: 'bg-[#FBF4E8] hover:bg-[#FBF4E8]/80 border-[#C88A2E]/30 text-[#C88A2E] font-black',
      activeBadgeClass: 'bg-[#C88A2E] text-white font-extrabold',
      activeIconClass: 'text-[#C88A2E]',
    },
  ];

  // Conversion Metrics Calculator (Real calculation: paid orders / total created orders)
  const getConversionMetrics = (period: 'week' | 'month' | 'year' | 'all') => {
    let days = 30;
    if (period === 'week') days = 7;
    if (period === 'year') days = 365;

    const periodMs = days * 24 * 60 * 60 * 1000;
    const currentStart = period === 'all' ? 0 : nowMs - periodMs;
    const previousStart = period === 'all' ? 0 : nowMs - 2 * periodMs;

    const currentOrders = businessOrders.filter((o) => {
      if (period === 'all') return true;
      const t = new Date(o.created_at).getTime();
      return t >= currentStart;
    });

    const previousOrders = businessOrders.filter((o) => {
      if (period === 'all') return false;
      const t = new Date(o.created_at).getTime();
      return t >= previousStart && t < currentStart;
    });

    const currPaid = currentOrders.filter((o) => o.payment_status === 'paid');
    const prevPaid = previousOrders.filter((o) => o.payment_status === 'paid');

    const currRate = currentOrders.length > 0 ? (currPaid.length / currentOrders.length) * 100 : 0;
    const prevRate = previousOrders.length > 0 ? (prevPaid.length / previousOrders.length) * 100 : 0;
    const rateDiff = period === 'all' ? 0 : currRate - prevRate;

    const currPaidRevenue = currPaid.reduce((a, o) => a + Number(o.total_amount || 0), 0);
    const prevPaidRevenue = prevPaid.reduce((a, o) => a + Number(o.total_amount || 0), 0);
    const revenueDiff = period === 'all' ? 0 : currPaidRevenue - prevPaidRevenue;

    const currUnpaidRevenue = currentOrders
      .filter((o) => o.payment_status !== 'paid')
      .reduce((a, o) => a + Number(o.total_amount || 0), 0);

    return {
      currentOrders,
      previousOrders,
      currentRate: currRate,
      previousRate: prevRate,
      rateDiff,
      currentPaidRevenue: currPaidRevenue,
      previousPaidRevenue: prevPaidRevenue,
      revenueDiff,
      currentUnpaidRevenue: currUnpaidRevenue,
      totalCount: currentOrders.length,
      paidCount: currPaid.length,
      unpaidCount: currentOrders.length - currPaid.length,
    };
  };

  const monthConversionMetrics = getConversionMetrics('month');
  const selectedPeriodMetrics = getConversionMetrics(conversionPeriod);

  // Permission Verification Helper
  const hasPermission = (tab: TabType): boolean => {
    if (activeStaff.role === 'owner') return true;
    if (tab === 'team' || tab === 'attendance') return true;
    if (tab === 'overview' || tab === 'profile' || tab === 'conversion' || tab === 'finance') return true;
    return Boolean(activeStaff.permissions[tab as keyof StaffPermissions]);
  };

  // Team Roster mapping directly from real staff store data
  const getPermissionsSummary = (staffItem: Staff): string => {
    if (staffItem.role === 'owner') return 'Accès complet';
    const labels: Record<keyof StaffPermissions, string> = {
      orders: 'Commandes',
      products: 'Produits',
      customers: 'Clients',
      agent: 'Agent WA',
      settings: 'Paramètres',
      staff: 'Équipe',
      finance: 'Finance',
    };
    const active = Object.entries(staffItem.permissions || {})
      .filter(([_, val]) => val)
      .map(([key]) => labels[key as keyof StaffPermissions] || key);
    return active.length > 0 ? active.join(', ') : 'Aucune permission';
  };

  const allTeamRows = businessStaff
    .filter((s) => !s.revoked)
    .map((s) => ({
      id: s.id,
    name: s.name,
    email: s.email,
    avatar_url: s.avatar_url,
    photo_url: s.photo_url,
    phone: s.phone || '-',
    role: s.role_title || (s.role === 'owner' ? 'Gérant' : 'Collaborateur'),
    rawRole: s.role,
    position: s.role === 'owner' ? 'Direction Générale' : 'Opérations Staff',
    permissions: getPermissionsSummary(s),
    salary: s.salary ?? (s.role === 'owner' ? 450000 : 250000),
    hireDate: new Date(s.created_at || '2023-08-01').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    status: 'active',
    rawStaff: s,
  }));

  const uniqueTeamRoles = Array.from(new Set(allTeamRows.map((r) => r.role).filter(Boolean)));

  const todayAttendanceCounts = {
    all: allTeamRows.length,
    present: allTeamRows.filter((r) => todayAttendanceMap[r.id]?.status === 'present').length,
    absent: allTeamRows.filter((r) => todayAttendanceMap[r.id]?.status === 'absent').length,
    late: allTeamRows.filter((r) => todayAttendanceMap[r.id]?.status === 'late').length,
    unmarked: allTeamRows.filter((r) => !todayAttendanceMap[r.id]?.status).length,
  };

  const displayTeamRows = allTeamRows.filter((emp) => {
    if (teamDeptFilter !== 'all' && emp.role !== teamDeptFilter) return false;

    if (teamSearch.trim()) {
      const q = teamSearch.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.position.toLowerCase().includes(q) ||
        emp.permissions.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const displayAttendanceRows = allTeamRows.filter((emp) => {
    const attStatus = todayAttendanceMap[emp.id]?.status;
    if (attendanceFilter === 'present' && attStatus !== 'present') return false;
    if (attendanceFilter === 'absent' && attStatus !== 'absent') return false;
    if (attendanceFilter === 'late' && attStatus !== 'late') return false;
    if (attendanceFilter === 'unmarked' && attStatus) return false;

    if (teamSearch.trim()) {
      const q = teamSearch.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.price || !editingProduct?.category_id) return;

    onSaveProduct({
      id: editingProduct.id,
      name: editingProduct.name,
      price: Number(editingProduct.price),
      category_id: editingProduct.category_id,
      description: editingProduct.description || '',
      image_url:
        editingProduct.image_url ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      available: editingProduct.available !== undefined ? editingProduct.available : true,
      stock_qty: editingProduct.stock_qty !== undefined ? Number(editingProduct.stock_qty) : null,
    });

    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onSaveCategory(newCatName.trim());
    setNewCatName('');
    setIsCategoryModalOpen(false);
  };

  const handleSaveTemplates = () => {
    onUpdateConfig({ message_templates: templates });
    alert('Templates de messages WhatsApp sauvegardés avec succès !');
  };

  const handleSaveBizProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasSettingsChanges) {
      handleSaveAllSettings();
    }
  };

  const handleInviteStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    if (editingStaffId) {
      store.updateStaff(editingStaffId, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        phone: invitePhone.trim() || '+221 77 000 00 00',
        role_title: inviteRoleTitle.trim() || 'Collaborateur',
        salary: Number(inviteSalary) || 250000,
        permissions: invitePerms,
        avatar_url: invitePhotoUrl || undefined,
        photo_url: invitePhotoUrl || undefined,
      });
    } else {
      store.inviteStaff({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        phone: invitePhone.trim() || '+221 77 000 00 00',
        role_title: inviteRoleTitle.trim() || 'Collaborateur',
        salary: Number(inviteSalary) || 250000,
        permissions: invitePerms,
        avatar_url: invitePhotoUrl || undefined,
        photo_url: invitePhotoUrl || undefined,
      });
    }

    setEditingStaffId(null);
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
    setInviteRoleTitle('');
    setInviteSalary(250000);
    setInvitePerms({
      orders: true,
      products: true,
      customers: true,
      agent: false,
      settings: false,
      staff: false,
      finance: false,
    });
    setInvitePhotoUrl('');
    setIsInviteModalOpen(false);
  };

  const handleEditStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    store.updateStaff(editingStaff.id, {
      role_title: editRoleTitle.trim() || editingStaff.role_title || 'Collaborateur',
      phone: editPhone.trim() || editingStaff.phone,
      salary: Number(editSalary) || editingStaff.salary,
      permissions: editPerms,
    });

    setEditingStaff(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Modifications enregistrées sur votre compte personnel !');
  };

  const runWebhookTest = async () => {
    if (!testOrderId) {
      alert('Veuillez sélectionner un identifiant de commande.');
      return;
    }

    const logEntry = `[${new Date().toLocaleTimeString()}] Call POST /api/webhooks/payment -> Order #${testOrderId}, Ref: ${testPaymentRef}`;
    setWebhookLogs((prev) => [logEntry, ...prev]);

    onProcessPayment(testOrderId, testPaymentRef);
    setTestPaymentRef('WAVE_REF_' + Math.floor(100000 + Math.random() * 900000));
  };

  // Sidebar Menu Items Configuration
  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number | string; ownerOnly?: boolean }[] = [
    { id: 'overview', label: 'Tableau de bord', icon: TrendingUp },
    { id: 'finance', label: 'Finance', icon: CreditCard },
    { id: 'orders', label: 'Commandes', icon: ListFilter, badge: totalSubAlertsCount > 0 ? totalSubAlertsCount : undefined },
    { id: 'products', label: 'Produits & Catégories', icon: Package, badge: businessProducts.length },
    { id: 'customers', label: 'Clients', icon: Users, badge: businessCustomers.length },
    { id: 'team', label: 'Équipe', icon: ShieldCheck, badge: allTeamRows.length },
    { id: 'attendance', label: 'Pointage', icon: Clock, badge: todayAttendanceCounts.unmarked > 0 ? todayAttendanceCounts.unmarked : undefined },
    { id: 'agent', label: 'Assistant IA', icon: Bot, badge: businessEvents.length },
    { id: 'settings', label: 'Paramètres', icon: Settings, ownerOnly: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900 flex flex-col md:flex-row">
      {/* 2. SIDEBAR LEFT (RUBAN DE NAVIGATION RÉTRACTABLE) */}
      <aside
        className={`bg-white border-r border-slate-200/80 flex flex-col justify-between transition-all duration-300 z-30 shrink-0 shadow-2xs ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div>
          {/* Sidebar Top Profile Avatar Header (Clickable -> Mon Profil) */}
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-3 text-left overflow-hidden group transition-all p-1 -m-1 rounded-2xl hover:bg-slate-100/80 ${
                activeTab === 'profile' ? 'bg-emerald-50/80 ring-1 ring-emerald-500/30' : ''
              } ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}
              title={`Mon Profil (${activeStaff.name})`}
            >
              <div className="relative w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-base shrink-0 overflow-hidden group-hover:border-emerald-400 transition-colors">
                {activeStaff.avatar_url ? (
                  <Image
                    src={activeStaff.avatar_url}
                    alt={activeStaff.name}
                    fill
                    sizes="40px"
                    unoptimized
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                ) : (
                  <span>{activeStaff.name.charAt(0)}</span>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              {!isSidebarCollapsed && (
                <div className="truncate min-w-0 flex-1">
                  <h2 className="font-extrabold text-slate-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
                    {activeStaff.name}
                  </h2>
                  <span className="text-[10px] text-slate-500 font-bold block truncate">
                    {activeStaff.role === 'owner' ? 'Gérant Principal' : 'Collaborateur'}
                  </span>
                </div>
              )}
            </button>

            {/* Collapse Toggle Button */}
            {!isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors shrink-0 ml-1"
                title="Rétracter la sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* If Collapsed, Expand Button */}
          {isSidebarCollapsed && (
            <div className="p-2 border-b border-slate-200/80 text-center">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 mx-auto block"
                title="Déplier la sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const allowed = hasPermission(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all group ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm font-black'
                      : allowed
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      : 'text-slate-400 hover:text-slate-500 hover:bg-slate-100/50 cursor-not-allowed'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className={`flex items-center space-x-3 ${isSidebarCollapsed ? 'mx-auto' : ''}`}>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-600'}`} />
                    {!isSidebarCollapsed && <span>{item.label}</span>}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center space-x-1">
                      {item.ownerOnly && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                          Owner
                        </span>
                      )}
                      {item.badge !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isActive
                              ? 'bg-emerald-800 text-white'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Token Quota */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/60">
          {!isSidebarCollapsed ? (
            <div>
              {/* Monthly Tokens Quota Indicator (Clickable -> Settings / Subscription) */}
              <div
                onClick={() => setActiveTab('settings')}
                className="p-2.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/80 shadow-2xs transition-all cursor-pointer group"
                title="Gérer mon abonnement"
              >
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700 mb-1.5">
                  <span>Tokens restants</span>
                  <span className="text-[10px] text-[#B5451B] font-extrabold group-hover:underline">Abonnement →</span>
                </div>
                {/* Thin horizontal progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#1B4B4A] h-1.5 rounded-full transition-all duration-300"
                    style={{ width: '68%' }}
                  />
                </div>
                <div className="mt-1.5 text-right text-[10px] font-bold text-slate-500 tabular-nums">
                  680k / 1M tokens
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div
                onClick={() => setActiveTab('settings')}
                className="p-1.5 bg-white hover:bg-slate-100 rounded-xl border border-slate-200/80 text-center transition-all cursor-pointer"
                title="Tokens restants : 680k / 1M tokens"
              >
                <div className="w-2 h-2 rounded-full bg-[#1B4B4A] mx-auto mb-0.5" />
                <span className="text-[9px] font-bold text-slate-600 block">680k</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Header / Back to Dashboard Button when outside Overview */}
        {activeTab !== 'overview' && activeTab !== 'agent' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 px-5 rounded-3xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <button
                onClick={() => {
                  setActiveTab('overview');
                  setStatusFilter('all');
                  setOrderSearch('');
                  setAlertCategoryFilter('all');
                }}
                className="inline-flex items-center space-x-2 text-xs font-extrabold text-slate-700 hover:text-emerald-700 bg-slate-100/90 hover:bg-emerald-50 px-3.5 py-2 rounded-2xl border border-slate-200 hover:border-emerald-200 transition-all shadow-2xs group cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                <span>Retour au Tableau de bord</span>
              </button>

              <span className="text-slate-300 font-light text-sm hidden sm:inline">|</span>

              <span className="text-xs font-bold text-slate-500">
                Page actuelle : <span className="text-slate-900 font-extrabold">{navItems.find((n) => n.id === activeTab)?.label || activeTab}</span>
                {activeTab === 'orders' && alertCategoryFilter !== 'all' && (
                  <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#FCECEB] text-[#A63A2F] text-[10px] font-black uppercase border border-[#A63A2F]/30">
                    Alerte : {
                      alertCategoryFilter === 'urgent_undelivered'
                        ? 'Urgent non livrée'
                        : 'En cours (+45m)'
                    }
                  </span>
                )}
                {activeTab === 'orders' && alertCategoryFilter === 'all' && statusFilter !== 'all' && (
                  <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#FBF4E8] text-[#C88A2E] text-[10px] font-black uppercase border border-[#C88A2E]/30">
                    Filtre : {statusFilter}
                  </span>
                )}
                {activeTab === 'orders' && hasRatingFilter && (
                  <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase border border-amber-300">
                    Avis clients (1-5 ★)
                  </span>
                )}
                {activeTab === 'orders' && orderSearch.trim() !== '' && (
                  <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#EBF3F3] text-[#1B4B4A] text-[10px] font-black uppercase border border-[#1B4B4A]/30">
                    Commande : #{orderSearch}
                  </span>
                )}
              </span>
            </div>

            {activeTab === 'orders' && (statusFilter !== 'all' || orderSearch.trim() !== '' || alertCategoryFilter !== 'all' || hasRatingFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setOrderSearch('');
                  setAlertCategoryFilter('all');
                  setHasRatingFilter(false);
                }}
                className="text-[11px] font-extrabold text-slate-500 hover:text-rose-600 underline cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {/* Permission Guard Banner */}
        {!hasPermission(activeTab) && (
          <div className="bg-rose-950/80 border border-rose-800/80 rounded-3xl p-8 text-center max-w-xl mx-auto my-12">
            <Lock className="w-12 h-12 text-rose-400 mx-auto mb-3" />
            <h3 className="text-lg font-black text-white">Accès Restreint</h3>
            <p className="text-xs text-rose-200 mt-2 leading-relaxed">
              Votre compte <strong className="text-white">{activeStaff.name}</strong> ({activeStaff.role === 'collaborator' ? 'Collaborateur' : 'Gérant'}) n&apos;a pas la permission d&apos;accéder à la section <strong className="text-white">{activeTab.toUpperCase()}</strong>.
            </p>
            <p className="text-xs text-rose-300/80 mt-1">
              Veuillez contacter le Gérant ({businessStaff.find((s) => s.role === 'owner')?.name || 'Owner'}) pour débloquer cette autorisation.
            </p>
            <button
              onClick={() => {
                const owner = businessStaff.find((s) => s.role === 'owner');
                if (owner) store.setActiveStaff(owner.id);
              }}
              className="mt-5 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md"
            >
              Basculer sur le compte Gérant (Owner)
            </button>
          </div>
        )}

        {/* 4. PAGE TABLEAU DE BORD (OVERVIEW) */}
        {hasPermission('overview') && activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Encaissé */}
              <div
                onClick={() => {
                  setActiveTab('orders');
                  setPaymentMethodFilter('all');
                  setOrderPeriodFilter('day');
                  setStatusFilter('all');
                  setAlertCategoryFilter('all');
                  setOrderSearch('');
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
                        setActiveTab('finance');
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
                        setActiveTab('finance');
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
                  setActiveTab('orders');
                  setStatusFilter('all');
                  setAlertCategoryFilter('all');
                  setOrderSearch('');
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
                              setActiveTab('orders');
                              setAlertCategoryFilter(cat.id);
                              setStatusFilter('all');
                              setOrderSearch('');
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
                  setActiveTab('customers');
                  setCustomerFilter('all');
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
                          setActiveTab('settings');
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
                      setActiveTab('customers');
                      setCustomerFilter('recurrent');
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
                  setActiveTab('conversion');
                }}
                className="bg-white border border-slate-200/80 rounded-3xl p-6 relative flex flex-col justify-between shadow-2xs hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group min-h-[160px]"
                title="Cliquer pour voir l'analyse détaillée du Taux de Conversion"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                      Taux de conversion
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

              {/* Carte Droite: Top Formats de Vente (Donut Chart) */}
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg tracking-tight pb-4 border-b border-slate-100">
                    Top Formats de Vente
                  </h3>

                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Donut Chart */}
                    <div className="w-44 h-44 shrink-0 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Commande Directe', value: 54, color: '#FF4B72' },
                              { name: 'Assistant IA', value: 24, color: '#8B5CF6' },
                              { name: 'Catalogue Web', value: 16, color: '#F472B6' },
                              { name: 'Lien de Paiement', value: 6, color: '#DDD6FE' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {[
                              { name: 'Commande Directe', value: 54, color: '#FF4B72' },
                              { name: 'Assistant IA', value: 24, color: '#8B5CF6' },
                              { name: 'Catalogue Web', value: 16, color: '#F472B6' },
                              { name: 'Lien de Paiement', value: 6, color: '#DDD6FE' },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend list matching reference layout */}
                    <div className="flex flex-col space-y-3 w-full sm:w-auto">
                      {[
                        { label: 'Commande Directe', pct: '54%', color: '#FF4B72' },
                        { label: 'Assistant IA', pct: '24%', color: '#8B5CF6' },
                        { label: 'Catalogue Web', pct: '16%', color: '#F472B6' },
                        { label: 'Lien de Paiement', pct: '6%', color: '#DDD6FE' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                            <span className="font-semibold text-slate-700 whitespace-nowrap">{item.label}</span>
                          </div>
                          <span className="font-black text-slate-900 tabular-nums">{item.pct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
                      onClick={() => setActiveTab('orders')}
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
                            const custObj = businessCustomers.find(
                              (c) =>
                                (c.phone && ord.customer_phone && c.phone.includes(ord.customer_phone.slice(-8))) ||
                                c.name === ord.customer_name
                            );
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
                              if (raw.toUpperCase().startsWith('ORD_') || raw.toUpperCase().startsWith('ORD-')) {
                                return `#${raw.toUpperCase()}`;
                              }
                              if (raw.startsWith('#')) return raw;
                              return `#ORD-${raw.toUpperCase()}`;
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

                                {/* Customer Avatar + Name (Separate click to customer page) */}
                                <td className="py-3.5 px-2">
                                  <div
                                    className="flex items-center gap-2.5 cursor-pointer group/cust transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (custObj) {
                                        setSelectedCustomerId(custObj.id);
                                      }
                                      setActiveTab('customers');
                                    }}
                                    title="Voir la fiche client"
                                  >
                                    {custObj?.avatar_url ? (
                                      <img
                                        src={custObj.avatar_url}
                                        alt={ord.customer_name}
                                        className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 group-hover/cust:scale-110 transition-transform duration-200 shadow-2xs"
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-purple-900 border border-purple-200/60 flex items-center justify-center font-black text-[10px] shrink-0 group-hover/cust:scale-110 transition-transform duration-200 shadow-2xs">
                                        {getInitials(ord.customer_name)}
                                      </div>
                                    )}
                                    <span className="font-bold text-slate-800 group-hover/cust:text-purple-600 group-hover/cust:underline underline-offset-2 transition-colors truncate max-w-[120px]">
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

              {/* Right Column: Messages & Activity of RAG Agent */}
              <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Messages Agent RAG</h3>
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
                      // Filter out routine order confirmations that duplicate the orders table on the left
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
                            Aucune activité agent pour le moment.
                          </div>
                        );
                      }

                      return relevantEvents.map((evt) => {
                        const eventDate = new Date(evt.created_at);
                        const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                        const rawMsg = evt.payload?.message || evt.payload?.query || evt.event_type || 'Action agent RAG enregistrée';
                        const msgText = typeof rawMsg === 'string' ? rawMsg : String(rawMsg);

                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              if (evt.order_id) {
                                setSelectedModalOrderId(evt.order_id);
                              } else {
                                setActiveTab('agent');
                              }
                            }}
                            className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-purple-200/80 hover:bg-purple-50/40 hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 ease-out cursor-pointer group active:scale-[0.99]"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-slate-800 text-xs group-hover:text-purple-700 transition-colors flex items-center gap-1.5">
                                <Bot className="w-3.5 h-3.5 text-purple-600 shrink-0 group-hover:scale-110 transition-transform duration-200" />
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
                    onClick={() => setActiveTab('agent')}
                    className="w-full mt-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Ouvrir l&apos;Assistant RAG</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4.5 PAGE FINANCE */}
        {hasPermission('finance') && activeTab === 'finance' && (
          <FinanceSection
            orders={businessOrders}
            currency={business.currency || 'XOF'}
            nowMs={nowMs}
            businessId={business.id}
          />
        )}

        {/* 4.5 PAGE TAUX DE CONVERSION (CONVERSION ANALYTICS & DETAIL) */}
        {hasPermission('conversion') && activeTab === 'conversion' && (
          <ConversionDetailSection
            orders={businessOrders}
            currency={business.currency}
            onNavigateToOrders={() => {
              setActiveTab('orders');
              setPaymentMethodFilter('all');
              setStatusFilter('pending');
              setAlertCategoryFilter('all');
            }}
          />
        )}

        {/* 5. PAGE COMMANDES (ORDERS) */}
        {hasPermission('orders') && activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Top Toolbar: Search & Filter Dropdowns aligned on one single row */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher #commande, client, tel..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                />
              </div>

              {/* 3 Dropdowns aligned horizontally */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
                {/* Dropdown 1: Canal de paiement */}
                <div className="relative">
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => {
                      setPaymentMethodFilter(e.target.value as any);
                      setOrdersCurrentPage(1);
                    }}
                    className="bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="all">Canal : Tous ({businessOrders.length})</option>
                    <option value="wave">
                      Canal : Wave ({businessOrders.filter((o) => (o.payment_method || '').toLowerCase().includes('wave')).length})
                    </option>
                    <option value="orange">
                      Canal : Orange Money (
                      {
                        businessOrders.filter((o) => {
                          const m = (o.payment_method || '').toLowerCase();
                          return m.includes('orange') || m.includes('om');
                        }).length
                      }
                      )
                    </option>
                    <option value="card">
                      Canal : Carte bancaire (
                      {
                        businessOrders.filter((o) => {
                          const m = (o.payment_method || '').toLowerCase();
                          return m.includes('card') || m.includes('carte');
                        }).length
                      }
                      )
                    </option>
                  </select>
                </div>

                {/* Dropdown 2: Période */}
                <div className="relative">
                  <select
                    value={orderPeriodFilter}
                    onChange={(e) => {
                      setOrderPeriodFilter(e.target.value as any);
                      setOrdersCurrentPage(1);
                    }}
                    className="bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="all">Période : Tout</option>
                    <option value="day">Période : Jour</option>
                    <option value="week">Période : Semaine</option>
                    <option value="month">Période : Mois</option>
                    <option value="year">Période : Année</option>
                  </select>
                </div>

                {/* Dropdown 3: Statut */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setHasRatingFilter(false);
                      setOrdersCurrentPage(1);
                    }}
                    className="bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="all">Statut : Toutes ({businessOrders.length})</option>
                    <option value="confirmed">
                      Statut : Confirmée ({businessOrders.filter((o) => o.status === 'confirmed' || o.status === 'pending').length})
                    </option>
                    <option value="preparing">
                      Statut : En cours ({businessOrders.filter((o) => o.status === 'preparing' || o.status === 'ready').length})
                    </option>
                    <option value="delivered">
                      Statut : Livrée ({businessOrders.filter((o) => o.status === 'delivered').length})
                    </option>
                    <option value="cancelled">
                      Statut : Annulée ({businessOrders.filter((o) => o.status === 'cancelled').length})
                    </option>
                    <option value="customer_history">
                      Statut : Historique Client ({businessCustomers.length})
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filter Banner Indicator */}

            {/* Orders Reconstructed Table OR Customer History Placeholder */}
            {statusFilter === 'customer_history' ? (
              <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-2xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Historique Client</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Historique agrégé des commandes par client
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[11px] font-black">
                    {businessCustomers.length} client(s)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200/70 tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Client</th>
                        <th className="py-3.5 px-4">Téléphone</th>
                        <th className="py-3.5 px-4 text-center">Nombre de commandes</th>
                        <th className="py-3.5 px-4 text-right">Total dépensé</th>
                        <th className="py-3.5 px-4 text-right">Dernière commande</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const customerHistoryData = businessCustomers.map((cust) => {
                          const custOrders = businessOrders
                            .filter((o) => o.customer_id === cust.id || (o.customer_phone && o.customer_phone === cust.phone))
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                          const totalOrders = custOrders.length;
                          const totalSpent = custOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
                          const lastOrderDate =
                            custOrders.length > 0
                              ? new Date(custOrders[0].created_at).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                              : 'Aucune commande';

                          return {
                            cust,
                            totalOrders,
                            totalSpent,
                            lastOrderDate,
                          };
                        }).sort((a, b) => b.totalOrders - a.totalOrders);

                        if (customerHistoryData.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-xs text-slate-400 font-medium">
                                Aucun client enregistré pour le moment.
                              </td>
                            </tr>
                          );
                        }

                        return customerHistoryData.map(({ cust, totalOrders, totalSpent, lastOrderDate }) => (
                          <tr
                            key={cust.id}
                            onClick={() => setSelectedCustomerId(cust.id)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                            title="Cliquer pour voir le détail et l'historique complet du client"
                          >
                            <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center font-black text-xs shrink-0">
                                  {cust.name ? cust.name.charAt(0) : '?'}
                                </div>
                                <span>{cust.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                              {cust.phone || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-black">
                                {totalOrders}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-slate-900 tabular-nums">
                              {totalSpent.toLocaleString('fr-FR')} {business.currency}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                              {lastOrderDate}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              (() => {
                const ORDERS_PER_PAGE = 10;
              const totalOrdersCount = filteredOrders.length;
              const totalOrdersPages = Math.ceil(totalOrdersCount / ORDERS_PER_PAGE) || 1;
              const safeOrdersPage = Math.min(Math.max(1, ordersCurrentPage), totalOrdersPages);
              const startOrderIdx = (safeOrdersPage - 1) * ORDERS_PER_PAGE;
              const paginatedOrders = filteredOrders.slice(startOrderIdx, startOrderIdx + ORDERS_PER_PAGE);

              return (
                <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 border-collapse">
                      <thead className="bg-slate-50/80 text-slate-500 uppercase font-medium text-[10px] border-b border-slate-200/70 tracking-wider">
                        <tr>
                          <th className="py-3 px-3.5 text-center">Avatar</th>
                          <th className="py-3 px-3.5">Client (nom)</th>
                          <th className="py-3 px-3.5">Adresse</th>
                          <th className="py-3 px-3.5">Téléphone</th>
                          <th className="py-3 px-3.5">Produits</th>
                          <th className="py-3 px-3.5 text-right">Montant</th>
                          <th className="py-3 px-3.5">Canal de paiement</th>
                          <th className="py-3 px-3.5">Priorité</th>
                          <th className="py-3 px-3.5">Statut</th>
                          <th className="py-3 px-3.5 text-right">Date / Heure</th>
                          <th className="py-3 px-3.5 text-center">Commentaire</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedOrders.map((ord) => {
                          const isTargeted = orderSearch.trim().toLowerCase() === ord.id.toLowerCase();

                          return (
                            <tr
                              key={ord.id}
                              onClick={() => setSelectedModalOrderId(ord.id)}
                              className={`hover:bg-slate-50/60 transition-all cursor-pointer ${
                                isTargeted ? 'bg-amber-50/80' : ''
                              }`}
                              title="Cliquer pour voir la carte détail de la commande"
                            >
                              {/* 1. Avatar initiales neutre */}
                              <td
                                className="py-3.5 px-3.5 text-center whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 font-medium text-xs flex items-center justify-center mx-auto shrink-0">
                                  {getInitials(ord.customer_name)}
                                </div>
                              </td>

                              {/* 2. Nom du client */}
                              <td className="py-3.5 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                                {ord.customer_name || 'Client Inconnu'}
                              </td>

                              {/* 3. Adresse (Texte simple, sans icône) */}
                              <td className="py-3.5 px-3.5 text-[11px] text-slate-600 max-w-[180px]">
                                {ord.order_type === 'pickup' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                                    À récupérer
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    <div className="text-slate-700 font-normal truncate max-w-[160px]" title={ord.delivery_address || 'Non renseignée'}>
                                      {ord.delivery_address || 'Non renseignée'}
                                    </div>
                                    {(ord.delivery_zone_name || ord.delivery_fee) && (
                                      <div className="text-[10px] text-slate-400 font-normal truncate">
                                        {ord.delivery_zone_name ? `Zone: ${ord.delivery_zone_name}` : ''}
                                        {ord.delivery_zone_name && ord.delivery_fee ? ' • ' : ''}
                                        {ord.delivery_fee ? `+${ord.delivery_fee.toLocaleString('fr-FR')} ${business.currency}` : ''}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* 4. Téléphone */}
                              <td className="py-3.5 px-3.5 text-[11px] text-slate-600 font-normal whitespace-nowrap">
                                {ord.customer_phone || '-'}
                              </td>

                              {/* 5. Produits */}
                              <td className="py-3.5 px-3.5 text-[11px]">
                                <ul className="space-y-0.5">
                                  {ord.items?.map((item) => (
                                    <li key={item.id} className="text-[11px] text-slate-700 font-normal whitespace-nowrap">
                                      <span className="font-medium text-slate-900">{item.quantity}x</span> {item.product_name || 'Produit'}
                                    </li>
                                  ))}
                                </ul>
                              </td>

                              {/* 6. Montant */}
                              <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                                <span className="font-medium text-slate-900 text-xs">
                                  {ord.total_amount.toLocaleString('fr-FR')} {business.currency}
                                </span>
                              </td>

                              {/* 7. Canal de paiement */}
                              <td className="py-3.5 px-3.5 whitespace-nowrap">
                                {(() => {
                                  const method = (ord.payment_method || 'wave').toLowerCase();
                                  let methodBadgeClass = 'bg-slate-100 text-slate-800 border-slate-300';
                                  let methodLabel = ord.payment_method || 'Paiement';

                                  if (method.includes('wave')) {
                                    methodBadgeClass = 'bg-sky-100 text-sky-900 border-sky-300';
                                    methodLabel = 'Wave';
                                  } else if (method.includes('orange') || method.includes('om')) {
                                    methodBadgeClass = 'bg-orange-100 text-orange-900 border-orange-300';
                                    methodLabel = 'Orange Money';
                                  } else if (method.includes('card') || method.includes('carte')) {
                                    methodBadgeClass = 'bg-indigo-100 text-indigo-900 border-indigo-300';
                                    methodLabel = 'Carte Bancaire';
                                  }

                                  return (
                                    <div>
                                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-medium uppercase border inline-block ${methodBadgeClass}`}>
                                        {methodLabel}
                                      </span>
                                      {ord.payment_reference && (
                                        <span className="text-[9px] text-slate-400 block mt-0.5 truncate max-w-[110px]" title={ord.payment_reference}>
                                          Réf: {ord.payment_reference}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* 8. Priorité */}
                              <td className="py-3.5 px-3.5 whitespace-nowrap">
                                {(() => {
                                  const prio = (ord.priority_level || 'moyen').toLowerCase();
                                  if (prio === 'urgent') {
                                    return (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center">
                                        Urgent
                                      </span>
                                    );
                                  } else if (prio === 'moyen' || prio === 'medium') {
                                    return (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center">
                                        Moyen
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center">
                                        Faible
                                      </span>
                                    );
                                  }
                                })()}
                              </td>

                              {/* 9. Statut */}
                              <td className="py-3.5 px-3.5 space-y-1 min-w-[120px]">
                                <select
                                  value={ord.status}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const newStatus = e.target.value as OrderStatus;
                                    if (newStatus === 'cancelled') {
                                      setCancellingOrderId(ord.id);
                                      setCancellationReason(ord.cancellation_reason || '');
                                      setIsCancelModalOpen(true);
                                    } else {
                                      onUpdateOrderStatus(ord.id, newStatus);
                                    }
                                  }}
                                  className={`border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none cursor-pointer w-full transition-colors ${getStatusSelectClass(ord.status)}`}
                                >
                                  <option value="confirmed" className="bg-blue-100 text-blue-900">Confirmée</option>
                                  <option value="preparing" className="bg-orange-100 text-orange-900">En cours</option>
                                  <option value="delivered" className="bg-emerald-100 text-emerald-900">Livrée</option>
                                  <option value="cancelled" className="bg-rose-100 text-rose-900">Annulée</option>
                                </select>

                                {ord.status === 'cancelled' && ord.cancellation_reason && (
                                  <div className="p-1 bg-rose-50 rounded border border-rose-200 text-[10px] text-rose-800">
                                    <span className="font-medium block text-rose-900">Motif :</span>
                                    {ord.cancellation_reason}
                                  </div>
                                )}
                              </td>

                              {/* 10. Date / Heure */}
                              <td className="py-3.5 px-3.5 text-right text-[11px] text-slate-600 font-normal whitespace-nowrap">
                                <span className="block text-slate-800 font-medium">{new Date(ord.created_at).toLocaleDateString('fr-FR')}</span>
                                <span className="text-[10px] text-slate-400 block" suppressHydrationWarning>{new Date(ord.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </td>

                              {/* 11. Commentaire */}
                              <td
                                className="py-3.5 px-3.5 text-[11px] text-slate-700 min-w-[140px] max-w-[170px] cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEnlargedComment({
                                    comment: ord.rating_comment || '',
                                    rating: ord.rating,
                                    internalNote: ord.internal_note,
                                    name: ord.customer_name || 'Client',
                                    orderId: ord.id,
                                  });
                                }}
                                title="Double-cliquer pour voir le commentaire complet"
                              >
                                {ord.rating_comment ? (
                                  <div className="p-1.5 bg-amber-50/80 rounded-lg border border-amber-200/80 text-[10px]">
                                    <div className="flex items-center space-x-1 text-amber-700 font-medium mb-0.5">
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                                      <span>{ord.rating ? `${ord.rating}/5` : 'Avis'}</span>
                                    </div>
                                    <p className="text-amber-950 italic truncate max-w-[130px]">
                                      &ldquo;{ord.rating_comment}&rdquo;
                                    </p>
                                  </div>
                                ) : ord.internal_note ? (
                                  <p className="text-slate-500 italic truncate max-w-[130px] text-[10px]">
                                    Note: {ord.internal_note}
                                  </p>
                                ) : (
                                  <span className="text-slate-300 italic text-[10px]">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredOrders.length === 0 && (
                          <tr>
                            <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                              Aucune commande ne correspond aux critères.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination sobre */}
                  <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                    <div>
                      {totalOrdersCount > 0 ? (
                        <span>
                          Affichage de <strong className="font-medium text-slate-700">{startOrderIdx + 1}</strong> à <strong className="font-medium text-slate-700">{Math.min(startOrderIdx + ORDERS_PER_PAGE, totalOrdersCount)}</strong> sur <strong className="font-medium text-slate-700">{totalOrdersCount}</strong> commandes
                        </span>
                      ) : (
                        <span>0 commande</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setOrdersCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safeOrdersPage <= 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                      >
                        Précédent
                      </button>
                      <span className="text-xs text-slate-600 px-1 font-medium">
                        {safeOrdersPage} / {totalOrdersPages}
                      </span>
                      <button
                        onClick={() => setOrdersCurrentPage((p) => Math.min(totalOrdersPages, p + 1))}
                        disabled={safeOrdersPage >= totalOrdersPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
            )}
          </div>
        )}

        {/* TAB 3: PRODUITS & CATÉGORIES */}
        {hasPermission('products') && activeTab === 'products' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
              <div className="text-xs text-slate-500 font-bold px-2">
                Catalogue : <span className="text-slate-900 font-black">{businessProducts.length}</span> produit(s), <span className="text-slate-900 font-black">{businessCategories.length}</span> catégorie(s)
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl flex items-center space-x-2 border border-slate-200 transition-all shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle Catégorie</span>
                </button>

                <button
                  onClick={() => {
                    setEditingProduct({ category_id: businessCategories[0]?.id || '' });
                    setIsProductModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-emerald-500/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un Produit</span>
                </button>
              </div>
            </div>

            {/* Categories List */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {businessCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="px-4 py-2 bg-white border border-slate-200/80 rounded-2xl flex items-center space-x-2 text-xs font-bold text-slate-700 shrink-0 shadow-2xs"
                >
                  <span>{cat.name}</span>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer la catégorie "${cat.name}" ?`)) onDeleteCategory(cat.id);
                    }}
                    className="text-slate-400 hover:text-rose-600 ml-1 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {businessProducts.map((prod) => {
                const cat = businessCategories.find((c) => c.id === prod.category_id);
                return (
                  <div key={prod.id} className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
                    <div>
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <Image
                          src={prod.image_url}
                          alt={prod.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          unoptimized
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                        <div className="absolute top-3 right-3 flex items-center space-x-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-2xs ${
                              prod.available
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {prod.available ? 'Disponible' : 'Épuisé'}
                          </span>
                        </div>
                      </div>

                      <div className="p-5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          {cat?.name || 'Catégorie'}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-base mt-1">{prod.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{prod.description}</p>
                      </div>
                    </div>

                    <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                      <div className="mt-3">
                        <span className="text-lg font-black text-emerald-700 block">
                          {prod.price.toLocaleString()} {business.currency}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Stock : {prod.stock_qty === null ? 'Illimité' : `${prod.stock_qty} unités`}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 mt-3">
                        <button
                          onClick={() => {
                            setEditingProduct(prod);
                            setIsProductModalOpen(true);
                          }}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer le produit "${prod.name}" ?`)) onDeleteProduct(prod.id);
                          }}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: CLIENTS - Messaging / Chat UI */}
        {hasPermission('customers') && activeTab === 'customers' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col md:flex-row min-h-[680px] h-[calc(100vh-220px)]">
            {/* LEFT COLUMN: Customer Conversations List */}
            <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col bg-white shrink-0">
              {/* Header & Search Bar */}
              <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-2">
                    <span>Chats</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-full text-[10px] font-black">
                      {filteredCustomers.length}
                    </span>
                  </h3>
                  <div className="flex items-center space-x-1.5 text-slate-500">
                    <button className="p-1.5 opacity-40 hover:opacity-60 rounded-xl transition-all cursor-not-allowed text-slate-600" title="Nouveau groupe (Disponible en Phase 2)">
                      <Users className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 opacity-40 hover:opacity-60 rounded-xl transition-all cursor-not-allowed text-slate-600" title="Nouveau message (Disponible en Phase 2)">
                      <SquarePen className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-600" title="Filtrer">
                      <ListFilter className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search or start new chat..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto">
                  <button
                    onClick={() => setCustomerFilter('all')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                      customerFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tous ({businessCustomers.length})
                  </button>
                  <button
                    disabled
                    title="Disponible en Phase 2"
                    className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all whitespace-nowrap text-slate-400 opacity-60 cursor-not-allowed"
                  >
                    Non lus (0)
                  </button>
                  <button
                    disabled
                    title="Disponible en Phase 2"
                    className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all whitespace-nowrap text-slate-400 opacity-60 cursor-not-allowed"
                  >
                    Favoris (0)
                  </button>
                  <button
                    disabled
                    title="Disponible en Phase 2"
                    className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all whitespace-nowrap text-slate-400 opacity-60 cursor-not-allowed"
                  >
                    Groupes (0)
                  </button>
                </div>
              </div>

              {/* Conversations Scrollable List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
                {filteredCustomers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    Aucun client trouvé.
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const custOrders = businessOrders.filter(
                      (o) => o.customer_id === cust.id || o.customer_phone === cust.phone
                    );
                    const custOrderIds = new Set(custOrders.map((o) => o.id));
                    const custMessages = businessEvents
                      .filter(
                        (e) =>
                          e.order_id &&
                          custOrderIds.has(e.order_id) &&
                          e.event_type !== 'order_confirmed'
                      )
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    const latestMsg = custMessages[0] || null;
                    const isSelected = (selectedCustomerId || filteredCustomers[0]?.id) === cust.id;

                    const rawText = latestMsg
                      ? latestMsg.payload?.message || 'Message'
                      : 'Aucun message';

                    const lastActivityText =
                      rawText.length > 38 ? rawText.slice(0, 38) + '...' : rawText;

                    const lastActivityTime = latestMsg
                      ? new Date(latestMsg.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <div
                        key={cust.id}
                        onClick={() => setSelectedCustomerId(cust.id)}
                        className={`p-3.5 flex items-center space-x-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-100/90 border-l-4 border-l-slate-900 font-bold'
                            : 'hover:bg-slate-50/80 bg-white'
                        }`}
                      >
                        {/* Avatar */}
                        {cust.avatar_url ? (
                          <img
                            src={cust.avatar_url}
                            alt={cust.name}
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                            {getInitials(cust.name)}
                          </div>
                        )}

                        {/* Customer Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h4 className="text-sm font-extrabold text-slate-900 truncate">
                              {cust.name}
                            </h4>
                            {lastActivityTime && (
                              <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                {lastActivityTime}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium truncate">
                            {lastActivityText}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Selected Conversation Thread */}
            {(() => {
              const activeCustomer =
                businessCustomers.find((c) => c.id === selectedCustomerId) ||
                filteredCustomers[0] ||
                null;

              if (!activeCustomer) {
                return (
                  <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 text-center">
                    <MessageSquareWarning className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Sélectionnez un client pour voir la conversation.</p>
                  </div>
                );
              }

              // Check if real conversation messages exist for this customer
              const custOrders = businessOrders.filter(
                (o) => o.customer_id === activeCustomer.id || o.customer_phone === activeCustomer.phone
              );
              const custOrderIds = new Set(custOrders.map((o) => o.id));
              const realMessages = businessEvents.filter(
                (e) =>
                  e.order_id &&
                  custOrderIds.has(e.order_id) &&
                  e.event_type !== 'order_confirmed'
              );

              return (
                <div className="flex-1 flex flex-col bg-[#FAF7F2]/50 min-h-[500px]">
                  {/* Conversation Header */}
                  <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between shadow-2xs shrink-0">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {activeCustomer.avatar_url ? (
                        <img
                          src={activeCustomer.avatar_url}
                          alt={activeCustomer.name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                          {getInitials(activeCustomer.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-900 text-base truncate leading-tight">
                          {activeCustomer.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <span>Contact Info</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono">{activeCustomer.phone || 'Non renseigné'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action icons on top right - visually disabled with tooltip */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        className="p-2 opacity-40 hover:opacity-60 rounded-full transition-all cursor-not-allowed text-slate-700"
                        title="Appel vidéo (Disponible en Phase 2)"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                      <button
                        className="p-2 opacity-40 hover:opacity-60 rounded-full transition-all cursor-not-allowed text-slate-700"
                        title="Appel vocal (Disponible en Phase 2)"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                      <button
                        className="p-2 opacity-40 hover:opacity-60 rounded-full transition-all cursor-not-allowed text-slate-700"
                        title="Rechercher dans la discussion (Disponible en Phase 2)"
                      >
                        <Search className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Messages Thread Body */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#FAF7F2]/40">
                    {realMessages.length === 0 ? (
                      /* Clean empty state if no real messages exist in database */
                      <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center my-auto min-h-[360px]">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/80">
                          <MessageSquareWarning className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-extrabold text-slate-700 mb-1">Aucun message pour le moment.</p>
                        <p className="text-xs text-slate-400 font-medium max-w-xs">
                          Aucun échange enregistré dans l&apos;historique de ce client.
                        </p>
                      </div>
                    ) : (
                      /* Display actual messages if any exist in DB */
                      <div className="space-y-3 max-w-2xl mx-auto">
                        {realMessages.map((msg) => {
                          const isSentByMerchant = msg.event_type === 'order_alert_sent' || msg.event_type === 'relance_sent';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isSentByMerchant ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`p-3.5 rounded-2xl max-w-md text-xs font-medium shadow-2xs ${
                                  isSentByMerchant
                                    ? 'bg-[#1B4B4A] text-white rounded-tr-xs'
                                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
                                }`}
                              >
                                <p>{msg.payload?.message || 'Notification WhatsApp'}</p>
                                <span
                                  className={`text-[9px] block mt-1 text-right ${
                                    isSentByMerchant ? 'text-emerald-200' : 'text-slate-400'
                                  }`}
                                >
                                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom Disabled Message Input Bar */}
                  <div className="p-4 bg-white border-t border-slate-200/80 space-y-2 shrink-0">
                    <div className="flex items-center space-x-2">
                      <button
                        disabled
                        className="p-2.5 text-slate-400 opacity-40 hover:opacity-60 rounded-xl cursor-not-allowed"
                        title="Disponible en Phase 2"
                      >
                        <Smile className="w-5 h-5" />
                      </button>
                      <button
                        disabled
                        className="p-2.5 text-slate-400 opacity-40 hover:opacity-60 rounded-xl cursor-not-allowed"
                        title="Disponible en Phase 2"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <input
                        type="text"
                        placeholder="Écrire un message..."
                        disabled
                        readOnly
                        className="flex-1 bg-slate-50 text-slate-400 placeholder:text-slate-400 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-xs cursor-not-allowed font-medium outline-none"
                      />
                      <button
                        disabled
                        className="p-2.5 text-slate-400 opacity-40 hover:opacity-60 rounded-xl cursor-not-allowed"
                        title="Envoyer (Disponible en Phase 2)"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                      <button
                        disabled
                        className="p-2.5 text-slate-400 opacity-40 hover:opacity-60 rounded-xl cursor-not-allowed"
                        title="Message vocal (Disponible en Phase 2)"
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 font-medium pt-1">
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Messagerie manuelle disponible en Phase 2</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 4.5: ÉQUIPE */}
        {hasPermission('team') && activeTab === 'team' && (
          <div className="space-y-6">
            {/* Header Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center space-x-3 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un employé, numéro, poste..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
                {/* Dynamic Role filter */}
                <select
                  value={teamDeptFilter}
                  onChange={(e) => setTeamDeptFilter(e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-slate-700 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none cursor-pointer shrink-0"
                >
                  <option value="all">Tous les rôles</option>
                  {uniqueTeamRoles.map((roleTitle) => (
                    <option key={roleTitle} value={roleTitle}>
                      {roleTitle}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toolbar Action Buttons matching image */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setTeamSortActive(!teamSortActive)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                    teamSortActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Trier la liste"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Sort</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-700 text-white font-bold ml-1">
                    1
                  </span>
                </button>

                <button
                  onClick={() => {
                    const csvHeader = "Employee,Téléphone,Rôle,Position,Permissions,Hire Date,Status\n";
                    const csvRows = displayTeamRows.map((e) => `"${e.name}","${e.phone}","${e.role}","${e.position}","${e.permissions}","${e.hireDate}","${e.status}"`).join("\n");
                    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "equipe_export.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Exporter la liste en CSV"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
                </button>

                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un membre</span>
                </button>
              </div>
            </div>

            {/* Table Card - Fond Blanc */}
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-50/80 text-slate-500 font-medium text-[11px] border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={displayTeamRows.length > 0 && selectedTeamMemberIds.length === displayTeamRows.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTeamMemberIds(displayTeamRows.map((r) => r.id));
                            } else {
                              setSelectedTeamMemberIds([]);
                            }
                          }}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Avatar</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Employee</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Téléphone</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Rôle</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Position</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Permissions</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600 text-right">Salaire</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Hire Date</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Status</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayTeamRows.map((emp) => {
                      const isChecked = selectedTeamMemberIds.includes(emp.id);
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedTeamMemberForDetail(emp)}
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isChecked ? 'bg-slate-50/90' : ''}`}
                        >
                          <td className="py-3.5 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTeamMemberIds([...selectedTeamMemberIds, emp.id]);
                                } else {
                                  setSelectedTeamMemberIds(selectedTeamMemberIds.filter((id) => id !== emp.id));
                                }
                              }}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                            />
                          </td>

                          <td className="py-3.5 px-3.5">
                            {(() => {
                              const photoSrc = emp.photo_url || emp.avatar_url;
                              return photoSrc ? (
                                <Image
                                  src={photoSrc}
                                  alt={emp.name}
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200/80 shadow-2xs"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                                  {getInitials(emp.name)}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                            {emp.name}
                          </td>

                          <td
                            className="py-3.5 px-3.5 font-normal text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTeamMemberForDetail(emp);
                            }}
                          >
                            {emp.phone}
                          </td>

                          <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                            {emp.role}
                          </td>

                          <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                            {emp.position}
                          </td>

                          <td className="py-3.5 px-3.5 font-normal text-slate-900 whitespace-nowrap">
                            {emp.permissions}
                          </td>

                          <td className="py-3.5 px-3.5 font-bold text-slate-900 text-right whitespace-nowrap">
                            {activeStaff.role === 'owner'
                              ? typeof emp.salary === 'number'
                                ? `${emp.salary.toLocaleString('fr-FR')} ${business.currency || 'FCFA'}`
                                : emp.salary
                              : '—'}
                          </td>

                          <td className="py-3.5 px-3.5 text-slate-600 font-normal whitespace-nowrap">
                            {emp.hireDate}
                          </td>

                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            {emp.status === 'active' && (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span>Active</span>
                              </span>
                            )}
                            {emp.status === 'inactive' && (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                <span>Inactive</span>
                              </span>
                            )}
                            {(emp.status === 'on_leave' || emp.status === 'on leave') && (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span>On leave</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3.5 text-center whitespace-nowrap text-slate-300">
                            —
                          </td>
                        </tr>
                      );
                    })}
                    {displayTeamRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                          Aucun membre de l&apos;équipe ne correspond aux critères.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom bar summary */}
              <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Total : <strong className="font-medium text-slate-700">{displayTeamRows.length}</strong> membre(s)</span>
                {selectedTeamMemberIds.length > 0 && (
                  <span className="text-slate-700 font-medium">{selectedTeamMemberIds.length} sélectionné(s)</span>
                )}
              </div>
            </div>

            {/* Slide-over Panel: Détails Membre d'Équipe */}
            <AnimatePresence>
              {selectedTeamMemberForDetail && (
                <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
                  {/* Dark Backdrop Overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
                    onClick={() => setSelectedTeamMemberForDetail(null)}
                  />

                  {/* Slide-in Panel */}
                  <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200/80 flex flex-col h-full overflow-y-auto"
                  >
                    <div className="p-6 space-y-5">
                      {/* En-tête avec bouton Fermer (X) */}
                      <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                          {(selectedTeamMemberForDetail.photo_url || selectedTeamMemberForDetail.avatar_url || selectedTeamMemberForDetail.rawStaff.photo_url || selectedTeamMemberForDetail.rawStaff.avatar_url) ? (
                            <Image
                              src={selectedTeamMemberForDetail.photo_url || selectedTeamMemberForDetail.avatar_url || selectedTeamMemberForDetail.rawStaff.photo_url || selectedTeamMemberForDetail.rawStaff.avatar_url!}
                              alt={selectedTeamMemberForDetail.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-full object-cover border border-slate-200/80 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-lg shrink-0">
                              {getInitials(selectedTeamMemberForDetail.name)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h3 className="font-extrabold text-slate-900 text-lg truncate">
                                {selectedTeamMemberForDetail.name}
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Active
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                              {selectedTeamMemberForDetail.role}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedTeamMemberForDetail(null)}
                          className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                          title="Fermer le panneau"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Mini-statistiques / Infos clés */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Téléphone
                          </span>
                          <span className="text-xs font-bold text-slate-800 font-mono break-all">
                            {selectedTeamMemberForDetail.phone}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Email
                          </span>
                          <span className="text-xs font-bold text-slate-800 break-all">
                            {selectedTeamMemberForDetail.email || selectedTeamMemberForDetail.rawStaff.email || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Salaire
                          </span>
                          <span className="text-xs font-black text-slate-900 tabular-nums">
                            {activeStaff.role === 'owner'
                              ? typeof selectedTeamMemberForDetail.salary === 'number'
                                ? `${selectedTeamMemberForDetail.salary.toLocaleString('fr-FR')} ${business.currency || 'FCFA'}`
                                : selectedTeamMemberForDetail.salary
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Type de compte
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {selectedTeamMemberForDetail.rawRole === 'owner' ? 'Gérant (Owner)' : 'Collaborateur'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Position
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {selectedTeamMemberForDetail.position || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Date d&apos;embauche
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {selectedTeamMemberForDetail.hireDate}
                          </span>
                        </div>
                      </div>

                      {/* Permissions d'accès */}
                      <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Permissions d&apos;accès système
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(selectedTeamMemberForDetail.rawStaff.permissions || {}).map(([key, enabled]) => {
                            const permLabels: Record<string, string> = {
                              orders: 'Commandes',
                              products: 'Produits',
                              customers: 'Clients',
                              agent: 'Agent WA',
                              settings: 'Paramètres',
                              staff: 'Équipe',
                            };
                            return (
                              <div
                                key={key}
                                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
                                  enabled
                                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                    : 'bg-white border-slate-200/60 text-slate-400 opacity-60'
                                }`}
                              >
                                <span>{permLabels[key] || key}</span>
                                {enabled ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                                ) : (
                                  <X className="w-3.5 h-3.5 text-slate-300" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bouton d'action vers Paramètres */}
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setSelectedTeamMemberForDetail(null);
                            setActiveTab('settings');
                          }}
                          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center space-x-2 cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Gérer ce membre dans les Paramètres</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* TAB 4.6: POINTAGE DÉDIÉ */}
        {hasPermission('attendance') && activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Header Title & Date Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div>
                <div className="flex items-center space-x-2.5">
                  <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h2 className="text-base font-black text-slate-900">
                    Pointage & Suivi de Présence du Jour
                  </h2>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enregistrement et suivi quotidien du pointage des membres de l&apos;équipe.
                  {!canMarkAttendance && (
                    <span className="text-amber-700 font-bold ml-1">
                      (Mode lecture seule - réservé aux gérants et responsables)
                    </span>
                  )}
                </p>
              </div>

              {/* Controls: Dropdown Filter + Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Dropdown Menu Statut avec compteurs */}
                <div className="relative">
                  <select
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value)}
                    className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="all">Statut : Tous ({todayAttendanceCounts.all})</option>
                    <option value="present">Statut : Présents ({todayAttendanceCounts.present})</option>
                    <option value="absent">Statut : Absents ({todayAttendanceCounts.absent})</option>
                    <option value="late">Statut : Retards ({todayAttendanceCounts.late})</option>
                    <option value="unmarked">Statut : Non pointés ({todayAttendanceCounts.unmarked})</option>
                  </select>
                </div>

                {/* Search Bar for Attendance Page */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, rôle..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Attendance Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-50/80 text-slate-500 font-medium text-[11px] border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Avatar</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Membre</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Email</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Téléphone</th>
                      <th className="py-3 px-3.5 font-bold text-slate-900 bg-emerald-50/50">Pointage du Jour</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Rôle</th>
                      <th className="py-3 px-3.5 font-medium text-slate-600">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayAttendanceRows.map((emp) => {
                      const att = todayAttendanceMap[emp.id];
                      const status = att?.status;
                      const reason = att?.reason;

                      return (
                        <tr
                          key={emp.id}
                          onClick={() => setSelectedAttendanceMember(emp)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-3.5">
                            {(() => {
                              const photoSrc = emp.photo_url || emp.avatar_url;
                              return photoSrc ? (
                                <Image
                                  src={photoSrc}
                                  alt={emp.name}
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200/80 shadow-2xs"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                                  {getInitials(emp.name)}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                            {emp.name}
                          </td>

                          <td className="py-3.5 px-3.5 font-normal text-slate-600 whitespace-nowrap">
                            {emp.email}
                          </td>

                          <td className="py-3.5 px-3.5 font-normal text-slate-700 whitespace-nowrap">
                            {emp.phone}
                          </td>

                          {/* Pointage Cell */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap bg-emerald-50/10" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center space-x-2">
                              {/* Integrated Status Dropdown Select */}
                              {canMarkAttendance ? (
                                <select
                                  value={status || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'present') {
                                      handleMarkAttendanceStatus(emp.id, 'present');
                                    } else if (val === 'late') {
                                      handleOpenAttendanceReasonModal(emp.rawStaff, 'late');
                                    } else if (val === 'absent') {
                                      handleOpenAttendanceReasonModal(emp.rawStaff, 'absent');
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none transition-all cursor-pointer shadow-2xs ${
                                    status === 'present'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                      : status === 'late'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                      : status === 'absent'
                                      ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70'
                                  }`}
                                >
                                  <option value="" disabled className="text-slate-400 bg-white">
                                    ― Choisir statut (Non pointé)
                                  </option>
                                  <option value="present" className="text-emerald-800 font-bold bg-white">
                                    ✓ Présent
                                  </option>
                                  <option value="late" className="text-amber-800 font-bold bg-white">
                                    ⏰ Retard
                                  </option>
                                  <option value="absent" className="text-rose-800 font-bold bg-white">
                                    ✕ Absent
                                  </option>
                                </select>
                              ) : (
                                <span
                                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs ${
                                    status === 'present'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : status === 'late'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : status === 'absent'
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  {status === 'present' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                  {status === 'late' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                                  {status === 'absent' && <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                                  <span>
                                    {status === 'present'
                                      ? 'Présent'
                                      : status === 'late'
                                      ? 'Retard'
                                      : status === 'absent'
                                      ? 'Absent'
                                      : 'Non pointé'}
                                  </span>
                                </span>
                              )}

                              {/* Justification Pill Badge for Late or Absent */}
                              {(status === 'late' || status === 'absent') && (
                                reason && reason.trim() ? (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs cursor-help"
                                    title={`Motif : ${reason}`}
                                  >
                                    <span>Justifié</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                                    <span>Non justifié</span>
                                  </span>
                                )
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                            {emp.role}
                          </td>

                          <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                            {emp.position}
                          </td>
                        </tr>
                      );
                    })}

                    {displayAttendanceRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-medium">
                          Aucun membre trouvé dans cette catégorie de pointage.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Bar Summary */}
              <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Affichés : <strong className="font-bold text-slate-700">{displayAttendanceRows.length}</strong> membre(s) sur {allTeamRows.length}</span>
                <span className="text-slate-500">Pointage enregistré sur Supabase (table <code className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1 py-0.5 rounded">attendance</code>)</span>
              </div>
            </div>

            {/* Slide-over Panel: Historique de Pointage Membre (30 derniers jours) */}
            <AnimatePresence>
              {selectedAttendanceMember && (
                <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
                  {/* Dark Backdrop Overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
                    onClick={() => setSelectedAttendanceMember(null)}
                  />

                  {/* Slide-in Panel */}
                  <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200/80 flex flex-col h-full overflow-y-auto"
                  >
                    <div className="p-6 space-y-5 flex-1">
                      {/* En-tête avec Avatar, Nom, Rôle et Bouton Fermer */}
                      <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                          {(selectedAttendanceMember.photo_url || selectedAttendanceMember.avatar_url || selectedAttendanceMember.rawStaff?.photo_url || selectedAttendanceMember.rawStaff?.avatar_url) ? (
                            <Image
                              src={selectedAttendanceMember.photo_url || selectedAttendanceMember.avatar_url || selectedAttendanceMember.rawStaff?.photo_url || selectedAttendanceMember.rawStaff?.avatar_url!}
                              alt={selectedAttendanceMember.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-full object-cover border border-slate-200/80 shrink-0 shadow-2xs"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-lg shrink-0 shadow-2xs">
                              {getInitials(selectedAttendanceMember.name)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-extrabold text-slate-900 text-lg truncate">
                              {selectedAttendanceMember.name}
                            </h3>
                            <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                              {selectedAttendanceMember.role} • <span className="text-slate-500 font-normal">{selectedAttendanceMember.email}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedAttendanceMember(null)}
                          className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                          title="Fermer le panneau"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Mini-résumé factuel sur 30 jours */}
                      <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                            Récapitulatif (30 derniers jours)
                          </span>
                          <span className="text-xs font-bold text-slate-600">30 jours glissants</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-center shadow-2xs">
                            <span className="text-emerald-800 text-base font-black block">{historySummary.present}</span>
                            <span className="text-[10px] font-bold text-emerald-700">Présent(s)</span>
                          </div>
                          <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-center shadow-2xs">
                            <span className="text-amber-800 text-base font-black block">{historySummary.late}</span>
                            <span className="text-[10px] font-bold text-amber-700">Retard(s)</span>
                          </div>
                          <div className="p-2.5 bg-rose-50/80 border border-rose-200/80 rounded-xl text-center shadow-2xs">
                            <span className="text-rose-800 text-base font-black block">{historySummary.absent}</span>
                            <span className="text-[10px] font-bold text-rose-700">Absent(s)</span>
                          </div>
                          <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-center shadow-2xs">
                            <span className="text-slate-700 text-base font-black block">{historySummary.unmarked}</span>
                            <span className="text-[10px] font-bold text-slate-600">Non pointé</span>
                          </div>
                        </div>
                      </div>

                      {/* Section Historique + Filtre interne */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                            <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              Historique de présence — 30 derniers jours
                            </h4>
                          </div>

                          {/* Filtre de statut interne */}
                          <select
                            value={attendanceHistoryFilter}
                            onChange={(e) => setAttendanceHistoryFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                          >
                            <option value="all">Tous les statuts ({last30DaysList.length})</option>
                            <option value="present">Présents ({historySummary.present})</option>
                            <option value="late">Retards ({historySummary.late})</option>
                            <option value="absent">Absents ({historySummary.absent})</option>
                            <option value="unmarked">Non pointés ({historySummary.unmarked})</option>
                          </select>
                        </div>

                        {/* Liste chronologique (du plus récent au plus ancien) */}
                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                          {filtered30DaysList.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs">
                              Aucun jour ne correspond au filtre sélectionné.
                            </div>
                          ) : (
                            filtered30DaysList.map((item) => {
                              const isToday = item.dateStr === todayStr;
                              return (
                                <div
                                  key={item.dateStr}
                                  className={`p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                                    isToday
                                      ? 'bg-emerald-50/40 border-emerald-200 shadow-2xs'
                                      : 'bg-white border-slate-200/70 hover:bg-slate-50/60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-bold text-slate-900">
                                        {formatDateFr(item.dateStr)}
                                      </span>
                                      {isToday && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                          Aujourd&apos;hui
                                        </span>
                                      )}
                                    </div>

                                    {/* Badge Statut */}
                                    {item.status === 'present' && (
                                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Présent</span>
                                      </span>
                                    )}
                                    {item.status === 'late' && (
                                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        <span>Retard</span>
                                      </span>
                                    )}
                                    {item.status === 'absent' && (
                                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/80">
                                        <X className="w-3 h-3 text-rose-600" />
                                        <span>Absent</span>
                                      </span>
                                    )}
                                    {item.status === 'unmarked' && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200/80">
                                        Non pointé
                                      </span>
                                    )}
                                  </div>

                                  {/* Motif si disponible */}
                                  {item.reason && item.reason.trim() !== '' && (
                                    <div className="mt-0.5 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px] text-slate-700 italic">
                                      <strong className="font-semibold text-slate-900 not-italic">Motif : </strong>
                                      &ldquo;{item.reason}&rdquo;
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer / Readonly Notice */}
                    <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 text-[11px] text-slate-500 text-center font-medium">
                      🔒 Historique en lecture seule. Pour modifier le pointage d&apos;aujourd&apos;hui, utilisez le tableau principal.
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* TAB 5: AGENT PAGE (CLAUDE.AI STYLE RESTRUCTURED WITH BRAND DESIGN) */}
        {hasPermission('agent') && activeTab === 'agent' && (
          <div className="bg-[#FAF7F2] text-[#241F1B] min-h-[680px] rounded-3xl p-4 sm:p-6 relative flex flex-col md:flex-row gap-4 overflow-hidden shadow-2xs border border-[#E5DCD0] font-sans">
            
            {/* INNER AGENT SIDEBAR (Claude.ai Style) */}
            <div className="w-full md:w-72 shrink-0 bg-[#F5F0E8] border border-[#E5DCD0] rounded-2xl p-4 flex flex-col justify-between space-y-4 font-sans">
              <div className="space-y-4">
                {/* Top New Conversation Button */}
                <button
                  onClick={() => handleStartNewConversation()}
                  className="w-full flex items-center justify-center space-x-2 bg-[#1B4B4A] hover:bg-[#143938] text-white py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle conversation</span>
                </button>

                {/* Search / Filter input inside sidebar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={agentSearchQuery}
                    onChange={(e) => setAgentSearchQuery(e.target.value)}
                    placeholder="Rechercher une discussion..."
                    className="w-full bg-white/80 border border-[#E5DCD0] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#241F1B] placeholder-slate-400 focus:outline-none focus:border-[#1B4B4A]"
                  />
                </div>

                {/* Discussions Section */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-bold px-2 py-1">
                    Discussions
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {activeConversations.filter(c => !agentSearchQuery || c.title.toLowerCase().includes(agentSearchQuery.toLowerCase())).length === 0 ? (
                      <p className="text-xs text-slate-400 italic px-2 py-1">Aucune discussion active</p>
                    ) : (
                      activeConversations
                        .filter(c => !agentSearchQuery || c.title.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                        .map((conv) => {
                          const isSelected = selectedConversationId === conv.id;
                          return (
                            <div
                              key={conv.id}
                              className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                                isSelected && !isTrashViewOpen
                                  ? 'bg-white border border-[#E5DCD0] text-[#241F1B] shadow-2xs'
                                  : 'hover:bg-white/60 text-slate-600'
                              }`}
                              onClick={() => {
                                setSelectedConversationId(conv.id);
                                setIsTrashViewOpen(false);
                              }}
                            >
                              <div className="flex items-center space-x-2 truncate pr-1">
                                <MessageSquare className="w-3.5 h-3.5 text-[#1B4B4A] shrink-0" />
                                <span className="truncate">{conv.title}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  store.moveConversationToTrash(conv.id);
                                  if (selectedConversationId === conv.id) {
                                    setSelectedConversationId(null);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#B5451B] text-slate-400 transition-opacity cursor-pointer"
                                title="Mettre en corbeille"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Projets Section */}
                <div className="space-y-1.5 pt-2 border-t border-[#E5DCD0]">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-bold">
                      Projets ({store.agentProjects.length})
                    </span>
                    <button
                      onClick={() => setShowNewProjectForm(true)}
                      className="p-1 text-slate-500 hover:text-[#1B4B4A] cursor-pointer"
                      title="Créer un projet"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {showNewProjectForm && (
                    <div className="p-2 bg-white rounded-xl border border-[#E5DCD0] space-y-2">
                      <input
                        type="text"
                        value={newProjectInput}
                        onChange={(e) => setNewProjectInput(e.target.value)}
                        placeholder="Nom du projet..."
                        className="w-full text-xs p-1.5 border border-[#E5DCD0] rounded-lg focus:outline-none focus:border-[#1B4B4A]"
                        autoFocus
                      />
                      <div className="flex justify-end space-x-1">
                        <button
                          onClick={() => setShowNewProjectForm(false)}
                          className="p-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCreateProject}
                          className="px-2 py-1 text-xs bg-[#1B4B4A] text-white rounded-lg hover:bg-[#143938] cursor-pointer"
                        >
                          Créer
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {store.agentProjects.length === 0 ? (
                      <p className="text-xs text-slate-400 italic px-2 py-1">Aucun projet créé</p>
                    ) : (
                      store.agentProjects.map((proj) => {
                        const projConvs = activeConversations.filter(c => c.project_id === proj.id);
                        const isExpanded = expandedProjects[proj.id] ?? true;
                        return (
                          <div key={proj.id} className="space-y-1">
                            <div className="flex items-center justify-between p-2 rounded-xl text-xs font-semibold bg-white/40 hover:bg-white/80 transition-all">
                              <div
                                className="flex items-center space-x-1.5 flex-1 cursor-pointer truncate"
                                onClick={() =>
                                  setExpandedProjects(prev => ({ ...prev, [proj.id]: !isExpanded }))
                                }
                              >
                                {isExpanded ? (
                                  <FolderOpen className="w-3.5 h-3.5 text-[#B5451B] shrink-0" />
                                ) : (
                                  <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                {editingProjectId === proj.id ? (
                                  <input
                                    type="text"
                                    value={editingProjectName}
                                    onChange={(e) => setEditingProjectName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameProject(proj.id);
                                    }}
                                    className="text-xs p-0.5 border border-[#E5DCD0] rounded bg-white"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="truncate">{proj.name}</span>
                                )}
                              </div>

                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleStartNewConversation(proj.id)}
                                  className="p-1 hover:text-[#1B4B4A] text-slate-400 cursor-pointer"
                                  title="Nouvelle discussion dans ce projet"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                {editingProjectId === proj.id ? (
                                  <button
                                    onClick={() => handleRenameProject(proj.id)}
                                    className="p-1 hover:text-emerald-600 text-slate-400 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingProjectId(proj.id);
                                      setEditingProjectName(proj.name);
                                    }}
                                    className="p-1 hover:text-slate-800 text-slate-400 cursor-pointer"
                                    title="Renommer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => store.deleteAgentProject(proj.id)}
                                  className="p-1 hover:text-[#B5451B] text-slate-400 cursor-pointer"
                                  title="Supprimer le projet"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* List of discussions inside project */}
                            {isExpanded && (
                              <div className="pl-4 space-y-1">
                                {projConvs.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic px-2">Aucune discussion</p>
                                ) : (
                                  projConvs.map(conv => (
                                    <div
                                      key={conv.id}
                                      onClick={() => setSelectedConversationId(conv.id)}
                                      className={`p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                                        selectedConversationId === conv.id
                                          ? 'bg-white text-[#241F1B] border border-[#E5DCD0] font-semibold'
                                          : 'text-slate-600 hover:bg-white/50'
                                      }`}
                                    >
                                      <span className="truncate">{conv.title}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          store.assignConversationToProject(conv.id, null);
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-[#B5451B] cursor-pointer"
                                        title="Retirer du projet"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Corbeille Section at Bottom of Sidebar */}
              <div className="pt-2 border-t border-[#E5DCD0]">
                <button
                  onClick={() => setIsTrashViewOpen(true)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isTrashViewOpen
                      ? 'bg-white border border-[#E5DCD0] shadow-2xs text-[#B5451B] font-bold'
                      : 'hover:bg-white/60 text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Trash2 className="w-4 h-4 text-[#B5451B]" />
                    <span className="text-xs">Corbeille ({trashedConversations.length})</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-[#B5451B] font-bold border border-red-100">
                    {trashedConversations.length}
                  </span>
                </button>
              </div>
            </div>

            {/* MAIN CHAT WORKSPACE AREA */}
            <div className="flex-1 flex flex-col justify-between space-y-4 p-2 sm:p-4">
              {isTrashViewOpen ? (
                /* VUE DÉDIÉE CORBEILLE */
                <div className="flex-1 flex flex-col space-y-4 h-full">
                  {/* Top Bar for Trash View */}
                  <div className="flex items-center justify-between w-full border-b border-[#E5DCD0]/60 pb-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setIsTrashViewOpen(false)}
                        className="w-9 h-9 rounded-full bg-white border border-[#E5DCD0] flex items-center justify-center hover:bg-slate-100 transition-all cursor-pointer text-[#241F1B] shadow-2xs"
                        title="Retour aux discussions"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h3 className="text-base font-bold text-[#241F1B] flex items-center space-x-2">
                          <Trash2 className="w-4 h-4 text-[#B5451B]" />
                          <span>Corbeille des conversations</span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          {trashedConversations.length} discussion(s) mise(s) en corbeille
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsTrashViewOpen(false)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#E5DCD0] hover:bg-[#FAF7F2] text-[#241F1B] rounded-xl shadow-2xs transition-all cursor-pointer"
                    >
                      Retour aux discussions
                    </button>
                  </div>

                  {/* List of Trashed Conversations */}
                  <div className="flex-1 overflow-y-auto pr-1 py-2">
                    {trashedConversations.length === 0 ? (
                      <div className="max-w-md mx-auto my-auto text-center py-16 space-y-3">
                        <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] flex items-center justify-center mx-auto text-slate-400">
                          <Trash2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-base font-bold text-[#241F1B]">La corbeille est vide</h4>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Aucune discussion ne se trouve dans la corbeille pour le moment.
                        </p>
                        <button
                          onClick={() => setIsTrashViewOpen(false)}
                          className="mt-2 px-4 py-2 bg-[#1B4B4A] text-white text-xs font-semibold rounded-xl hover:bg-[#143938] transition-colors cursor-pointer"
                        >
                          Retourner aux discussions
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-w-2xl mx-auto w-full pt-2">
                        {trashedConversations.map((conv) => {
                          const projName = conv.project_id
                            ? store.agentProjects.find((p) => p.id === conv.project_id)?.name
                            : null;
                          return (
                            <div
                              key={conv.id}
                              className="p-4 rounded-2xl bg-white border border-[#E5DCD0] shadow-2xs flex items-center justify-between space-x-4 hover:border-slate-300 transition-all"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center space-x-2">
                                  <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                                  <h4 className="text-sm font-bold text-[#241F1B] truncate">{conv.title}</h4>
                                  {projName && (
                                    <span className="text-[10px] font-semibold bg-[#FAF7F2] border border-[#E5DCD0] text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                                      {projName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {conv.updated_at
                                    ? `Modifié le ${new Date(conv.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                    : 'En corbeille'}
                                </p>
                              </div>

                              <div className="flex items-center space-x-2 shrink-0">
                                <button
                                  onClick={() => {
                                    store.restoreConversationFromTrash(conv.id);
                                  }}
                                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                                  title="Restaurer la discussion"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restaurer</span>
                                </button>
                                <button
                                  onClick={() => store.deleteConversationPermanently(conv.id)}
                                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-[#B5451B] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Supprimer définitivement</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* CHAT WORKSPACE NORMAL */
                <>
                  {/* Top Bar: Circular Back Arrow & Conversation Context */}
                  <div className="flex items-center justify-between w-full border-b border-[#E5DCD0]/60 pb-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setActiveTab('overview')}
                        className="w-9 h-9 rounded-full bg-white border border-[#E5DCD0] flex items-center justify-center hover:bg-slate-100 transition-all cursor-pointer text-[#241F1B] shadow-2xs"
                        title="Retour au Tableau de bord"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      {currentConversation && (
                        <div>
                          <h3 className="text-sm font-bold text-[#241F1B]">{currentConversation.title}</h3>
                          <p className="text-[11px] text-slate-500">
                            {currentConversation.project_id
                              ? `Projet: ${store.agentProjects.find(p => p.id === currentConversation.project_id)?.name || 'Inconnu'}`
                              : 'Discussion non classée'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Project Assignment Dropdown / Quick Actions if active conversation */}
                    {currentConversation && (
                      <div className="flex items-center space-x-2">
                        <select
                          value={currentConversation.project_id || ''}
                          onChange={(e) => store.assignConversationToProject(currentConversation.id, e.target.value || null)}
                          className="text-xs bg-white border border-[#E5DCD0] rounded-xl px-2.5 py-1.5 text-[#241F1B] focus:outline-none focus:border-[#1B4B4A] cursor-pointer"
                        >
                          <option value="">-- Sans projet --</option>
                          {store.agentProjects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            store.moveConversationToTrash(currentConversation.id);
                            setSelectedConversationId(null);
                          }}
                          className="p-2 text-slate-400 hover:text-[#B5451B] hover:bg-white rounded-xl border border-transparent hover:border-[#E5DCD0] transition-all cursor-pointer"
                          title="Mettre en corbeille"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

              {/* MAIN CONTENT WORKSPACE: STATE 1 (WELCOME) vs STATE 2 (ACTIVE CHAT STREAM) */}
              <div className="flex-1 flex flex-col justify-center py-4">
                {!currentConversation || currentMessages.length === 0 ? (
                  /* ÉTAT 1 — Aucune conversation active (écran d'accueil) */
                  <div className="max-w-2xl mx-auto w-full text-center space-y-6 my-auto">
                    <div className="space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-[#241F1B]">
                        Bonjour, {activeStaff?.name ? activeStaff.name.split(' ')[0] : 'Gérant'}
                      </h2>
                      <p className="text-sm sm:text-base text-slate-600 font-medium max-w-lg mx-auto">
                        Comment puis-je vous aider aujourd&apos;hui ? Posez une question sur votre commerce ou lancez une analyse.
                      </p>
                    </div>

                    {/* Suggestion Pills */}
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      <button
                        onClick={() => handleSendAgentMessage("Combien de commandes sont enregistrées ?")}
                        className="bg-white border border-[#E5DCD0] hover:border-[#1B4B4A] hover:bg-[#1B4B4A]/5 text-[#241F1B] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        📊 Synthèse des commandes
                      </button>
                      <button
                        onClick={() => handleSendAgentMessage("Combien de clients compte notre base ?")}
                        className="bg-white border border-[#E5DCD0] hover:border-[#1B4B4A] hover:bg-[#1B4B4A]/5 text-[#241F1B] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        👥 Nombre de clients enregistrés
                      </button>
                      <button
                        onClick={() => handleSendAgentMessage("Lancer mon projet avec l'IA")}
                        className="bg-[#1B4B4A] text-white hover:bg-[#143938] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        🚀 Lancer mon projet avec l&apos;IA
                      </button>
                      <button
                        onClick={() => handleSendAgentMessage("Quel est l'état du catalogue produits ?")}
                        className="bg-white border border-[#E5DCD0] hover:border-[#1B4B4A] hover:bg-[#1B4B4A]/5 text-[#241F1B] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        📦 État du catalogue produits
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ÉTAT 2 — Conversation active (fil de messages) */
                  <div className="space-y-6 max-h-[460px] overflow-y-auto pr-2 flex-1">
                    {currentMessages.map((msg) => (
                      <div key={msg.id} className="space-y-1.5">
                        {msg.sender === 'user' ? (
                          <div className="flex flex-col items-end space-y-1">
                            <div className="bg-slate-100 border border-slate-200/80 text-slate-700 rounded-2xl sm:rounded-3xl px-5 py-3 text-xs sm:text-sm font-medium shadow-2xs max-w-xl">
                              {msg.text}
                            </div>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 justify-end max-w-xl">
                                {msg.attachments.map((att) => (
                                  <div key={att.id} className="bg-white border border-[#E5DCD0] rounded-xl p-2 text-xs text-[#241F1B] shadow-2xs space-y-1">
                                    {att.type.startsWith('image/') ? (
                                      <div>
                                        <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[140px] object-cover rounded-lg" />
                                        <p className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-[180px]">{att.name}</p>
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-2">
                                        <Paperclip className="w-4 h-4 text-[#1B4B4A] shrink-0" />
                                        <div className="truncate">
                                          <p className="font-semibold truncate max-w-[140px]">{att.name}</p>
                                          <p className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(0)} Ko</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2 text-[10px] font-mono tracking-[0.2em] text-[#1B4B4A] uppercase font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1B4B4A] inline-block" />
                              <span>Assistant IA</span>
                            </div>
                            <p className="text-sm sm:text-base font-medium text-[#241F1B] leading-relaxed max-w-2xl bg-white/60 p-4 rounded-2xl border border-[#E5DCD0]/60 whitespace-pre-line">
                              {msg.text}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Input Area */}
              <div className="w-full space-y-2 pt-2 border-t border-[#E5DCD0]/60">
                {/* Staged Attachments Preview */}
                {stagedAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-[#F5F0E8] border border-[#E5DCD0] rounded-2xl">
                    {stagedAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center space-x-2 bg-white border border-[#E5DCD0] rounded-xl px-2.5 py-1.5 text-xs text-[#241F1B] shadow-2xs"
                      >
                        {att.type.startsWith('image/') ? (
                          <img src={att.url} alt={att.name} className="w-6 h-6 object-cover rounded-lg shrink-0" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-[#1B4B4A] shrink-0" />
                        )}
                        <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                        <span className="text-[10px] text-slate-400">({(att.size / 1024).toFixed(0)} Ko)</span>
                        <button
                          onClick={() => setStagedAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                          className="p-0.5 text-slate-400 hover:text-[#B5451B] rounded-full hover:bg-slate-100 cursor-pointer"
                          title="Retirer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white border border-[#E5DCD0] focus-within:border-slate-400 rounded-full px-4 py-2.5 flex items-center space-x-3 shadow-2xs transition-all relative">
                  {/* Plus Button with Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowPlusMenu((prev) => !prev)}
                      className={`p-1 rounded-full transition-colors cursor-pointer ${
                        showPlusMenu ? 'bg-[#FAF7F2] text-[#241F1B] border border-[#E5DCD0]' : 'text-slate-400 hover:text-[#241F1B]'
                      }`}
                      title="Ajouter un fichier"
                    >
                      <Plus className="w-5 h-5" />
                    </button>

                    {showPlusMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowPlusMenu(false)}
                        />
                        <div className="absolute bottom-full mb-3 left-0 z-50 bg-[#FAF7F2] border border-[#E5DCD0] rounded-2xl shadow-xl p-1.5 min-w-[210px] space-y-1 font-sans">
                          <button
                            onClick={() => {
                              setShowPlusMenu(false);
                              agentFileInputRef.current?.click();
                            }}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#241F1B] hover:bg-[#B5451B]/10 hover:text-[#B5451B] transition-colors cursor-pointer text-left"
                          >
                            <Paperclip className="w-4 h-4 text-[#1B4B4A] shrink-0" />
                            <span>Ajouter des fichiers</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={agentFileInputRef}
                    multiple
                    onChange={handleAgentFileUpload}
                    className="hidden"
                  />

                  <input
                    type="text"
                    value={agentChatInput}
                    onChange={(e) => setAgentChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAgentMessage();
                      }
                    }}
                    placeholder="Écrire un message..."
                    className="bg-transparent text-xs sm:text-sm text-[#241F1B] placeholder-slate-400 focus:outline-none flex-1 font-medium"
                  />

                  <button
                    onClick={() => handleSendAgentMessage()}
                    className="w-9 h-9 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

          </div>
        )}

        {/* TAB 6: PARAMÈTRES (STORE SETTINGS, OWNER ONLY) */}
        {hasPermission('settings') && activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Réglages Généraux</span>
                <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-black uppercase">
                  Réservé au Gérant
                </span>
              </div>

              {/* Profile Form */}
              <form onSubmit={handleSaveBizProfile} className="mt-6 space-y-4 max-w-xl">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Nom du commerce</label>
                  <input
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Numéro WhatsApp Business</label>
                  <input
                    type="text"
                    value={bizWhatsapp}
                    onChange={(e) => setBizWhatsapp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Devise (Currency)</label>
                  <input
                    type="text"
                    value={bizCurrency}
                    onChange={(e) => setBizCurrency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </form>
            </div>

            {/* Delivery Zones Table (delivery_zones) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                    <Truck className="w-5 h-5 text-emerald-600" />
                    <span>Zones de Livraison (`delivery_zones`)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Définissez les zones de livraison et leurs frais fixes associés pour le storefront client.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingZone({ business_id: business.id, name: '', fee: 1000, active: true });
                    setIsZoneModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-emerald-500/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter une Zone</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/90 text-slate-500 uppercase font-black text-[10px] border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-4">Zone</th>
                      <th className="py-3 px-4">Frais Fixe</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {store.getDeliveryZones(business.id).map((zone) => (
                      <tr key={zone.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">{zone.name}</td>
                        <td className="py-3.5 px-4 font-black text-emerald-700">
                          {zone.fee.toLocaleString()} {business.currency}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => store.toggleDeliveryZoneActive(zone.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                              zone.active
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {zone.active ? 'Actif' : 'Inactif'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingZone(zone);
                              setIsZoneModalOpen(true);
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                          >
                            Éditer
                          </button>
                          <button
                            onClick={() => setDeletingZone(zone)}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-200 transition-colors cursor-pointer"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                    {store.getDeliveryZones(business.id).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                          Aucune zone de livraison définie.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Aggregator & Channels Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-6">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>Agrégateur de Paiement</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configurez votre plateforme d&apos;encaissement globale (PayDunya ou CinetPay) pour recevoir vos fonds directement.
                </p>
              </div>

              {/* 1. Payment Gateway Configuration */}
              <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Provider Select */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      Agrégateur actif
                    </label>
                    <select
                      value={gwProvider}
                      onChange={(e) => setGwProvider(e.target.value as 'paydunya' | 'cinetpay')}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs cursor-pointer"
                    >
                      <option value="paydunya">PayDunya (Sénégal & UEMOA)</option>
                      <option value="cinetpay">CinetPay (Afrique de l&apos;Ouest &amp; Centrale)</option>
                    </select>
                  </div>

                  {/* Public API Key */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      Clé API publique (Master Key)
                    </label>
                    <input
                      type="text"
                      value={gwPublicKey}
                      onChange={(e) => setGwPublicKey(e.target.value)}
                      placeholder={gwProvider === 'paydunya' ? 'Ex: pk_live_891203...' : 'Ex: 198273645...'}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  {/* Secret API Key with Toggle */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      Clé API secrète (PrivateKey / Secret)
                    </label>
                    <div className="relative">
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        value={gwSecretKey}
                        onChange={(e) => setGwSecretKey(e.target.value)}
                        placeholder="••••••••••••••••••••"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title={showSecretKey ? 'Masquer la clé' : 'Afficher la clé'}
                      >
                        {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Les clés secrètes sont transmises en toute sécurité. Les transactions pour <strong>Wave</strong>, <strong>Orange Money</strong> et <strong>Carte bancaire</strong> seront traitées via <strong>{gwProvider === 'paydunya' ? 'PayDunya' : 'CinetPay'}</strong>.
                  </span>
                </div>
              </div>

              {/* 2. Payment Channels Available to Customers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Méthodes de paiement proposées aux clients (`payment_channels`)
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500">
                    {currentChs.filter((c) => channelStates[c.id] ?? c.enabled).length} sur 3 actives
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentChs.map((channel) => {
                    const isEnabled = channelStates[channel.id] ?? channel.enabled;
                    return (
                      <div
                        key={channel.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isEnabled
                            ? 'border-emerald-200 bg-emerald-50/20 shadow-2xs'
                            : 'border-slate-200 bg-slate-50/50 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-2xs ${
                                channel.id === 'wave'
                                  ? 'bg-sky-500 text-white'
                                  : channel.id === 'orange_money'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-indigo-600 text-white'
                              }`}
                            >
                              {channel.id === 'wave'
                                ? 'W'
                                : channel.id === 'orange_money'
                                ? 'OM'
                                : 'CB'}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 text-sm block">{channel.name}</span>
                              <span className="text-[10px] font-bold text-slate-400">
                                {isEnabled ? 'Proposé en caisse' : 'Désactivé'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setChannelStates((prev) => ({
                                ...prev,
                                [channel.id]: !isEnabled,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer ${
                              isEnabled
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {isEnabled ? 'Actif' : 'Inactif'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Staff Team Management */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Équipe & Membres du Staff ({businessStaff.length})</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gérez les collaborateurs et attribuez des autorisations sur les sections du Dashboard.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingStaffId(null);
                    setInviteName('');
                    setInviteEmail('');
                    setInvitePhone('');
                    setInviteRoleTitle('');
                    setInviteSalary(250000);
                    setInvitePhotoUrl('');
                    setInvitePerms({
                      orders: true,
                      products: true,
                      customers: true,
                      agent: false,
                      settings: false,
                      staff: false,
                      finance: false,
                    });
                    setIsInviteModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Inviter un Collaborateur</span>
                </button>
              </div>

              {/* Staff Tabs Filter (Actifs / Révoqués) */}
              <div className="flex items-center space-x-2 mt-4 pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setStaffTab('active')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                    staffTab === 'active'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>Actifs</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      staffTab === 'active' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {businessStaff.filter((s) => !s.revoked).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStaffTab('revoked')}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                    staffTab === 'revoked'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>Révoqués</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      staffTab === 'revoked' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {businessStaff.filter((s) => s.revoked === true).length}
                  </span>
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/90 text-slate-500 uppercase font-black text-[10px] border-b border-slate-200/80">
                    <tr>
                      <th className="py-3.5 px-4">Membre</th>
                      <th className="py-3.5 px-4">Rôle</th>
                      <th className="py-3.5 px-4">Permissions Actives</th>
                      {staffTab === 'revoked' && <th className="py-3.5 px-4">Raison</th>}
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {businessStaff
                      .filter((s) => (staffTab === 'active' ? !s.revoked : s.revoked === true))
                      .length === 0 ? (
                      <tr>
                        <td colSpan={staffTab === 'revoked' ? 5 : 4} className="py-8 text-center text-slate-400 text-xs italic">
                          {staffTab === 'active' ? 'Aucun membre actif.' : 'Aucun membre révoqué.'}
                        </td>
                      </tr>
                    ) : (
                      businessStaff
                        .filter((s) => (staffTab === 'active' ? !s.revoked : s.revoked === true))
                        .map((staff) => (
                          <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-4 font-extrabold text-slate-900">
                              <div className="flex items-center space-x-2.5">
                                {staff.photo_url || staff.avatar_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setZoomedPhotoUrl(staff.photo_url || staff.avatar_url || '')}
                                    className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200 hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer"
                                    title="Cliquer pour agrandir la photo"
                                  >
                                    <img
                                      src={staff.photo_url || staff.avatar_url}
                                      alt={staff.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center font-black shrink-0">
                                    {staff.name.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <span className="block">{staff.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{staff.email}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                  staff.role === 'owner'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                                }`}
                              >
                                {staff.role === 'owner' ? 'Gérant (Owner)' : 'Collaborateur'}
                              </span>
                            </td>

                            <td className="py-4 px-4">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(staff.permissions).map(([perm, val]) => (
                                  <span
                                    key={perm}
                                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                      val
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-400 line-through'
                                    }`}
                                  >
                                    {perm}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {staffTab === 'revoked' && (
                              <td className="py-4 px-4">
                                {staff.revocation_reason && activeStaff.role === 'owner' ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingReasonStaff(staff);
                                    }}
                                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 px-2.5 py-1 rounded-md font-medium flex items-center space-x-1 cursor-pointer transition-colors max-w-[200px] group"
                                    title="Cliquer pour voir la raison complète"
                                  >
                                    <span className="truncate text-slate-600">
                                      {staff.revocation_reason.length > 28
                                        ? staff.revocation_reason.slice(0, 28) + '...'
                                        : staff.revocation_reason}
                                    </span>
                                    <Info className="w-3 h-3 text-slate-400 group-hover:text-slate-700 shrink-0 ml-0.5" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">-</span>
                                )}
                              </td>
                            )}

                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStaffId(staff.id);
                                    setInviteName(staff.name);
                                    setInviteEmail(staff.email);
                                    setInvitePhone(staff.phone || '');
                                    setInviteRoleTitle(staff.role_title || '');
                                    setInviteSalary(staff.salary ?? 250000);
                                    setInvitePhotoUrl(staff.photo_url || staff.avatar_url || '');
                                    setInvitePerms({ ...staff.permissions });
                                    setIsInviteModalOpen(true);
                                  }}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                                  title="Éditer les informations du membre"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {staffTab === 'active' ? (
                                  staff.role !== 'owner' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRevokingStaffMember(staff);
                                        setRevocationReasonInput('');
                                      }}
                                      className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                                    >
                                      Révoquer
                                    </button>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => store.reactivateStaff(staff.id)}
                                    className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer"
                                  >
                                    Réactiver
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Webhook Tester Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
              <h3 className="font-extrabold text-slate-900 text-base">Testeur de Webhook de Paiement (Wave / OM)</h3>
              <p className="text-xs text-slate-500 mt-1">
                Simulez l&apos;appel serveur-à-serveur renvoyé par l&apos;agrégateur lors de la validation d&apos;un règlement.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <select
                  value={testOrderId}
                  onChange={(e) => setTestOrderId(e.target.value)}
                  className="bg-slate-50 text-slate-800 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:border-emerald-500 shadow-2xs"
                >
                  <option value="">Sélectionner une commande...</option>
                  {businessOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id} - {o.customer_name} ({o.total_amount} {business.currency})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={testPaymentRef}
                  onChange={(e) => setTestPaymentRef(e.target.value)}
                  className="bg-slate-50 text-slate-800 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:border-emerald-500 shadow-2xs"
                  placeholder="Référence de paiement Wave"
                />

                <button
                  onClick={runWebhookTest}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs rounded-xl p-3 transition-all shadow-2xs"
                >
                  Simuler Webhook POST
                </button>
              </div>

              {webhookLogs.length > 0 && (
                <div className="mt-4 p-3 bg-slate-900 rounded-2xl border border-slate-800 font-mono text-[10px] text-cyan-300 space-y-1">
                  {webhookLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Sticky Unified Settings Save Bar */}
            <div className="sticky bottom-6 z-30 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/90 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 transition-all">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    hasSettingsChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">
                    {hasSettingsChanges
                      ? 'Modifications non enregistrées'
                      : 'Toutes les modifications sont enregistrées'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {hasSettingsChanges
                      ? 'Réglages généraux, agrégateur ou canaux modifiés.'
                      : 'Aucune modification en attente.'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCancelSettingsChanges}
                  disabled={!hasSettingsChanges}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    hasSettingsChanges
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-slate-100/50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllSettings}
                  disabled={!hasSettingsChanges}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                    hasSettingsChanges
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-98'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. PAGE MON PROFIL (PERSONAL MEMBER PROFILE - SEPARATED FROM SETTINGS) */}
        {hasPermission('profile') && activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Main Profile Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* CARTE DE GAUCHE (~30% / 4 colonnes sur 12) */}
              <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
                {/* Avatar + Nom + Rôle */}
                <div className="flex flex-col items-center text-center">
                  <div className="relative group mb-4">
                    {/* Avatar Display - Click to Zoom if photo exists */}
                    {(activeStaff.photo_url || activeStaff.avatar_url) ? (
                      <button
                        type="button"
                        onClick={() => setIsProfileAvatarZoomOpen(true)}
                        className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-100 cursor-pointer block hover:ring-2 hover:ring-[#1B4B4A]/50 transition-all focus:outline-none"
                        title="Cliquer pour agrandir la photo"
                      >
                        <Image
                          src={activeStaff.photo_url || activeStaff.avatar_url!}
                          alt={activeStaff.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-[#FAF7F2] border-2 border-[#1B4B4A]/20 text-[#1B4B4A] flex items-center justify-center font-black text-3xl shadow-sm cursor-default">
                        {getInitials(activeStaff.name)}
                      </div>
                    )}

                    {/* Overlay d'upload photo - Distinct and stops event propagation */}
                    <label
                      htmlFor="profile-avatar-upload"
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-0 right-0 p-2 rounded-full cursor-pointer transition-all shadow-md z-10 ${
                        profileAvatarUploading
                          ? 'bg-slate-400 text-white cursor-not-allowed'
                          : 'bg-[#1B4B4A] text-white hover:bg-[#153a39] active:scale-95'
                      }`}
                      title="Changer la photo de profil"
                    >
                      {profileAvatarUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      <input
                        id="profile-avatar-upload"
                        type="file"
                        accept="image/*"
                        disabled={profileAvatarUploading}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setCropImageSrc(reader.result);
                              setCropTarget('profile');
                              setCropModalOpen(true);
                            }
                          };
                          reader.readAsDataURL(file);
                          // Reset input so the same file can be selected again
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <h2 className="font-extrabold text-slate-900 text-lg leading-tight">
                    {activeStaff.name}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {activeStaff.role === 'owner'
                      ? 'Gérant Principal'
                      : (activeStaff.role_title || 'Collaborateur')}
                  </p>
                </div>

                {/* Séparateur fin */}
                <div className="border-t border-slate-100" />

                {/* Menu de navigation interne vertical */}
                <nav className="space-y-1.5" aria-label="Navigation profil">
                  <button
                    type="button"
                    onClick={() => setActiveProfileSection('personal')}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                      activeProfileSection === 'personal'
                        ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <User className={`w-4 h-4 shrink-0 ${activeProfileSection === 'personal' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                    <span className="truncate">Informations Personnelles</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProfileSection('security')}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                      activeProfileSection === 'security'
                        ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Lock className={`w-4 h-4 shrink-0 ${activeProfileSection === 'security' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                    <span className="truncate">Sécurité</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProfileSection('notifications')}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                      activeProfileSection === 'notifications'
                        ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Bell className={`w-4 h-4 shrink-0 ${activeProfileSection === 'notifications' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                    <span className="truncate">Préférences de Notification</span>
                  </button>

                  {/* Visible uniquement si activeStaff.role === 'owner' */}
                  {activeStaff.role === 'owner' && (
                    <button
                      type="button"
                      onClick={() => setActiveProfileSection('billing')}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                        activeProfileSection === 'billing'
                          ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <CreditCard className={`w-4 h-4 shrink-0 ${activeProfileSection === 'billing' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                      <span className="truncate">Abonnement &amp; Facturation</span>
                    </button>
                  )}
                </nav>
              </div>

              {/* ZONE DE DROITE (~70% / 8 colonnes sur 12) */}
              <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6 min-h-[420px]">
                {/* En-tête de section dynamique avec bouton Modifier / Enregistrer / Annuler */}
                <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      {activeProfileSection === 'personal' && 'Informations Personnelles'}
                      {activeProfileSection === 'security' && 'Sécurité (mot de passe)'}
                      {activeProfileSection === 'notifications' && 'Préférences de Notification'}
                      {activeProfileSection === 'billing' && 'Abonnement & Facturation'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeProfileSection === 'personal' && 'Gérez vos coordonnées et informations d\'identification.'}
                      {activeProfileSection === 'security' && 'Mettez à jour votre mot de passe et vos paramètres d\'authentification.'}
                      {activeProfileSection === 'notifications' && 'Configurez vos canaux de réception et alertes en temps réel.'}
                      {activeProfileSection === 'billing' && 'Consultez votre formule d\'abonnement et vos factures.'}
                    </p>
                  </div>

                  {/* Actions d'édition spécifiques à la section Informations Personnelles */}
                  {activeProfileSection === 'personal' && (
                    <div className="flex items-center space-x-2 shrink-0">
                      {!isEditingPersonalInfo ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPersonalInfoError(null);
                            const names = splitStaffName(activeStaff.name);
                            setProfileEditFirstName(names.firstName);
                            setProfileEditLastName(names.lastName);
                            setProfileEditEmail(activeStaff.email || '');
                            setProfileEditPhone(activeStaff.phone || '');
                            setIsEditingPersonalInfo(true);
                          }}
                          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#1B4B4A]" />
                          <span>Modifier</span>
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={personalInfoSaving}
                            onClick={handleCancelPersonalInfo}
                            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Annuler</span>
                          </button>
                          <button
                            type="button"
                            disabled={personalInfoSaving}
                            onClick={handleSavePersonalInfo}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#1B4B4A] hover:bg-[#153a39] text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {personalInfoSaving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Enregistrement...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Enregistrer</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section Informations Personnelles avec vraies données */}
                {activeProfileSection === 'personal' ? (
                  <div className="space-y-6">
                    {/* Message de succès */}
                    {personalInfoSuccess && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Vos informations personnelles ont été mises à jour avec succès.</span>
                      </div>
                    )}

                    {/* Message d'erreur de validation ou réseau */}
                    {personalInfoError && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{personalInfoError}</span>
                      </div>
                    )}

                    {/* Badge Rôle (lecture seule, jamais éditable) */}
                    <div className="p-4 rounded-2xl bg-[#FAF7F2]/60 border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-white text-[#1B4B4A] border border-[#1B4B4A]/10 flex items-center justify-center shrink-0 shadow-2xs">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rôle sur le compte</div>
                          <div className="text-xs font-medium text-slate-600">Niveau d&apos;autorisation assigné</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                        activeStaff.role === 'owner'
                          ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {activeStaff.role === 'owner' ? 'Propriétaire / Gérant' : (activeStaff.role_title || 'Collaborateur')}
                      </span>
                    </div>

                    {/* Formulaire / Affichage des 4 champs : Nom, Prénom, Email, Téléphone */}
                    {!isEditingPersonalInfo ? (
                      /* MODE LECTURE SEULE (texte simple, pas d'inputs visibles) */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Prénom */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Prénom
                          </span>
                          <p className="text-sm font-extrabold text-slate-900">
                            {splitStaffName(activeStaff.name).firstName || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>

                        {/* Nom */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Nom
                          </span>
                          <p className="text-sm font-extrabold text-slate-900">
                            {splitStaffName(activeStaff.name).lastName || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>

                        {/* Email */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Adresse Email
                          </span>
                          <p className="text-sm font-extrabold text-slate-900 break-all">
                            {activeStaff.email || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>

                        {/* Téléphone */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Numéro de Téléphone
                          </span>
                          <p className="text-sm font-extrabold text-slate-900">
                            {activeStaff.phone || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* MODE ÉDITION (4 inputs éditables avec icônes et validation en temps réel) */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Input Prénom */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Prénom <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <User className="w-4 h-4" />
                              </div>
                              <input
                                type="text"
                                value={profileEditFirstName}
                                onChange={(e) => setProfileEditFirstName(e.target.value)}
                                placeholder="Ex: Amadou"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>

                          {/* Input Nom */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Nom <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <User className="w-4 h-4" />
                              </div>
                              <input
                                type="text"
                                value={profileEditLastName}
                                onChange={(e) => setProfileEditLastName(e.target.value)}
                                placeholder="Ex: Diallo"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>

                          {/* Input Email */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Adresse Email <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <Mail className="w-4 h-4" />
                              </div>
                              <input
                                type="email"
                                value={profileEditEmail}
                                onChange={(e) => setProfileEditEmail(e.target.value)}
                                placeholder="Ex: amadou@example.com"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>

                          {/* Input Téléphone */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Numéro de Téléphone <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <Phone className="w-4 h-4" />
                              </div>
                              <input
                                type="tel"
                                value={profileEditPhone}
                                onChange={(e) => setProfileEditPhone(e.target.value)}
                                placeholder="Ex: +221 77 000 00 00"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400">
                          Les modifications apportées seront immédiatement synchronisées avec votre profil utilisateur.
                        </p>
                      </div>
                    )}
                  </div>
                ) : activeProfileSection === 'security' ? (
                  /* Section Sécurité Réelle & Conforme */
                  <div className="space-y-6">
                    {/* Dernière connexion (lecture seule) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2]/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white text-[#1B4B4A] border border-[#1B4B4A]/10 flex items-center justify-center shrink-0 shadow-2xs">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dernière connexion</div>
                          <div className="text-xs text-slate-500 mt-0.5">Horodatage de la dernière session enregistrée</div>
                        </div>
                      </div>
                      <div className="sm:text-right pl-13 sm:pl-0">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-white border border-slate-200 text-slate-800 shadow-2xs">
                          {formatLastLogin(activeStaff.last_login_at)}
                        </span>
                      </div>
                    </div>

                    {/* Bloc Formulaire Changement de mot de passe */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-[#1B4B4A]/10 text-[#1B4B4A] flex items-center justify-center shrink-0">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">Changer le mot de passe</h4>
                          <p className="text-xs text-slate-500">Mettez à jour vos identifiants d&apos;accès sécurisé</p>
                        </div>
                      </div>

                      {/* Message d'information */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs flex items-start space-x-2.5">
                        <Info className="w-4 h-4 text-[#1B4B4A] shrink-0 mt-0.5" />
                        <span>Le mot de passe actuel confirme votre identité. Le nouveau mot de passe doit comporter au moins 8 caractères.</span>
                      </div>

                      {/* Message de succès */}
                      {securitySuccess && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{securitySuccess}</span>
                        </div>
                      )}

                      {/* Message d'erreur */}
                      {securityError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{securityError}</span>
                        </div>
                      )}

                      <form onSubmit={handleUpdatePassword} className="space-y-4">
                        {/* 1. Mot de passe actuel */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Mot de passe actuel <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showCurrentPassword ? 'text' : 'password'}
                              value={securityCurrentPassword}
                              onChange={(e) => setSecurityCurrentPassword(e.target.value)}
                              placeholder="••••••••"
                              disabled={securitySaving}
                              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* 2. Nouveau mot de passe */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Nouveau mot de passe <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={securityNewPassword}
                              onChange={(e) => setSecurityNewPassword(e.target.value)}
                              placeholder="Minimum 8 caractères"
                              disabled={securitySaving}
                              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* 3. Confirmer le nouveau mot de passe */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Confirmer le nouveau mot de passe <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={securityConfirmPassword}
                              onChange={(e) => setSecurityConfirmPassword(e.target.value)}
                              placeholder="Répétez le nouveau mot de passe"
                              disabled={securitySaving}
                              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Bouton de soumission */}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="submit"
                            disabled={securitySaving}
                            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#1B4B4A] hover:bg-[#153a39] text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {securitySaving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Mise à jour en cours...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Mettre à jour le mot de passe</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  /* Contenu pour les autres sections (Notifications, Facturation) */
                  <div className="bg-[#FAF7F2] rounded-2xl border border-slate-200/80 p-8 text-center flex flex-col items-center justify-center min-h-[260px]">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-[#1B4B4A] mb-3 shadow-2xs">
                      {activeProfileSection === 'notifications' && <Bell className="w-6 h-6" />}
                      {activeProfileSection === 'billing' && <CreditCard className="w-6 h-6" />}
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                      {activeProfileSection === 'notifications' && 'Préférences de Notification'}
                      {activeProfileSection === 'billing' && 'Abonnement & Facturation'} — Structure validée
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md">
                      Navigation interne opérationnelle. Prêt pour l&apos;intégration des formulaires et champs détaillés lors de l&apos;étape suivante.
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* Lightbox / Zoom Modal pour la photo de profil */}
            <AnimatePresence>
              {isProfileAvatarZoomOpen && (activeStaff.photo_url || activeStaff.avatar_url) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop assombri avec flou doux */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs cursor-pointer"
                    onClick={() => setIsProfileAvatarZoomOpen(false)}
                  />

                  {/* Image agrandie avec zoom doux */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 bg-white rounded-3xl p-4 shadow-2xl border border-white/20 max-w-sm sm:max-w-md w-full flex flex-col items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Bouton Fermer */}
                    <button
                      type="button"
                      onClick={() => setIsProfileAvatarZoomOpen(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer z-20 shadow-xs"
                      title="Fermer (Échap)"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    {/* Grande Photo */}
                    <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 mt-2 mb-4">
                      <Image
                        src={activeStaff.photo_url || activeStaff.avatar_url!}
                        alt={activeStaff.name}
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Nom et Rôle sous la grande photo */}
                    <div className="text-center pb-2">
                      <h4 className="font-extrabold text-slate-900 text-base">
                        {activeStaff.name}
                      </h4>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        {activeStaff.role === 'owner'
                          ? 'Gérant Principal'
                          : (activeStaff.role_title || 'Collaborateur')}
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}


      </main>

      {/* MODALS */}
      {/* Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingProduct?.id ? 'Modifier le Produit' : 'Ajouter un Produit'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Catégorie</label>
                <select
                  value={editingProduct?.category_id || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                  required
                >
                  <option value="">Sélectionner une catégorie...</option>
                  {businessCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Nom du Produit</label>
                <input
                  type="text"
                  value={editingProduct?.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Thieboudienne au Poisson"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Prix ({business.currency})</label>
                  <input
                    type="number"
                    value={editingProduct?.price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-extrabold focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="3500"
                    required
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Stock Quantité (Optionnel)</label>
                  <input
                    type="number"
                    value={editingProduct?.stock_qty ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock_qty: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="Illimité si vide"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">URL de l&apos;image</label>
                <input
                  type="url"
                  value={editingProduct?.image_url || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono text-[11px] focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editingProduct?.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="Composition du plat ou détails..."
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="prod_available"
                  checked={editingProduct?.available !== false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, available: e.target.checked })}
                  className="rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="prod_available" className="font-extrabold text-slate-800 cursor-pointer">
                  Produit disponible à la commande
                </label>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm"
              >
                Sauvegarder le Produit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">Nouvelle Catégorie</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Nom de la catégorie</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Desserts, Boissons Fraîches"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm"
              >
                Créer la Catégorie
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Staff Invite / Edit Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingStaffId ? 'Éditer le membre du staff' : 'Ajouter / Inviter un membre'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setEditingStaffId(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteStaffSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs pt-4">
              {/* Photo de profil Upload Field (Supabase Storage: agent-attachments/staff-avatars/{business_id}/) */}
              <div className="flex flex-col items-center justify-center p-3 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
                <label className="font-extrabold text-slate-700 block text-xs mb-2 w-full text-left">
                  Photo de profil
                </label>
                <div className="relative flex flex-col items-center">
                  <input
                    type="file"
                    accept="image/*"
                    id="staff-photo-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setCropImageSrc(reader.result);
                          setCropTarget('staff_invite');
                          setCropModalOpen(true);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="staff-photo-input"
                    className="relative cursor-pointer flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-dashed border-emerald-400 bg-white hover:bg-emerald-50/50 transition-all overflow-hidden shadow-xs group"
                  >
                    {invitePhotoUploading ? (
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                    ) : invitePhotoUrl ? (
                      <>
                        <img
                          src={invitePhotoUrl}
                          alt="Aperçu photo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-emerald-600">
                        {inviteName.trim() ? (
                          <span className="font-extrabold text-emerald-700 text-base uppercase">
                            {inviteName.trim().substring(0, 2)}
                          </span>
                        ) : (
                          <User className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 py-0.5 text-[9px] text-white font-bold text-center">
                          Ajouter
                        </div>
                      </div>
                    )}
                  </label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {invitePhotoUrl ? 'Cliquer pour modifier la photo' : 'Zone cliquable pour sélectionner une image'}
                    </span>
                    {invitePhotoUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setInvitePhotoUrl('');
                        }}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Nom complet</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Mamadou Ndiaye"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Titre du poste / Rôle</label>
                  <input
                    type="text"
                    value={inviteRoleTitle}
                    onChange={(e) => setInviteRoleTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="ex: Responsable Cuisine"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="ex: +221 77 123 45 67"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="mamadou@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Salaire (FCFA)</label>
                  <input
                    type="number"
                    value={inviteSalary}
                    onChange={(e) => setInviteSalary(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="250000"
                  />
                </div>
              </div>

              <div>
                <span className="font-extrabold text-slate-700 block mb-2">Permissions d&apos;accès :</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {Object.entries(invitePerms).map(([perm, val]) => (
                    <label key={perm} className="flex items-center space-x-2 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setInvitePerms({ ...invitePerms, [perm]: e.target.checked })}
                        className="rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="capitalize">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 sticky bottom-0 bg-white pb-1 border-t border-slate-100 mt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  {editingStaffId ? 'Enregistrer les modifications' : 'Ajouter le membre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zoom Photo Overlay Modal */}
      {zoomedPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setZoomedPhotoUrl(null)}
        >
          <div
            className="relative max-w-md w-full max-h-[85vh] p-3 bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full z-10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedPhotoUrl}
              alt="Aperçu photo"
              className="w-full h-auto max-h-[75vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Revocation Reason Modal */}
      {revokingStaffMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-base">Révoquer l&apos;accès du membre</h3>
            </div>
            <p className="text-xs text-slate-600">
              Voulez-vous vraiment révoquer l&apos;accès de <span className="font-bold text-slate-900">{revokingStaffMember.name}</span> ?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Raison de la révocation <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Départ, Faute, Pause temporaire..."
                value={revocationReasonInput}
                onChange={(e) => setRevocationReasonInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRevokingStaffMember(null);
                  setRevocationReasonInput('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!revocationReasonInput.trim()) return;
                  store.revokeStaff(revokingStaffMember.id, revocationReasonInput.trim());
                  setRevokingStaffMember(null);
                  setRevocationReasonInput('');
                }}
                disabled={!revocationReasonInput.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Confirmer la révocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Revocation Reason Modal (Carte Agrandie au clic) */}
      {viewingReasonStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer animate-in fade-in duration-200"
          onClick={() => setViewingReasonStaff(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800 cursor-default relative transform transition-all scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-slate-900 text-base">Raison de la révocation</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingReasonStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Member Details */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center space-x-3">
              {viewingReasonStaff.photo_url || viewingReasonStaff.avatar_url ? (
                <img
                  src={viewingReasonStaff.photo_url || viewingReasonStaff.avatar_url}
                  alt={viewingReasonStaff.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center font-black shrink-0 text-sm">
                  {viewingReasonStaff.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-900 text-sm truncate">{viewingReasonStaff.name}</h4>
                <p className="text-xs text-slate-500 font-mono truncate">{viewingReasonStaff.email}</p>
                {viewingReasonStaff.created_at && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Inscrit le : {new Date(viewingReasonStaff.created_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </div>

            {/* Full Reason Content */}
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Motif renseigné :
              </span>
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 text-slate-800 text-xs font-medium leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap break-words shadow-inner">
                {viewingReasonStaff.revocation_reason}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingReasonStaff(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Edit Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">Éditer {editingStaff.name}</h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Titre du poste / Rôle (Affiché dans le tableau)</label>
                <input
                  type="text"
                  value={editRoleTitle}
                  onChange={(e) => setEditRoleTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Responsable Caisse, Chef de Rang, Gérant"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="+221 77 000 00 00"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Salaire (FCFA)</label>
                  <input
                    type="number"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="250000"
                  />
                </div>
              </div>

              <div>
                <span className="font-extrabold text-slate-700 block mb-2">Permissions d&apos;accès :</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {Object.entries(editPerms).map(([perm, val]) => (
                    <label key={perm} className="flex items-center space-x-2 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setEditPerms({ ...editPerms, [perm]: e.target.checked })}
                        className="rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="capitalize">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Enregistrer les modifications
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Zone Modal */}
      {isZoneModalOpen && editingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingZone.id ? 'Éditer la zone de livraison' : 'Nouvelle zone de livraison'}
              </h3>
              <button
                onClick={() => setIsZoneModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingZone.name && editingZone.fee !== undefined && editingZone.fee >= 0) {
                  store.saveDeliveryZone({
                    id: editingZone.id,
                    business_id: business.id,
                    name: editingZone.name,
                    fee: Number(editingZone.fee),
                    active: editingZone.active ?? true,
                  });
                  setIsZoneModalOpen(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom de la zone (ex: Dakar-Plateau, Almadies, Zone Périphérique)
                </label>
                <input
                  type="text"
                  required
                  value={editingZone.name || ''}
                  onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                  placeholder="Ex: Mermoz / Sacré-Cœur"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Frais fixe de livraison ({business.currency})
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="100"
                  value={editingZone.fee ?? 1000}
                  onChange={(e) => setEditingZone({ ...editingZone, fee: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="zoneActiveToggle"
                  checked={editingZone.active ?? true}
                  onChange={(e) => setEditingZone({ ...editingZone, active: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="zoneActiveToggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Zone active et disponible pour les clients
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs"
                >
                  Enregistrer la Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Delivery Zone Confirmation Modal */}
      {deletingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-base">Supprimer la zone de livraison</h3>
            </div>
            <p className="text-xs text-slate-600">
              Voulez-vous vraiment supprimer la zone <span className="font-bold text-slate-900">&quot;{deletingZone.name}&quot;</span> ?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingZone(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  store.deleteDeliveryZone(deletingZone.id);
                  setDeletingZone(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Order Cancellation Reason Modal */}
      {isCancelModalOpen && cancellingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-base">Motif d&apos;annulation obligatoire</h3>
            </div>
            <p className="text-xs text-slate-600">
              Spécifiez la raison pour laquelle la commande <span className="font-mono font-bold text-slate-900">#{cancellingOrderId}</span> est annulée :
            </p>

            {/* Quick Option Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Client injoignable',
                'Rupture de stock',
                'Erreur de commande',
                'Client a annulé',
                'Hors zone de livraison',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCancellationReason(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    cancellationReason === preset
                      ? 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold ring-2 ring-rose-400/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Motif explicite / Champ libre :</label>
              <textarea
                rows={2}
                required
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ex: Le client ne répond pas au téléphone après 3 tentatives..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancellingOrderId(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Abandonner
              </button>
              <button
                type="button"
                disabled={!cancellationReason.trim()}
                onClick={() => {
                  if (cancellingOrderId && cancellationReason.trim()) {
                    store.cancelOrder(cancellingOrderId, cancellationReason.trim());
                    setIsCancelModalOpen(false);
                    setCancellingOrderId(null);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs"
              >
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Photo Modal (Double click on photo cell) */}
      {enlargedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 relative text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setEnlargedPhoto(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-extrabold text-slate-900 text-base">Photo de Profil Client</h3>
            <p className="text-xs font-bold text-emerald-800 bg-emerald-50 py-1 px-3 rounded-full border border-emerald-200 inline-block">
              {enlargedPhoto.name}
            </p>
            <div className="pt-2">
              {enlargedPhoto.url ? (
                <img
                  src={enlargedPhoto.url}
                  alt={enlargedPhoto.name}
                  className="w-56 h-56 rounded-2xl object-cover mx-auto border-2 border-slate-200 shadow-md"
                />
              ) : (
                <div className="w-48 h-48 rounded-full bg-emerald-100 text-emerald-800 border-2 border-emerald-300 font-black text-5xl flex items-center justify-center mx-auto shadow-md">
                  {enlargedPhoto.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEnlargedPhoto(null)}
              className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Enlarged Comment Modal (Double click on comment icon cell) */}
      {enlargedComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setEnlargedComment(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h3 className="font-black text-slate-900 text-base">Commentaire & Avis Client</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Client : <span className="font-bold text-slate-800">{enlargedComment.name}</span> (Commande #{enlargedComment.orderId})
              </p>
            </div>

            {/* Rating Stars if available */}
            {enlargedComment.rating ? (
              <div className="flex items-center space-x-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-amber-900 text-xs font-black">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
                <span>Note attribuée : {enlargedComment.rating}/5</span>
              </div>
            ) : null}

            {/* Comment Text */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Message / Avis du Client :
              </span>
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-950 font-medium italic whitespace-pre-wrap leading-relaxed shadow-2xs">
                {enlargedComment.comment ? `“${enlargedComment.comment}”` : 'Aucun commentaire écrit par le client.'}
              </div>
            </div>

            {/* Internal Note if available */}
            {enlargedComment.internalNote ? (
              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Note Interne (Staff / Livreur) :
                </span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                  {enlargedComment.internalNote}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setEnlargedComment(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all mt-2"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modal Carte Détaillée Commande */}
      {(() => {
        if (!selectedModalOrderId) return null;
        const modalOrder = businessOrders.find((o) => o.id === selectedModalOrderId);
        if (!modalOrder) return null;

        const modalCustomer = businessCustomers.find(
          (c) => c.id === modalOrder.customer_id || c.phone === modalOrder.customer_phone
        );
        const modalAlert = getOrderAlert(modalOrder);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 text-slate-800 relative my-auto animate-in fade-in zoom-in-95 duration-150">
              {/* Header Modal */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-black text-slate-900 text-xl">
                      Commande #{modalOrder.id}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${getStatusBadgeClass(modalOrder.status)}`}>
                      {getStatusLabel(modalOrder.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(modalOrder.created_at).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(modalOrder.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedModalOrderId(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Alerte Active sur cette commande */}
              {modalAlert && (
                <div className={`p-4 rounded-2xl border flex items-start space-x-3 shadow-2xs ${modalAlert.badgeClass}`}>
                  <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${modalAlert.iconClass}`} />
                  <div>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider">{modalAlert.title}</h4>
                    <p className="text-xs font-medium mt-0.5 leading-relaxed">{modalAlert.description}</p>
                  </div>
                </div>
              )}

              {/* Grille Informations Client & Logistique */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Informations Client */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Informations Client
                  </span>
                  
                  <div className="flex items-center space-x-3">
                    {modalCustomer?.avatar_url ? (
                      <img
                        src={modalCustomer.avatar_url}
                        alt={modalOrder.customer_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-2xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        {getInitials(modalOrder.customer_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-slate-900 text-sm truncate">{modalOrder.customer_name}</h4>
                      <span className="text-[11px] text-slate-500 font-mono block">
                        ID Client : {modalOrder.customer_id || modalCustomer?.id || `CLI-${modalOrder.customer_phone}`}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Téléphone :
                      </span>
                      <a
                        href={`tel:${modalOrder.customer_phone}`}
                        className="font-bold font-mono text-emerald-700 hover:underline"
                      >
                        {modalOrder.customer_phone}
                      </a>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Adresse de livraison :
                      </span>
                      <p className="font-bold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200/80 leading-relaxed text-xs">
                        {modalOrder.delivery_address || 'Aucune adresse renseignée'}
                      </p>
                    </div>

                    {/* Mode de retrait / zone */}
                    <div className="pt-1">
                      {modalOrder.order_type === 'pickup' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center">
                          <Store className="w-3 h-3 mr-1" />
                          Sur place (Retrait)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-cyan-100 text-cyan-900 border border-cyan-200 inline-flex items-center">
                          <Truck className="w-3 h-3 mr-1" />
                          Livraison {modalOrder.delivery_zone_name ? `(${modalOrder.delivery_zone_name})` : ''}
                        </span>
                      )}
                    </div>

                    {/* GPS Google Maps Link */}
                    {modalOrder.customer_lat && modalOrder.customer_lng && (
                      <a
                        href={`https://www.google.com/maps?q=${modalOrder.customer_lat},${modalOrder.customer_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full mt-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        Ouvrir la position GPS sur Google Maps
                      </a>
                    )}
                  </div>
                </div>

                {/* Suivi & Attribution */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Statut & Suivi Logistique
                  </span>

                  {/* Changer le statut */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Statut de la commande :
                    </label>
                    <select
                      value={modalOrder.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as OrderStatus;
                        if (newStatus === 'cancelled') {
                          setCancellingOrderId(modalOrder.id);
                          setCancellationReason(modalOrder.cancellation_reason || '');
                          setIsCancelModalOpen(true);
                        } else {
                          onUpdateOrderStatus(modalOrder.id, newStatus);
                        }
                      }}
                      className={`border rounded-xl px-3 py-2 text-xs font-extrabold focus:outline-none cursor-pointer shadow-2xs w-full transition-colors ${getStatusSelectClass(modalOrder.status)}`}
                    >
                      <option value="confirmed" className="bg-blue-100 text-blue-900 font-bold">Confirmée</option>
                      <option value="preparing" className="bg-orange-100 text-orange-900 font-bold">En cours</option>
                      <option value="delivered" className="bg-emerald-100 text-emerald-900 font-bold">Livrée</option>
                      <option value="cancelled" className="bg-rose-100 text-rose-900 font-bold">Annulée</option>
                    </select>
                  </div>

                  {/* Livreur assigné */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Nom du livreur assigné :
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Babacar Diallo..."
                      value={modalOrder.assigned_to || ''}
                      onChange={(e) => store.assignDriver(modalOrder.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Mode de règlement & Montant */}
                  <div className="pt-2 border-t border-slate-200/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Méthode de paiement :</span>
                      <span className="font-extrabold text-slate-900 uppercase bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {modalOrder.payment_method}
                      </span>
                    </div>

                    {modalOrder.payment_reference && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Référence paiement :</span>
                        <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {modalOrder.payment_reference}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Produits Commandés */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Produits Commandés ({modalOrder.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} article(s))
                </span>
                <div className="divide-y divide-slate-200/60">
                  {modalOrder.items?.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center shrink-0">
                          {item.quantity}x
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{item.product_name || 'Produit'}</span>
                          {item.unit_price ? (
                            <span className="text-[10px] text-slate-500 block">
                              {item.unit_price.toLocaleString()} {business.currency} / unité
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="font-black text-slate-900">
                        {((item.unit_price || 0) * item.quantity).toLocaleString()} {business.currency}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Synthèse financière */}
                <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs font-bold">
                  {modalOrder.delivery_fee ? (
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Frais de livraison :</span>
                      <span>+{modalOrder.delivery_fee.toLocaleString()} {business.currency}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-slate-900 text-sm font-black pt-1 border-t border-slate-200/80">
                    <span>Montant Total :</span>
                    <span className="text-emerald-700 text-base">
                      {modalOrder.total_amount.toLocaleString()} {business.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Commentaire / Avis client (Affiché uniquement pour commande Livrée) */}
              {modalOrder.status === 'delivered' && (
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                      Commentaire & Avis Client {modalOrder.rating ? `(${modalOrder.rating}/5 ★)` : ''}
                    </span>
                    <span className="text-[10px] text-amber-700 font-extrabold uppercase">Avis Intégral</span>
                  </div>
                  <p className="text-xs text-amber-950 font-medium italic whitespace-pre-wrap leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200/60">
                    {modalOrder.rating_comment
                      ? `“${modalOrder.rating_comment}”`
                      : 'Aucun commentaire rédigé pour cette commande.'}
                  </p>
                </div>
              )}

              {/* Note Interne */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Note Interne (Livreur / Cuisine / Staff)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ajouter une note interne ou consigne spéciale..."
                  value={modalOrder.internal_note || ''}
                  onChange={(e) => store.updateOrderInternalNote(modalOrder.id, e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedModalOrderId(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Saisie Motif pour Absent / Retard */}
      <AnimatePresence>
        {attendanceReasonModal.isOpen && attendanceReasonModal.staff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200/80 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Pointage : {attendanceReasonModal.status === 'absent' ? 'Absence' : 'Retard'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Membre : <strong className="text-slate-800">{attendanceReasonModal.staff.name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setAttendanceReasonModal({ isOpen: false, staff: null, status: 'absent', reason: '' })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Motif / Justification <span className="text-slate-400 font-normal">(Optionnel)</span>
                </label>
                <textarea
                  value={attendanceReasonModal.reason}
                  onChange={(e) =>
                    setAttendanceReasonModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Ex: Maladie avec certificat, Embouteillages, Congé personnel..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                />
                <p className="text-[11px] text-slate-500 italic">
                  * Si un motif est renseigné, le statut affichera le badge factuel <strong className="text-sky-700">Justifié</strong>. Sinon, il sera affiché <strong className="text-amber-700">Non justifié</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setAttendanceReasonModal({ isOpen: false, staff: null, status: 'absent', reason: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveAttendanceReasonModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                >
                  Enregistrer le pointage
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shared Image Cropper Modal for Profile & Staff Invite */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc}
        title={cropTarget === 'profile' ? 'Recadrer ma photo de profil' : 'Recadrer la photo du membre'}
        isSaving={cropSaving}
        onCancel={() => {
          setCropModalOpen(false);
          setCropImageSrc(null);
        }}
        onConfirm={async (croppedBlob) => {
          setCropSaving(true);
          try {
            const url = await uploadStaffAvatar(croppedBlob, business.id);
            if (cropTarget === 'profile') {
              store.updateStaff(activeStaff.id, { photo_url: url, avatar_url: url });
            } else {
              setInvitePhotoUrl(url);
            }
            setCropModalOpen(false);
            setCropImageSrc(null);
          } catch (err) {
            console.error('Erreur lors de l\'enregistrement de la photo recadrée:', err);
          } finally {
            setCropSaving(false);
          }
        }}
      />
    </div>
  );
}
