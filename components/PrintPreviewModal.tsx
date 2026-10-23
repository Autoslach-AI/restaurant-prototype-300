'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Printer,
  Minus,
  Plus,
  Receipt,
  Loader2,
  Check,
  CheckSquare,
  Square,
  Copy,
  Info,
  FileText,
  Download,
  RotateCcw,
  Edit3,
} from 'lucide-react';
import { Business, Driver, Order, OrderItem } from '@/lib/types';
import {
  generateTicketsPdf,
  generateRoutePdf,
  generateInvoicePdf,
  downloadInvoicePdf,
  InvoicePrintOptions,
  getOrderShortRef,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  formatAmount,
} from '@/lib/print-docs';
import { fetchOrderItemsForOrders } from '@/lib/supabase';

interface InvoiceOverrides {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  subjectNote: string;
  paymentMention: string;
  dueDate: string;
  footerText: string;
}

function getInitialInvoiceOverrides(ord?: Order, biz?: Business): InvoiceOverrides {
  if (!ord) {
    return {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      subjectNote: '',
      paymentMention: '',
      dueDate: '',
      footerText: biz?.config?.invoice?.footer_text || '',
    };
  }
  const isPaid = ord.payment_status === 'paid';
  const paymentMethod = getPaymentMethodLabel(ord.payment_method);
  const defaultMention = isPaid ? `Payée · ${paymentMethod}` : `À régler · ${paymentMethod}`;
  const defaultAddress =
    ord.order_type === 'pickup' ? 'Retrait sur place' : (ord.delivery_address || '');

  return {
    customerName: ord.customer_name || '',
    customerPhone: ord.customer_phone || '',
    customerAddress: defaultAddress,
    subjectNote: '',
    paymentMention: defaultMention,
    dueDate: '',
    footerText: biz?.config?.invoice?.footer_text || '',
  };
}

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver?: Driver | null;
  orders: Order[];
  business: Business;
  initialItemsByOrder?: Record<string, OrderItem[]>;
  initialTab?: 'tickets' | 'route' | 'invoice';
}

