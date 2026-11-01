'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Info,
  Loader2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Trash2,
  Truck,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  fetchDeliveryZonesForBusiness,
  insertDeliveryZone,
  updateDeliveryZone,
  toggleDeliveryZoneActive,
  deleteDeliveryZone,
  uploadInvoiceLogo,
  updateBusinessConfig,
  fetchDrivers,
  setDriverActive,
  fetchOrderItemsForOrders,
  updateProduct,
} from '@/lib/supabase';
import { getStore } from '@/lib/store';
import { Business, Staff, StaffPermissions, Order, DeliveryZone, Driver, Product, Category } from '@/lib/types';
import DriverFormModal from './DriverFormModal';

export interface SettingsSectionProps {
  onBack?: () => void;
  business: Business;
  activeStaff: Staff;
  businessOrders: Order[];
  products?: Product[];
  categories?: Category[];
  onProcessPayment: (orderId: string, paymentRef: string) => void;
  businessStaff: Staff[];
  staffTab: 'active' | 'revoked';
  setStaffTab: (tab: 'active' | 'revoked') => void;
  setEditingStaffId: (id: string | null) => void;
  setInviteName: (name: string) => void;
  setInviteEmail: (email: string) => void;
  setInvitePhone: (phone: string) => void;
  setInviteRoleTitle: (title: string) => void;
  setInviteSalary: (salary: number | string) => void;
  setInvitePhotoUrl: (url: string) => void;
  setInvitePerms: (perms: StaffPermissions) => void;
  setIsInviteModalOpen: (open: boolean) => void;
  setZoomedPhotoUrl: (url: string) => void;
  setViewingReasonStaff: (staff: Staff | null) => void;
  setRevokingStaffMember: (staff: Staff | null) => void;
  setRevocationReasonInput: (reason: string) => void;
  reactivatingStaffId: string | null;
  handleReactivateStaff: (id: string) => void;
  bizName: string;
  setBizName: (name: string) => void;
  bizWhatsapp: string;
  setBizWhatsapp: (whatsapp: string) => void;
  bizCurrency: string;
  setBizCurrency: (currency: string) => void;
  isBizLoading: boolean;
  isBizSaving: boolean;
  gwProvider: 'paydunya' | 'cinetpay';
  setGwProvider: (p: 'paydunya' | 'cinetpay') => void;
  gwPublicKey: string;
  setGwPublicKey: (k: string) => void;
  gwSecretKey: string;
  setGwSecretKey: (k: string) => void;
  channelStates: Record<string, boolean>;
  setChannelStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentChs: { id: string; name: string; enabled: boolean }[];
  hasSettingsChanges: boolean;
  handleSaveAllSettings: (e?: React.FormEvent) => Promise<void>;
  handleCancelSettingsChanges: () => void;
}

