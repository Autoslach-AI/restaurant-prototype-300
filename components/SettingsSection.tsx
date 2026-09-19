'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  fetchDeliveryZonesForBusiness,
  insertDeliveryZone,
  updateDeliveryZone,
  toggleDeliveryZoneActive,
  deleteDeliveryZone,
} from '@/lib/supabase';
import { getStore } from '@/lib/store';
import { Business, Staff, StaffPermissions, Order, DeliveryZone } from '@/lib/types';

export interface SettingsSectionProps {
  business: Business;
  activeStaff: Staff;
  businessOrders: Order[];
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
  business,
  activeStaff,
  businessOrders,
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
      {/* 1. Réglages Généraux */}
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

      {/* 2. Zones de Livraison Table (delivery_zones) */}
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

      {/* 3. Payment Aggregator & Channels Section */}
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

      {/* 4. Staff Team Management */}
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

      {/* 5. Webhook Tester Box */}
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
    </div>
  );
}