export default function PrintPreviewModal({
  isOpen,
  onClose,
  driver,
  orders,
  business,
  initialItemsByOrder,
  initialTab = 'tickets',
}: PrintPreviewModalProps) {
  // Onglet actif : « tickets » (Tickets 80 mm), « route » (Feuille de route A4) ou « invoice » (Facture A4)
  const [activeDocTab, setActiveDocTab] = useState<'tickets' | 'route' | 'invoice'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveDocTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Options mémorisées pour la facture A4 (persistées dans localStorage)
  const [invoiceOptions, setInvoiceOptions] = useState<InvoicePrintOptions>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('invoice_print_options');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return { showLogo: true, showTaxId: true, showFooter: true };
  });

  // Modifications temporaires avant impression (ne changent pas la commande en base)
  const [invoiceOverrides, setInvoiceOverrides] = useState<InvoiceOverrides>(() =>
    getInitialInvoiceOverrides(orders[0], business)
  );

  // Synchronisation des valeurs d'impression si la première commande change
  useEffect(() => {
    if (orders[0]) {
      setInvoiceOverrides(getInitialInvoiceOverrides(orders[0], business));
    }
  }, [orders[0]?.id]);

  const handleResetInvoiceOverrides = () => {
    setInvoiceOverrides(getInitialInvoiceOverrides(orders[0], business));
  };

  const toggleInvoiceOption = (key: keyof InvoicePrintOptions) => {
    setInvoiceOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('invoice_print_options', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };
  // Sélection des commandes cochées (cochées par défaut)
  const [checkedOrders, setCheckedOrders] = useState<Record<string, boolean>>({});

  // Nombre de copies par commande (1 à 20, conservé même si décochée)
  const [copiesByOrder, setCopiesByOrder] = useState<Record<string, number>>({});

  // Valeur du champ global « Copies pour tous » (1 à 20)
  const [copiesForAll, setCopiesForAll] = useState<number>(1);

  // Commande actuellement sélectionnée / mise en évidence dans l'aperçu
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Articles des commandes (pour affichage fidèle des tickets)
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>(
    initialItemsByOrder || {}
  );
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  // Référence du conteneur d'aperçu pour le défilement
  const previewScrollContainerRef = useRef<HTMLDivElement>(null);
  const ticketRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Initialisation à l'ouverture de la modal ou changement de commandes
  useEffect(() => {
    if (!isOpen) return;

    // Toutes les commandes cochées par défaut
    const initialChecked: Record<string, boolean> = {};
    const initialCopies: Record<string, number> = {};

    orders.forEach((ord) => {
      initialChecked[ord.id] = true;
      // Conserver les copies existantes ou 1 par défaut
      initialCopies[ord.id] = copiesByOrder[ord.id] || 1;
    });

    setCheckedOrders(initialChecked);
    setCopiesByOrder(initialCopies);
    setCopiesForAll(1);
    if (orders.length > 0) {
      setActiveOrderId(orders[0].id);
    }

    // Charger les articles si manquants
    const missingIds = orders.map((o) => o.id).filter((id) => !itemsByOrder[id]);
    if (missingIds.length > 0) {
      setIsLoadingItems(true);
      fetchOrderItemsForOrders(missingIds)
        .then((fetched) => {
          setItemsByOrder((prev) => ({ ...prev, ...fetched }));
        })
        .catch((err) => {
          console.warn('Erreur chargement articles pour aperçu tickets:', err);
        })
        .finally(() => {
          setIsLoadingItems(false);
        });
    }
  }, [isOpen, orders]);

  // Commandes cochées dans l'ordre d'origine
  const activeOrders = useMemo(() => {
    return orders.filter((o) => checkedOrders[o.id]);
  }, [orders, checkedOrders]);

  // Total de tickets cochés et total de copies
  const checkedCount = activeOrders.length;
  const totalCopies = useMemo(() => {
    return activeOrders.reduce((sum, ord) => sum + (copiesByOrder[ord.id] || 1), 0);
  }, [activeOrders, copiesByOrder]);

  if (!isOpen) return null;

  // Toggle commande cochée / décochée (ses copies restent conservées dans copiesByOrder)
  const toggleOrderCheck = (orderId: string) => {
    setCheckedOrders((prev) => {
      const nextChecked = !prev[orderId];
      return { ...prev, [orderId]: nextChecked };
    });
  };

  // Cocher / Décocher tout
  const toggleSelectAll = () => {
    const allChecked = orders.every((o) => checkedOrders[o.id]);
    const next: Record<string, boolean> = {};
    orders.forEach((o) => {
      next[o.id] = !allChecked;
    });
    setCheckedOrders(next);
  };

  // Modification des copies d'une commande individuelle (1 à 20)
  const updateOrderCopies = (orderId: string, val: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(val || 1)));
    setCopiesByOrder((prev) => ({
      ...prev,
      [orderId]: clamped,
    }));
  };

  // Application de « Copies pour tous » aux commandes actuellement cochées
  const handleApplyCopiesForAll = (val: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(val || 1)));
    setCopiesForAll(clamped);
    setCopiesByOrder((prev) => {
      const next = { ...prev };
      orders.forEach((ord) => {
        if (checkedOrders[ord.id]) {
          next[ord.id] = clamped;
        }
      });
      return next;
    });
  };

  // Clic sur une commande : défilement jusqu'au ticket et mise en évidence
  const handleOrderRowClick = (orderId: string) => {
    setActiveOrderId(orderId);
    // Si la commande était décochée, l'utilisateur souhaite probablement la voir : la cocher
    if (!checkedOrders[orderId]) {
      setCheckedOrders((prev) => ({ ...prev, [orderId]: true }));
    }

    // Défilement doux vers le ticket
    setTimeout(() => {
      const targetEl = ticketRefs.current[orderId];
      if (targetEl && previewScrollContainerRef.current) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  };

  // Lancement de l'impression PDF avec copies multipliées
  const handlePrintTickets = async () => {
    if (activeOrders.length === 0) return;
    setIsGeneratingPdf(true);
    setErrorFeedback(null);
    try {
      // Construction de la liste des commandes en répétant selon le nombre de copies
      const expandedOrders: Order[] = [];
      activeOrders.forEach((ord) => {
        const copies = copiesByOrder[ord.id] || 1;
        for (let i = 0; i < copies; i++) {
          expandedOrders.push(ord);
        }
      });

      if (driver) {
        await generateTicketsPdf(expandedOrders, itemsByOrder, driver, business);
        onClose();
      }
    } catch (err: any) {
      console.error('Erreur génération tickets:', err);
      setErrorFeedback(err?.message || 'Erreur lors de la création du document PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const effectiveInvoiceOptions: InvoicePrintOptions = useMemo(() => ({
    ...invoiceOptions,
    customerName: invoiceOverrides.customerName,
    customerPhone: invoiceOverrides.customerPhone,
    customerAddress: invoiceOverrides.customerAddress,
    subjectNote: invoiceOverrides.subjectNote,
    paymentMention: invoiceOverrides.paymentMention,
    dueDate: invoiceOverrides.dueDate,
    footerText: invoiceOverrides.footerText,
  }), [invoiceOptions, invoiceOverrides]);

  // Actions Facture : Téléchargement direct ou Impression
  const handleDownloadInvoice = async () => {
    const ord = orders[0];
    if (!ord) return;
    setIsGeneratingPdf(true);
    setErrorFeedback(null);
    try {
      const items = itemsByOrder[ord.id] || [];
      await downloadInvoicePdf(ord, items, business, effectiveInvoiceOptions);
    } catch (err: any) {
      console.error('Erreur téléchargement facture:', err);
      setErrorFeedback(err?.message || 'Erreur lors du téléchargement de la facture.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintInvoice = async () => {
    const ord = orders[0];
    if (!ord) return;
    setIsGeneratingPdf(true);
    setErrorFeedback(null);
    try {
      const items = itemsByOrder[ord.id] || [];
      await generateInvoicePdf(ord, items, business, effectiveInvoiceOptions);
    } catch (err: any) {
      console.error('Erreur impression facture:', err);
      setErrorFeedback(err?.message || 'Erreur lors de la génération de la facture.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Nom et téléphone de l'en-tête du ticket
  const legalName = business.config?.invoice?.legal_name || business.name;
  const businessPhone = business.config?.invoice?.phone || business.whatsapp_number;
  const currency = business.currency || 'XOF';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[820px] bg-white rounded-2xl border border-[#E5DCD0] shadow-2xl flex flex-col overflow-hidden">
        
        {/* En-tête de la modale */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5DCD0] bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#E5DCD0] flex items-center justify-center text-[#1B4B4A]">
              {activeDocTab === 'invoice' ? (
                <FileText className="w-5 h-5" />
              ) : activeDocTab === 'route' ? (
                <FileText className="w-5 h-5" />
              ) : (
                <Receipt className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {activeDocTab === 'invoice'
                  ? 'Facture (A4)'
                  : activeDocTab === 'route'
                  ? 'Feuille de route (A4)'
                  : 'Aperçu des tickets thermiques (80 mm)'}
              </h2>
              <p className="text-xs text-slate-500">
                {activeDocTab === 'invoice' ? (
                  orders[0] ? (
                    <>
                      Commande <span className="font-semibold text-slate-700">#{getOrderShortRef(orders[0])}</span> ·{' '}
                      {orders[0].customer_name || 'Client anonyme'}
                    </>
                  ) : (
                    'Facture de commande'
                  )
                ) : (
                  <>
                    Tournée de <span className="font-semibold text-slate-700">{driver?.name || 'Livreur'}</span>
                    {driver?.phone ? ` (${driver.phone})` : ''} · {orders.length} commande(s) au total
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Onglets de la fenêtre d'aperçu */}
            <div className="hidden sm:flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E5DCD0]">
              {driver && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveDocTab('tickets')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeDocTab === 'tickets'
                        ? 'bg-white text-[#1B4B4A] shadow-xs border border-[#E5DCD0]/60'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Aperçu des tickets thermiques 80 mm"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Tickets (80 mm)</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setActiveDocTab('route');
                      setIsGeneratingPdf(true);
                      try {
                        await generateRoutePdf(
                          driver,
                          activeOrders.length > 0 ? activeOrders : orders,
                          itemsByOrder,
                          business
                        );
                      } catch (err: any) {
                        setErrorFeedback(err?.message || 'Erreur lors de la génération de la feuille de route.');
                      } finally {
                        setIsGeneratingPdf(false);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeDocTab === 'route'
                        ? 'bg-white text-[#1B4B4A] shadow-xs border border-[#E5DCD0]/60'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Feuille de route (A4)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Feuille de route (A4)</span>
                  </button>
                </>
              )}

              {activeDocTab === 'invoice' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-white text-[#1B4B4A] shadow-xs border border-[#E5DCD0]/60"
                  title="Facture (A4)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Facture (A4)</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-[#FAF7F2] transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps de la modale en deux colonnes */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-[#FAF7F2]">
          
          {/* ========================================================= */}
          {/* COLONNE GAUCHE                                            */}
          {/* ========================================================= */}
          {activeDocTab === 'invoice' ? (
            <div className="w-full md:w-[380px] lg:w-[410px] flex-shrink-0 flex flex-col bg-white border-b md:border-b-0 md:border-r border-[#E5DCD0] h-full overflow-hidden">
              {/* En-tête commande & Montants non modifiables */}
              <div className="p-3.5 border-b border-[#E5DCD0] bg-[#FFFDF9] space-y-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Commande
                    </h3>
                    {orders[0] && (
                      <span className="font-mono text-xs font-bold text-[#1B4B4A]">
                        #{getOrderShortRef(orders[0])}
                      </span>
                    )}
                  </div>
                  {orders[0] && (
                    <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-[#E5DCD0] shadow-2xs">
                      {formatAmount(orders[0].total_amount, currency)}
                    </span>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-900 flex items-center justify-between">
                  <span>Montants (articles, frais, total) : <strong>figés</strong></span>
                  <span className="text-[10px] text-amber-700 font-medium">Non modifiables</span>
                </div>
              </div>

              {/* Contenu scrollable : Panneau « Modifier avant impression » + Options d'affichage */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                
                {/* Panneau « Modifier avant impression » */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Edit3 className="w-3.5 h-3.5 text-[#1B4B4A]" />
                      <span>Modifier avant impression</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetInvoiceOverrides}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#1B4B4A] hover:bg-[#FAF7F2] border border-[#E5DCD0] transition-colors cursor-pointer shadow-2xs"
                      title="Rétablir les valeurs d'origine de la commande"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rétablir</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-tight">
                    Ces modifications servent uniquement pour ce document sans changer la commande.
                  </p>

                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5DCD0] space-y-3">
                    {/* Nom du client */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Nom du client
                      </label>
                      <input
                        type="text"
                        value={invoiceOverrides.customerName}
                        onChange={(e) => setInvoiceOverrides((prev) => ({ ...prev, customerName: e.target.value }))}
                        placeholder="Nom du client"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5DCD0] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A]"
                      />
                    </div>

                    {/* Téléphone */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Téléphone
                      </label>
                      <input
                        type="text"
                        value={invoiceOverrides.customerPhone}
                        onChange={(e) => setInvoiceOverrides((prev) => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="Numéro de téléphone"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5DCD0] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A]"
                      />
                    </div>

                    {/* Adresse */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Adresse du client
                      </label>
                      <textarea
                        rows={2}
                        value={invoiceOverrides.customerAddress}
                        onChange={(e) => setInvoiceOverrides((prev) => ({ ...prev, customerAddress: e.target.value }))}
                        placeholder="Adresse ou Retrait sur place"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5DCD0] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A] resize-none"
                      />
                    </div>

                    {/* « Objet / note » (200 caractères) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Objet / note
                        </label>
                        <span className={`text-[10px] ${invoiceOverrides.subjectNote.length >= 200 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                          {invoiceOverrides.subjectNote.length} / 200
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={200}
                        value={invoiceOverrides.subjectNote}
                        onChange={(e) => setInvoiceOverrides((prev) => ({ ...prev, subjectNote: e.target.value.slice(0, 200) }))}
                        placeholder="Précision ou note (ex: Commande entreprise, événement...)"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5DCD0] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A] resize-none"
                      />
                    </div>

                    {/* Mention de paiement */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Mention de paiement
                      </label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        <button
                          type="button"
                          onClick={() => setInvoiceOverrides((prev) => ({ ...prev, paymentMention: 'Payée' }))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          Payée
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceOverrides((prev) => ({ ...prev, paymentMention: 'À régler' }))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          À régler
                        </button>
                        {orders[0]?.payment_method && (
                          <button
                            type="button"
                            onClick={() =>
                              setInvoiceOverrides((prev) => ({
                                ...prev,
                                paymentMention: `${orders[0]?.payment_status === 'paid' ? 'Payée' : 'À régler'} · ${getPaymentMethodLabel(orders[0]?.payment_method)}`,
                              }))
                            }
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white text-slate-700 border border-[#E5DCD0] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                          >
                            {getPaymentMethodLabel(orders[0]?.payment_method)}
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={invoiceOverrides.paymentMention}
                        onChange={(e) => setInvoiceOverrides((prev) => ({ ...prev, paymentMention: e.target.value }))}
                        placeholder="Ex: Payée · Wave, À régler à réception..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5DCD0] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A]"
                      />
                    </div>

                    {/* Date d'échéance */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Date d&apos;échéance
                      </label>
                      <input
                        type="text"
                        value={invoiceOverrides.dueDate}
                        onChange={(e) => setInvoiceOverrides((prev) => ({ ...prev, dueDate: e.target.value }))}
                        placeholder="Ex: 30/11/2026, Immédiate..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5DCD0] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A]"
                      />
                    </div>

                    {/* Pied de page */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Pied de page
                      </label>
                      <textarea
                        rows={2}
                        value={invoiceOverrides.footerText}
                        onChange={(e) => setInvoiceOverrides((prev) => ({ ...prev, footerText: e.target.value }))}
                        placeholder="Mentions légales, remerciements..."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5DCD0] bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A] resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Options d'affichage */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5">
                    Options d&apos;affichage
                  </h4>
                  <div className="space-y-2">
                    {/* Option 1 : Logo */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#E5DCD0] bg-white hover:bg-[#FAF7F2] transition-colors cursor-pointer">
                      <div className="text-xs">
                        <div className="font-semibold text-slate-800">Afficher le logo</div>
                        <div className="text-[10px] text-slate-500">Logo de l&apos;en-tête de facture</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={invoiceOptions.showLogo !== false}
                        onChange={() => toggleInvoiceOption('showLogo')}
                        className="w-4 h-4 rounded text-[#1B4B4A] focus:ring-[#1B4B4A] cursor-pointer"
                      />
                    </label>

                    {/* Option 2 : Identifiant fiscal */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#E5DCD0] bg-white hover:bg-[#FAF7F2] transition-colors cursor-pointer">
                      <div className="text-xs">
                        <div className="font-semibold text-slate-800">Identifiant fiscal</div>
                        <div className="text-[10px] text-slate-500">NINEA / NIF si renseigné</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={invoiceOptions.showTaxId !== false}
                        onChange={() => toggleInvoiceOption('showTaxId')}
                        className="w-4 h-4 rounded text-[#1B4B4A] focus:ring-[#1B4B4A] cursor-pointer"
                      />
                    </label>

                    {/* Option 3 : Pied de page */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#E5DCD0] bg-white hover:bg-[#FAF7F2] transition-colors cursor-pointer">
                      <div className="text-xs">
                        <div className="font-semibold text-slate-800">Pied de page</div>
                        <div className="text-[10px] text-slate-500">Mentions légales et remerciements</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={invoiceOptions.showFooter !== false}
                        onChange={() => toggleInvoiceOption('showFooter')}
                        className="w-4 h-4 rounded text-[#1B4B4A] focus:ring-[#1B4B4A] cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Résumé bas colonne gauche */}
              <div className="p-3 border-t border-[#E5DCD0] bg-[#FFFDF9] flex-shrink-0 flex items-center justify-between">
                <div className="text-xs font-bold text-[#1B4B4A] flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#1B4B4A]" />
                  <span>1 document · Format A4</span>
                </div>
                <div className="text-[10px] text-slate-400">PDF Portrait</div>
              </div>
            </div>
          ) : (
            <div className="w-full md:w-[380px] lg:w-[410px] flex-shrink-0 flex flex-col bg-white border-b md:border-b-0 md:border-r border-[#E5DCD0] h-full overflow-hidden">
              
              {/* Haut de la colonne gauche : En-tête de contrôle & « Copies pour tous » */}
              <div className="p-3.5 border-b border-[#E5DCD0] bg-[#FFFDF9] space-y-3 flex-shrink-0">
              
              {/* Ligne Sélecteur global & Titre */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#1B4B4A] transition-colors cursor-pointer"
                >
                  {orders.length > 0 && orders.every((o) => checkedOrders[o.id]) ? (
                    <CheckSquare className="w-4 h-4 text-[#1B4B4A]" />
                  ) : orders.some((o) => checkedOrders[o.id]) ? (
                    <div className="w-4 h-4 rounded border-2 border-[#1B4B4A] flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#1B4B4A] rounded-xs" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                  <span>Sélectionner tout</span>
                </button>

                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#1B4B4A]/10 text-[#1B4B4A]">
                  {checkedCount} / {orders.length} cochée{checkedCount > 1 ? 's' : ''}
                </span>
              </div>

              {/* Champ « Copies pour tous » */}
              <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5DCD0]/70 flex items-center justify-between gap-2 shadow-2xs">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-[#1B4B4A]" />
                    <span>Copies pour tous</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    Applique aux commandes cochées
                  </div>
                </div>

                {/* Stepper avec −, saisie directe (1-20), et + */}
                <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-[#E5DCD0] shadow-2xs flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApplyCopiesForAll(copiesForAll - 1)}
                    disabled={copiesForAll <= 1}
                    aria-label="Diminuer les copies pour tous"
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-[#FAF7F2] hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={copiesForAll}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        handleApplyCopiesForAll(val);
                      }
                    }}
                    aria-label="Nombre de copies pour toutes les commandes"
                    className="w-8 text-center text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A] py-0.5 border-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCopiesForAll(copiesForAll + 1)}
                    disabled={copiesForAll >= 20}
                    aria-label="Augmenter les copies pour tous"
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-[#FAF7F2] hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Liste scrollable des commandes */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#E5DCD0]/60 p-2 space-y-1">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Aucune commande assignée à ce livreur.
                </div>
              ) : (
                orders.map((ord) => {
                  const isChecked = Boolean(checkedOrders[ord.id]);
                  const copies = copiesByOrder[ord.id] || 1;
                  const shortRef = getOrderShortRef(ord);
                  const isActive = activeOrderId === ord.id;
                  const ordItems = itemsByOrder[ord.id] || [];
                  const paymentMethod = getPaymentMethodLabel(ord.payment_method);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => handleOrderRowClick(ord.id)}
                      className={`group p-2.5 rounded-xl transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#FAF7F2] border-[#1B4B4A] shadow-xs'
                          : isChecked
                          ? 'bg-white hover:bg-[#FFFDF9] border-transparent hover:border-[#E5DCD0]'
                          : 'bg-slate-50/70 border-dashed border-slate-200 opacity-60 hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Checkbox individuelle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOrderCheck(ord.id);
                          }}
                          aria-label={isChecked ? `Décocher commande #${shortRef}` : `Cocher commande #${shortRef}`}
                          className="mt-0.5 text-slate-400 hover:text-[#1B4B4A] transition-colors cursor-pointer flex-shrink-0"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#1B4B4A]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>

                        {/* Informations commande */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold text-[#1B4B4A]">
                              #{shortRef}
                            </span>
                            <span className="text-[11px] font-bold text-slate-900">
                              {formatAmount(ord.total_amount, currency)}
                            </span>
                          </div>

                          <div className="text-xs font-medium text-slate-800 truncate mt-0.5">
                            {ord.customer_name || 'Client anonyme'}
                          </div>

                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            <span>
                              {ord.delivery_zone_name ||
                                (ord.delivery_zone_id && ord.delivery_zone_id !== '__no_zone__'
                                  ? ord.delivery_zone_id
                                  : 'Livraison')}
                            </span>
                            <span>•</span>
                            <span>{paymentMethod}</span>
                            {ordItems.length > 0 && (
                              <>
                                <span>•</span>
                                <span>{ordItems.length} art.</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ligne inférieure : Contrôle Copies de la commande */}
                      <div
                        className="mt-2 pt-2 border-t border-[#E5DCD0]/40 flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <span>Copies :</span>
                          <span className="font-semibold text-slate-700">{copies}</span>
                        </div>

                        {/* Champ Copies avec boutons − et + et saisie directe (1 à 20) */}
                        <div className="flex items-center gap-1 bg-[#FAF7F2] px-1 py-0.5 rounded-lg border border-[#E5DCD0] shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateOrderCopies(ord.id, copies - 1)}
                            disabled={copies <= 1}
                            aria-label={`Diminuer copies pour commande #${shortRef}`}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={copies}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                updateOrderCopies(ord.id, val);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              updateOrderCopies(ord.id, isNaN(val) ? 1 : val);
                            }}
                            aria-label={`Nombre de copies pour commande #${shortRef}`}
                            className="w-7 text-center text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1B4B4A] py-0 border-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateOrderCopies(ord.id, copies + 1)}
                            disabled={copies >= 20}
                            aria-label={`Augmenter copies pour commande #${shortRef}`}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ========================================================= */}
            {/* RÉSUMÉ EN PIED DE COLONNE GAUCHE                           */}
            {/* Format exact demandé : « n tickets · n copies au total »  */}
            {/* ========================================================= */}
            <div className="p-3 border-t border-[#E5DCD0] bg-[#FFFDF9] flex-shrink-0 flex items-center justify-between">
              <div className="text-xs font-bold text-[#1B4B4A] flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#1B4B4A]" />
                <span>
                  {checkedCount} ticket{checkedCount > 1 ? 's' : ''} · {totalCopies} copie
                  {totalCopies > 1 ? 's' : ''} au total
                </span>
              </div>
              <div className="text-[10px] text-slate-400">80 mm thermique</div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* COLONNE DROITE : Zone de prévisualisation                   */}
        {/* ========================================================= */}
        {activeDocTab === 'invoice' ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
            {/* Barre d'état de l'aperçu */}
            <div className="px-5 py-2.5 bg-white border-b border-[#E5DCD0] flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Aperçu en direct</span>
                <span className="text-slate-400">•</span>
                <span>Facture A4</span>
                {isLoadingItems && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 ml-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Chargement des articles…
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 hidden sm:block">
                Format standard A4 (210 × 297 mm) · Marges 14 mm
              </div>
            </div>

            {/* Conteneur scrollable avec feuille A4 blanche */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF7F2] flex flex-col items-center">
              {orders[0] ? (() => {
                const ord = orders[0];
                const shortRef = getOrderShortRef(ord);
                const items = itemsByOrder[ord.id] || [];
                const logoUrl = business.config?.invoice?.logo_url || business.logo_url;
                const legalName = business.config?.invoice?.legal_name || business.name || 'Commerce';
                const bizAddress = business.config?.invoice?.address || business.address;
                const bizPhone = business.config?.invoice?.phone || business.whatsapp_number;
                const taxId = business.config?.invoice?.tax_id;
                const footerText = invoiceOverrides.footerText !== undefined
                  ? invoiceOverrides.footerText
                  : (business.config?.invoice?.footer_text || '');
                const paymentMethod = getPaymentMethodLabel(ord.payment_method);
                const isPaid = ord.payment_status === 'paid';
                const defaultPaymentMention = isPaid ? `Payée · ${paymentMethod}` : `À régler · ${paymentMethod}`;
                const finalPaymentMention = invoiceOverrides.paymentMention && invoiceOverrides.paymentMention.trim()
                  ? invoiceOverrides.paymentMention.trim()
                  : defaultPaymentMention;

                const orderDateStr = ord.created_at
                  ? new Date(ord.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : new Date().toLocaleDateString('fr-FR');

                const delivDateStr = ord.delivered_at
                  ? new Date(ord.delivered_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : null;

                const clientName = invoiceOverrides.customerName.trim() || 'Client anonyme';
                const clientPhone = invoiceOverrides.customerPhone.trim();
                const clientAddress = invoiceOverrides.customerAddress.trim() || 'Retrait sur place';
                const dueDate = invoiceOverrides.dueDate.trim();
                const subjectNote = invoiceOverrides.subjectNote.trim();

                const deliveryFee = Number(ord.delivery_fee || 0);
                const urgentFee = Number(ord.urgent_surcharge_applied || 0);
                const totalStored = Number(ord.total_amount || 0);

                let subTotal = 0;
                if (items.length > 0) {
                  subTotal = items.reduce(
                    (acc, it) => acc + (Number(it.unit_price) || 0) * (it.quantity || 1),
                    0
                  );
                } else {
                  subTotal = totalStored;
                }

                const calculatedSum =
                  subTotal + (deliveryFee > 0 ? deliveryFee : 0) + (urgentFee > 0 ? urgentFee : 0);
                const adjustment = totalStored - calculatedSum;

                return (
                  <div className="w-full max-w-[640px] bg-white rounded-xl shadow-lg border border-[#E5DCD0] p-6 sm:p-8 space-y-6 text-slate-800 text-xs">
                    {/* En-tête de la facture */}
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                      <div className="space-y-1">
                        {invoiceOptions.showLogo !== false && logoUrl && (
                          <img
                            src={logoUrl}
                            alt={legalName}
                            className="h-10 w-auto object-contain mb-2"
                          />
                        )}
                        <div className="font-bold text-sm text-[#1B4B4A]">{legalName}</div>
                        {bizAddress && <div className="text-[11px] text-slate-500">{bizAddress}</div>}
                        {bizPhone && <div className="text-[11px] text-slate-500">Tél : {bizPhone}</div>}
                        {invoiceOptions.showTaxId !== false && taxId && (
                          <div className="text-[11px] text-slate-500">NINEA / NIF : {taxId}</div>
                        )}
                      </div>

                      <div className="text-right space-y-1 shrink-0">
                        <div className="text-xl font-bold tracking-tight text-[#1B4B4A]">FACTURE</div>
                        <div className="font-mono font-bold text-slate-800">N° {shortRef}</div>
                        <div className="text-[11px] text-slate-500">Date : {orderDateStr}</div>
                        {delivDateStr && (
                          <div className="text-[11px] text-slate-500">Livrée le : {delivDateStr}</div>
                        )}
                        {dueDate && (
                          <div className="text-[11px] text-[#1B4B4A] font-semibold">
                            Échéance : {dueDate}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bloc Client */}
                    <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5DCD0]/70 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#1B4B4A]">
                        Facturé à :
                      </div>
                      <div className="font-bold text-slate-900 text-xs">{clientName}</div>
                      <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                        {clientPhone && <span>Tél : {clientPhone}</span>}
                        <span>Adresse : {clientAddress}</span>
                      </div>
                    </div>

                    {/* Objet / Note si renseigné */}
                    {subjectNote && (
                      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-slate-800 flex items-start gap-2.5">
                        <span className="font-bold text-[#1B4B4A] shrink-0 text-[11px]">Objet / note :</span>
                        <span className="text-[11px] text-slate-700 leading-relaxed break-words">{subjectNote}</span>
                      </div>
                    )}

                    {/* Tableau des articles */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#1B4B4A] text-white text-[11px] uppercase font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Désignation</th>
                            <th className="py-2.5 px-3 text-center w-16">Qté</th>
                            <th className="py-2.5 px-3 text-right w-28">Prix unitaire</th>
                            <th className="py-2.5 px-3 text-right w-28">Total ligne</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.length > 0 ? (
                            items.map((it, idx) => {
                              const qty = it.quantity || 1;
                              const price = Number(it.unit_price) || 0;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-3 font-medium text-slate-800">{it.product_name}</td>
                                  <td className="py-2 px-3 text-center text-slate-600">{qty}</td>
                                  <td className="py-2 px-3 text-right text-slate-600">
                                    {formatAmount(price, currency)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold text-slate-900">
                                    {formatAmount(price * qty, currency)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="py-2 px-3 font-medium text-slate-800">Commande #{shortRef}</td>
                              <td className="py-2 px-3 text-center text-slate-600">1</td>
                              <td className="py-2 px-3 text-right text-slate-600">
                                {formatAmount(totalStored, currency)}
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-slate-900">
                                {formatAmount(totalStored, currency)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Totaux */}
                    <div className="flex justify-end pt-1">
                      <div className="w-64 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Sous-total :</span>
                          <span className="font-semibold text-slate-800">
                            {formatAmount(subTotal, currency)}
                          </span>
                        </div>
                        {deliveryFee > 0 && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Frais de livraison :</span>
                            <span className="font-semibold text-slate-800">
                              {formatAmount(deliveryFee, currency)}
                            </span>
                          </div>
                        )}
                        {urgentFee > 0 && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Supplément urgent :</span>
                            <span className="font-semibold text-slate-800">
                              {formatAmount(urgentFee, currency)}
                            </span>
                          </div>
                        )}
                        {Math.abs(adjustment) >= 1 && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Ajustement :</span>
                            <span className="font-semibold text-slate-800">
                              {(adjustment > 0 ? '+' : '') + formatAmount(adjustment, currency)}
                            </span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 pt-2 flex items-center justify-between font-bold text-sm text-[#1B4B4A]">
                          <span>TOTAL :</span>
                          <span>{formatAmount(totalStored, currency)}</span>
                        </div>
                        <div className="text-right text-[11px] pt-0.5">
                          <span
                            className={`font-semibold ${
                              finalPaymentMention.toLowerCase().includes('payé') ||
                              finalPaymentMention.toLowerCase().includes('payee')
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {finalPaymentMention}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pied de page */}
                    {invoiceOptions.showFooter !== false && footerText && footerText.trim() && (
                      <div className="border-t border-slate-100 pt-4 text-center italic text-[11px] text-slate-500">
                        {footerText.trim()}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="my-auto text-center p-8 max-w-sm rounded-2xl bg-white border border-[#E5DCD0] shadow-xs">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <div className="text-sm font-bold text-slate-700">Aucune commande sélectionnée</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
            
            {/* Barre d'état de l'aperçu */}
            <div className="px-5 py-2.5 bg-white border-b border-[#E5DCD0] flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Aperçu en direct</span>
                <span className="text-slate-400">•</span>
                <span>
                  {activeOrders.length} ticket{activeOrders.length > 1 ? 's' : ''} affiché
                  {activeOrders.length > 1 ? 's' : ''}
                </span>
                {isLoadingItems && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 ml-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Chargement des articles…
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 hidden sm:block">
                Largeur standard 80 mm · Hauteur automatique mesurée
              </div>
            </div>

            {/* Conteneur scrollable des tickets */}
            <div
              ref={previewScrollContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF7F2] space-y-6 flex flex-col items-center"
            >
              {activeOrders.length === 0 ? (
                <div className="my-auto text-center p-8 max-w-sm rounded-2xl bg-white border border-[#E5DCD0] shadow-xs">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <div className="text-sm font-bold text-slate-700">Aucun ticket dans l&apos;aperçu</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cochez au moins une commande dans la colonne de gauche pour afficher son ticket thermique ici.
                  </p>
                </div>
              ) : (
                activeOrders.map((ord, idx) => {
                  const copies = copiesByOrder[ord.id] || 1;
                  const shortRef = getOrderShortRef(ord);
                  const items = itemsByOrder[ord.id] || [];
                  const isHighlighted = activeOrderId === ord.id;
                  const paymentMethod = getPaymentMethodLabel(ord.payment_method);
                  const paymentStatus = getPaymentStatusLabel(ord.payment_status);

                  // Date de commande formatée
                  const dateStr = ord.created_at
                    ? new Date(ord.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : new Date().toLocaleDateString('fr-FR');

                  // Adresse avec zone entre parenthèses
                  const zoneName =
                    ord.delivery_zone_name ||
                    (ord.delivery_zone_id && ord.delivery_zone_id !== '__no_zone__'
                      ? ord.delivery_zone_id
                      : '');
                  const address = ord.delivery_address || 'Sur place';
                  const zoneText = zoneName && zoneName.trim() ? ` (${zoneName.trim()})` : '';
                  const fullAddress = `${address}${zoneText}`;

                  const deliveryFee = Number(ord.delivery_fee || 0);
                  const urgentFee = Number(ord.urgent_surcharge_applied || 0);

                  return (
                    <div
                      key={ord.id}
                      ref={(el) => {
                        ticketRefs.current[ord.id] = el;
                      }}
                      id={`ticket-preview-${ord.id}`}
                      onClick={() => setActiveOrderId(ord.id)}
                      className={`relative w-[300px] sm:w-[320px] bg-white rounded-xl shadow-md border transition-all duration-200 cursor-pointer ${
                        isHighlighted
                          ? 'ring-2 ring-[#1B4B4A] ring-offset-2 border-[#1B4B4A] shadow-xl'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Bandeau d'état / Copies */}
                      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-50 border-b border-slate-100 rounded-t-xl text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-600">Ticket #{idx + 1}</span>
                        <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-md bg-[#1B4B4A]/10 text-[#1B4B4A]">
                          <Copy className="w-3 h-3" />
                          {copies} {copies > 1 ? 'copies' : 'copie'}
                        </span>
                      </div>

                      {/* Corps du ticket thermique 80 mm */}
                      <div className="p-4 font-mono text-[11px] text-slate-900 leading-tight space-y-2 select-text">
                        
                        {/* En-tête : Nom du commerce et Téléphone */}
                        <div className="text-center pb-1">
                          <div className="font-bold text-sm tracking-tight text-slate-900 font-sans">
                            {legalName}
                          </div>
                          {businessPhone && (
                            <div className="text-[10px] text-slate-600 mt-0.5">
                              Tél : {businessPhone}
                            </div>
                          )}
                        </div>

                        {/* Ligne « #réf · date et heure » */}
                        <div className="text-center text-[10px] text-slate-600 border-t border-b border-dashed border-slate-300 py-1 font-semibold">
                          #{shortRef} · {dateStr}
                        </div>

                        {/* Client et téléphone sur une ligne */}
                        <div className="text-[11px]">
                          <span className="font-bold">{ord.customer_name || 'Client anonyme'}</span>
                          {ord.customer_phone && (
                            <span className="text-slate-600"> · {ord.customer_phone}</span>
                          )}
                        </div>

                        {/* Adresse avec zone entre parenthèses */}
                        <div className="text-[10px] text-slate-600">
                          {fullAddress}
                        </div>

                        {/* Séparateur pointillé avant les plats */}
                        <div className="border-b border-dashed border-slate-300 my-1.5" />

                        {/* Plats : « 1 x Nom du plat … Prix » (sans en-tête ARTICLES / PRIX) */}
                        <div className="space-y-1">
                          {items.length === 0 ? (
                            <div className="text-[10px] italic text-slate-400">
                              Commande #{shortRef}
                            </div>
                          ) : (
                            items.map((it, itemIdx) => {
                              const qty = it.quantity || 1;
                              const lineTotal = formatAmount(
                                (Number(it.unit_price) || 0) * qty,
                                currency
                              );
                              return (
                                <div
                                  key={itemIdx}
                                  className="flex items-start justify-between gap-1 text-[11px]"
                                >
                                  <span className="truncate pr-1">
                                    {qty} x {it.product_name}
                                  </span>
                                  <span className="flex-shrink-0 font-medium">
                                    {lineTotal}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Frais de livraison seulement si > 0 */}
                        {deliveryFee > 0 && (
                          <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5">
                            <span>Frais de livraison</span>
                            <span>{formatAmount(deliveryFee, currency)}</span>
                          </div>
                        )}

                        {/* Supplément urgent seulement si > 0 */}
                        {urgentFee > 0 && (
                          <div className="flex items-center justify-between text-[10px] text-slate-600">
                            <span>Supplément urgent</span>
                            <span>{formatAmount(urgentFee, currency)}</span>
                          </div>
                        )}

                        {/* Séparateur pointillé avant le total */}
                        <div className="border-b border-dashed border-slate-300 my-1.5" />

                        {/* TOTAL en gras */}
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900 pt-0.5">
                          <span>TOTAL</span>
                          <span>{formatAmount(ord.total_amount, currency)}</span>
                        </div>

                        {/* Paiement : Wave (Payé) */}
                        <div className="text-[10px] text-slate-700">
                          Paiement : <span className="font-semibold">{paymentMethod}</span> ({paymentStatus})
                        </div>

                        {/* Livreur */}
                        {driver?.name && (
                          <div className="text-[10px] text-slate-600">
                            Livreur : {driver.name}
                          </div>
                        )}

                        {/* Pied de page thermique */}
                        <div className="text-center text-[9px] text-slate-400 pt-1.5 border-t border-dashed border-slate-200">
                          Merci pour votre confiance !
                        </div>
                      </div>

                      {/* Effet papier ticket en bas (crénelage subtil) */}
                      <div className="h-2 bg-gradient-to-b from-white to-[#FAF7F2] rounded-b-xl border-t border-dashed border-slate-200" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        </div>

        {/* Pied de page général de la modale */}
        {activeDocTab === 'invoice' ? (
          <div className="px-5 py-3 border-t border-[#E5DCD0] bg-white flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              {errorFeedback ? (
                <span className="text-red-600 font-medium">{errorFeedback}</span>
              ) : (
                <span className="text-slate-500">
                  Facture prête à être téléchargée ou imprimée au format A4.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isGeneratingPdf}
                className="px-4 py-2 rounded-xl border border-[#E5DCD0] bg-white text-xs font-semibold text-slate-700 hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:opacity-50"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={isGeneratingPdf || orders.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1B4B4A] bg-white text-[#1B4B4A] hover:bg-[#1B4B4A]/5 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Télécharger le fichier PDF de la facture"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger</span>
              </button>
              <button
                type="button"
                onClick={handlePrintInvoice}
                disabled={isGeneratingPdf || orders.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1B4B4A] hover:bg-[#153B3A] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Imprimer ou ouvrir la facture"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Génération…</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Imprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-3 border-t border-[#E5DCD0] bg-white flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              {errorFeedback ? (
                <span className="text-red-600 font-medium">{errorFeedback}</span>
              ) : (
                <span className="text-slate-500">
                  Prêt à imprimer {totalCopies} ticket{totalCopies > 1 ? 's' : ''} thermique
                  {totalCopies > 1 ? 's' : ''} (format 80 mm).
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isGeneratingPdf}
                className="px-4 py-2 rounded-xl border border-[#E5DCD0] bg-white text-xs font-semibold text-slate-700 hover:bg-[#FAF7F2] transition-colors cursor-pointer disabled:opacity-50"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handlePrintTickets}
                disabled={isGeneratingPdf || activeOrders.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1B4B4A] hover:bg-[#153B3A] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Génération du PDF…</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>
                      Imprimer ({totalCopies} copie{totalCopies > 1 ? 's' : ''})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
