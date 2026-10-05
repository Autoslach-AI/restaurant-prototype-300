'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Check,
  Copy,
  RotateCw,
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
  Menu,
  ArrowLeft,
  ArrowUpRight,
  AlertTriangle,
  Info,
  MessageSquareWarning,
  TrendingDown,
  Percent,
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
  MoreVertical,
  CheckCheck,
  Download,
  File,
  Bookmark,
  ExternalLink,
  CheckSquare,
  Square,
  Receipt,
} from 'lucide-react';
import {
  uploadStaffAvatar,
  fetchAttendanceRecords,
  upsertAttendanceRecord,
  updateStaffProfile,
  updateStaffNotificationPreferences,
  insertStaffMember,
  revokeStaffMember,
  reactivateStaffMember,
  fetchCustomersForBusiness,
  fetchBusinessById,
  updateBusinessConfig,
  supabase,
} from '@/lib/supabase';
import {
  Business,
  Category,
  Product,
  Order,
  AgentEvent,
  OrderStatus,
  StaffPermissions,
  Staff,
  AttendanceRecord,
  AttendanceStatus,
  Customer,
  CustomerMessage,
} from '@/lib/types';
import { getStore } from '@/lib/store';
import PeriodFilter from '@/components/ui/period-filter';
import ConversionDetailSection from '@/components/ui/conversion-detail-section';
import FinanceSection from '@/components/FinanceSection';
import ExpensesSection from '@/components/ExpensesSection';
import CustomersSection from '@/components/CustomersSection';
import { ImageCropperModal } from '@/components/ImageCropperModal';
import { MediaViewer, MediaViewerItem } from '@/components/MediaViewer';
import OverviewSection from './OverviewSection';
import AgentAssistantSection from './AgentAssistantSection';
import ProfileSection from './ProfileSection';
import SettingsSection from './SettingsSection';
import { TeamSection } from './TeamSection';
import { AttendanceSection } from './AttendanceSection';
import OrdersSection from './OrdersSection';
import ProductsSection from './ProductsSection';