export default function SettingsSection({
  onBack,
  business,
  activeStaff,
  businessOrders,
  products = [],
  categories = [],
  onProcessPayment,
  businessStaff,
  staffTab,
  setStaffTab,
  setEditingStaffId,
  setInviteName,
  setInviteEmail,
  setInvitePhone,
  setInviteRoleTitle,
  setInviteSalary,
  setInvitePhotoUrl,
  setInvitePerms,
  setIsInviteModalOpen,
  setZoomedPhotoUrl,
  setViewingReasonStaff,
  setRevokingStaffMember,
  setRevocationReasonInput,
  reactivatingStaffId,
  handleReactivateStaff,
  bizName,
  setBizName,
  bizWhatsapp,
  setBizWhatsapp,
  bizCurrency,
  setBizCurrency,
  isBizLoading,
  isBizSaving,
  gwProvider,
  setGwProvider,
  gwPublicKey,
  setGwPublicKey,
  gwSecretKey,
  setGwSecretKey,
  channelStates,
  setChannelStates,
  currentChs,
  hasSettingsChanges,
  handleSaveAllSettings,
  handleCancelSettingsChanges,
}: SettingsSectionProps) {
  const store = getStore();

  // Category A States: local to Settings only
  const [activeSettingsSection, setActiveSettingsSection] = useState<'general' | 'invoice' | 'delivery' | 'payment' | 'team' | 'capacity'>('general');
  const [isSettingsRibbonCollapsed, setIsSettingsRibbonCollapsed] = useState<boolean>(false);

  // États pour la section Capacité
  const [capacityProducts, setCapacityProducts] = useState<Product[]>(products);
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [rowSuccess, setRowSuccess] = useState<Record<string, string | null>>({});
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});

  // Suivi des ventes du jour (ord.items)
  const [soldTodayMap, setSoldTodayMap] = useState<Record<string, number>>({});
  const [isSoldLoading, setIsSoldLoading] = useState<boolean>(false);
  const [soldError, setSoldError] = useState<string | null>(null);

  useEffect(() => {
    setCapacityProducts(products);
  }, [products]);

  const loadTodaySales = async () => {
    setIsSoldLoading(true);
    setSoldError(null);
    try {
      const now = new Date();
      const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const todayActiveOrderIds = businessOrders
        .filter((o) => {
          if (o.status === 'cancelled') return false;
          const t = new Date(o.created_at).getTime();
          return !isNaN(t) && t >= startOfTodayMs;
        })
        .map((o) => o.id);

      if (todayActiveOrderIds.length === 0) {
        setSoldTodayMap({});
        setIsSoldLoading(false);
        return;
      }

      const itemsByOrder = await fetchOrderItemsForOrders(todayActiveOrderIds);
      const counts: Record<string, number> = {};
      for (const items of Object.values(itemsByOrder)) {
        for (const item of items) {
          if (item.product_id) {
            counts[item.product_id] = (counts[item.product_id] || 0) + Number(item.quantity || 0);
          }
        }
      }
      setSoldTodayMap(counts);
    } catch (err: any) {
      console.warn('Erreur chargement articles du jour pour capacité:', err);
      setSoldError(err?.message || 'Erreur lors du calcul des ventes du jour.');
    } finally {
      setIsSoldLoading(false);
    }
  };

  useEffect(() => {
    if (activeSettingsSection === 'capacity') {
      loadTodaySales();
    }
  }, [activeSettingsSection]);

  const categoryMap = useMemo(() => {
    return new Map((categories || []).map((c) => [c.id, c.name]));
  }, [categories]);

  const handleSaveProductDailyLimit = async (product: Product) => {
    const rawVal = (limitInputs[product.id] !== undefined
      ? limitInputs[product.id]
      : (product.daily_limit !== null && product.daily_limit !== undefined ? String(product.daily_limit) : '')
    ).trim();

    let newLimit: number | null = null;
    if (rawVal !== '') {
      if (!/^\d+$/.test(rawVal)) {
        setRowErrors((prev) => ({
          ...prev,
          [product.id]: 'La limite doit être un entier strict (pas de décimales, virgules ou symboles).',
        }));
        setRowSuccess((prev) => ({ ...prev, [product.id]: null }));
        return;
      }
      const parsed = Number(rawVal);
      if (!Number.isInteger(parsed) || parsed < 1) {
        setRowErrors((prev) => ({
          ...prev,
          [product.id]: 'La limite doit être un entier supérieur ou égal à 1 (ou vide pour illimité).',
        }));
        setRowSuccess((prev) => ({ ...prev, [product.id]: null }));
        return;
      }
      newLimit = parsed;
    }

    setRowSaving((prev) => ({ ...prev, [product.id]: true }));
    setRowErrors((prev) => ({ ...prev, [product.id]: null }));
    setRowSuccess((prev) => ({ ...prev, [product.id]: null }));

    try {
      const res = await updateProduct(product.id, { daily_limit: newLimit });
      if (res.success && res.product) {
        setCapacityProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, daily_limit: newLimit } : p))
        );
        setRowSuccess((prev) => ({
          ...prev,
          [product.id]: newLimit === null ? 'Limite retirée (illimité).' : `Limite fixée à ${newLimit} / jour.`,
        }));
        setLimitInputs((prev) => ({ ...prev, [product.id]: newLimit === null ? '' : String(newLimit) }));
      } else {
        setRowErrors((prev) => ({
          ...prev,
          [product.id]: res.error || "Échec de l'enregistrement de la limite.",
        }));
      }
    } catch (err: any) {
      setRowErrors((prev) => ({
        ...prev,
        [product.id]: err?.message || 'Erreur inattendue de connexion.',
      }));
    } finally {
      setRowSaving((prev) => ({ ...prev, [product.id]: false }));
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('platform_settings_ribbon_collapsed');
      if (stored === 'true') {
        setIsSettingsRibbonCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSettingsRibbonCollapsed = () => {
    setIsSettingsRibbonCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('platform_settings_ribbon_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [showSecretKey, setShowSecretKey] = useState(false);

  // Delivery Zones state & modals
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(() => store.getDeliveryZones(business.id));
  const [isDeliveryZonesLoading, setIsDeliveryZonesLoading] = useState(false);
  const [isZoneSaving, setIsZoneSaving] = useState(false);
  const [isZoneDeleting, setIsZoneDeleting] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone> | null>(null);
  const [deletingZone, setDeletingZone] = useState<DeliveryZone | null>(null);

  // Webhook tester form states
  const [testOrderId, setTestOrderId] = useState('');
  const [testPaymentRef, setTestPaymentRef] = useState(() => 'WAVE_REF_' + Math.floor(100000 + Math.random() * 900000));
  const [webhookLogs, setWebhookLogs] = useState<string[]>([]);

  // Invoice Configuration state
  const [invoiceLegalName, setInvoiceLegalName] = useState(() => business.config?.invoice?.legal_name || '');
  const [invoiceAddress, setInvoiceAddress] = useState(() => business.config?.invoice?.address || '');
  const [invoicePhone, setInvoicePhone] = useState(() => business.config?.invoice?.phone || '');
  const [invoiceTaxId, setInvoiceTaxId] = useState(() => business.config?.invoice?.tax_id || '');
  const [invoiceFooterText, setInvoiceFooterText] = useState(() => business.config?.invoice?.footer_text || '');
  const [invoiceLogoUrl, setInvoiceLogoUrl] = useState(() => business.config?.invoice?.logo_url || '');

  const [isInvoiceSaving, setIsInvoiceSaving] = useState(false);
  const [isInvoiceUploading, setIsInvoiceUploading] = useState(false);
  const [invoiceFeedback, setInvoiceFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync state if business prop updates
  useEffect(() => {
    setInvoiceLegalName(business.config?.invoice?.legal_name || '');
    setInvoiceAddress(business.config?.invoice?.address || '');
    setInvoicePhone(business.config?.invoice?.phone || '');
    setInvoiceTaxId(business.config?.invoice?.tax_id || '');
    setInvoiceFooterText(business.config?.invoice?.footer_text || '');
    setInvoiceLogoUrl(business.config?.invoice?.logo_url || '');
  }, [
    business.id,
    business.config?.invoice?.legal_name,
    business.config?.invoice?.address,
    business.config?.invoice?.phone,
    business.config?.invoice?.tax_id,
    business.config?.invoice?.footer_text,
    business.config?.invoice?.logo_url,
  ]);

  const handleInvoiceLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInvoiceFeedback(null);
    setIsInvoiceUploading(true);

    try {
      const res = await uploadInvoiceLogo(file, business.id);
      if (res.success && res.url) {
        setInvoiceLogoUrl(res.url);
        setInvoiceFeedback({ type: 'success', message: 'Logo téléversé avec succès. Pensez à enregistrer les modifications.' });
      } else {
        setInvoiceFeedback({ type: 'error', message: res.error || "Échec du téléversement du logo." });
      }
    } catch (err: any) {
      setInvoiceFeedback({ type: 'error', message: err?.message || "Erreur imprévue lors de l'upload du logo." });
    } finally {
      setIsInvoiceUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveInvoiceLogo = () => {
    setInvoiceLogoUrl('');
    setInvoiceFeedback({ type: 'success', message: 'Logo retiré. Cliquez sur Enregistrer pour confirmer.' });
  };

  const handleSaveInvoiceSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setInvoiceFeedback(null);
    setIsInvoiceSaving(true);

    try {
      const invoicePayload = {
        legal_name: invoiceLegalName.trim(),
        address: invoiceAddress.trim(),
        phone: invoicePhone.trim(),
        tax_id: invoiceTaxId.trim(),
        footer_text: invoiceFooterText.trim(),
        logo_url: invoiceLogoUrl.trim(),
      };

      const res = await updateBusinessConfig(business.id, {
        config: {
          ...(business.config || {}),
          message_templates: business.config?.message_templates || {
            confirmation: '',
            alert: '',
            relance: '',
            follow_up: '',
          },
          invoice: invoicePayload,
        },
      });

      if (res.success) {
        // Enforce store in-memory update
        store.updateBusinessConfig(business.id, {
          invoice: invoicePayload,
        });
        setInvoiceFeedback({ type: 'success', message: 'Paramètres de facturation enregistrés avec succès !' });
      } else {
        setInvoiceFeedback({ type: 'error', message: res.error || 'Erreur lors de la sauvegarde.' });
      }
    } catch (err: any) {
      setInvoiceFeedback({ type: 'error', message: err?.message || 'Erreur inattendue lors de la sauvegarde.' });
    } finally {
      setIsInvoiceSaving(false);
    }
  };

  // Load delivery zones from Supabase
  const loadDeliveryZones = async () => {
    if (!business?.id) return;
    setIsDeliveryZonesLoading(true);
    try {
      const zones = await fetchDeliveryZonesForBusiness(business.id);
      setDeliveryZones(zones || []);
    } catch (err) {
      console.error('Error fetching delivery zones:', err);
    } finally {
      setIsDeliveryZonesLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadZones() {
      if (!business?.id) return;
      try {
        const zones = await fetchDeliveryZonesForBusiness(business.id);
        if (isMounted) {
          setDeliveryZones(zones || []);
        }
      } catch (err) {
        console.error('Error loading delivery zones:', err);
      }
    }
    loadZones();
    return () => {
      isMounted = false;
    };
  }, [business?.id]);

  // Gestion des Livreurs (platform_drivers)
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isDriversLoading, setIsDriversLoading] = useState(false);
  const [driversFilter, setDriversFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverActionFeedback, setDriverActionFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
    driverId?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!business?.id) return;
    setIsDriversLoading(true);
    fetchDrivers(business.id)
      .then((list) => {
        if (isMounted) {
          setDrivers(list || []);
        }
      })
      .catch((err) => {
        console.error('Erreur chargement livreurs dans SettingsSection:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsDriversLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [business?.id]);

  const handleOpenNewDriver = () => {
    setEditingDriver(null);
    setDriverActionFeedback(null);
    setIsDriverModalOpen(true);
  };

  const handleOpenEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverActionFeedback(null);
    setIsDriverModalOpen(true);
  };

  const handleDriverSaved = (savedDriver: Driver) => {
    setDrivers((prev) => {
      const idx = prev.findIndex((d) => d.id === savedDriver.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = savedDriver;
        return updated;
      }
      return [...prev, savedDriver];
    });
    setDriverActionFeedback({
      type: 'success',
      message: `Livreur ${savedDriver.name} enregistré avec succès.`,
    });
  };

  const handleToggleDriverStatus = async (driver: Driver) => {
    setDriverActionFeedback(null);

    // Blocage si archivage d'un livreur avec commandes en cours
    if (driver.is_active) {
      // en livraison = statut ni 'delivered' ni 'cancelled'
      const inDeliveryOrders = (businessOrders || []).filter(
        (o) =>
          o.order_type === 'delivery' &&
          o.driver_id === driver.id &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      );

      if (inDeliveryOrders.length > 0) {
        const count = inDeliveryOrders.length;
        setDriverActionFeedback({
          type: 'error',
          message: `${count} commande${count > 1 ? 's' : ''} en cours, réassigne-les ou termine-les d'abord`,
          driverId: driver.id,
        });
        return;
      }
    }

    const nextActive = !driver.is_active;
    try {
      const res = await setDriverActive(driver.id, business.id, nextActive);
      if (res.success && res.driver) {
        setDrivers((prev) => prev.map((d) => (d.id === driver.id ? res.driver! : d)));
        setDriverActionFeedback({
          type: 'success',
          message: nextActive ? `Livreur ${driver.name} réactivé.` : `Livreur ${driver.name} archivé.`,
        });
      } else {
        setDriverActionFeedback({
          type: 'error',
          message: res.error || 'Erreur lors du changement de statut.',
          driverId: driver.id,
        });
      }
    } catch (err: any) {
      setDriverActionFeedback({
        type: 'error',
        message: err?.message || 'Erreur inattendue.',
        driverId: driver.id,
      });
    }
  };

  const getDriverInitials = (name?: string) => {
    if (!name) return 'L';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Webhook Tester Action
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

  // Delivery Zone Save Handler
  const handleSaveZone = async () => {
    if (!editingZone || !editingZone.name?.trim()) return;
    setIsZoneSaving(true);
    try {
      if (editingZone.id) {
        const res = await updateDeliveryZone(editingZone.id, {
          name: editingZone.name.trim(),
          fee: Number(editingZone.fee) || 0,
          active: editingZone.active ?? true,
        });
        if (res.success) {
          if (res.zone) {
            setDeliveryZones((prev) => prev.map((z) => (z.id === editingZone.id ? res.zone! : z)));
          } else {
            await loadDeliveryZones();
          }
          setIsZoneModalOpen(false);
          setEditingZone(null);
        } else {
          alert(`Erreur lors de la mise à jour : ${res.error || 'Échec'}`);
        }
      } else {
        const res = await insertDeliveryZone({
          business_id: business.id,
          name: editingZone.name.trim(),
          fee: Number(editingZone.fee) || 0,
          active: editingZone.active ?? true,
        });
        if (res.success) {
          if (res.zone) {
            setDeliveryZones((prev) => [...prev, res.zone!]);
          } else {
            await loadDeliveryZones();
          }
          setIsZoneModalOpen(false);
          setEditingZone(null);
        } else {
          alert(`Erreur lors de la création : ${res.error || 'Échec'}`);
        }
      }
    } catch (err) {
      console.error('Error saving delivery zone:', err);
      alert("Erreur lors de l'enregistrement de la zone");
    } finally {
      setIsZoneSaving(false);
    }
  };

  // Delivery Zone Delete Handler
  const handleDeleteZoneConfirm = async () => {
    if (!deletingZone) return;
    setIsZoneDeleting(true);
    try {
      const res = await deleteDeliveryZone(deletingZone.id);
      if (res.success) {
        setDeliveryZones((prev) => prev.filter((z) => z.id !== deletingZone.id));
        setDeletingZone(null);
      } else {
        alert(`Erreur lors de la suppression : ${res.error || 'Échec'}`);
      }
    } catch (err) {
      console.error('Error deleting delivery zone:', err);
      alert("Erreur lors de la suppression de la zone");
    } finally {
      setIsZoneDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CARTE DE GAUCHE : Ruban de navigation paramètres */}
        <div className={`${isSettingsRibbonCollapsed ? 'lg:col-span-1 p-3' : 'lg:col-span-3 p-5'} bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-4`}>
          {!isSettingsRibbonCollapsed ? (
            <>
              <div className="flex items-center justify-between gap-2">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center space-x-2 text-xs font-extrabold text-slate-700 hover:text-emerald-700 bg-slate-100/90 hover:bg-emerald-50 px-3.5 py-2 rounded-2xl border border-slate-200 hover:border-emerald-200 transition-all shadow-2xs group cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                    <span>Retour</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleSettingsRibbonCollapsed}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors shrink-0 ml-auto cursor-pointer"
                  title="Rétracter le ruban"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Paramètres</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Configuration du commerce</p>
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={toggleSettingsRibbonCollapsed}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Déplier le ruban"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {onBack && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-2xl bg-slate-100/90 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-all shadow-2xs cursor-pointer flex items-center justify-center"
                    title="Retour au Tableau de bord"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-500 hover:text-emerald-600" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-100" />

          {/* Menu de navigation interne vertical */}
          <nav className="space-y-1.5" aria-label="Navigation paramètres">
            <button
              type="button"
              onClick={() => setActiveSettingsSection('general')}
              className={`w-full flex items-center ${
                isSettingsRibbonCollapsed ? 'justify-center p-2.5' : 'space-x-3 px-3.5 py-2.5 text-left'
              } rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSettingsSection === 'general'
                  ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Général"
            >
              <Sliders className={`w-4 h-4 shrink-0 ${activeSettingsSection === 'general' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
              {!isSettingsRibbonCollapsed && <span className="truncate">Général</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveSettingsSection('invoice')}
              className={`w-full flex items-center ${
                isSettingsRibbonCollapsed ? 'justify-center p-2.5' : 'space-x-3 px-3.5 py-2.5 text-left'
              } rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSettingsSection === 'invoice'
                  ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Facture"
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeSettingsSection === 'invoice' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
              {!isSettingsRibbonCollapsed && <span className="truncate">Facture</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveSettingsSection('delivery')}
              className={`w-full flex items-center ${
                isSettingsRibbonCollapsed ? 'justify-center p-2.5' : 'space-x-3 px-3.5 py-2.5 text-left'
              } rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSettingsSection === 'delivery'
                  ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Livraison"
            >
              <Truck className={`w-4 h-4 shrink-0 ${activeSettingsSection === 'delivery' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
              {!isSettingsRibbonCollapsed && <span className="truncate">Livraison</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveSettingsSection('payment')}
              className={`w-full flex items-center ${
                isSettingsRibbonCollapsed ? 'justify-center p-2.5' : 'space-x-3 px-3.5 py-2.5 text-left'
              } rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSettingsSection === 'payment'
                  ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Paiement"
            >
              <CreditCard className={`w-4 h-4 shrink-0 ${activeSettingsSection === 'payment' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
              {!isSettingsRibbonCollapsed && <span className="truncate">Paiement</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveSettingsSection('team')}
              className={`w-full flex items-center ${
                isSettingsRibbonCollapsed ? 'justify-center p-2.5' : 'space-x-3 px-3.5 py-2.5 text-left'
              } rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSettingsSection === 'team'
                  ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Équipe"
            >
              <Users className={`w-4 h-4 shrink-0 ${activeSettingsSection === 'team' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
              {!isSettingsRibbonCollapsed && <span className="truncate">Équipe</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveSettingsSection('capacity')}
              className={`w-full flex items-center ${
                isSettingsRibbonCollapsed ? 'justify-center p-2.5' : 'space-x-3 px-3.5 py-2.5 text-left'
              } rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeSettingsSection === 'capacity'
                  ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Capacité"
            >
              <Gauge className={`w-4 h-4 shrink-0 ${activeSettingsSection === 'capacity' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
              {!isSettingsRibbonCollapsed && <span className="truncate">Capacité</span>}
            </button>
          </nav>
        </div>

        {/* ZONE DE DROITE : Contenu de la section active */}
        <div className={`${isSettingsRibbonCollapsed ? 'lg:col-span-11' : 'lg:col-span-9'} space-y-6`}>
          {/* 1. Réglages Généraux */}
          {activeSettingsSection === 'general' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Réglages Généraux</span>
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-black uppercase">
            Réservé au Gérant
          </span>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSaveAllSettings} className="mt-6 space-y-4 max-w-xl">
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1">Nom du commerce</label>
            <input
              type="text"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              disabled={isBizLoading || isBizSaving}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1">Numéro WhatsApp Business</label>
            <input
              type="text"
              value={bizWhatsapp}
              onChange={(e) => setBizWhatsapp(e.target.value)}
              disabled={isBizLoading || isBizSaving}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1">Devise (Currency)</label>
            <input
              type="text"
              value={bizCurrency}
              onChange={(e) => setBizCurrency(e.target.value)}
              disabled={isBizLoading || isBizSaving}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60"
            />
          </div>
        </form>
          </div>
        )}

        {/* 1.bis Bloc Facture */}
        {activeSettingsSection === 'invoice' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Facture</span>
            <span className="text-[11px] text-slate-500 font-medium">
              Coordonnées et mentions légales affichées sur les factures imprimées de vos commandes.
            </span>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-black uppercase">
            Personnalisation
          </span>
        </div>

        {/* Feedback Messages (Never window.alert) */}
        {invoiceFeedback && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-bold border flex items-center justify-between ${
              invoiceFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{invoiceFeedback.message}</span>
            <button
              type="button"
              onClick={() => setInvoiceFeedback(null)}
              className="text-slate-400 hover:text-slate-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSaveInvoiceSettings} className="mt-6 space-y-5 max-w-xl">
          {/* Logo */}
          <div>
            <label className="text-xs font-extrabold text-slate-700 block mb-1">
              Logo de la facture (PNG, JPG, WEBP · 2 Mo max)
            </label>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative">
                {invoiceLogoUrl ? (
                  <img
                    src={invoiceLogoUrl}
                    alt="Logo facture"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium text-center px-1">Aucun logo</span>
                )}
                {isInvoiceUploading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{invoiceLogoUrl ? 'Changer le logo' : 'Ajouter un logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleInvoiceLogoChange}
                      disabled={isInvoiceUploading || isInvoiceSaving}
                      className="hidden"
                    />
                  </label>

                  {invoiceLogoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveInvoiceLogo}
                      disabled={isInvoiceUploading || isInvoiceSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Retirer</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {invoiceLogoUrl ? 'Logo prêt. Cliquez sur Enregistrer pour valider.' : 'Aucun fichier sélectionné.'}
                </p>
              </div>
            </div>
          </div>

          {/* Nom légal */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700">Nom légal</label>
              <span className="text-[10px] text-slate-400 font-mono">{invoiceLegalName.length}/120</span>
            </div>
            <input
              type="text"
              maxLength={120}
              value={invoiceLegalName}
              onChange={(e) => setInvoiceLegalName(e.target.value)}
              disabled={isInvoiceSaving}
              placeholder="Ex: Auto Slashai SARL"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60"
            />
          </div>

          {/* Adresse */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700">Adresse</label>
              <span className="text-[10px] text-slate-400 font-mono">{invoiceAddress.length}/200</span>
            </div>
            <textarea
              rows={2}
              maxLength={200}
              value={invoiceAddress}
              onChange={(e) => setInvoiceAddress(e.target.value)}
              disabled={isInvoiceSaving}
              placeholder="Ex: 14 Rue Carnot, Plateau, Dakar, Sénégal"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60 resize-none"
            />
          </div>

          {/* Téléphone */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700">Téléphone</label>
              <span className="text-[10px] text-slate-400 font-mono">{invoicePhone.length}/30</span>
            </div>
            <input
              type="text"
              maxLength={30}
              value={invoicePhone}
              onChange={(e) => setInvoicePhone(e.target.value)}
              disabled={isInvoiceSaving}
              placeholder="Ex: +221 77 123 45 67"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60 font-mono"
            />
          </div>

          {/* Identifiant fiscal */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700">Identifiant fiscal (ex: NINEA ou RCCM)</label>
              <span className="text-[10px] text-slate-400 font-mono">{invoiceTaxId.length}/60</span>
            </div>
            <input
              type="text"
              maxLength={60}
              value={invoiceTaxId}
              onChange={(e) => setInvoiceTaxId(e.target.value)}
              disabled={isInvoiceSaving}
              placeholder="Ex: NINEA 001234567 2V2 / RCCM SN-DKR-2024-B-1234"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60 font-mono"
            />
          </div>

          {/* Pied de page */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700">Pied de page</label>
              <span className="text-[10px] text-slate-400 font-mono">{invoiceFooterText.length}/300</span>
            </div>
            <textarea
              rows={3}
              maxLength={300}
              value={invoiceFooterText}
              onChange={(e) => setInvoiceFooterText(e.target.value)}
              disabled={isInvoiceSaving}
              placeholder="Ex: Merci pour votre confiance ! Marchandises ni reprises ni échangées après 48h."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs disabled:opacity-60 resize-none"
            />
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isInvoiceSaving || isInvoiceUploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isInvoiceSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Enregistrer la facture</span>
                </>
              )}
            </button>
          </div>
        </form>
          </div>
        )}

        {/* 2. Zones de Livraison et Livreurs (delivery) */}
        {activeSettingsSection === 'delivery' && (
          <div className="space-y-6">
            {/* Zones de Livraison Table (delivery_zones) */}
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
                  type="button"
                  onClick={() => {
                    setEditingZone({ business_id: business.id, name: '', fee: 1000, active: true });
                    setIsZoneModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
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
                    {deliveryZones.map((zone) => (
                      <tr key={zone.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">{zone.name}</td>
                        <td className="py-3.5 px-4 font-black text-emerald-700">
                          {zone.fee.toLocaleString()} {business.currency}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await toggleDeliveryZoneActive(zone.id, zone.active);
                              if (res.success) {
                                if (res.zone) {
                                  setDeliveryZones((prev) => prev.map((z) => (z.id === zone.id ? res.zone! : z)));
                                } else {
                                  await loadDeliveryZones();
                                }
                              } else {
                                alert(`Erreur lors du changement de statut de la zone : ${res.error || 'Échec'}`);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all cursor-pointer ${
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
                            type="button"
                            onClick={() => {
                              setEditingZone(zone);
                              setIsZoneModalOpen(true);
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Éditer
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingZone(zone)}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-200 transition-colors cursor-pointer"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                    {deliveryZones.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                          {isDeliveryZonesLoading ? 'Chargement des zones...' : 'Aucune zone de livraison définie.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bloc Livreurs (platform_drivers) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <span>Livreurs</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gérez vos livreurs, suivez leurs courses et contrôlez leur disponibilité.
                  </p>
                </div>

                <div className="flex items-center flex-wrap gap-2.5">
                  {/* Filtre Tous / Actifs / Archivés */}
                  <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDriversFilter('all')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        driversFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      Tous ({drivers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDriversFilter('active')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        driversFilter === 'active'
                          ? 'bg-white text-emerald-800 shadow-2xs'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      Actifs ({drivers.filter((d) => d.is_active).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDriversFilter('archived')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        driversFilter === 'archived'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'hover:text-slate-900'
                      }`}
                    >
                      Archivés ({drivers.filter((d) => !d.is_active).length})
                    </button>
                  </div>

                  {/* Bouton Nouveau livreur */}
                  <button
                    type="button"
                    onClick={handleOpenNewDriver}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouveau livreur</span>
                  </button>
                </div>
              </div>

              {/* Message de notification d'action général */}
              {driverActionFeedback && !driverActionFeedback.driverId && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                    driverActionFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {driverActionFeedback.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                    <span>{driverActionFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDriverActionFeedback(null)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Grille des cartes livreurs */}
              {(() => {
                const filtered = drivers.filter((d) => {
                  if (driversFilter === 'active') return d.is_active;
                  if (driversFilter === 'archived') return !d.is_active;
                  return true;
                });

                const sorted = [...filtered].sort((a, b) => {
                  if (driversFilter === 'all') {
                    if (a.is_active !== b.is_active) {
                      return a.is_active ? -1 : 1;
                    }
                  }
                  return a.name.localeCompare(b.name);
                });

                if (isDriversLoading) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <Loader2 className="w-5 h-5 text-emerald-600 animate-spin mx-auto mb-2" />
                      <span>Chargement des livreurs...</span>
                    </div>
                  );
                }

                if (sorted.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                      {drivers.length === 0
                        ? 'Aucun livreur enregistré pour le moment.'
                        : 'Aucun livreur ne correspond à ce filtre.'}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                    {sorted.map((driver) => {
                      const initials = getDriverInitials(driver.name);
                      const driverOrders = (businessOrders || []).filter(
                        (o) => o.order_type === 'delivery' && o.driver_id === driver.id
                      );
                      const inDeliveryCount = driverOrders.filter(
                        (o) => o.status !== 'delivered' && o.status !== 'cancelled'
                      ).length;
                      const deliveredTotalCount = driverOrders.filter(
                        (o) => o.status === 'delivered'
                      ).length;

                      const deliveredWithDates = driverOrders
                        .filter((o) => o.status === 'delivered' && Boolean(o.delivered_at))
                        .sort(
                          (a, b) =>
                            new Date(b.delivered_at!).getTime() - new Date(a.delivered_at!).getTime()
                        );
                      const lastDeliveredAt = deliveredWithDates[0]?.delivered_at || null;
                      const lastDeliveredFormatted = lastDeliveredAt
                        ? new Date(lastDeliveredAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—';

                      const hasBlockingError =
                        driverActionFeedback?.driverId === driver.id &&
                        driverActionFeedback.type === 'error';

                      return (
                        <div
                          key={driver.id}
                          className={`rounded-2xl border p-4 flex flex-col justify-between transition-all bg-white ${
                            driver.is_active
                              ? 'border-slate-200/90 shadow-2xs hover:border-emerald-500/40'
                              : 'border-slate-200 bg-slate-50/70 opacity-85'
                          }`}
                        >
                          <div>
                            {/* En-tête de carte : Photo / Initiale, Nom, Quartier, Téléphone, Badge */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {driver.photo_url ? (
                                  <img
                                    src={driver.photo_url}
                                    alt={driver.name}
                                    className="w-10 h-10 rounded-full object-cover border border-[#E5DCD0] shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] text-[#1B4B4A] flex items-center justify-center font-bold text-xs shrink-0">
                                    {initials}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                                    {driver.name}
                                  </h4>
                                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5 truncate">
                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{driver.phone || 'Non renseigné'}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">
                                      {driver.neighborhood || 'Quartier non renseigné'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                  driver.is_active
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {driver.is_active ? 'Actif' : 'Archivé'}
                              </span>
                            </div>

                            {/* Statistiques depuis businessOrders */}
                            <div className="space-y-1.5 pt-2 pb-2 border-t border-slate-100 text-xs">
                              <div className="flex items-center justify-between text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg">
                                <span>En livraison</span>
                                <span className="font-bold font-mono text-slate-900">
                                  {inDeliveryCount} en livraison
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600 px-2.5 py-1 rounded-lg">
                                <span>Livrées au total</span>
                                <span className="font-bold font-mono text-slate-900">
                                  {deliveredTotalCount} livrées au total
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500 text-[11px] px-2.5 py-0.5">
                                <span>Dernière livraison :</span>
                                <span className="font-semibold text-slate-700">
                                  {lastDeliveredFormatted}
                                </span>
                              </div>
                            </div>

                            {/* Message d'erreur spécifique en cas de tentative d'archivage bloquée */}
                            {hasBlockingError && (
                              <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 font-medium flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <span>{driverActionFeedback.message}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions de la carte */}
                          <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDriver(driver)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Modifier</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleDriverStatus(driver)}
                              className={`px-2.5 py-1 font-bold text-xs rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                                driver.is_active
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
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
                );
              })()}
            </div>
          </div>
        )}

        {/* 3. Payment Aggregator & Channels Section */}
        {activeSettingsSection === 'payment' && (
          <div className="space-y-6">
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
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

            {/* Testeur de Webhook de Paiement (Wave / OM) */}
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
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs rounded-xl p-3 transition-all shadow-2xs cursor-pointer"
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
          </div>
        )}

        {/* 4. Staff Team Management */}
        {activeSettingsSection === 'team' && (
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
                              disabled={reactivatingStaffId === staff.id}
                              onClick={() => handleReactivateStaff(staff.id)}
                              className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                            >
                              {reactivatingStaffId === staff.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Réactivation...</span>
                                </>
                              ) : (
                                <span>Réactiver</span>
                              )}
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
        )}

        {/* 5. Section Capacité de production journalière */}
        {activeSettingsSection === 'capacity' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <Gauge className="w-5 h-5 text-emerald-600" />
                  <span>Capacité de Production Journalière</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Définissez un plafond quotidien de commandes par produit. Si le quota est atteint, les nouvelles commandes du jour seront bloquées.
                </p>
              </div>

              <button
                type="button"
                onClick={loadTodaySales}
                disabled={isSoldLoading}
                className="inline-flex items-center space-x-2 text-xs font-extrabold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-3.5 py-2 rounded-2xl border border-slate-200 hover:border-emerald-200 transition-all shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
                title="Actualiser les ventes du jour"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSoldLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                <span>{isSoldLoading ? 'Actualisation...' : 'Actualiser'}</span>
              </button>
            </div>

            {soldError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-800">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{soldError}</span>
                </div>
                <button
                  type="button"
                  onClick={loadTodaySales}
                  className="px-3 py-1 bg-white border border-rose-300 rounded-xl font-extrabold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
                >
                  Réessayer
                </button>
              </div>
            )}

            {capacityProducts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                <p className="text-xs font-bold text-slate-600">Aucun produit configuré dans la boutique.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Produit</th>
                      <th className="pb-3 px-4">Catégorie</th>
                      <th className="pb-3 px-4">Vendu aujourd&apos;hui</th>
                      <th className="pb-3 px-4">Limite par jour (unités)</th>
                      <th className="pb-3 pl-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {capacityProducts.map((prod) => {
                      const catName = categoryMap.get(prod.category_id) || 'Non catégorisé';
                      const soldCount = soldTodayMap[prod.id] || 0;
                      const hasLimit = prod.daily_limit !== null && prod.daily_limit !== undefined;
                      const isLimitReached = hasLimit && soldCount >= (prod.daily_limit as number);
                      const currentInputValue = limitInputs[prod.id] !== undefined
                        ? limitInputs[prod.id]
                        : (hasLimit ? String(prod.daily_limit) : '');
                      const rowErr = rowErrors[prod.id];
                      const rowSucc = rowSuccess[prod.id];
                      const isSaving = Boolean(rowSaving[prod.id]);

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 pr-4 align-top">
                            <div className="flex items-center space-x-3">
                              {prod.image_url ? (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">
                                  {(prod.name.trim().charAt(0) || 'P').toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 block truncate">{prod.name}</span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {prod.price.toLocaleString()} {business.currency}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 whitespace-nowrap">
                              {catName}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 align-top font-mono">
                            {isSoldLoading ? (
                              <span className="text-slate-400 italic">Chargement...</span>
                            ) : soldError ? (
                              <div className="flex items-center space-x-1.5 text-rose-600 text-[11px]">
                                <span>Échec</span>
                                <button
                                  type="button"
                                  onClick={loadTodaySales}
                                  className="underline font-bold hover:text-rose-800 cursor-pointer"
                                >
                                  Réessayer
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="font-extrabold text-slate-900 text-sm">
                                  {soldCount}
                                </span>
                                <span className="text-[11px] text-slate-500 ml-1">unité{soldCount > 1 ? 's' : ''}</span>
                                {isLimitReached && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                      <span>Limite atteinte</span>
                                    </span>
                                    <span className="block text-[9px] text-slate-400 mt-0.5">
                                      seules les nouvelles commandes seront bloquées
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Illimité"
                                value={currentInputValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLimitInputs((prev) => ({ ...prev, [prod.id]: val }));
                                  setRowErrors((prev) => ({ ...prev, [prod.id]: null }));
                                  setRowSuccess((prev) => ({ ...prev, [prod.id]: null }));
                                }}
                                className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs font-mono"
                              />
                              {rowErr && (
                                <p className="text-[10px] font-bold text-rose-600 leading-tight">
                                  {rowErr}
                                </p>
                              )}
                              {rowSucc && (
                                <p className="text-[10px] font-bold text-emerald-600 leading-tight">
                                  {rowSucc}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 pl-4 text-right align-top">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveProductDailyLimit(prod)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-2xs disabled:opacity-50 cursor-pointer inline-flex items-center space-x-1"
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Enregistrement...</span>
                                </>
                              ) : (
                                <span>Enregistrer</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        </div>
      </div>

      {/* 6. Sticky Unified Settings Save Bar */}
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
            disabled={!hasSettingsChanges || isBizSaving}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              hasSettingsChanges && !isBizSaving
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-slate-100/50 text-slate-400 cursor-not-allowed'
            }`}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSaveAllSettings}
            disabled={!hasSettingsChanges || isBizSaving}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              hasSettingsChanges && !isBizSaving
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isBizSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
          </button>
        </div>
      </div>

      {/* Delivery Zone Add / Edit Modal */}
      {isZoneModalOpen && editingZone && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <span>{editingZone.id ? 'Modifier la Zone' : 'Nouvelle Zone de Livraison'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsZoneModalOpen(false);
                  setEditingZone(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">Nom de la zone</label>
                <input
                  type="text"
                  value={editingZone.name || ''}
                  onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                  placeholder="Ex: Dakar Plateau, Almadies, Mbour..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1">
                  Frais de livraison ({business.currency})
                </label>
                <input
                  type="number"
                  value={editingZone.fee ?? 1000}
                  onChange={(e) => setEditingZone({ ...editingZone, fee: Number(e.target.value) })}
                  min={0}
                  step={100}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Zone active</span>
                  <span className="text-[10px] text-slate-500">Disponible lors de la commande client</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingZone({ ...editingZone, active: !editingZone.active })}
                  className={`px-3 py-1 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                    editingZone.active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {editingZone.active ? 'Oui' : 'Non'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsZoneModalOpen(false);
                  setEditingZone(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isZoneSaving || !editingZone.name?.trim()}
                onClick={handleSaveZone}
                className="px-5 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isZoneSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <span>Enregistrer</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Zone Delete Confirmation Modal */}
      {deletingZone && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Supprimer la zone ?</h3>
                <p className="text-xs text-slate-500">Zone : <strong>{deletingZone.name}</strong></p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Êtes-vous sûr de vouloir supprimer cette zone de livraison ? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isZoneDeleting}
                onClick={() => setDeletingZone(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isZoneDeleting}
                onClick={handleDeleteZoneConfirm}
                className="px-4 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isZoneDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <span>Supprimer</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Create / Edit Modal */}
      <DriverFormModal
        isOpen={isDriverModalOpen}
        driver={editingDriver}
        businessId={business.id}
        onClose={() => {
          setIsDriverModalOpen(false);
          setEditingDriver(null);
        }}
        onSaved={handleDriverSaved}
      />
    </div>
  );
}
