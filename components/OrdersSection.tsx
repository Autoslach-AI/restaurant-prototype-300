'use client';

import React, { useState } from 'react';
import {
  Search,
  Star,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Order, OrderStatus, Customer, Business } from '@/lib/types';

export interface OrdersSectionProps {
  business: Business;
  businessOrders: Order[];
  businessCustomers: Customer[];
  nowMs: number;
  startOfTodayMs: number;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  alertCategoryFilter: 'all' | 'urgent_undelivered' | 'preparing_45m' | 'new_orders';
  setAlertCategoryFilter: (filter: 'all' | 'urgent_undelivered' | 'preparing_45m' | 'new_orders') => void;
  orderSearch: string;
  setOrderSearch: (search: string) => void;
  hasRatingFilter: boolean;
  setHasRatingFilter: (filter: boolean) => void;
  paymentMethodFilter: 'all' | 'wave' | 'orange' | 'card';
  setPaymentMethodFilter: (method: 'all' | 'wave' | 'orange' | 'card') => void;
  orderPeriodFilter: 'day' | 'week' | 'month' | 'year' | 'all';
  setOrderPeriodFilter: (period: 'day' | 'week' | 'month' | 'year' | 'all') => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  getInitials: (name?: string) => string;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onCancelOrder: (orderId: string, reason: string) => Promise<void>;
}

export default function OrdersSection({
  business,
  businessOrders,
  businessCustomers,
  nowMs,
  startOfTodayMs,
  statusFilter,
  setStatusFilter,
  alertCategoryFilter,
  setAlertCategoryFilter,
  orderSearch,
  setOrderSearch,
  hasRatingFilter,
  setHasRatingFilter,
  paymentMethodFilter,
  setPaymentMethodFilter,
  orderPeriodFilter,
  setOrderPeriodFilter,
  selectedCustomerId,
  setSelectedCustomerId,
  getInitials,
  onUpdateOrderStatus,
  onCancelOrder,
}: OrdersSectionProps) {
  // Local states exclusive to OrdersSection
  const [ordersCurrentPage, setOrdersCurrentPage] = useState<number>(1);
  const [selectedModalOrderId, setSelectedModalOrderId] = useState<string | null>(null);

  // Modal d'annulation de commande
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [isCancellingOrder, setIsCancellingOrder] = useState<false | boolean>(false);

  // Double-clic pour agrandir un commentaire
  const [enlargedComment, setEnlargedComment] = useState<{
    comment: string;
    rating?: number | null;
    internalNote?: string | null;
    name: string;
    orderId: string;
  } | null>(null);

  // Helper local pour la classe de couleur du sélecteur de statut
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

  // Filtrage complet des commandes
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
    } else if (alertCategoryFilter === 'new_orders') {
      if (o.status !== 'pending' && o.status !== 'confirmed') return false;
      const createdTime = new Date(o.created_at).getTime();
      if (nowMs - createdTime > 30 * 60 * 1000) return false;
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

  return (
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
                            {ord.requested_delivery_time && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                                <span>🕒 Souhaitée : {ord.requested_delivery_time}</span>
                              </span>
                            )}
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

      {/* Cancel Order Modal */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-base">Annuler la commande ?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Indiquez le motif de l&apos;annulation pour cette commande. Cette action est irreversible.
            </p>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Motif de l'annulation (ex: Rupture de stock, Demande client)..."
              rows={3}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-800"
            />
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingOrderId(null);
                  setCancellationReason('');
                }}
                disabled={isCancellingOrder}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={isCancellingOrder || !cancellationReason.trim()}
                onClick={async () => {
                  if (!cancellingOrderId) return;
                  setIsCancellingOrder(true);
                  try {
                    await onCancelOrder(cancellingOrderId, cancellationReason.trim());
                    setCancellingOrderId(null);
                    setCancellationReason('');
                  } catch (err: any) {
                    alert(err?.message || "Erreur lors de l'annulation.");
                  } finally {
                    setIsCancellingOrder(false);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {isCancellingOrder ? 'Annulation...' : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Comment Modal */}
      {enlargedComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <h3 className="font-extrabold text-slate-900 text-sm">Avis &amp; Commentaire Client</h3>
              </div>
              <button
                type="button"
                onClick={() => setEnlargedComment(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Client</span>
                <span className="text-xs font-semibold text-slate-800">{enlargedComment.name}</span>
              </div>

              {enlargedComment.rating && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Note</span>
                  <div className="flex items-center space-x-1 mt-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`w-4 h-4 ${
                          idx < (enlargedComment.rating || 0)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200 fill-slate-100'
                        }`}
                      />
                    ))}
                    <span className="text-xs font-black text-slate-700 ml-1.5">{enlargedComment.rating}/5</span>
                  </div>
                </div>
              )}

              {enlargedComment.comment && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Commentaire client</span>
                  <p className="text-xs text-slate-700 bg-amber-50/60 p-3 rounded-2xl border border-amber-200/60 mt-1 italic">
                    &ldquo;{enlargedComment.comment}&rdquo;
                  </p>
                </div>
              )}

              {enlargedComment.internalNote && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Note interne</span>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200 mt-1">
                    {enlargedComment.internalNote}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setEnlargedComment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
