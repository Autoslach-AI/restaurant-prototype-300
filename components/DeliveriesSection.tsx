'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Loader2,
  Camera,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Layers,
  ChevronLeft,
  Users,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  Receipt,
  MoreVertical,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { Order, OrderStatus, Business, Staff, Driver, OrderItem } from '@/lib/types';
import {
  fetchDrivers,
  insertDriver,
  updateDriver,
  setDriverActive,
  assignDriverToOrders,
  uploadDriverPhoto,
  updateOrderStatus,
  fetchOrderItemsForOrders,
  cancelOrder,
} from '@/lib/supabase';
import {
  generateRoutePdf,
  generateTicketsPdf,
  getOrderShortRef,
} from '@/lib/print-docs';
import PrintPreviewModal from '@/components/PrintPreviewModal';
import { getOrderStatusLabel } from '@/lib/order-status';
import { getStore } from '@/lib/store';
import {
  buildCustomerDriverHistory,
  buildZoneDriverHistory,
  suggestForOrder,
  DriverSuggestion,
} from '@/lib/delivery-suggestions';

export interface DeliveriesSectionProps {
  business: Business;
  orders: Order[];
  staff: Staff[];
  nowMs: number;
}

export default function DeliveriesSection({
  business,
  orders,
  nowMs,
}: DeliveriesSectionProps) {
  // Navigation segmentée : « À assigner », « En tournée », « Livrées »
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'routes' | 'delivered'>('pending');

  // Panneau latéral de gestion des livreurs
  const [isDriversDrawerOpen, setIsDriversDrawerOpen] = useState(false);

  // Cartes de livreurs repliées dans l'onglet « En tournée »
  const [collapsedDriverIds, setCollapsedDriverIds] = useState<Record<string, boolean>>({});

  // Filtres de l'onglet « Livrées »
  const [deliveredPeriodFilter, setDeliveredPeriodFilter] = useState<
    'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month' | 'all' | 'custom'
  >('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [deliveredDriverFilter, setDeliveredDriverFilter] = useState<string>('all');
  const [deliveredZoneFilter, setDeliveredZoneFilter] = useState<string>('all');
  const [deliveredSearchQuery, setDeliveredSearchQuery] = useState<string>('');
  const [deliveredVisibleLimit, setDeliveredVisibleLimit] = useState<number>(50);

  // Filtre pour inclure les commandes déjà assignées dans l'onglet « À assigner » (désactivé par défaut)
  const [includeAssignedOrders, setIncludeAssignedOrders] = useState<boolean>(false);

  // Livreur ciblé / centré pour l'onglet « En tournée »
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);

  // Menu ⋮ d'une commande en tournée (rendu via portail pour éviter le clipping par overflow-hidden)
  const [orderMenu, setOrderMenu] = useState<{
    order: Order;
    driver: Driver;
    coords: {
      top?: number;
      bottom?: number;
      right: number;
    };
    view: 'main' | 'reassign';
  } | null>(null);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const orderMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const orderMenuDropdownRef = useRef<HTMLDivElement | null>(null);

  // Modale d'annulation de commande
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [cancelModalError, setCancelModalError] = useState<string | null>(null);

  // Commande en cours de traitement asynchrone (réassigner / retirer / marquer livrée)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Menu Imprimer pour l'onglet « En cours »
  const [openPrintMenuDriverId, setOpenPrintMenuDriverId] = useState<string | null>(null);
  const [printingDriverId, setPrintingDriverId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<{ driverId: string; message: string } | null>(null);

  // Modale d'aperçu d'impression (tickets 80 mm ou feuille de route A4)
  const [ticketPreviewModal, setTicketPreviewModal] = useState<{
    isOpen: boolean;
    driver: Driver | null;
    orders: Order[];
    initialTab?: 'tickets' | 'route';
  }>({
    isOpen: false,
    driver: null,
    orders: [],
    initialTab: 'tickets',
  });

  // Modale d'aperçu d'impression de Facture (A4) pour une commande individuelle
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);
  const [invoiceItemsByOrder, setInvoiceItemsByOrder] = useState<Record<string, OrderItem[]>>({});

  // État des livreurs chargés depuis Supabase
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDriversLoading, setIsDriversLoading] = useState(false);
  const [showArchivedDrivers, setShowArchivedDrivers] = useState(false);

  // Messages in-app discrets
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Modale Nouveau / Modifier Livreur
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverFormName, setDriverFormName] = useState('');
  const [driverFormPhone, setDriverFormPhone] = useState('');
  const [driverFormNeighborhood, setDriverFormNeighborhood] = useState('');
  const [driverFormPhotoUrl, setDriverFormPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDriverSaving, setIsDriverSaving] = useState(false);
  const [driverFormError, setDriverFormError] = useState<string | null>(null);
  const driverPhotoInputRef = useRef<HTMLInputElement>(null);

  // Chargement des livreurs de la boutique
  const loadDrivers = async () => {
    setIsDriversLoading(true);
    try {
      const data = await fetchDrivers(business.id);
      setDrivers(data);
    } catch (err: any) {
      console.warn('Erreur chargement livreurs:', err);
    } finally {
      setIsDriversLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, [business.id]);

  // Commandes de livraison actives à livrer
  const deliveryOrders = useMemo(() => {
    return orders.filter((o) => {
      const isBiz = o.business_id === business.id;
      const isDeliv = o.order_type === 'delivery';
      const isStatusEligible =
        o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready';
      return isBiz && isDeliv && isStatusEligible;
    });
  }, [orders, business.id]);

  // Compteurs en-tête
  const totalToDeliver = deliveryOrders.length;
  const totalUnassigned = useMemo(() => {
    return deliveryOrders.filter((o) => o.status === 'ready' && !o.driver_id && (!o.assigned_to || !o.assigned_to.trim())).length;
  }, [deliveryOrders]);

  // Commandes assignées « en cours » par livreur (statuts confirmed, preparing ou ready, quelle que soit leur date de création, rattachées par driver_id, sinon par le nom assigned_to)
  const driverActiveOrdersMap = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const d of drivers) {
      map.set(d.id, []);
    }
    for (const ord of deliveryOrders) {
      let matchedDriverId: string | undefined = undefined;
      if (ord.driver_id && map.has(ord.driver_id)) {
        matchedDriverId = ord.driver_id;
      } else if (ord.assigned_to && ord.assigned_to.trim()) {
        const cleanName = ord.assigned_to.trim().toLowerCase();
        const found = drivers.find((d) => d.name.trim().toLowerCase() === cleanName);
        if (found) {
          matchedDriverId = found.id;
        }
      }
      if (matchedDriverId) {
        const list = map.get(matchedDriverId) || [];
        list.push(ord);
        map.set(matchedDriverId, list);
      }
    }
    return map;
  }, [drivers, deliveryOrders]);

  // Livreurs ayant au moins une commande en cours (confirmed, preparing, ready) pour l'onglet « En tournée »
  const driversWithRoutes = useMemo(() => {
    return drivers.filter((d) => (driverActiveOrdersMap.get(d.id)?.length || 0) > 0);
  }, [drivers, driverActiveOrdersMap]);

  // Nombre de clients distincts ayant au moins une commande en cours dans les tournées actives
  // Règle identique à l'en-tête de chaque carte de livreur :
  // customer_id distinct ; sans customer_id, chaque commande compte pour un client
  const routesClientsCount = useMemo(() => {
    const clientIds = new Set<string>();
    let anonymousClientsCount = 0;
    for (const driver of driversWithRoutes) {
      const driverOrders = driverActiveOrdersMap.get(driver.id) || [];
      for (const ord of driverOrders) {
        if (ord.customer_id && ord.customer_id.trim()) {
          clientIds.add(ord.customer_id.trim());
        } else {
          anonymousClientsCount++;
        }
      }
    }
    return clientIds.size + anonymousClientsCount;
  }, [driversWithRoutes, driverActiveOrdersMap]);

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

  // Début de la journée pour les calculs de dates et filtres
  const startOfTodayMs = useMemo(() => {
    const d = new Date(nowMs);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }, [nowMs]);

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

  // Filtrage et tri des commandes livrées (triées par date de livraison décroissante : delivered_at, sinon updated_at)
  const filteredDeliveredOrders = useMemo(() => {
    const list = deliveredOrders.filter((ord) => {
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

      // 2. Filtre livreur
      if (deliveredDriverFilter !== 'all') {
        const matchesId = ord.driver_id === deliveredDriverFilter;
        const matchesName = ord.assigned_to?.trim().toLowerCase() === deliveredDriverFilter.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // 3. Filtre zone
      if (deliveredZoneFilter !== 'all') {
        const ordZoneId = ord.delivery_zone_id || '__no_zone__';
        if (ordZoneId !== deliveredZoneFilter) return false;
      }

      // 4. Recherche client, tél, réf, adresse, livreur
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

    // Tri par date de livraison décroissante (delivered_at, sinon updated_at)
    list.sort((a, b) => {
      const timeA = a.delivered_at || a.updated_at ? new Date(a.delivered_at || a.updated_at!).getTime() : 0;
      const timeB = b.delivered_at || b.updated_at ? new Date(b.delivered_at || b.updated_at!).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [
    deliveredOrders,
    deliveredPeriodFilter,
    deliveredDateBounds,
    deliveredDriverFilter,
    deliveredZoneFilter,
    deliveredSearchQuery,
  ]);

  // Montant total des commandes livrées filtrées
  const totalDeliveredFilteredAmount = useMemo(() => {
    return filteredDeliveredOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
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

  // Formatage de l'heure de livraison pour l'onglet « Livrées » (la date étant dans l'en-tête du jour)
  const formatDeliveryTime = (ord: Order) => {
    if (!ord.delivered_at) {
      return { timeText: '—', isApproximate: true };
    }
    try {
      const d = new Date(ord.delivered_at);
      if (isNaN(d.getTime())) return { timeText: '—', isApproximate: true };
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return {
        timeText: `${hours}:${minutes}`,
        isApproximate: false,
      };
    } catch {
      return { timeText: '—', isApproximate: true };
    }
  };

  // Groupement de TOUTES les commandes livrées filtrées par jour, avec totaux réels et pagination (50 lignes visibles à la fois)
  const deliveredDayGroups = useMemo(() => {
    // 1. Groupement complet de toutes les commandes filtrées pour calculer les vrais totaux du jour
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

          const rawLabel = d.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          });
          dayLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
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

    // 2. Découpage pour n'afficher que jusqu'à deliveredVisibleLimit commandes au total
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
        totalAmount: grp.totalAmount, // Vrai total de TOUTES les livraisons de ce jour
        totalCount: grp.totalCount,   // Vrai nombre de TOUTES les livraisons de ce jour
      });
      remainingSlots -= countToTake;
    }

    return visibleGroups;
  }, [filteredDeliveredOrders, deliveredVisibleLimit]);

  // Réinitialiser à 50 commandes visibles lorsque les filtres changent
  useEffect(() => {
    setDeliveredVisibleLimit(50);
  }, [
    deliveredPeriodFilter,
    customStartDate,
    customEndDate,
    deliveredDriverFilter,
    deliveredZoneFilter,
    deliveredSearchQuery,
  ]);

  // Gestion du repliage des cartes livreurs dans l'onglet « En tournée »
  const toggleDriverCollapse = (driverId: string) => {
    setCollapsedDriverIds((prev) => ({
      ...prev,
      [driverId]: !prev[driverId],
    }));
  };

  const collapseAllDrivers = () => {
    const map: Record<string, boolean> = {};
    for (const d of driversWithRoutes) {
      map[d.id] = true;
    }
    setCollapsedDriverIds(map);
  };

  const expandAllDrivers = () => {
    setCollapsedDriverIds({});
  };

  const areAllDriversCollapsed =
    driversWithRoutes.length > 0 &&
    driversWithRoutes.every((d) => Boolean(collapsedDriverIds[d.id]));

  const toggleAllDriversCollapse = () => {
    if (areAllDriversCollapsed) {
      expandAllDrivers();
    } else {
      collapseAllDrivers();
    }
  };

  const todayDriverDeliveriesCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const ord of orders) {
      if (ord.business_id !== business.id) continue;
      const t = new Date(ord.created_at).getTime();
      if (t < startOfTodayMs) continue;
      if (ord.status === 'cancelled') continue;

      if (ord.driver_id) {
        map.set(ord.driver_id, (map.get(ord.driver_id) || 0) + 1);
      } else if (ord.assigned_to?.trim()) {
        const key = `name:${ord.assigned_to.trim().toLowerCase()}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [orders, business.id, startOfTodayMs]);

  // Suggestions de livraison
  const customerHistory = useMemo(() => buildCustomerDriverHistory(orders), [orders]);
  const zoneHistory = useMemo(() => buildZoneDriverHistory(orders, nowMs), [orders, nowMs]);

  const orderSuggestions = useMemo(() => {
    const map = new Map<string, DriverSuggestion | null>();
    for (const ord of deliveryOrders) {
      map.set(ord.id, suggestForOrder(ord, customerHistory, zoneHistory));
    }
    return map;
  }, [deliveryOrders, customerHistory, zoneHistory]);

  // Extraction des zones représentées
  const allZonesList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const ord of deliveryOrders) {
      const zId = ord.delivery_zone_id || '__no_zone__';
      const zName = ord.delivery_zone_name || (zId === '__no_zone__' ? 'Sans zone' : 'Zone non nommée');
      const existing = map.get(zId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(zId, { id: zId, name: zName, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [deliveryOrders]);

  // Filtres dans l'onglet « À assigner »
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneSearchInDropdown, setZoneSearchInDropdown] = useState('');
  const [collapsedZones, setCollapsedZones] = useState<Record<string, boolean>>({});

  // Fermer le menu déroulant lors d'un clic extérieur
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isFilterDropdownOpen]);

  // Filtrage combiné des commandes
  const filteredOrders = useMemo(() => {
    return deliveryOrders.filter((ord) => {
      // « À assigner » ne liste que les commandes de livraison au statut ready sans livreur
      if (ord.status !== 'ready') {
        return false;
      }

      const hasDriver =
        Boolean(ord.driver_id && ord.driver_id.trim()) ||
        Boolean(ord.assigned_to && ord.assigned_to.trim());
      if (hasDriver) {
        return false;
      }

      // Filtre statut
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(ord.status)) {
        return false;
      }

      // Filtre zones
      if (selectedZoneIds.length > 0) {
        const ordZoneId = ord.delivery_zone_id || '__no_zone__';
        if (!selectedZoneIds.includes(ordZoneId)) {
          return false;
        }
      }

      // Recherche principale : client, téléphone, référence, adresse ET nom de zone
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesClient = ord.customer_name?.toLowerCase().includes(q) ?? false;
        const matchesPhone = ord.customer_phone?.toLowerCase().includes(q) ?? false;
        const matchesRef =
          ord.id.toLowerCase().includes(q) ||
          (ord.payment_reference?.toLowerCase().includes(q) ?? false);
        const matchesAddress = ord.delivery_address?.toLowerCase().includes(q) ?? false;
        const matchesZoneName = ord.delivery_zone_name?.toLowerCase().includes(q) ?? false;
        if (!matchesClient && !matchesPhone && !matchesRef && !matchesAddress && !matchesZoneName) {
          return false;
        }
      }

      return true;
    });
  }, [deliveryOrders, includeAssignedOrders, selectedStatuses, selectedZoneIds, searchQuery]);

  // Tri des colonnes (Zone, Client, Montant, Statut, Livreur - Tri par défaut sur la zone)
  type SortField = 'zone' | 'client' | 'amount' | 'status' | 'driver';
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>('zone');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Interrupteur « Grouper par zone » (clé platform_deliveries_group_by_zone, désactivé par défaut)
  const [groupByZone, setGroupByZone] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('platform_deliveries_group_by_zone') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleGroupByZone = () => {
    setGroupByZone((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('platform_deliveries_group_by_zone', String(next));
      } catch {}
      return next;
    });
  };

  // Mode de sélection (désactivé par défaut)
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

  // Commandes filtrées et triées
  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'zone') {
        const zA = a.delivery_zone_name || (a.delivery_zone_id ? 'Zone' : 'Sans zone');
        const zB = b.delivery_zone_name || (b.delivery_zone_id ? 'Zone' : 'Sans zone');
        comparison = zA.localeCompare(zB, 'fr');
      } else if (sortField === 'client') {
        const cA = a.customer_name || '';
        const cB = b.customer_name || '';
        comparison = cA.localeCompare(cB, 'fr');
      } else if (sortField === 'amount') {
        const mA = Number(a.total_amount || 0);
        const mB = Number(b.total_amount || 0);
        comparison = mA - mB;
      } else if (sortField === 'status') {
        const sA = a.status || '';
        const sB = b.status || '';
        comparison = sA.localeCompare(sB, 'fr');
      } else if (sortField === 'driver') {
        const dA = a.assigned_to || '';
        const dB = b.assigned_to || '';
        comparison = dA.localeCompare(dB, 'fr');
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredOrders, sortField, sortDirection]);

  // Regroupement par zone (alimenté par les commandes triées)
  const groupedByZone = useMemo(() => {
    const groups = new Map<string, { zoneId: string; zoneName: string; orders: Order[] }>();

    for (const ord of sortedOrders) {
      const zId = ord.delivery_zone_id || '__no_zone__';
      const zName = ord.delivery_zone_name || (zId === '__no_zone__' ? 'Sans zone' : 'Zone non nommée');
      let grp = groups.get(zId);
      if (!grp) {
        grp = { zoneId: zId, zoneName: zName, orders: [] };
        groups.set(zId, grp);
      }
      grp.orders.push(ord);
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.zoneId === '__no_zone__') return 1;
      if (b.zoneId === '__no_zone__') return -1;
      return a.zoneName.localeCompare(b.zoneName, 'fr');
    });
  }, [sortedOrders]);

  // Sélection des commandes
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleZoneSelection = (zoneOrders: Order[]) => {
    const zoneIds = zoneOrders.map((o) => o.id);
    const allSelected = zoneIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !zoneIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...zoneIds])));
    }
  };

  const toggleAllVisibleOrders = () => {
    const visibleIds = sortedOrders.map((o) => o.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const isAllVisibleSelected =
    sortedOrders.length > 0 && sortedOrders.every((o) => selectedOrderIds.includes(o.id));

  // Suggestion commune si applicable
  const commonSuggestion = useMemo(() => {
    if (selectedOrderIds.length === 0) return null;
    let commonDriverName: string | null = null;
    let commonDriverId: string | undefined = undefined;
    let totalCount = 0;

    for (const id of selectedOrderIds) {
      const sugg = orderSuggestions.get(id);
      if (!sugg) return null;
      if (commonDriverName === null) {
        commonDriverName = sugg.driverName;
        commonDriverId = sugg.driverId;
        totalCount = sugg.count;
      } else if (commonDriverName !== sugg.driverName) {
        return null;
      }
    }
    return commonDriverName ? { driverName: commonDriverName, driverId: commonDriverId, count: totalCount } : null;
  }, [selectedOrderIds, orderSuggestions]);

  // Sélecteur de livreur dans la barre fixe
  const [selectedDriverIdInBar, setSelectedDriverIdInBar] = useState<string>('');
  const [isAssignDriverDropdownOpen, setIsAssignDriverDropdownOpen] = useState(false);
  const assignDriverDropdownRef = useRef<HTMLDivElement>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Fermer le menu déroulant du sélecteur de livreur au clic extérieur
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (assignDriverDropdownRef.current && !assignDriverDropdownRef.current.contains(e.target as Node)) {
        setIsAssignDriverDropdownOpen(false);
      }
    };
    if (isAssignDriverDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isAssignDriverDropdownOpen]);

  // Livreurs actifs pour le sélecteur
  const activeDriversList = useMemo(() => {
    return drivers.filter((d) => d.is_active);
  }, [drivers]);

  // Effectuer l'assignation / désassignation
  const handleAssignAction = async (driverIdToSet: string | null, driverNameToSet?: string | null) => {
    if (selectedOrderIds.length === 0) return;
    setIsAssigning(true);
    setBannerMessage(null);

    let resolvedName = driverNameToSet;
    if (driverIdToSet && !resolvedName) {
      const matched = drivers.find((d) => d.id === driverIdToSet);
      if (matched) resolvedName = matched.name;
    }

    const res = await assignDriverToOrders(
      selectedOrderIds,
      driverIdToSet,
      business.id,
      resolvedName
    );

    setIsAssigning(false);
    if (res.success) {
      const count = selectedOrderIds.length;
      if (driverIdToSet || resolvedName) {
        setBannerMessage({
          type: 'success',
          text: `${count} commande${count > 1 ? 's assignées' : ' assignée'} à ${resolvedName || 'livreur'}.`,
        });
      } else {
        setBannerMessage({
          type: 'success',
          text: `Assignation retirée pour ${count} commande${count > 1 ? 's' : ''}.`,
        });
      }
      setSelectedOrderIds([]);
      setSelectedDriverIdInBar('');
    } else {
      setBannerMessage({
        type: 'error',
        text: res.error || "Erreur lors de l'assignation.",
      });
    }
  };

  // Actions par commande dans l'onglet « Tournées »
  const handleReassignOrder = async (orderId: string, targetDriver: Driver) => {
    setProcessingOrderId(orderId);
    setOrderMenu(null);
    setBannerMessage(null);
    const res = await assignDriverToOrders(
      [orderId],
      targetDriver.id,
      business.id,
      targetDriver.name
    );
    setProcessingOrderId(null);
    if (res.success) {
      setBannerMessage({
        type: 'success',
        text: `Commande réassignée à ${targetDriver.name}.`,
      });
    } else {
      setBannerMessage({
        type: 'error',
        text: res.error || 'Erreur lors de la réassignation.',
      });
    }
  };

  const handleRemoveFromRoute = async (orderId: string) => {
    setProcessingOrderId(orderId);
    setOrderMenu(null);
    setBannerMessage(null);
    const res = await assignDriverToOrders([orderId], null, business.id, null);
    setProcessingOrderId(null);
    if (res.success) {
      setBannerMessage({
        type: 'success',
        text: 'Commande retirée des livraisons.',
      });
    } else {
      setBannerMessage({
        type: 'error',
        text: res.error || 'Erreur lors du retrait de la commande.',
      });
    }
  };

  const handleMarkOrderDelivered = async (orderId: string) => {
    setProcessingOrderId(orderId);
    setOrderMenu(null);
    setBannerMessage(null);
    const res = await updateOrderStatus(orderId, 'delivered');
    getStore().updateOrderStatus(orderId, 'delivered');
    setProcessingOrderId(null);
    if (res.success) {
      const refShort = getOrderShortRef(orderId);
      setBannerMessage({
        type: 'success',
        text: `Commande #${refShort} marquée comme livrée.`,
      });
    } else {
      setBannerMessage({
        type: 'error',
        text: res.error || 'Erreur lors de la mise à jour du statut.',
      });
    }
  };

  // Scroll automatique sur le livreur centré quand on arrive depuis l'onglet Livreurs
  useEffect(() => {
    if (activeSubTab === 'routes' && focusedDriverId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`route-card-${focusedDriverId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeSubTab, focusedDriverId]);

  // Calcul et ouverture du menu ⋮ d'une commande (position fixed calculée avec getBoundingClientRect)
  const handleOpenOrderMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    ord: Order,
    drv: Driver
  ) => {
    e.stopPropagation();
    if (orderMenu?.order.id === ord.id) {
      setOrderMenu(null);
      return;
    }

    const btn = e.currentTarget;
    orderMenuButtonRef.current = btn;
    const rect = btn.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - rect.right);
    const estimatedMenuHeight = 220; // Hauteur compacte
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight;

    setDriverSearchQuery('');
    if (openUpwards) {
      setOrderMenu({
        order: ord,
        driver: drv,
        coords: {
          bottom: window.innerHeight - rect.top + 4,
          right,
        },
        view: 'main',
      });
    } else {
      setOrderMenu({
        order: ord,
        driver: drv,
        coords: {
          top: rect.bottom + 4,
          right,
        },
        view: 'main',
      });
    }
  };

  // Annulation de commande via la modale React (même fonction cancelOrder que la page Commandes)
  const handleConfirmCancelOrder = async () => {
    if (!cancelModalOrder) return;
    const trimmed = cancellationReason.trim();
    if (trimmed.length < 3) {
      setCancelModalError('Le motif doit comporter au moins 3 caractères.');
      return;
    }

    setIsCancellingOrder(true);
    setCancelModalError(null);
    setBannerMessage(null);
    try {
      const res = await cancelOrder(cancelModalOrder.id, trimmed);
      if (res.success) {
        const refShort = getOrderShortRef(cancelModalOrder);
        setBannerMessage({
          type: 'success',
          text: `Commande #${refShort} annulée avec succès.`,
        });
        setCancelModalOrder(null);
        setCancellationReason('');
      } else {
        setCancelModalError(res.error || "Erreur lors de l'annulation de la commande.");
      }
    } catch (err: any) {
      setCancelModalError(err?.message || "Erreur inattendue lors de l'annulation.");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // Fermeture du menu ⋮ : clic extérieur, touche Échap, défilement et redimensionnement
  // Un seul mécanisme unifié qui considère à la fois le bouton ET le menu comme intérieurs
  useEffect(() => {
    if (!orderMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOrderMenu(null);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        orderMenuDropdownRef.current?.contains(target) ||
        orderMenuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setOrderMenu(null);
    };

    const handleScrollOrResize = () => {
      setOrderMenu(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [orderMenu]);

  // Fermer le menu Imprimer en cas de clic extérieur
  useEffect(() => {
    const handleOutsidePrintClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openPrintMenuDriverId && !target.closest('.print-menu-container')) {
        setOpenPrintMenuDriverId(null);
      }
    };
    if (openPrintMenuDriverId) {
      document.addEventListener('mousedown', handleOutsidePrintClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsidePrintClick);
  }, [openPrintMenuDriverId]);

  // Action d'impression : Feuille de route (A4) ou Tickets (80 mm)
  const handlePrint = async (
    driver: Driver,
    driverOrders: Order[],
    type: 'route' | 'tickets'
  ) => {
    if (!driverOrders || driverOrders.length === 0) return;

    setTicketPreviewModal({
      isOpen: true,
      driver,
      orders: driverOrders,
      initialTab: type,
    });
  };

  // Ouverture du modal de Facture (A4) pour une commande individuelle
  const handleOpenOrderInvoice = async (order: Order) => {
    // Si la commande contient déjà ses articles
    if (order.items && order.items.length > 0) {
      setInvoiceItemsByOrder((prev) => ({ ...prev, [order.id]: order.items || [] }));
      setInvoiceModalOrder(order);
      return;
    }

    if (invoiceItemsByOrder[order.id] && invoiceItemsByOrder[order.id].length > 0) {
      setInvoiceModalOrder(order);
      return;
    }

    try {
      const fetched = await fetchOrderItemsForOrders([order.id]);
      setInvoiceItemsByOrder((prev) => ({ ...prev, ...fetched }));
      const orderWithItems: Order = {
        ...order,
        items: fetched[order.id] || order.items || [],
      };
      setInvoiceModalOrder(orderWithItems);
    } catch (err: any) {
      console.warn('Erreur chargement articles pour facture:', err);
      setBannerMessage({
        type: 'error',
        text: `Impossible de charger les articles de la commande #${getOrderShortRef(order)} : ${err?.message || 'Erreur réseau'}`,
      });
    }
  };

  // Gestion formulaire livreur (Création / Modification)
  const openNewDriverModal = () => {
    setEditingDriver(null);
    setDriverFormName('');
    setDriverFormPhone('');
    setDriverFormNeighborhood('');
    setDriverFormPhotoUrl(null);
    setDriverFormError(null);
    setIsDriverModalOpen(true);
  };

  const openEditDriverModal = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverFormName(driver.name);
    setDriverFormPhone(driver.phone || '');
    setDriverFormNeighborhood(driver.neighborhood || '');
    setDriverFormPhotoUrl(driver.photo_url || null);
    setDriverFormError(null);
    setIsDriverModalOpen(true);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setDriverFormError(null);
    try {
      const res = await uploadDriverPhoto(file, business.id);
      if (res.success && res.url) {
        setDriverFormPhotoUrl(res.url);
      } else {
        setDriverFormError(res.error || "Échec de l'upload de la photo.");
      }
    } catch (err: any) {
      setDriverFormError(err?.message || "Erreur lors de l'upload de la photo.");
    } finally {
      setIsUploadingPhoto(false);
      if (driverPhotoInputRef.current) {
        driverPhotoInputRef.current.value = '';
      }
    }
  };

  const handleSaveDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriverFormError(null);
    const cleanName = driverFormName.trim();
    const cleanPhone = driverFormPhone.trim() || null;
    const cleanNeighborhood = driverFormNeighborhood.trim() || null;
    const cleanPhotoUrl = driverFormPhotoUrl?.trim() || null;

    if (!cleanName) {
      setDriverFormError('Le nom du livreur est requis.');
      return;
    }
    if (cleanName.length > 80) {
      setDriverFormError('Le nom ne doit pas dépasser 80 caractères.');
      return;
    }
    if (cleanPhone && cleanPhone.length > 30) {
      setDriverFormError('Le téléphone ne doit pas dépasser 30 caractères.');
      return;
    }
    if (cleanNeighborhood && cleanNeighborhood.length > 80) {
      setDriverFormError('Le quartier ne doit pas dépasser 80 caractères.');
      return;
    }

    setIsDriverSaving(true);
    try {
      if (editingDriver) {
        const res = await updateDriver(editingDriver.id, business.id, {
          name: cleanName,
          phone: cleanPhone,
          neighborhood: cleanNeighborhood,
          photo_url: cleanPhotoUrl,
        });
        if (res.success && res.driver) {
          setDrivers((prev) => prev.map((d) => (d.id === editingDriver.id ? res.driver! : d)));
          setIsDriverModalOpen(false);
          setBannerMessage({ type: 'success', text: `Livreur ${cleanName} modifié.` });
        } else {
          setDriverFormError(res.error || 'Erreur lors de la modification.');
        }
      } else {
        const res = await insertDriver({
          business_id: business.id,
          name: cleanName,
          phone: cleanPhone,
          neighborhood: cleanNeighborhood,
          photo_url: cleanPhotoUrl,
          is_active: true,
        });
        if (res.success && res.driver) {
          setDrivers((prev) => [...prev, res.driver!]);
          setIsDriverModalOpen(false);
          setSelectedDriverIdInBar(res.driver.id);
          setBannerMessage({ type: 'success', text: `Livreur ${cleanName} ajouté.` });
        } else {
          setDriverFormError(res.error || "Erreur lors de l'enregistrement.");
        }
      }
    } catch (err: any) {
      setDriverFormError(err?.message || 'Erreur inattendue.');
    } finally {
      setIsDriverSaving(false);
    }
  };

  const handleToggleDriverStatus = async (driver: Driver) => {
    const nextActive = !driver.is_active;
    try {
      const res = await setDriverActive(driver.id, business.id, nextActive);
      if (res.success) {
        setDrivers((prev) =>
          prev.map((d) => (d.id === driver.id ? { ...d, is_active: nextActive } : d))
        );
        setBannerMessage({
          type: 'success',
          text: nextActive
            ? `Livreur ${driver.name} réactivé.`
            : `Livreur ${driver.name} archivé.`,
        });
      } else {
        setBannerMessage({
          type: 'error',
          text: res.error || 'Erreur lors du changement de statut.',
        });
      }
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err?.message || 'Erreur inattendue.' });
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            {getOrderStatusLabel('confirmed', 'delivery')}
          </span>
        );
      case 'preparing':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            {getOrderStatusLabel('preparing', 'delivery')}
          </span>
        );
      case 'ready':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
            {getOrderStatusLabel('ready', 'delivery')}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
            {getOrderStatusLabel(status, 'delivery')}
          </span>
        );
    }
  };

  // Pastille de statut pour l'onglet « En livraison » : masquer « Confirmée » (cas normal),
  // afficher « En préparation » et « Prête » en petit (point de couleur et texte).
  const getRouteStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'confirmed':
        return null;
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>{getOrderStatusLabel('preparing', 'delivery')}</span>
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>{getOrderStatusLabel('ready', 'delivery')}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 pb-36">
      {/* 1. Cadre unifié compact : En-tête et barre d'outils sur une seule ligne (flex-wrap sous xl) */}
      <div className="bg-white px-3 py-2 rounded-xl border border-[#E5DCD0]">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2.5 justify-between">
          {/* Gauche : Titre « Livraisons » + Contrôle segmenté « À assigner | Livreurs (n) » */}
          <div className="flex items-center gap-2.5 shrink-0">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Livraisons</h1>
            <div className="inline-flex items-center bg-[#FAF7F2] border border-[#E5DCD0] p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveSubTab('pending')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeSubTab === 'pending'
                    ? 'bg-[#1B4B4A] text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                À assigner
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('routes')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeSubTab === 'routes'
                    ? 'bg-[#1B4B4A] text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                En livraison ({routesClientsCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('delivered')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeSubTab === 'delivered'
                    ? 'bg-[#1B4B4A] text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Livrées ({deliveredOrders.length})
              </button>
            </div>
          </div>

          {/* Éléments de la barre d'outils dans l'onglet « En livraison » */}
          {activeSubTab === 'routes' && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-xs text-slate-600 font-medium whitespace-nowrap">
                <span className="font-semibold text-slate-900 tabular-nums">{driversWithRoutes.length}</span> livreur{driversWithRoutes.length > 1 ? 's' : ''} en livraison · <span className="font-semibold text-slate-900 tabular-nums">{routesClientsCount}</span> client{routesClientsCount > 1 ? 's' : ''}
              </div>
              <button
                type="button"
                onClick={toggleAllDriversCollapse}
                className="px-2 py-1 rounded-md border border-[#E5DCD0] bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap"
              >
                {areAllDriversCollapsed ? 'Tout déplier' : 'Tout replier'}
              </button>
            </div>
          )}

          {/* Éléments de la barre d'outils dans l'onglet « À assigner » */}
          {activeSubTab === 'pending' && (
            <>
              {/* Recherche (largeur flexible min 200px max 360px) */}
              <div className="relative flex-1 min-w-[200px] max-w-[360px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Recherche client, téléphone, réf..."
                  className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
                />
              </div>

              {/* Bouton Filtres */}
              <div className="relative shrink-0" ref={filterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    selectedStatuses.length > 0 || selectedZoneIds.length > 0 || includeAssignedOrders
                      ? 'border-[#1B4B4A] bg-[#1B4B4A] text-white'
                      : 'border-[#E5DCD0] bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtres</span>
                  {(selectedStatuses.length > 0 || selectedZoneIds.length > 0 || includeAssignedOrders) && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                      {selectedStatuses.length + selectedZoneIds.length + (includeAssignedOrders ? 1 : 0)}
                    </span>
                  )}
                </button>

                {/* Dropdown Filtres */}
                {isFilterDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white border border-[#E5DCD0] rounded-xl shadow-xl z-30 p-3.5 space-y-3">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Statuts
                      </div>
                      <div className="space-y-1">
                        {(['confirmed', 'preparing', 'ready'] as OrderStatus[]).map((st) => {
                          const isChecked = selectedStatuses.includes(st);
                          const label = getOrderStatusLabel(st, 'delivery');
                          return (
                            <label
                              key={st}
                              className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedStatuses((prev) =>
                                    isChecked ? prev.filter((s) => s !== st) : [...prev, st]
                                  );
                                }}
                                className="rounded border-[#E5DCD0] text-[#1B4B4A] focus:ring-[#1B4B4A]"
                              />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Assignation
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={includeAssignedOrders}
                          onChange={(e) => setIncludeAssignedOrders(e.target.checked)}
                          className="rounded border-[#E5DCD0] text-[#1B4B4A] focus:ring-[#1B4B4A]"
                        />
                        <span>Inclure les commandes déjà assignées</span>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Zones
                      </div>
                      <input
                        type="text"
                        value={zoneSearchInDropdown}
                        onChange={(e) => setZoneSearchInDropdown(e.target.value)}
                        placeholder="Filtrer les zones..."
                        className="w-full bg-[#FAF7F2] border border-[#E5DCD0] rounded-md px-2 py-1 text-xs mb-1.5 focus:outline-none focus:border-[#1B4B4A]"
                      />
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {allZonesList
                          .filter((z) =>
                            z.name.toLowerCase().includes(zoneSearchInDropdown.toLowerCase())
                          )
                          .map((z) => {
                            const isChecked = selectedZoneIds.includes(z.id);
                            return (
                              <label
                                key={z.id}
                                className="flex items-center justify-between text-xs text-slate-700 cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedZoneIds((prev) =>
                                        isChecked ? prev.filter((id) => id !== z.id) : [...prev, z.id]
                                      );
                                    }}
                                    className="rounded border-[#E5DCD0] text-[#1B4B4A] focus:ring-[#1B4B4A]"
                                  />
                                  <span className="truncate">{z.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono ml-2">
                                  {z.count}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStatuses([]);
                          setSelectedZoneIds([]);
                          setIncludeAssignedOrders(false);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        Effacer
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFilterDropdownOpen(false)}
                        className="px-2.5 py-1 bg-[#1B4B4A] text-white rounded-md text-xs font-semibold cursor-pointer"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Interrupteur « Grouper par zone » */}
              <button
                type="button"
                onClick={toggleGroupByZone}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  groupByZone
                    ? 'border-[#1B4B4A] bg-[#1B4B4A]/10 text-[#1B4B4A]'
                    : 'border-[#E5DCD0] bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={groupByZone ? 'Affichage groupé par zone actif' : 'Affichage liste plate actif'}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Grouper par zone</span>
              </button>

              {/* Tout à droite : Compteurs sobres en texte simple et boutons de sélection */}
              <div className="flex items-center justify-end gap-2.5 shrink-0 ml-auto">
                <div className="text-xs text-slate-600 font-medium whitespace-nowrap">
                  <span className="font-semibold text-slate-900 tabular-nums">{totalToDeliver}</span> à livrer
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="font-semibold text-amber-800 tabular-nums">{totalUnassigned}</span> non assignées
                </div>

                {!isSelectionMode ? (
                  <button
                    type="button"
                    onClick={() => setIsSelectionMode(true)}
                    className="px-2.5 py-1 rounded-lg border border-[#E5DCD0] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sélectionner</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleAllVisibleOrders}
                      className="px-2.5 py-1 rounded-lg border border-[#E5DCD0] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {isAllVisibleSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#1B4B4A]" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{isAllVisibleSelected ? 'Tout décocher' : 'Tout cocher'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedOrderIds([]);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bouton Livreurs (ouvre le panneau latéral de gestion des livreurs) */}
          <button
            type="button"
            onClick={() => setIsDriversDrawerOpen(true)}
            className="px-2.5 py-1 rounded-lg border border-[#E5DCD0] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ml-auto"
            title="Ouvrir la gestion des livreurs"
          >
            <Users className="w-3.5 h-3.5 text-[#1B4B4A]" />
            <span>Livreurs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#FAF7F2] border border-[#E5DCD0] text-slate-700 font-mono">
              {drivers.filter((d) => d.is_active).length}
            </span>
          </button>
        </div>

        {/* Message d'information discret */}
        {bannerMessage && (
          <div
            className={`mt-2 p-2 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 ${
              bannerMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span>{bannerMessage.text}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-slate-400 hover:text-slate-700 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Pastilles actives retirables */}
        {activeSubTab === 'pending' && (selectedStatuses.length > 0 || selectedZoneIds.length > 0 || includeAssignedOrders) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">
              Filtres :
            </span>
            {includeAssignedOrders && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#1B4B4A]/10 text-[#1B4B4A] border border-[#1B4B4A]/20">
                <span>Commandes assignées incluses</span>
                <button
                  type="button"
                  onClick={() => setIncludeAssignedOrders(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStatuses.map((st) => (
              <span
                key={st}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800 border border-slate-200"
              >
                <span>
                  {getOrderStatusLabel(st, 'delivery')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStatuses((prev) => prev.filter((s) => s !== st))}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedZoneIds.map((zId) => {
              const z = allZonesList.find((item) => item.id === zId);
              const name = z ? z.name : zId === '__no_zone__' ? 'Sans zone' : zId;
              return (
                <span
                  key={zId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-800 border border-slate-200"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedZoneIds((prev) => prev.filter((id) => id !== zId))}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelectedStatuses([]);
                setSelectedZoneIds([]);
                setIncludeAssignedOrders(false);
              }}
              className="text-[11px] text-[#1B4B4A] hover:underline font-semibold ml-1 cursor-pointer"
            >
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. ONGLET 1 : TABLEAU DES COMMANDES À ASSIGNER (DENSITÉ AMÉLIORÉE) */}
      {/* ========================================================================= */}
      {activeSubTab === 'pending' && (
        <div className="space-y-3">
          {sortedOrders.length === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-[#E5DCD0] text-center">
              <p className="text-xs text-slate-500">
                Aucune commande à livrer correspondant aux critères.{' '}
                {(selectedStatuses.length > 0 || selectedZoneIds.length > 0 || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStatuses([]);
                      setSelectedZoneIds([]);
                      setSearchQuery('');
                    }}
                    className="text-[#1B4B4A] font-bold underline ml-1 cursor-pointer"
                  >
                    Réinitialiser
                  </button>
                )}
              </p>
            </div>
          ) : !groupByZone ? (
            /* 1. LISTE PLATE PAR DÉFAUT (Colonnes Client, Zone, Montant, Statut, Livreur) */
            <div className="bg-white rounded-xl border border-[#E5DCD0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 table-fixed">
                  <colgroup>
                    {isSelectionMode && <col className="w-[40px]" style={{ width: '40px' }} />}
                    <col />
                    <col className="w-[150px]" style={{ width: '150px' }} />
                    <col className="w-[120px]" style={{ width: '120px' }} />
                    <col className="w-[130px]" style={{ width: '130px' }} />
                    <col className="w-[200px]" style={{ width: '200px' }} />
                  </colgroup>
                  <thead className="bg-slate-50/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-100">
                    <tr>
                      {isSelectionMode && <th className="py-1.5 px-2 text-center w-[40px]"></th>}
                      {/* Client */}
                      <th
                        onClick={() => handleSort('client')}
                        className="py-1.5 px-2.5 cursor-pointer hover:text-slate-800 select-none transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Client</span>
                          {sortField === 'client' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>

                      {/* Zone */}
                      <th
                        onClick={() => handleSort('zone')}
                        className="py-1.5 px-2.5 w-[150px] cursor-pointer hover:text-slate-800 select-none transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Zone</span>
                          {sortField === 'zone' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>

                      {/* Montant */}
                      <th
                        onClick={() => handleSort('amount')}
                        className="py-1.5 px-2.5 text-right w-[120px] cursor-pointer hover:text-slate-800 select-none transition-colors"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Montant</span>
                          {sortField === 'amount' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>

                      {/* Statut */}
                      <th
                        onClick={() => handleSort('status')}
                        className="py-1.5 px-2 w-[130px] cursor-pointer hover:text-slate-800 select-none transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Statut</span>
                          {sortField === 'status' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>

                      {/* Livreur */}
                      <th
                        onClick={() => handleSort('driver')}
                        className="py-1.5 px-2.5 w-[200px] cursor-pointer hover:text-slate-800 select-none transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Livreur</span>
                          {sortField === 'driver' ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedOrders.map((ord) => {
                      const isChecked = selectedOrderIds.includes(ord.id);
                      const suggestion = orderSuggestions.get(ord.id);
                      const refShort = getOrderShortRef(ord);
                      const clientInitial = ((ord.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase();

                      return (
                        <tr
                          key={ord.id}
                          onClick={() => {
                            if (isSelectionMode) {
                              toggleOrderSelection(ord.id);
                            }
                          }}
                          className={`transition-colors ${
                            isSelectionMode ? 'cursor-pointer hover:bg-[#1B4B4A]/5' : 'hover:bg-slate-50/60'
                          } ${isChecked ? 'bg-[#1B4B4A]/5' : ''}`}
                        >
                          {/* Case (uniquement en mode sélection) */}
                          {isSelectionMode && (
                            <td className="py-2 px-1 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleOrderSelection(ord.id)}
                                className="cursor-pointer text-slate-400 hover:text-slate-700 inline-flex items-center justify-center"
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-[#1B4B4A]" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-300" />
                                )}
                              </button>
                            </td>
                          )}

                          {/* Client (avatar, nom, tél & adresse, réf courte) */}
                          <td className="py-2 px-2.5 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {ord.customer_avatar ? (
                                <img
                                  src={ord.customer_avatar}
                                  alt={ord.customer_name || 'Client'}
                                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#E5DCD0]"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-xs shrink-0">
                                  {clientInitial}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-900 text-xs truncate">
                                  {ord.customer_name || 'Client anonyme'}
                                </div>
                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 leading-tight mt-0.5">
                                  <span className="font-mono text-slate-400 font-medium">#{refShort}</span>
                                  {ord.customer_phone && (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <span className="font-mono shrink-0">{ord.customer_phone}</span>
                                    </>
                                  )}
                                  {ord.delivery_address && (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <span className="truncate max-w-xs">{ord.delivery_address}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Zone */}
                          <td className="py-2 px-2.5 w-[150px] whitespace-nowrap truncate">
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {ord.delivery_zone_name || (ord.delivery_zone_id ? 'Zone' : 'Sans zone')}
                            </span>
                          </td>

                          {/* Montant (120 px aligné à droite) */}
                          <td className="py-2 px-2.5 text-right font-bold text-slate-900 text-xs tabular-nums whitespace-nowrap">
                            {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
                          </td>

                          {/* Statut (130 px) */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            {getStatusBadge(ord.status)}
                          </td>

                          {/* Livreur (200 px) */}
                          <td className="py-2 px-2.5 min-w-0">
                            <div className="leading-tight truncate">
                              {ord.assigned_to ? (
                                <span className="font-semibold text-slate-900 text-xs block truncate">
                                  {ord.assigned_to}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-xs block truncate">Non assigné</span>
                              )}

                              {/* Suggestion en petit texte sous le livreur */}
                              {suggestion && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrderIds([ord.id]);
                                    if (suggestion.driverId) {
                                      setSelectedDriverIdInBar(suggestion.driverId);
                                    }
                                  }}
                                  className="text-[10px] text-[#1B4B4A] hover:underline font-medium block text-left cursor-pointer mt-0.5 truncate"
                                >
                                  {suggestion.reason}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* 2. GROUPÉ PAR ZONE (SECTIONS REPLIABLES ACTUELLES) */
            <div className="space-y-2.5">
              {groupedByZone.map((group) => {
                const isCollapsed = collapsedZones[group.zoneId] ?? false;
                const zoneOrderIds = group.orders.map((o) => o.id);
                const isZoneAllSelected =
                  zoneOrderIds.length > 0 && zoneOrderIds.every((id) => selectedOrderIds.includes(id));
                const isZonePartiallySelected =
                  zoneOrderIds.some((id) => selectedOrderIds.includes(id)) && !isZoneAllSelected;

                return (
                  <div
                    key={group.zoneId}
                    className="bg-white rounded-xl border border-[#E5DCD0] overflow-hidden"
                  >
                    {/* En-tête de zone compact */}
                    <div className="bg-[#FAF7F2] px-3 py-1.5 border-b border-[#E5DCD0] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedZones((prev) => ({ ...prev, [group.zoneId]: !isCollapsed }))
                          }
                          className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isSelectionMode && (
                          <button
                            type="button"
                            onClick={() => toggleZoneSelection(group.orders)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {isZoneAllSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[#1B4B4A]" />
                            ) : isZonePartiallySelected ? (
                              <div className="w-3.5 h-3.5 rounded bg-[#1B4B4A]/10 border border-[#1B4B4A] flex items-center justify-center text-[9px] text-[#1B4B4A] font-bold">
                                -
                              </div>
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </button>
                        )}

                        <span className="text-xs font-bold text-slate-900">{group.zoneName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white border border-[#E5DCD0] text-slate-600">
                          {group.orders.length}
                        </span>
                      </div>

                      {isSelectionMode && (
                        <button
                          type="button"
                          onClick={() => toggleZoneSelection(group.orders)}
                          className="text-[11px] text-[#1B4B4A] hover:underline font-semibold cursor-pointer"
                        >
                          {isZoneAllSelected ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      )}
                    </div>

                    {/* Tableau dense avec colonnes alignées rigoureusement entre toutes les zones */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700 table-fixed">
                          <colgroup>
                            {isSelectionMode && <col className="w-[40px]" style={{ width: '40px' }} />}
                            <col />
                            <col className="w-[120px]" style={{ width: '120px' }} />
                            <col className="w-[130px]" style={{ width: '130px' }} />
                            <col className="w-[200px]" style={{ width: '200px' }} />
                          </colgroup>
                          <thead className="bg-slate-50/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-100">
                            <tr>
                              {isSelectionMode && <th className="py-1.5 px-2 text-center w-[40px]"></th>}
                              <th
                                onClick={() => handleSort('client')}
                                className="py-1.5 px-2.5 cursor-pointer hover:text-slate-800 select-none transition-colors"
                              >
                                <div className="flex items-center gap-1">
                                  <span>Client</span>
                                  {sortField === 'client' ? (
                                    sortDirection === 'asc' ? (
                                      <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                  )}
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort('amount')}
                                className="py-1.5 px-2.5 text-right w-[120px] cursor-pointer hover:text-slate-800 select-none transition-colors"
                              >
                                <div className="flex items-center justify-end gap-1">
                                  <span>Montant</span>
                                  {sortField === 'amount' ? (
                                    sortDirection === 'asc' ? (
                                      <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                  )}
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort('status')}
                                className="py-1.5 px-2 w-[130px] cursor-pointer hover:text-slate-800 select-none transition-colors"
                              >
                                <div className="flex items-center gap-1">
                                  <span>Statut</span>
                                  {sortField === 'status' ? (
                                    sortDirection === 'asc' ? (
                                      <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                  )}
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort('driver')}
                                className="py-1.5 px-2.5 w-[200px] cursor-pointer hover:text-slate-800 select-none transition-colors"
                              >
                                <div className="flex items-center gap-1">
                                  <span>Livreur</span>
                                  {sortField === 'driver' ? (
                                    sortDirection === 'asc' ? (
                                      <ArrowUp className="w-3 h-3 text-[#1B4B4A]" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-[#1B4B4A]" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-300" />
                                  )}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.orders.map((ord) => {
                              const isChecked = selectedOrderIds.includes(ord.id);
                              const suggestion = orderSuggestions.get(ord.id);
                              const refShort = getOrderShortRef(ord);
                              const clientInitial = ((ord.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase();

                              return (
                                <tr
                                  key={ord.id}
                                  onClick={() => {
                                    if (isSelectionMode) {
                                      toggleOrderSelection(ord.id);
                                    }
                                  }}
                                  className={`transition-colors ${
                                    isSelectionMode ? 'cursor-pointer hover:bg-[#1B4B4A]/5' : 'hover:bg-slate-50/60'
                                  } ${isChecked ? 'bg-[#1B4B4A]/5' : ''}`}
                                >
                                  {/* Case (uniquement en mode sélection) */}
                                  {isSelectionMode && (
                                    <td className="py-2 px-1 text-center" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => toggleOrderSelection(ord.id)}
                                        className="cursor-pointer text-slate-400 hover:text-slate-700 inline-flex items-center justify-center"
                                      >
                                        {isChecked ? (
                                          <CheckSquare className="w-3.5 h-3.5 text-[#1B4B4A]" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 text-slate-300" />
                                        )}
                                      </button>
                                    </td>
                                  )}

                                  {/* Client (avatar, nom, tél & adresse, réf courte) */}
                                  <td className="py-2 px-2.5 min-w-0">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {ord.customer_avatar ? (
                                        <img
                                          src={ord.customer_avatar}
                                          alt={ord.customer_name || 'Client'}
                                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#E5DCD0]"
                                        />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-xs shrink-0">
                                          {clientInitial}
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-slate-900 text-xs truncate">
                                          {ord.customer_name || 'Client anonyme'}
                                        </div>
                                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 leading-tight mt-0.5">
                                          <span className="font-mono text-slate-400 font-medium">#{refShort}</span>
                                          {ord.customer_phone && (
                                            <>
                                              <span className="text-slate-300">·</span>
                                              <span className="font-mono shrink-0">{ord.customer_phone}</span>
                                            </>
                                          )}
                                          {ord.delivery_address && (
                                            <>
                                              <span className="text-slate-300">·</span>
                                              <span className="truncate max-w-xs">{ord.delivery_address}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Montant (120 px aligné à droite) */}
                                  <td className="py-2 px-2.5 text-right font-bold text-slate-900 text-xs tabular-nums whitespace-nowrap">
                                    {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
                                  </td>

                                  {/* Statut (130 px) */}
                                  <td className="py-2 px-2 whitespace-nowrap">
                                    {getStatusBadge(ord.status)}
                                  </td>

                                  {/* Livreur (200 px) */}
                                  <td className="py-2 px-2.5 min-w-0">
                                    <div className="leading-tight truncate">
                                      {ord.assigned_to ? (
                                        <span className="font-semibold text-slate-900 text-xs block truncate">
                                          {ord.assigned_to}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic text-xs block truncate">Non assigné</span>
                                      )}

                                      {/* Suggestion en petit texte sous le livreur */}
                                      {suggestion && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedOrderIds([ord.id]);
                                            if (suggestion.driverId) {
                                              setSelectedDriverIdInBar(suggestion.driverId);
                                            }
                                          }}
                                          className="text-[10px] text-[#1B4B4A] hover:underline font-medium block text-left cursor-pointer mt-0.5 truncate"
                                        >
                                          {suggestion.reason}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Barre d'action fixe en bas dès qu'on coche */}
          {selectedOrderIds.length > 0 && (
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-3xl bg-[#FAF7F2] border border-[#1B4B4A] shadow-xl rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#1B4B4A] text-white text-xs font-bold font-mono">
                  {selectedOrderIds.length}
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {selectedOrderIds.length === 1 ? '1 commande cochée' : `${selectedOrderIds.length} commandes cochées`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                {/* Suggestion commune cliquable si disponible */}
                {commonSuggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      if (commonSuggestion.driverId) {
                        setSelectedDriverIdInBar(commonSuggestion.driverId);
                      }
                    }}
                    className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold cursor-pointer"
                  >
                    Suggéré : {commonSuggestion.driverName} ({commonSuggestion.count} fois)
                  </button>
                )}

                {/* Sélecteur de livreur avec photo/initiales et quartier (ACTIFS UNIQUEMENT) */}
                <div className="relative" ref={assignDriverDropdownRef}>
                  <button
                    type="button"
                    disabled={isAssigning}
                    onClick={() => setIsAssignDriverDropdownOpen((prev) => !prev)}
                    className="bg-white border border-[#E5DCD0] rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] flex items-center gap-2 min-w-[190px] justify-between cursor-pointer disabled:opacity-50"
                  >
                    {selectedDriverIdInBar ? (
                      (() => {
                        const d = activeDriversList.find((drv) => drv.id === selectedDriverIdInBar);
                        if (!d) return <span className="text-slate-400">Choisir un livreur...</span>;
                        const inits = (d.name.trim().charAt(0) || 'L').toUpperCase();
                        return (
                          <div className="flex items-center gap-1.5 truncate">
                            {d.photo_url ? (
                              <img
                                src={d.photo_url}
                                alt={d.name}
                                className="w-4 h-4 rounded-full object-cover shrink-0 border border-[#E5DCD0]"
                              />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-[9px] shrink-0">
                                {inits}
                              </span>
                            )}
                            <span className="font-semibold truncate">{d.name}</span>
                            {d.neighborhood && (
                              <span className="text-[10px] text-slate-400 truncate">({d.neighborhood})</span>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-slate-500">Choisir un livreur...</span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {isAssignDriverDropdownOpen && (
                    <div className="absolute bottom-full mb-1 left-0 w-64 bg-white border border-[#E5DCD0] rounded-xl shadow-xl z-50 p-1.5 space-y-1 max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDriverIdInBar('');
                          setIsAssignDriverDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer hover:bg-slate-50 ${
                          !selectedDriverIdInBar ? 'bg-[#FAF7F2] font-semibold text-[#1B4B4A]' : 'text-slate-600'
                        }`}
                      >
                        <span className="text-slate-400 italic">Aucun livreur sélectionné</span>
                      </button>

                      {activeDriversList.map((d) => {
                        const isSelected = selectedDriverIdInBar === d.id;
                        const inProgressCount = driverActiveOrdersMap.get(d.id)?.length || 0;
                        const inits = (d.name.trim().charAt(0) || 'L').toUpperCase();
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedDriverIdInBar(d.id);
                              setIsAssignDriverDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer hover:bg-[#FAF7F2] transition-colors ${
                              isSelected ? 'bg-[#FAF7F2] font-semibold text-[#1B4B4A]' : 'text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {d.photo_url ? (
                                <img
                                  src={d.photo_url}
                                  alt={d.name}
                                  className="w-5 h-5 rounded-full object-cover shrink-0 border border-[#E5DCD0]"
                                />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-slate-100 border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {inits}
                                </span>
                              )}
                              <div className="truncate">
                                <div className="leading-tight truncate">{d.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                                  {d.neighborhood && <span>{d.neighborhood}</span>}
                                  {d.neighborhood && d.phone && <span>·</span>}
                                  {d.phone && <span>{d.phone}</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 shrink-0 font-medium font-mono">
                              {inProgressCount} en livraison
                            </span>
                          </button>
                        );
                      })}

                      <div className="pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAssignDriverDropdownOpen(false);
                            openNewDriverModal();
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-[#1B4B4A] hover:bg-[#1B4B4A]/10 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nouveau livreur...</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bouton Assigner */}
                <button
                  type="button"
                  disabled={!selectedDriverIdInBar || isAssigning}
                  onClick={() => handleAssignAction(selectedDriverIdInBar)}
                  className="px-3 py-1 bg-[#1B4B4A] hover:bg-[#153a39] text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isAssigning ? 'En cours...' : 'Assigner'}
                </button>

                {/* Bouton Retirer */}
                <button
                  type="button"
                  disabled={isAssigning}
                  onClick={() => handleAssignAction(null, null)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-[#E5DCD0] rounded-md text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Retirer
                </button>

                {/* Fermer la sélection */}
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds([])}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Annuler la sélection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ONGLET : EN LIVRAISON */}
      {/* ========================================================================= */}
      {activeSubTab === 'routes' && (
        <div className="space-y-4">
          {driversWithRoutes.length === 0 ? (
            <div className="bg-white p-4 rounded-xl border border-[#E5DCD0] text-center text-xs text-slate-500">
              Aucune livraison en cours pour le moment.
            </div>
          ) : (
            <div className="space-y-4">
              {driversWithRoutes.map((driver) => {
                const driverOrders = driverActiveOrdersMap.get(driver.id) || [];
                const initials = (driver.name.trim().charAt(0) || 'L').toUpperCase();
                const totalAmount = driverOrders.reduce(
                  (sum, o) => sum + Number(o.total_amount || 0),
                  0
                );

                // Groupement des commandes de ce livreur par zone
                const zoneMap = new Map<string, { zoneId: string; zoneName: string; orders: Order[] }>();
                for (const ord of driverOrders) {
                  const zId = ord.delivery_zone_id || '__no_zone__';
                  const zName =
                    ord.delivery_zone_name ||
                    (zId === '__no_zone__' ? 'Sans zone' : 'Zone non nommée');
                  let group = zoneMap.get(zId);
                  if (!group) {
                    group = { zoneId: zId, zoneName: zName, orders: [] };
                    zoneMap.set(zId, group);
                  }
                  group.orders.push(ord);
                }

                const zonesList = Array.from(zoneMap.values()).sort((a, b) => {
                  if (a.zoneId === '__no_zone__') return 1;
                  if (b.zoneId === '__no_zone__') return -1;
                  return a.zoneName.localeCompare(b.zoneName, 'fr');
                });

                const totalOrdersCount = driverOrders.length;
                const totalZonesCount = zonesList.length;
                const isFocused = focusedDriverId === driver.id;
                const isCollapsed = Boolean(collapsedDriverIds[driver.id]);

                // Nombre de clients = clients distincts (customer_id), sinon une commande sans client identifié compte pour un client
                const clientIds = new Set<string>();
                let anonymousClientsCount = 0;
                for (const ord of driverOrders) {
                  if (ord.customer_id && ord.customer_id.trim()) {
                    clientIds.add(ord.customer_id.trim());
                  } else {
                    anonymousClientsCount++;
                  }
                }
                const distinctClientsCount = clientIds.size + anonymousClientsCount;

                return (
                  <div
                    key={driver.id}
                    id={`route-card-${driver.id}`}
                    className={`bg-white rounded-xl border transition-all ${
                      isFocused
                        ? 'border-[#1B4B4A] ring-2 ring-[#1B4B4A]/20'
                        : 'border-[#E5DCD0]'
                    } p-4 space-y-3`}
                  >
                    {/* En-tête repliable (clic sur l'en-tête, chevron) : photo ou initiales, nom, téléphone, quartier, et « n clients · n commandes · total X devise » */}
                    <div
                      onClick={() => toggleDriverCollapse(driver.id)}
                      className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        !isCollapsed ? 'pb-3 border-b border-slate-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="text-slate-400 hover:text-slate-700 transition-transform p-0.5">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        {driver.photo_url ? (
                          <img
                            src={driver.photo_url}
                            alt={driver.name}
                            className="w-10 h-10 rounded-full object-cover border border-[#E5DCD0] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-sm shrink-0">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {driver.name}
                            </h3>
                            {driver.neighborhood && (
                              <span className="text-[11px] font-medium text-slate-600 px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E5DCD0]">
                                {driver.neighborhood}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            {driver.phone || 'Aucun numéro'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E5DCD0] text-xs font-semibold text-slate-800 whitespace-nowrap">
                          {distinctClientsCount} client{distinctClientsCount > 1 ? 's' : ''} · {totalOrdersCount} commande{totalOrdersCount > 1 ? 's' : ''} · total {totalAmount.toLocaleString()} {business.currency}
                        </div>

                        {/* Menu Imprimer */}
                        <div className="relative print-menu-container" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenPrintMenuDriverId((prev) => (prev === driver.id ? null : driver.id));
                            }}
                            disabled={printingDriverId === driver.id || driverOrders.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5DCD0] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                          >
                            {printingDriverId === driver.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B4B4A]" />
                            ) : (
                              <Printer className="w-3.5 h-3.5 text-[#1B4B4A]" />
                            )}
                            <span>Imprimer</span>
                            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${openPrintMenuDriverId === driver.id ? 'rotate-180' : ''}`} />
                          </button>

                          {openPrintMenuDriverId === driver.id && (
                            <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg border border-[#E5DCD0] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenPrintMenuDriverId(null);
                                  handlePrint(driver, driverOrders, 'route');
                                }}
                                disabled={printingDriverId === driver.id}
                                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-[#FAF7F2] hover:text-[#1B4B4A] flex items-center gap-2 cursor-pointer transition-colors"
                                title="Feuille de route (A4)"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#1B4B4A]" />
                                <div>
                                  <div className="font-semibold">Feuille de route (A4)</div>
                                  <div className="text-[10px] text-slate-400">Arrêts groupés & signature</div>
                                </div>
                              </button>
                              <div className="h-px bg-slate-100 my-0.5" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenPrintMenuDriverId(null);
                                  handlePrint(driver, driverOrders, 'tickets');
                                }}
                                disabled={printingDriverId === driver.id}
                                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-[#FAF7F2] hover:text-[#1B4B4A] flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Receipt className="w-3.5 h-3.5 text-[#1B4B4A]" />
                                <div>
                                  <div className="font-semibold">Tickets (80 mm)</div>
                                  <div className="text-[10px] text-slate-400">1 ticket thermique par commande</div>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Alerte d'erreur d'impression */}
                    {printError && printError.driverId === driver.id && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
                        <span>{printError.message}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintError(null);
                          }}
                          className="text-red-500 hover:text-red-700 font-bold p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Corps déplié : commandes groupées par zone */}
                    {!isCollapsed && (
                      <div className="space-y-3">
                      {zonesList.map((group) => (
                        <div
                          key={group.zoneId}
                          className="rounded-lg border border-[#E5DCD0]/70 overflow-hidden"
                        >
                          <div className="bg-[#FAF7F2]/50 px-3 py-1 text-[11px] font-semibold text-slate-700 flex items-center justify-between border-b border-[#E5DCD0]/40">
                            <span>{group.zoneName}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {group.orders.length} commande{group.orders.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {group.orders.map((ord) => {
                              const refShort = getOrderShortRef(ord);
                              const isProcessing = processingOrderId === ord.id;
                              const clientInitial = ((ord.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase();

                              return (
                                <div
                                  key={ord.id}
                                  className="p-3 bg-white hover:bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                                >
                                  {/* Infos client, téléphone, adresse, montant, statut */}
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
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
                                        <span className="font-bold text-slate-900 truncate">
                                          {ord.customer_name || 'Client anonyme'}
                                        </span>
                                      </div>
                                      <span className="font-mono text-slate-400 font-medium text-[11px]">
                                        #{refShort}
                                      </span>
                                      {getRouteStatusBadge(ord.status)}
                                      <span className="font-bold text-slate-900 tabular-nums ml-auto md:ml-2">
                                        {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
                                      </span>
                                    </div>

                                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5 leading-tight pl-8">
                                      {ord.customer_phone && (
                                        <span className="font-mono">{ord.customer_phone}</span>
                                      )}
                                      {ord.customer_phone && ord.delivery_address && (
                                        <span className="text-slate-300">·</span>
                                      )}
                                      {ord.delivery_address && (
                                        <span className="text-slate-600">{ord.delivery_address}</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Actions par commande : bouton ⋮ uniquement */}
                                  <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={(e) => handleOpenOrderMenu(e, ord, driver)}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                                        orderMenu?.order.id === ord.id
                                          ? 'bg-slate-100 border-[#1B4B4A] text-slate-900 shadow-2xs'
                                          : 'bg-white hover:bg-slate-100 border-slate-200/80 text-slate-500 hover:text-slate-900'
                                      }`}
                                      title="Options de la commande"
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-[#1B4B4A]" />
                                      ) : (
                                        <MoreVertical className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Portail pour le menu ⋮ des commandes de tournée (évite le clipping par les ancêtres en overflow-hidden) */}
        {orderMenu &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={orderMenuDropdownRef}
              style={{
                position: 'fixed',
                top: orderMenu.coords.top !== undefined ? `${orderMenu.coords.top}px` : undefined,
                bottom:
                  orderMenu.coords.bottom !== undefined ? `${orderMenu.coords.bottom}px` : undefined,
                right: `${orderMenu.coords.right}px`,
                width: '200px',
              }}
              className="w-[200px] bg-white border border-[#E5DCD0] rounded-xl shadow-2xl z-[9999] p-1 overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {orderMenu.view === 'main' ? (
                <div className="flex flex-col space-y-0.5">
                  {/* 1. Marquer livrée (icône de coche) */}
                  <button
                    type="button"
                    onClick={async () => {
                      const ordId = orderMenu.order.id;
                      setOrderMenu(null);
                      await handleMarkOrderDelivered(ordId);
                    }}
                    className="w-full h-8 px-2 text-left text-[12px] font-medium text-slate-800 hover:text-[#1B4B4A] hover:bg-[#FAF7F2] rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Marquer livrée</span>
                  </button>

                  {/* Facture */}
                  <button
                    type="button"
                    onClick={() => {
                      const targetOrder = orderMenu.order;
                      setOrderMenu(null);
                      handleOpenOrderInvoice(targetOrder);
                    }}
                    className="w-full h-8 px-2 text-left text-[12px] font-medium text-slate-800 hover:text-[#1B4B4A] hover:bg-[#FAF7F2] rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#1B4B4A] shrink-0" />
                    <span className="truncate">Facture</span>
                  </button>

                  {/* 2. Réassigner… (chevron à droite) */}
                  <button
                    type="button"
                    onClick={() => {
                      setDriverSearchQuery('');
                      setOrderMenu({ ...orderMenu, view: 'reassign' });
                    }}
                    className="w-full h-8 px-2 text-left text-[12px] font-medium text-slate-800 hover:text-[#1B4B4A] hover:bg-[#FAF7F2] rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">Réassigner…</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                  </button>

                  {/* 3. Retirer de la tournée */}
                  <button
                    type="button"
                    onClick={async () => {
                      const ordId = orderMenu.order.id;
                      setOrderMenu(null);
                      await handleRemoveFromRoute(ordId);
                    }}
                    className="w-full h-8 px-2 text-left text-[12px] font-medium text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Retirer de la tournée</span>
                  </button>
                </div>
              ) : (
                /* Second écran : Réassigner à… */
                <div className="flex flex-col">
                  {/* « ← Retour » en haut */}
                  <button
                    type="button"
                    onClick={() => {
                      setOrderMenu({ ...orderMenu, view: 'main' });
                    }}
                    className="w-full h-8 px-2 text-left text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-[#FAF7F2] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border-b border-slate-100 mb-0.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Retour</span>
                  </button>

                  {/* Liste des livreurs actifs (le livreur actuel est masqué, recherche si > 6) */}
                  {(() => {
                    const candidateDrivers = activeDriversList.filter(
                      (d) => d.id !== orderMenu.driver.id
                    );
                    const showSearch = candidateDrivers.length > 6;
                    const filteredCandidates =
                      showSearch && driverSearchQuery.trim()
                        ? candidateDrivers.filter((d) =>
                            d.name
                              .toLowerCase()
                              .includes(driverSearchQuery.toLowerCase().trim())
                          )
                        : candidateDrivers;

                    return (
                      <>
                        {showSearch && (
                          <div className="p-1 border-b border-slate-100">
                            <input
                              type="text"
                              value={driverSearchQuery}
                              onChange={(e) => setDriverSearchQuery(e.target.value)}
                              placeholder="Filtrer..."
                              autoFocus
                              className="w-full h-7 px-2 text-[12px] bg-[#FAF7F2] border border-[#E5DCD0] rounded-md outline-none focus:border-[#1B4B4A]"
                            />
                          </div>
                        )}
                        <div className="max-h-48 overflow-y-auto space-y-0.5 pt-0.5">
                          {candidateDrivers.length === 0 ? (
                            <div className="h-8 px-2 flex items-center text-[12px] text-slate-400 italic truncate">
                              Aucun autre livreur actif
                            </div>
                          ) : filteredCandidates.length === 0 ? (
                            <div className="h-8 px-2 flex items-center text-[12px] text-slate-400 italic truncate">
                              Aucun résultat
                            </div>
                          ) : (
                            filteredCandidates.map((targetDriver) => {
                              const targetOrdersCount =
                                driverActiveOrdersMap.get(targetDriver.id)?.length || 0;
                              return (
                                <button
                                  key={targetDriver.id}
                                  type="button"
                                  onClick={async () => {
                                    const ordId = orderMenu.order.id;
                                    setOrderMenu(null);
                                    await handleReassignOrder(ordId, targetDriver);
                                  }}
                                  className="w-full h-8 px-2 text-left text-[12px] hover:bg-[#FAF7F2] rounded-lg flex items-center justify-between gap-1.5 transition-colors cursor-pointer text-slate-800"
                                >
                                  <span className="font-medium truncate flex-1">
                                    {targetDriver.name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-mono shrink-0">
                                    {targetOrdersCount} en livraison
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>,
            document.body
          )}
      </div>
    )}

      {/* ========================================================================= */}
      {/* 3. ONGLET 3 : LIVRÉES (TRAÇABILITÉ EN LECTURE SEULE) */}
      {/* ========================================================================= */}
      {activeSubTab === 'delivered' && (
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
                <option value="custom">Personnalisée</option>
              </select>
            </div>

            {/* Boutons ‹ et › à côté du menu pour reculer ou avancer d'un jour */}
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
                    <col className="w-[85px]" style={{ width: '85px' }} />
                    <col />
                    <col className="w-[130px]" style={{ width: '130px' }} />
                    <col className="w-[140px]" style={{ width: '140px' }} />
                    <col className="w-[120px]" style={{ width: '120px' }} />
                    <col className="w-[150px]" style={{ width: '150px' }} />
                    <col className="w-[85px]" style={{ width: '85px' }} />
                  </colgroup>
                  <thead className="bg-slate-50/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Heure</th>
                      <th className="py-2 px-3">Client</th>
                      <th className="py-2 px-3">Téléphone</th>
                      <th className="py-2 px-3">Zone</th>
                      <th className="py-2 px-3 text-right">Montant</th>
                      <th className="py-2 px-3">Livreur</th>
                      <th className="py-2 px-3 text-right">Réf</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveredDayGroups.map((grp) => (
                      <React.Fragment key={grp.dayKey}>
                        {/* En-tête de jour : « Mercredi 15 oct. · n livraisons · total X » (porte sur TOUTES les livraisons filtrées de ce jour) */}
                        <tr className="bg-[#FAF7F2] border-y border-[#E5DCD0]">
                          <td colSpan={7} className="py-2 px-3 text-xs font-bold text-slate-800">
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

                        {/* Lignes du groupe */}
                        {grp.orders.map((ord) => {
                          const refShort = getOrderShortRef(ord);
                          const { timeText, isApproximate } = formatDeliveryTime(ord);
                          const clientInitial = ((ord.customer_name || 'C').trim().charAt(0) || 'C').toUpperCase();
                          const matchedDriver = ord.driver_id ? drivers.find((d) => d.id === ord.driver_id) : null;
                          const driverName = matchedDriver?.name || ord.assigned_to || 'Non assigné';

                          return (
                            <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors bg-white">
                              {/* Heure (HH:mm, date dans l'en-tête du jour) */}
                              <td className="py-2 px-3 align-top whitespace-nowrap">
                                <div className="font-medium text-slate-900 font-mono text-xs">{timeText}</div>
                                {isApproximate && (
                                  <div className="text-[10px] text-amber-700 font-medium">date approximative</div>
                                )}
                              </td>

                              {/* Client (avatar et nom, sans téléphone dessous) */}
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

                              {/* Téléphone (colonne propre, police monospace) */}
                              <td className="py-2 px-3 align-top whitespace-nowrap font-mono text-xs text-slate-600">
                                {ord.customer_phone || '—'}
                              </td>

                              {/* Zone */}
                              <td className="py-2 px-3 align-top whitespace-nowrap">
                                <span className="text-xs text-slate-700">
                                  {ord.delivery_zone_name || (ord.delivery_zone_id ? ord.delivery_zone_id : 'Sans zone')}
                                </span>
                              </td>

                              {/* Montant (aligné à droite) */}
                              <td className="py-2 px-3 align-top text-right font-bold text-slate-900 text-xs tabular-nums whitespace-nowrap">
                                {Number(ord.total_amount || 0).toLocaleString()} {business.currency}
                              </td>

                              {/* Livreur (nom de la fiche livreur driver_id en priorité, sinon assigned_to, sinon Non assigné) */}
                              <td className="py-2 px-3 align-top whitespace-nowrap truncate">
                                <span className="text-xs font-medium text-slate-800">
                                  {driverName}
                                </span>
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
      )}

      {/* ========================================================================= */}
      {/* 4. PANNEAU LATÉRAL : GESTION DES LIVREURS (TIROIR FLOTTANT À DROITE) */}
      {/* ========================================================================= */}
      {isDriversDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Fond estompé */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDriversDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[#FAF7F2] border-l border-[#E5DCD0] shadow-2xl flex flex-col h-full">
              {/* En-tête du panneau */}
              <div className="p-3.5 bg-white border-b border-[#E5DCD0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1B4B4A]" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Gestion des livreurs
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    ({drivers.filter((d) => (showArchivedDrivers ? true : d.is_active)).length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDriversDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Fermer le panneau"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Barre d'outils du panneau : Nouveau livreur + Afficher archivés */}
              <div className="p-3 bg-white border-b border-[#E5DCD0] flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={openNewDriverModal}
                  className="px-3 py-1.5 bg-[#1B4B4A] hover:bg-[#153a39] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau livreur</span>
                </button>

                <label className="flex items-center gap-2 text-xs text-slate-700 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchivedDrivers}
                    onChange={(e) => setShowArchivedDrivers(e.target.checked)}
                    className="rounded border-[#E5DCD0] text-[#1B4B4A] focus:ring-[#1B4B4A]"
                  />
                  <span>Afficher les archivés</span>
                </label>
              </div>

              {/* Contenu : liste des livreurs */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {isDriversLoading ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 text-[#1B4B4A] animate-spin mx-auto mb-1.5" />
                    <span>Chargement des livreurs...</span>
                  </div>
                ) : drivers.filter((d) => (showArchivedDrivers ? true : d.is_active)).length === 0 ? (
                  <div className="bg-white p-6 rounded-xl border border-[#E5DCD0] text-center">
                    <p className="text-xs text-slate-500">
                      Aucun livreur enregistré.{' '}
                      <button
                        type="button"
                        onClick={openNewDriverModal}
                        className="text-[#1B4B4A] font-bold underline ml-1 cursor-pointer"
                      >
                        Ajouter un premier livreur
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {drivers
                      .filter((d) => (showArchivedDrivers ? true : d.is_active))
                      .map((driver) => {
                        const initials = (driver.name.trim().charAt(0) || 'L').toUpperCase();
                        const inProgressCount = driverActiveOrdersMap.get(driver.id)?.length || 0;

                        return (
                          <div
                            key={driver.id}
                            onClick={() => {
                              setActiveSubTab('routes');
                              setFocusedDriverId(driver.id);
                              setIsDriversDrawerOpen(false);
                            }}
                            className={`bg-white rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer hover:border-[#1B4B4A] hover:shadow-xs ${
                              driver.is_active
                                ? 'border-[#E5DCD0]'
                                : 'border-slate-200 bg-slate-50/60 opacity-80'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2.5 mb-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {driver.photo_url ? (
                                    <img
                                      src={driver.photo_url}
                                      alt={driver.name}
                                      className="w-8 h-8 rounded-full object-cover border border-[#E5DCD0] shrink-0"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-xs shrink-0">
                                      {initials}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <h3 className="text-xs font-bold text-slate-900 leading-tight truncate">
                                      {driver.name}
                                    </h3>
                                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                                      {driver.phone || 'Aucun numéro'}
                                    </div>
                                    {driver.neighborhood && (
                                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                        {driver.neighborhood}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    driver.is_active
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {driver.is_active ? 'Actif' : 'Archivé'}
                                </span>
                              </div>

                              <div className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 flex items-center justify-between">
                                <span>En livraison</span>
                                <span className="font-bold tabular-nums text-slate-900 font-mono">
                                  {inProgressCount} en livraison
                                </span>
                              </div>
                            </div>

                            <div
                              className="flex items-center justify-end gap-2 mt-2.5 pt-2 border-t border-slate-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDriverModal(driver);
                                }}
                                className="px-2 py-1 text-slate-700 hover:text-slate-900 text-xs font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Modifier</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleDriverStatus(driver);
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                                  driver.is_active
                                    ? 'text-slate-600 hover:text-rose-700'
                                    : 'text-[#1B4B4A] hover:bg-[#1B4B4A]/10'
                                }`}
                              >
                                {driver.is_active ? (
                                  <>
                                    <Archive className="w-3 h-3" />
                                    <span>Archiver</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Réactiver</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALE NOUVEAU / MODIFIER LIVREUR */}
      {/* ========================================================================= */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5DCD0]">
              <h3 className="text-xs font-bold text-slate-900">
                {editingDriver ? 'Modifier le livreur' : 'Nouveau livreur'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDriverModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {driverFormError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                {driverFormError}
              </div>
            )}

            <form onSubmit={handleSaveDriverSubmit} className="space-y-3">
              {/* Photo du livreur (aperçu rond, ajouter, changer, retirer) */}
              <div className="flex flex-col items-center justify-center pt-1 pb-1">
                <input
                  ref={driverPhotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handlePhotoFileChange}
                />
                <div className="relative group">
                  {driverFormPhotoUrl ? (
                    <img
                      src={driverFormPhotoUrl}
                      alt="Aperçu livreur"
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#1B4B4A] shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-dashed border-[#E5DCD0] text-slate-400 flex flex-col items-center justify-center font-bold text-base shadow-sm">
                      {driverFormName.trim() ? (
                        <span className="text-[#1B4B4A] text-lg">
                          {(driverFormName.trim().charAt(0) || 'L').toUpperCase()}
                        </span>
                      ) : (
                        <Camera className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  )}

                  {isUploadingPhoto && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    disabled={isUploadingPhoto || isDriverSaving}
                    onClick={() => driverPhotoInputRef.current?.click()}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#E5DCD0] rounded-md text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-3 h-3 text-[#1B4B4A]" />
                    <span>{driverFormPhotoUrl ? 'Changer la photo' : 'Ajouter une photo'}</span>
                  </button>

                  {driverFormPhotoUrl && (
                    <button
                      type="button"
                      disabled={isUploadingPhoto || isDriverSaving}
                      onClick={() => setDriverFormPhotoUrl(null)}
                      className="p-1 hover:bg-rose-50 text-rose-600 rounded-md border border-rose-200 text-[11px] cursor-pointer transition-colors"
                      title="Retirer la photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">PNG, JPG ou WEBP (max 2 Mo)</div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nom complet <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={80}
                  value={driverFormName}
                  onChange={(e) => setDriverFormName(e.target.value)}
                  placeholder="Ex: Ibrahima Sow"
                  className="w-full bg-white border border-[#E5DCD0] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Numéro de téléphone (optionnel)
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={driverFormPhone}
                  onChange={(e) => setDriverFormPhone(e.target.value)}
                  placeholder="Ex: +221 77 123 45 67"
                  className="w-full bg-white border border-[#E5DCD0] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A] font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Quartier de résidence (optionnel)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={driverFormNeighborhood}
                  onChange={(e) => setDriverFormNeighborhood(e.target.value)}
                  placeholder="Ex: Médina, Almadies, Sacré-Cœur..."
                  className="w-full bg-white border border-[#E5DCD0] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isDriverSaving || isUploadingPhoto}
                  className="px-3.5 py-1 bg-[#1B4B4A] hover:bg-[#153a39] text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isDriverSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'aperçu d'impression (tickets 80 mm ou feuille de route A4) */}
      {ticketPreviewModal.isOpen && ticketPreviewModal.driver && (
        <PrintPreviewModal
          isOpen={ticketPreviewModal.isOpen}
          onClose={() =>
            setTicketPreviewModal({ isOpen: false, driver: null, orders: [], initialTab: 'tickets' })
          }
          driver={ticketPreviewModal.driver}
          orders={ticketPreviewModal.orders}
          business={business}
          initialTab={ticketPreviewModal.initialTab || 'tickets'}
        />
      )}

      {/* Modal d'aperçu d'impression / Facture */}
      {invoiceModalOrder && (
        <PrintPreviewModal
          isOpen={Boolean(invoiceModalOrder)}
          onClose={() => setInvoiceModalOrder(null)}
          orders={[invoiceModalOrder]}
          business={business}
          initialTab="invoice"
          initialItemsByOrder={invoiceItemsByOrder}
        />
      )}
    </div>
  );
}
