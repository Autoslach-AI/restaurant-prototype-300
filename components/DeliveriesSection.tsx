'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Order, OrderStatus, Business, Staff, Driver } from '@/lib/types';
import {
  fetchDrivers,
  insertDriver,
  updateDriver,
  setDriverActive,
  assignDriverToOrders,
  uploadDriverPhoto,
  updateOrderStatus,
} from '@/lib/supabase';
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
  // Navigation segmentée
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'routes' | 'drivers'>('pending');

  // Filtre pour inclure les commandes déjà assignées dans l'onglet « À assigner » (désactivé par défaut)
  const [includeAssignedOrders, setIncludeAssignedOrders] = useState<boolean>(false);

  // Livreur ciblé / centré pour l'onglet « Tournées »
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);

  // Commande en cours de réassignation (dropdown ouvert)
  const [reassigningOrderId, setReassigningOrderId] = useState<string | null>(null);

  // Commande en cours de traitement asynchrone (réassigner / retirer / marquer livrée)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

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
    return deliveryOrders.filter((o) => !o.driver_id && (!o.assigned_to || !o.assigned_to.trim())).length;
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

  // Livreurs ayant au moins une commande en cours (confirmed, preparing, ready) pour l'onglet « Tournées »
  const driversWithRoutes = useMemo(() => {
    return drivers.filter((d) => (driverActiveOrdersMap.get(d.id)?.length || 0) > 0);
  }, [drivers, driverActiveOrdersMap]);

  // Calcul du nombre de courses aujourd'hui par livreur
  const startOfTodayMs = useMemo(() => {
    const d = new Date(nowMs);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }, [nowMs]);

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
      // Filtre « sans livreur » par défaut (driver_id vide ET assigned_to vide)
      if (!includeAssignedOrders) {
        const hasDriver =
          Boolean(ord.driver_id && ord.driver_id.trim()) ||
          Boolean(ord.assigned_to && ord.assigned_to.trim());
        if (hasDriver) {
          return false;
        }
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
    setReassigningOrderId(null);
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
    setBannerMessage(null);
    const res = await assignDriverToOrders([orderId], null, business.id, null);
    setProcessingOrderId(null);
    if (res.success) {
      setBannerMessage({
        type: 'success',
        text: 'Commande retirée de la tournée.',
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
    setBannerMessage(null);
    const res = await updateOrderStatus(orderId, 'delivered');
    getStore().updateOrderStatus(orderId, 'delivered');
    setProcessingOrderId(null);
    if (res.success) {
      const refShort = orderId.replace('order_', '').slice(0, 6);
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

  // Fermer le menu déroulant de réassignation en cas de clic extérieur
  useEffect(() => {
    const handleOutsideReassignClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (reassigningOrderId && !target.closest('.reassign-dropdown-container')) {
        setReassigningOrderId(null);
      }
    };
    if (reassigningOrderId) {
      document.addEventListener('mousedown', handleOutsideReassignClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideReassignClick);
  }, [reassigningOrderId]);

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
            Confirmée
          </span>
        );
      case 'preparing':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            En préparation
          </span>
        );
      case 'ready':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
            Prête
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
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
                Tournées ({driversWithRoutes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('drivers')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeSubTab === 'drivers'
                    ? 'bg-[#1B4B4A] text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Livreurs ({drivers.filter((d) => d.is_active).length})
              </button>
            </div>
          </div>

          {/* Éléments de la barre d'outils dans l'onglet « Tournées » */}
          {activeSubTab === 'routes' && (
            <div className="flex items-center justify-end gap-2.5 shrink-0 ml-auto">
              <div className="text-xs text-slate-600 font-medium whitespace-nowrap">
                <span className="font-semibold text-slate-900 tabular-nums">{driversWithRoutes.length}</span> tournée{driversWithRoutes.length > 1 ? 's' : ''} active{driversWithRoutes.length > 1 ? 's' : ''}
              </div>
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
                          const label =
                            st === 'confirmed'
                              ? 'Confirmée'
                              : st === 'preparing'
                              ? 'En préparation'
                              : 'Prête';
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
                  {st === 'confirmed' ? 'Confirmée' : st === 'preparing' ? 'En préparation' : 'Prête'}
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
                      const refShort = ord.id.replace('order_', '').slice(0, 6);
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
                              const refShort = ord.id.replace('order_', '').slice(0, 6);
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
                              {inProgressCount} en cours
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
      {/* 2. NOUVEL ONGLET : TOURNÉES */}
      {/* ========================================================================= */}
      {activeSubTab === 'routes' && (
        <div className="space-y-4">
          {driversWithRoutes.length === 0 ? (
            <div className="bg-white p-4 rounded-xl border border-[#E5DCD0] text-center text-xs text-slate-500">
              Aucune tournée active pour le moment.
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

                return (
                  <div
                    key={driver.id}
                    id={`route-card-${driver.id}`}
                    className={`bg-white rounded-xl border transition-all ${
                      isFocused
                        ? 'border-[#1B4B4A] ring-2 ring-[#1B4B4A]/20'
                        : 'border-[#E5DCD0]'
                    } p-4 space-y-3.5`}
                  >
                    {/* En-tête : photo ou initiales, nom, téléphone, quartier, et « n commandes · n zones · total X devise » */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
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

                      <div className="px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E5DCD0] text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {totalOrdersCount} commande{totalOrdersCount > 1 ? 's' : ''} · {totalZonesCount} zone{totalZonesCount > 1 ? 's' : ''} · total {totalAmount.toLocaleString()} {business.currency}
                      </div>
                    </div>

                    {/* Corps : commandes groupées par zone */}
                    <div className="space-y-3">
                      {zonesList.map((group) => (
                        <div
                          key={group.zoneId}
                          className="rounded-lg border border-[#E5DCD0]/70 overflow-hidden"
                        >
                          <div className="bg-[#FAF7F2] px-3 py-1.5 text-xs font-bold text-slate-800 flex items-center justify-between border-b border-[#E5DCD0]/60">
                            <span>{group.zoneName}</span>
                            <span className="text-[11px] text-slate-500 font-normal">
                              {group.orders.length} commande{group.orders.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {group.orders.map((ord) => {
                              const refShort = ord.id.replace('order_', '').slice(0, 6);
                              const isProcessing = processingOrderId === ord.id;
                              const isReassignOpen = reassigningOrderId === ord.id;
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
                                      {getStatusBadge(ord.status)}
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

                                  {/* Actions par commande : « Réassigner », « Retirer », « Marquer livrée » */}
                                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                    {/* Menu Réassigner */}
                                    <div className="relative reassign-dropdown-container">
                                      <button
                                        type="button"
                                        disabled={isProcessing}
                                        onClick={() =>
                                          setReassigningOrderId((prev) =>
                                            prev === ord.id ? null : ord.id
                                          )
                                        }
                                        className="px-2.5 py-1 rounded-md border border-[#E5DCD0] bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
                                      >
                                        Réassigner
                                      </button>

                                      {isReassignOpen && (
                                        <div className="absolute right-0 mt-1 w-56 bg-white border border-[#E5DCD0] rounded-xl shadow-xl z-30 p-1.5 space-y-1 max-h-56 overflow-y-auto">
                                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                            Choisir un livreur actif
                                          </div>
                                          {activeDriversList.map((targetDriver) => {
                                            const targetOrdersCount =
                                              driverActiveOrdersMap.get(targetDriver.id)?.length || 0;
                                            const isCurrentDriver = targetDriver.id === driver.id;
                                            return (
                                              <button
                                                key={targetDriver.id}
                                                type="button"
                                                disabled={isCurrentDriver}
                                                onClick={() => handleReassignOrder(ord.id, targetDriver)}
                                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                                                  isCurrentDriver
                                                    ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                                    : 'hover:bg-[#FAF7F2] cursor-pointer'
                                                }`}
                                              >
                                                <span className="font-medium text-slate-800 truncate">
                                                  {targetDriver.name} {isCurrentDriver ? '(actuel)' : ''}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                  {targetOrdersCount} en cours
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {/* Retirer */}
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleRemoveFromRoute(ord.id)}
                                      className="px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50"
                                    >
                                      Retirer
                                    </button>

                                    {/* Marquer livrée */}
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleMarkOrderDelivered(ord.id)}
                                      className="px-2.5 py-1 rounded-md bg-[#1B4B4A] hover:bg-[#153a39] text-white text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : null}
                                      <span>Marquer livrée</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ONGLET 3 : LIVREURS */}
      {/* ========================================================================= */}
      {activeSubTab === 'drivers' && (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-xl border border-[#E5DCD0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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

            <div className="text-xs text-slate-500">
              {drivers.filter((d) => (showArchivedDrivers ? true : d.is_active)).length} livreur(s)
            </div>
          </div>

          {isDriversLoading ? (
            <div className="p-6 text-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 text-[#1B4B4A] animate-spin mx-auto mb-1.5" />
              <span>Chargement des livreurs...</span>
            </div>
          ) : (
            <>
              {drivers.filter((d) => (showArchivedDrivers ? true : d.is_active)).length === 0 ? (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                          }}
                          className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between transition-all cursor-pointer hover:border-[#1B4B4A] hover:shadow-xs ${
                            driver.is_active
                              ? 'border-[#E5DCD0]'
                              : 'border-slate-200 bg-slate-50/60 opacity-80'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2.5 mb-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {driver.photo_url ? (
                                  <img
                                    src={driver.photo_url}
                                    alt={driver.name}
                                    className="w-9 h-9 rounded-full object-cover border border-[#E5DCD0] shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-xs shrink-0">
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
                                    <div className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                                      <span className="font-sans font-medium text-slate-500">{driver.neighborhood}</span>
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
                              <span>En cours</span>
                              <span className="font-bold tabular-nums text-slate-900">{inProgressCount} en cours</span>
                            </div>
                          </div>

                          <div
                            className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100"
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
            </>
          )}
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
    </div>
  );
}
