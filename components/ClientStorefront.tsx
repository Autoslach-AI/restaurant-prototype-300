'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  Clock,
  Phone,
  ArrowRight,
  ShieldCheck,
  X,
  CreditCard,
  MessageCircle,
  MapPin,
  CheckCircle2,
  Truck,
  Store,
  Star,
  Navigation,
} from 'lucide-react';
import { Business, Category, Product, CartItem, PaymentMethod, Order, DeliveryZone, OrderType } from '@/lib/types';
import { getStore } from '@/lib/store';

interface ClientStorefrontProps {
  business: Business;
  categories: Category[];
  products: Product[];
  cart: CartItem[];
  deliveryZones?: DeliveryZone[];
  onAddToCart: (product: Product) => void;
  onUpdateCartQty: (productId: string, delta: number) => void;
  onClearCart: () => void;
  cartTotal: number;
  isCartOpen: boolean;
  onCloseCart: () => void;
  onOpenCart: () => void;
  onCreateOrder: (orderData: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    paymentMethod: PaymentMethod;
    orderType: OrderType;
    deliveryZoneId?: string | null;
    deliveryZoneName?: string | null;
    deliveryFee?: number;
    customerLat?: number | null;
    customerLng?: number | null;
  }) => { order: Order; clientMsg: string; merchantMsg: string };
  onSimulatePayment: (orderId: string) => void;
  onSubmitRating?: (orderId: string, rating: number, comment: string) => void;
}