interface MerchantDashboardProps {
  business: Business;
  categories: Category[];
  products: Product[];
  orders: Order[];
  agentEvents: AgentEvent[];
  customers?: Customer[];
  isCustomersLoading?: boolean;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onCancelOrder: (orderId: string, reason: string) => Promise<void>;
  onProcessPayment: (orderId: string, reference: string) => void;
  onTriggerRelance: (orderId: string) => void;
  onSaveProduct: (productData: Partial<Product> & { name: string; price: number; category_id: string }) => void;
  onDeleteProduct: (productId: string) => void;
  onSaveCategory: (name: string, categoryId?: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onUpdateConfig: (newConfig: Partial<Business['config']>, newDetails?: Partial<Business>) => void;
  onToggleWhatsAppSim: () => void;
}

type TabType = 'overview' | 'finance' | 'expenses' | 'orders' | 'products' | 'customers' | 'agent' | 'settings' | 'profile' | 'conversion' | 'team' | 'attendance';

export default function MerchantDashboard({
  business,
  categories,
  products,
  orders,
  agentEvents,
  customers: propCustomers,
  isCustomersLoading,
  onUpdateOrderStatus,
  onCancelOrder,
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState<'all' | 'unread' | 'favorites' | 'recurrent' | 'inactive'>('all');

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

  // Order filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [alertCategoryFilter, setAlertCategoryFilter] = useState<'all' | 'urgent_undelivered' | 'preparing_45m' | 'new_orders'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'wave' | 'orange' | 'card'>('all');
  const [orderPeriodFilter, setOrderPeriodFilter] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('all');
  const [hasRatingFilter, setHasRatingFilter] = useState<boolean>(false);

  // Conversion filter
  const [conversionPeriod, setConversionPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');

  // Attendance / Pointage state
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<Record<string, AttendanceRecord>>({});

  // Staff Invite / Edit Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const [staffTab, setStaffTab] = useState<'active' | 'revoked'>('active');
  const [revokingStaffMember, setRevokingStaffMember] = useState<Staff | null>(null);
  const [revocationReasonInput, setRevocationReasonInput] = useState('');
  const [revokingLoading, setRevokingLoading] = useState(false);
  const [reactivatingStaffId, setReactivatingStaffId] = useState<string | null>(null);
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
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  // Business Profile Settings Form
  const [bizName, setBizName] = useState(business.name);
  const [bizWhatsapp, setBizWhatsapp] = useState(business.whatsapp_number);
  const [bizCurrency, setBizCurrency] = useState(business.currency);
  const [savedBizProfile, setSavedBizProfile] = useState<{ name: string; whatsapp_number: string; currency: string }>({
    name: business.name,
    whatsapp_number: business.whatsapp_number,
    currency: business.currency,
  });
  const [isBizSaving, setIsBizSaving] = useState(false);
  const [isBizLoading, setIsBizLoading] = useState(false);

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
    setSavedBizProfile({
      name: business.name,
      whatsapp_number: business.whatsapp_number,
      currency: business.currency,
    });
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

  // Load Business Profile from Supabase on mount or settings tab activation
  useEffect(() => {
    let isMounted = true;
    async function loadBusinessData() {
      if (!business?.id) return;
      if (activeTab === 'settings') {
        setIsBizLoading(true);
        try {
          const bizData = await fetchBusinessById(business.id);
          if (bizData && isMounted) {
            setBizName(bizData.name);
            setBizWhatsapp(bizData.whatsapp_number);
            setBizCurrency(bizData.currency);
            setSavedBizProfile({
              name: bizData.name,
              whatsapp_number: bizData.whatsapp_number,
              currency: bizData.currency,
            });
          }
        } catch (err) {
          console.error('Error loading business from Supabase:', err);
        } finally {
          if (isMounted) setIsBizLoading(false);
        }
      }
    }
    loadBusinessData();
    return () => {
      isMounted = false;
    };
  }, [business?.id, activeTab]);

  // Settings modification detection
  const currentGw = store.getPaymentGateway(business.id);
  const currentChs = store.getPaymentChannels(business.id);

  const isGeneralChanged =
    bizName !== savedBizProfile.name ||
    bizWhatsapp !== savedBizProfile.whatsapp_number ||
    bizCurrency !== savedBizProfile.currency;

  const isGatewayChanged =
    gwProvider !== currentGw.provider ||
    gwPublicKey !== (currentGw.public_key || '') ||
    gwSecretKey !== (currentGw.secret_key || '');

  const isChannelsChanged = currentChs.some(
    (c) => (channelStates[c.id] ?? c.enabled) !== c.enabled
  );

  const hasSettingsChanges = isGeneralChanged || isGatewayChanged || isChannelsChanged;

  const handleSaveAllSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isGeneralChanged) {
      setIsBizSaving(true);
      try {
        const res = await updateBusinessConfig(business.id, {
          name: bizName,
          whatsapp_number: bizWhatsapp,
          currency: bizCurrency,
        });
        if (!res.success) {
          alert(`Erreur lors de l'enregistrement des réglages généraux : ${res.error || 'Échec de la mise à jour'}`);
          return;
        }
        setSavedBizProfile({
          name: bizName,
          whatsapp_number: bizWhatsapp,
          currency: bizCurrency,
        });
        onUpdateConfig({}, { name: bizName, whatsapp_number: bizWhatsapp, currency: bizCurrency });
      } finally {
        setIsBizSaving(false);
      }
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
    setBizName(savedBizProfile.name);
    setBizWhatsapp(savedBizProfile.whatsapp_number);
    setBizCurrency(savedBizProfile.currency);
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

  // Shared Image Cropper state for Profile, Staff Invite & Customer Create
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'profile' | 'staff_invite' | 'customer_create'>('profile');
  const [cropSaving, setCropSaving] = useState(false);

  // Filtered lists
  const businessOrders = orders.filter((o) => o.business_id === business.id);
  const businessProducts = products.filter((p) => p.business_id === business.id);
  const businessCategories = categories.filter((c) => c.business_id === business.id);
  const businessEvents = agentEvents.filter((e) => e.business_id === business.id);
  const effectiveCustomers = propCustomers !== undefined ? propCustomers : store.customers;
  const businessCustomers = (effectiveCustomers || []).filter((c) => c.business_id === business.id);

  console.log('[DEBUG_RENDER] MerchantDashboard render', {
    businessCustomersLength: businessCustomers.length,
    storeCustomersRawLength: (effectiveCustomers || []).length,
  });

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

  // Today Timestamp for OrdersSection
  const currentDateObj = new Date(nowMs);
  const startOfTodayMs = new Date(currentDateObj.getFullYear(), currentDateObj.getMonth(), currentDateObj.getDate()).getTime();

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

  // 3. Nouvelles commandes récemment créées (<= 30 min, statut pending ou confirmed)
  const newRecentOrders = businessOrders.filter((o) => {
    if (o.status !== 'pending' && o.status !== 'confirmed') return false;
    const createdAt = new Date(o.created_at).getTime();
    return nowMs - createdAt <= 30 * 60 * 1000;
  });

  const totalSubAlertsCount =
    urgentUndelivered.length +
    preparingOver45Min.length +
    newRecentOrders.length;

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
    if (tab === 'overview' || tab === 'profile' || tab === 'conversion') return true;
    if (tab === 'finance' || tab === 'expenses') return Boolean(activeStaff.permissions?.finance);
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

  console.log('[DEBUG_TEAM_ROWS] allTeamRows computed', {
    timestamp: Date.now(),
    storeStaffRawLength: store.staff?.length,
    businessStaffLength: businessStaff?.length,
    allTeamRowsLength: allTeamRows.length,
    storeStaffIds: store.staff?.map(s => ({id: s.id, name: s.name, revoked: s.revoked})),
  });

  useEffect(() => {
    console.log('[DEBUG_TEAM] allTeamRows', {
      timestamp: Date.now(),
      count: allTeamRows.length,
      ids: allTeamRows.map((r) => ({ id: r.id, name: r.name })),
    });
  }, [allTeamRows]);

  const todayAttendanceCounts = {
    all: businessStaff.filter((s) => !s.revoked).length,
    present: businessStaff.filter((s) => !s.revoked && todayAttendanceMap[s.id]?.status === 'present').length,
    absent: businessStaff.filter((s) => !s.revoked && todayAttendanceMap[s.id]?.status === 'absent').length,
    late: businessStaff.filter((s) => !s.revoked && todayAttendanceMap[s.id]?.status === 'late').length,
    unmarked: businessStaff.filter((s) => !s.revoked && !todayAttendanceMap[s.id]?.status).length,
  };

  const handleSaveTemplates = () => {
    onUpdateConfig({ message_templates: templates });
    alert('Templates de messages WhatsApp sauvegardés avec succès !');
  };

  const handleInviteStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    setInviteError(null);

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
    } else {
      setInviteSaving(true);
      try {
        const res = await insertStaffMember({
          business_id: business.id,
          invited_by: activeStaff.id || null,
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          phone: invitePhone.trim() || undefined,
          role_title: inviteRoleTitle.trim() || 'Collaborateur',
          salary: inviteSalary ? Number(inviteSalary) : undefined,
          permissions: invitePerms,
          avatar_url: invitePhotoUrl || undefined,
        });

        if (!res.success) {
          setInviteError(res.error || "Une erreur est survenue lors de l'ajout du membre.");
          return;
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
      } catch (err: any) {
        setInviteError(err?.message || "Une erreur inattendue est survenue.");
      } finally {
        setInviteSaving(false);
      }
    }
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

  const handleRevokeStaffSubmit = async () => {
    if (!revokingStaffMember || !revocationReasonInput.trim()) return;
    setRevokingLoading(true);
    try {
      const res = await revokeStaffMember(revokingStaffMember.id, revocationReasonInput.trim());
      if (!res.success) {
        alert(res.error || "Une erreur est survenue lors de la révocation.");
        return;
      }
      setRevokingStaffMember(null);
      setRevocationReasonInput('');
    } catch (err: any) {
      alert(err?.message || "Erreur de communication avec la base de données.");
    } finally {
      setRevokingLoading(false);
    }
  };

  const handleReactivateStaff = async (staffId: string) => {
    setReactivatingStaffId(staffId);
    try {
      const res = await reactivateStaffMember(staffId);
      if (!res.success) {
        alert(res.error || "Une erreur est survenue lors de la réactivation.");
        return;
      }
    } catch (err: any) {
      alert(err?.message || "Erreur de communication avec la base de données.");
    } finally {
      setReactivatingStaffId(null);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Modifications enregistrées sur votre compte personnel !');
  };

  // Sidebar Menu Items Configuration
  const navItems: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number | string; ownerOnly?: boolean; hidden?: boolean }[] = [
    { id: 'overview', label: 'Tableau de bord', icon: TrendingUp },
    { id: 'finance', label: 'Finance', icon: CreditCard },
    { id: 'expenses', label: 'Dépenses', icon: Receipt, hidden: !hasPermission('finance') },
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
            {navItems.filter((item) => !item.hidden).map((item) => {
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
        {activeTab !== 'overview' && activeTab !== 'agent' && activeTab !== 'expenses' && (
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
          <OverviewSection
            business={business}
            businessOrders={businessOrders}
            businessCustomers={businessCustomers}
            businessEvents={businessEvents}
            nowMs={nowMs}
            urgentUndelivered={urgentUndelivered}
            preparingOver45Min={preparingOver45Min}
            newRecentOrders={newRecentOrders}
            totalSubAlertsCount={totalSubAlertsCount}
            monthConversionMetrics={monthConversionMetrics}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onNavigateToOrdersWithFilter={(filters) => {
              setActiveTab('orders');
              if (filters?.status !== undefined) setStatusFilter(filters.status);
              if (filters?.alertCategory !== undefined) setAlertCategoryFilter(filters.alertCategory);
              if (filters?.period !== undefined) setOrderPeriodFilter(filters.period);
              if (filters?.paymentMethod !== undefined) setPaymentMethodFilter(filters.paymentMethod);
              if (filters?.search !== undefined) setOrderSearch(filters.search);
            }}
            onNavigateToCustomersWithFilter={(filter, customerId) => {
              if (customerId) {
                setSelectedCustomerId(customerId);
              }
              if (filter !== undefined) {
                setCustomerFilter(filter);
              }
              setActiveTab('customers');
            }}
          />
        )}

        {/* 4.5 PAGE FINANCE */}
        {hasPermission('finance') && activeTab === 'finance' && (
          <FinanceSection
            orders={businessOrders}
            currency={business.currency || 'XOF'}
            nowMs={nowMs}
            businessId={business.id}
            onNavigateToExpenses={() => setActiveTab('expenses')}
          />
        )}

        {/* 4.6 PAGE DÉPENSES (EXPENSES) */}
        {hasPermission('finance') && activeTab === 'expenses' && (
          <ExpensesSection
            business={business}
            activeStaff={activeStaff}
            onBackToDashboard={() => {
              setActiveTab('overview');
              setStatusFilter('all');
              setOrderSearch('');
              setAlertCategoryFilter('all');
            }}
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
          <OrdersSection
            business={business}
            businessOrders={businessOrders}
            businessCustomers={businessCustomers}
            nowMs={nowMs}
            startOfTodayMs={startOfTodayMs}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            alertCategoryFilter={alertCategoryFilter}
            setAlertCategoryFilter={setAlertCategoryFilter}
            orderSearch={orderSearch}
            setOrderSearch={setOrderSearch}
            hasRatingFilter={hasRatingFilter}
            setHasRatingFilter={setHasRatingFilter}
            paymentMethodFilter={paymentMethodFilter}
            setPaymentMethodFilter={setPaymentMethodFilter}
            orderPeriodFilter={orderPeriodFilter}
            setOrderPeriodFilter={setOrderPeriodFilter}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            getInitials={getInitials}
            onUpdateOrderStatus={onUpdateOrderStatus}
            onCancelOrder={onCancelOrder}
          />
        )}

        {/* TAB 3: PRODUITS & CATÉGORIES */}
        {hasPermission('products') && activeTab === 'products' && (
          <ProductsSection
            business={business}
            businessProducts={businessProducts}
            businessCategories={businessCategories}
            onSaveProduct={onSaveProduct}
            onDeleteProduct={onDeleteProduct}
            onSaveCategory={onSaveCategory}
            onDeleteCategory={onDeleteCategory}
          />
        )}

        {/* TAB 4: CLIENTS - Messaging / Chat UI */}
        {activeTab === 'customers' && (
          <CustomersSection
            business={business}
            businessCustomers={businessCustomers}
            isCustomersLoading={isCustomersLoading}
            cropModalOpen={cropModalOpen}
            setCropModalOpen={setCropModalOpen}
            cropImageSrc={cropImageSrc}
            setCropImageSrc={setCropImageSrc}
            cropTarget={cropTarget}
            setCropTarget={setCropTarget}
            cropSaving={cropSaving}
            setCropSaving={setCropSaving}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            customerFilter={customerFilter}
            setCustomerFilter={setCustomerFilter}
          />
        )}

        {/* TAB 4.5: ÉQUIPE */}
        {hasPermission('team') && activeTab === 'team' && (
          <TeamSection
            business={business}
            activeStaff={activeStaff}
            allTeamRows={allTeamRows}
            setIsInviteModalOpen={setIsInviteModalOpen}
            setActiveTab={setActiveTab}
            getInitials={getInitials}
          />
        )}

        {/* TAB 4.6: POINTAGE DÉDIÉ */}
        {hasPermission('attendance') && activeTab === 'attendance' && (
          <AttendanceSection
            business={business}
            canMarkAttendance={canMarkAttendance}
            allTeamRows={allTeamRows}
            todayAttendanceMap={todayAttendanceMap}
            setTodayAttendanceMap={setTodayAttendanceMap}
            todayAttendanceCounts={todayAttendanceCounts}
            getInitials={getInitials}
            todayStr={todayStr}
          />
        )}

        {/* TAB 5: AGENT PAGE (CLAUDE.AI STYLE RESTRUCTURED WITH BRAND DESIGN) */}
        {activeTab === 'agent' && (
          <AgentAssistantSection
            business={business}
            hasPermission={hasPermission}
            setActiveTab={setActiveTab}
          />
        )}
        {/* TAB 6: PARAMÈTRES (STORE SETTINGS, OWNER ONLY) */}
        {hasPermission('settings') && activeTab === 'settings' && (
          <SettingsSection
            business={business}
            activeStaff={activeStaff}
            businessOrders={businessOrders}
            onProcessPayment={onProcessPayment}
            businessStaff={businessStaff}
            staffTab={staffTab}
            setStaffTab={setStaffTab}
            setEditingStaffId={setEditingStaffId}
            setInviteName={setInviteName}
            setInviteEmail={setInviteEmail}
            setInvitePhone={setInvitePhone}
            setInviteRoleTitle={setInviteRoleTitle}
            setInviteSalary={setInviteSalary}
            setInvitePhotoUrl={setInvitePhotoUrl}
            setInvitePerms={setInvitePerms}
            setIsInviteModalOpen={setIsInviteModalOpen}
            setZoomedPhotoUrl={setZoomedPhotoUrl}
            setViewingReasonStaff={setViewingReasonStaff}
            setRevokingStaffMember={setRevokingStaffMember}
            setRevocationReasonInput={setRevocationReasonInput}
            reactivatingStaffId={reactivatingStaffId}
            handleReactivateStaff={handleReactivateStaff}
            bizName={bizName}
            setBizName={setBizName}
            bizWhatsapp={bizWhatsapp}
            setBizWhatsapp={setBizWhatsapp}
            bizCurrency={bizCurrency}
            setBizCurrency={setBizCurrency}
            isBizLoading={isBizLoading}
            isBizSaving={isBizSaving}
            gwProvider={gwProvider}
            setGwProvider={setGwProvider}
            gwPublicKey={gwPublicKey}
            setGwPublicKey={setGwPublicKey}
            gwSecretKey={gwSecretKey}
            setGwSecretKey={setGwSecretKey}
            channelStates={channelStates}
            setChannelStates={setChannelStates}
            currentChs={currentChs}
            hasSettingsChanges={hasSettingsChanges}
            handleSaveAllSettings={handleSaveAllSettings}
            handleCancelSettingsChanges={handleCancelSettingsChanges}
          />
        )}

        {/* 7. PAGE MON PROFIL (PERSONAL MEMBER PROFILE - SEPARATED FROM SETTINGS) */}
        {hasPermission('profile') && activeTab === 'profile' && (
          <ProfileSection
            business={business}
            activeStaff={activeStaff}
            getInitials={getInitials}
            cropModalOpen={cropModalOpen}
            setCropModalOpen={setCropModalOpen}
            cropImageSrc={cropImageSrc}
            setCropImageSrc={setCropImageSrc}
            cropTarget={cropTarget}
            setCropTarget={setCropTarget}
            cropSaving={cropSaving}
            setCropSaving={setCropSaving}
          />
        )}

      </main>

      {/* MODALS */}
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

              {inviteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                  {inviteError}
                </div>
              )}

              <div className="pt-2 sticky bottom-0 bg-white pb-1 border-t border-slate-100 mt-2">
                <button
                  type="submit"
                  disabled={inviteSaving}
                  className={`w-full py-3 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 ${
                    inviteSaving
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-95'
                  }`}
                >
                  {inviteSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement en cours...</span>
                    </>
                  ) : (
                    <span>{editingStaffId ? 'Enregistrer les modifications' : 'Ajouter le membre'}</span>
                  )}
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
                disabled={revokingLoading}
                onClick={() => {
                  setRevokingStaffMember(null);
                  setRevocationReasonInput('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRevokeStaffSubmit}
                disabled={!revocationReasonInput.trim() || revokingLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                {revokingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmer la révocation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal (Profil, Collaborateur, Client) */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc}
        title={
          cropTarget === 'profile'
            ? 'Recadrer la photo de profil'
            : cropTarget === 'staff_invite'
            ? 'Recadrer la photo du collaborateur'
            : 'Recadrer la photo du client'
        }
        isSaving={cropSaving}
        onCancel={() => {
          setCropModalOpen(false);
          setCropImageSrc(null);
        }}
        onConfirm={async (croppedBlob: Blob) => {
          setCropSaving(true);
          try {
            const uploadedUrl = await uploadStaffAvatar(croppedBlob, business.id);
            if (cropTarget === 'profile') {
              await updateStaffProfile(activeStaff.id, activeStaff.auth_uid, {
                photo_url: uploadedUrl,
                avatar_url: uploadedUrl,
              });
            } else if (cropTarget === 'staff_invite') {
              setInvitePhotoUrl(uploadedUrl);
            } else if (cropTarget === 'customer_create') {
              window.dispatchEvent(new CustomEvent('customer_photo_cropped', { detail: uploadedUrl }));
            }
            setCropModalOpen(false);
            setCropImageSrc(null);
          } catch (err: any) {
            console.error('Erreur upload avatar:', err);
            alert(err?.message || "Erreur lors de l'enregistrement de la photo");
          } finally {
            setCropSaving(false);
          }
        }}
      />
    </div>
  );
}

// Fin du composant MerchantDashboard