export default function ClientStorefront({
  business,
  categories,
  products,
  cart,
  deliveryZones = [],
  onAddToCart,
  onUpdateCartQty,
  cartTotal,
  isCartOpen,
  onCloseCart,
  onOpenCart,
  onCreateOrder,
  onSimulatePayment,
  onSubmitRating,
}: ClientStorefrontProps) {
  const store = getStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Delivery & Pickup States
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const activeZones = deliveryZones.filter((z) => z.business_id === business.id && z.active);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    activeZones.length > 0 ? activeZones[0].id : ''
  );
  const selectedZone = activeZones.find((z) => z.id === selectedZoneId) || activeZones[0];
  const currentDeliveryFee = orderType === 'delivery' ? (selectedZone?.fee || 0) : 0;
  const grandTotal = cartTotal + currentDeliveryFee;

  // GPS Position Capture (Optional single capture)
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationCaptured, setLocationCaptured] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState('Fatou Diallo');
  const [customerPhone, setCustomerPhone] = useState('+221 77 654 32 10');
  const [deliveryAddress, setDeliveryAddress] = useState('Mermoz Pyrotechnie, Villa 14, Dakar');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');

  // Rating state for last order
  const [userRating, setUserRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [ratingSubmitted, setRatingSubmitted] = useState<boolean>(false);

  // Last created order view
  const [lastOrderResult, setLastOrderResult] = useState<{
    order: Order;
    clientMsg: string;
    merchantMsg: string;
  } | null>(null);

  // Floating Chat modal state
  const [isChatNoticeOpen, setIsChatNoticeOpen] = useState(false);

  // Filter products by business, category, search
  const businessProducts = products.filter((p) => p.business_id === business.id);
  const filteredProducts = businessProducts.filter((prod) => {
    const matchesCategory = selectedCategoryId === 'all' || prod.category_id === selectedCategoryId;
    const matchesSearch =
      searchQuery.trim() === '' ||
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCaptureLocation = () => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCustomerLat(pos.coords.latitude);
          setCustomerLng(pos.coords.longitude);
          setLocationCaptured(true);
          setIsLocating(false);
        },
        (err) => {
          console.error('Geolocation error:', err);
          setIsLocating(false);
          alert('Impossible de capturer la position GPS. Vous pouvez poursuivre avec votre adresse textuelle.');
        },
        { timeout: 8000 }
      );
    } else {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const result = onCreateOrder({
      customerName,
      customerPhone,
      deliveryAddress: orderType === 'pickup' ? 'À récupérer en magasin' : deliveryAddress,
      paymentMethod,
      orderType,
      deliveryZoneId: orderType === 'delivery' ? (selectedZone?.id || null) : null,
      deliveryZoneName: orderType === 'delivery' ? (selectedZone?.name || null) : null,
      deliveryFee: currentDeliveryFee,
      customerLat: orderType === 'delivery' ? customerLat : null,
      customerLng: orderType === 'delivery' ? customerLng : null,
    });

    setLastOrderResult(result);
    setRatingSubmitted(false);
    setRatingComment('');
    setIsCheckoutOpen(false);
    onCloseCart();
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-24 font-sans">
      {/* Business Header Banner */}
      <section className="bg-white border-b border-[#E5DCD0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-[#E5DCD0] shadow-xs bg-[#F4EFE6] shrink-0">
                <Image
                  src={business.logo_url}
                  alt={business.name}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#241F1B] tracking-tight">
                    {business.name}
                  </h1>
                  <span className="capitalize px-2 py-0.5 text-xs font-semibold rounded-md bg-[#F4EFE6] text-[#6B6259] border border-[#E5DCD0]">
                    {business.type}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-[#6B6259]">
                  <div className="flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-[#1B4B4A]" />
                    <span className="font-medium">{business.whatsapp_number}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-[#C88A2E]" />
                    <span>Ouvert aujourd&apos;hui</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Category Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8">
          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-[#B5451B] text-white shadow-xs font-extrabold'
                  : 'bg-white text-[#6B6259] hover:bg-[#F4EFE6] border border-[#E5DCD0]'
              }`}
            >
              Tous les produits
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'bg-[#B5451B] text-white shadow-xs font-extrabold'
                    : 'bg-white text-[#6B6259] hover:bg-[#F4EFE6] border border-[#E5DCD0]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6259]" />
            <input
              type="text"
              placeholder="Rechercher un plat, article..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white text-xs font-medium border border-[#E5DCD0] rounded-xl focus:outline-hidden focus:border-[#B5451B] text-[#241F1B] placeholder:text-[#6B6259] shadow-2xs"
            />
          </div>
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-[#E5DCD0]">
            <ShoppingBag className="w-12 h-12 text-[#6B6259]/50 mx-auto mb-3" />
            <h3 className="text-base font-display font-bold text-[#241F1B]">Aucun produit trouvé</h3>
            <p className="text-xs text-[#6B6259] mt-1">
              Essayez de modifier votre recherche ou sélectionnez une autre catégorie.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((i) => i.product.id === product.id);
              const qtyInCart = cartItem ? cartItem.quantity : 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-[#E5DCD0] overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Image */}
                    <div className="relative h-48 w-full bg-[#F4EFE6] overflow-hidden">
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      {!product.available ? (
                        <div className="absolute inset-0 bg-[#241F1B]/60 backdrop-blur-xs flex items-center justify-center">
                          <span className="px-3 py-1 bg-[#A63A2F] text-white font-bold text-xs rounded-full shadow-sm">
                            Non disponible
                          </span>
                        </div>
                      ) : (
                        product.stock_qty !== null && (
                          <span className="absolute top-3 right-3 px-2.5 py-1 bg-[#241F1B]/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg border border-white/20 tabular-nums">
                            Stock : {product.stock_qty}
                          </span>
                        )
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="font-display font-extrabold text-[#241F1B] text-base leading-snug">
                        {product.name}
                      </h3>
                      <p className="text-xs text-[#6B6259] mt-1.5 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  {/* Price & Add Button */}
                  <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-[#E5DCD0]/60 mt-2">
                    <div>
                      <span className="text-xs text-[#6B6259] block">Prix</span>
                      <span className="text-base font-extrabold text-[#B5451B] tabular-nums">
                        {product.price.toLocaleString('fr-FR')} {business.currency}
                      </span>
                    </div>

                    {qtyInCart > 0 ? (
                      <div className="flex items-center space-x-2 bg-[#F8EFEA] border border-[#B5451B]/30 rounded-xl p-1">
                        <button
                          onClick={() => onUpdateCartQty(product.id, -1)}
                          className="p-1 rounded-lg bg-white text-[#B5451B] hover:bg-[#F8EFEA] transition-colors shadow-2xs cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-[#B5451B] px-1 tabular-nums">
                          {qtyInCart}
                        </span>
                        <button
                          onClick={() => onAddToCart(product)}
                          className="p-1 rounded-lg bg-[#B5451B] text-white hover:bg-[#9E3B16] transition-colors shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onAddToCart(product)}
                        disabled={!product.available}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
                          product.available
                            ? 'bg-[#B5451B] text-white hover:bg-[#9E3B16]'
                            : 'bg-[#E5DCD0] text-[#6B6259] cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Sticky Cart Bar (Mobile/Desktop) */}
      {cartItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-lg bg-[#241F1B] text-white rounded-2xl shadow-xl border border-[#241F1B] p-3 px-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#B5451B] flex items-center justify-center font-bold text-sm tabular-nums">
              {cartItemCount}
            </div>
            <div>
              <span className="text-xs text-[#E5DCD0] block font-medium">Total commande</span>
              <span className="text-sm font-black text-white tabular-nums">
                {cartTotal.toLocaleString('fr-FR')} {business.currency}
              </span>
            </div>
          </div>

          <button
            onClick={onOpenCart}
            className="px-4 py-2 bg-[#B5451B] hover:bg-[#9E3B16] text-white font-extrabold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>Voir le panier</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Shopping Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseCart}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-extrabold text-slate-900">Mon Panier</h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    {cartItemCount}
                  </span>
                </div>
                <button
                  onClick={onCloseCart}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium">Votre panier est vide</p>
                  </div>
                ) : (
                  cart.map(({ product, quantity }) => (
                    <div key={product.id} className="py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="relative w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                            {product.name}
                          </h4>
                          <span className="text-xs text-slate-500 font-semibold">
                            {product.price.toLocaleString('fr-FR')} {business.currency}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => onUpdateCartQty(product.id, -1)}
                          className="p-1 bg-white rounded-lg text-slate-700 hover:bg-slate-200 shadow-2xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-900 px-1">{quantity}</span>
                        <button
                          onClick={() => onAddToCart(product)}
                          className="p-1 bg-white rounded-lg text-slate-700 hover:bg-slate-200 shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer / Total & Checkout Button */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-4">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Sous-total</span>
                      <span>
                        {cartTotal.toLocaleString('fr-FR')} {business.currency}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Frais de confirmation Assistant IA</span>
                      <span className="text-emerald-600 font-bold">Inclus (Gratuit)</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                      <span>Total à payer</span>
                      <span>
                        {cartTotal.toLocaleString('fr-FR')} {business.currency}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsCheckoutOpen(true)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <span>Commander & Valider</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Finaliser la commande</h3>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="mt-4 space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Votre nom complet
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Fatou Diallo"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Customer WhatsApp Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Numéro WhatsApp (pour confirmation & lien de paiement)
                </label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+221 77 123 45 67"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Mode de réception: Livraison vs Sur place */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Mode de réception
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderType('delivery')}
                    className={`p-3 rounded-2xl border text-left flex items-center space-x-2.5 transition-all ${
                      orderType === 'delivery'
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-extrabold text-slate-900">Livraison</span>
                      <span className="text-[10px] text-slate-500">Par nos livreurs</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('pickup')}
                    className={`p-3 rounded-2xl border text-left flex items-center space-x-2.5 transition-all ${
                      orderType === 'pickup'
                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-extrabold text-slate-900">Sur place</span>
                      <span className="text-[10px] text-slate-500">À récupérer (Gratuit)</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Livraison Options */}
              {orderType === 'delivery' ? (
                <div className="space-y-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-200">
                  {/* Zone Selection */}
                  {activeZones.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Zone de livraison (Frais fixe)
                      </label>
                      <select
                        value={selectedZoneId}
                        onChange={(e) => setSelectedZoneId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      >
                        {activeZones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} — {z.fee.toLocaleString('fr-FR')} {business.currency}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Delivery Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Adresse de livraison détaillée
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ex: Mermoz Pyrotechnie, Villa 14, près de l'école..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Optional GPS Capture */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Position GPS (Optionnel)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Capture unique via navigateur
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCaptureLocation}
                        disabled={isLocating}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all ${
                          locationCaptured
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {isLocating
                            ? 'Localisation...'
                            : locationCaptured
                            ? 'GPS capturé ✓'
                            : 'Capturer ma position'}
                        </span>
                      </button>
                    </div>
                    {locationCaptured && customerLat && customerLng && (
                      <div className="mt-2 text-[11px] text-emerald-700 font-mono bg-white p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                        <span>📍 Coordonnées : {customerLat.toFixed(4)}, {customerLng.toFixed(4)}</span>
                        <span className="text-[10px] text-emerald-600 font-sans">Sans suivi continu</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                  <p className="font-bold">📍 Récupération en magasin :</p>
                  <p className="text-[11px] mt-0.5 text-amber-700">
                    Vous présenterez votre nom ou numéro de commande lors du retrait au magasin. Aucun frais de livraison.
                  </p>
                </div>
              )}

              {/* Payment Method Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Mode de règlement préféré
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {store.getPaymentChannels(business.id).find((c) => c.id === 'wave')?.enabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wave')}
                      className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                        paymentMethod === 'wave'
                          ? 'border-cyan-500 bg-cyan-50/50 ring-2 ring-cyan-500/30'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-cyan-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                        W
                      </div>
                      <div>
                        <span className="block text-xs font-extrabold text-slate-900">Wave</span>
                        <span className="text-[10px] text-slate-500">Paiement instantané</span>
                      </div>
                    </button>
                  )}

                  {store.getPaymentChannels(business.id).find((c) => c.id === 'orange_money')?.enabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('orange_money')}
                      className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                        paymentMethod === 'orange_money'
                          ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/30'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-orange-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                        OM
                      </div>
                      <div>
                        <span className="block text-xs font-extrabold text-slate-900">Orange Money</span>
                        <span className="text-[10px] text-slate-500">Agrégateur sécurisé</span>
                      </div>
                    </button>
                  )}

                  {store.getPaymentChannels(business.id).find((c) => c.id === 'card')?.enabled && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('paydunya')}
                      className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                        paymentMethod === 'paydunya' || paymentMethod === 'cinetpay'
                          ? 'border-slate-800 bg-slate-100 ring-2 ring-slate-400/30'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                        CB
                      </div>
                      <div>
                        <span className="block text-xs font-extrabold text-slate-900">Carte bancaire</span>
                        <span className="text-[10px] text-slate-500">Paiement carte</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Articles :</span>
                  <span>{cartTotal.toLocaleString('fr-FR')} {business.currency}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Mode :</span>
                  <span className="font-semibold text-slate-800">
                    {orderType === 'delivery' ? `Livraison (${selectedZone?.name || 'Standard'})` : 'À récupérer'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Frais de livraison :</span>
                  <span className="font-semibold text-slate-800">
                    {orderType === 'delivery' && currentDeliveryFee > 0
                      ? `${currentDeliveryFee.toLocaleString('fr-FR')} ${business.currency}`
                      : 'Gratuit'}
                  </span>
                </div>
                <div className="flex justify-between font-extrabold text-slate-900 pt-1.5 border-t border-slate-200 text-sm">
                  <span>Total commande :</span>
                  <span className="text-emerald-700">
                    {grandTotal.toLocaleString('fr-FR')} {business.currency}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/20"
              >
                <span>Envoyer ma commande ({grandTotal.toLocaleString('fr-FR')} {business.currency})</span>
                <Check className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Post-Checkout Result Modal */}
      {lastOrderResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Commande transmise avec succès !</h2>
              <p className="text-xs text-slate-600 mt-1">
                Commande <span className="font-bold text-emerald-700">#{lastOrderResult.order.id}</span> enregistrée.
              </p>
            </div>

            {/* Assistant IA Notification Preview */}
            <div className="mt-5 bg-emerald-950 text-white rounded-2xl p-4 shadow-inner relative overflow-hidden text-xs">
              <div className="flex items-center space-x-2 pb-2 border-b border-emerald-800/60 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-emerald-300">Message WhatsApp envoyé par l&apos;Assistant IA :</span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-emerald-100 text-xs leading-relaxed">
                {lastOrderResult.clientMsg}
              </pre>
            </div>

            {/* Post-delivery rating feedback widget */}
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">Avis / Évaluation du client :</span>
                <span className="text-[10px] text-slate-500 font-semibold">1 à 5 étoiles</span>
              </div>

              {!ratingSubmitted ? (
                <div className="space-y-2.5">
                  <div className="flex items-center space-x-1.5 justify-center py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setUserRating(star)}
                        className="p-1 text-amber-400 hover:scale-125 transition-transform"
                        title={`${star} étoile${star > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= userRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {['Livraison rapide', 'Plat encore chaud', 'Livreur courtois', 'Retard léger'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setRatingComment((prev) => (prev ? `${prev}, ${preset}` : preset))
                        }
                        className="px-2 py-0.5 bg-white hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 transition-colors"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Remarque libre (ex: Plat délicieux!)..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (onSubmitRating && lastOrderResult) {
                        onSubmitRating(lastOrderResult.order.id, userRating, ratingComment);
                        setRatingSubmitted(true);
                      }
                    }}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs"
                  >
                    Envoyer ma note ({userRating}/5 ★)
                  </button>
                </div>
              ) : (
                <div className="text-center py-2 text-emerald-800 font-extrabold bg-emerald-50 rounded-xl border border-emerald-200">
                  Merci pour votre avis ! ({userRating}/5 ★)
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-2">
              <button
                onClick={() => {
                  onSimulatePayment(lastOrderResult.order.id);
                  setLastOrderResult(null);
                }}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all"
              >
                <CreditCard className="w-4 h-4" />
                <span>Simuler le règlement immédiat (Wave / OM)</span>
              </button>

              <button
                onClick={() => setLastOrderResult(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Fermer & Continuer mes achats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Button (Public Client Storefront) */}
      <button
        onClick={() => setIsChatNoticeOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl flex items-center space-x-2 transition-all transform hover:scale-105 active:scale-95 group border-2 border-white/20"
        title="Discuter avec l'assistant commercial"
      >
        <MessageCircle className="w-6 h-6 animate-pulse" />
        <span className="font-extrabold text-xs pr-1 hidden sm:inline">Besoin d&apos;aide ?</span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 absolute top-1 right-1 border border-white" />
      </button>

      {/* Chat Notice Modal ("Connectez-vous pour discuter") */}
      {isChatNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsChatNoticeOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <MessageCircle className="w-8 h-8 text-emerald-600" />
            </div>

            <h3 className="text-lg font-black text-slate-900">Connectez-vous pour discuter</h3>
            
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Le service de discussion en direct et l&apos;assistant WhatsApp personnalisé seront bientôt accessibles.
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-left text-xs text-slate-500 space-y-1">
              <span className="font-bold text-slate-800 block">📞 Vous préférez commander par téléphone ?</span>
              <p>Contactez directement le commerce au <strong className="text-emerald-700 font-mono">{business.whatsapp_number}</strong></p>
            </div>

            <button
              onClick={() => setIsChatNoticeOpen(false)}
              className="w-full mt-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all"
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
