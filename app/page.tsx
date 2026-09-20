'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';
import { getStore, AppStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import ClientStorefront from '@/components/ClientStorefront';
import MerchantDashboard from '@/components/MerchantDashboard';
import WhatsAppSimulator from '@/components/WhatsAppSimulator';
import PaymentModal from '@/components/PaymentModal';
import { Order, PaymentMethod, OrderStatus } from '@/lib/types';
import {
  fetchStaffForBusiness,
  fetchCategoriesForBusiness,
  fetchProductsForBusiness,
  fetchCustomersForBusiness,
  fetchOrdersForBusiness,
  insertCategory,
  updateCategory,
  deleteCategory,
  insertProduct,
  updateProduct,
  deleteProduct,
  insertCustomer,
  insertOrder,
  updateOrderStatus,
  cancelOrder,
} from '@/lib/supabase';

const emptySubscribe = () => () => {};

export default function HomePage() {
  const store = getStore();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Subscribe to store updates using React 19 pattern
  const [, setTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, [store]);

  const activeBusiness = store.getActiveBusiness();
  const prevEffectDepsRef = useRef<{ activeBusinessId?: string; store?: AppStore; isFirstRun: boolean }>({
    activeBusinessId: undefined,
    store: undefined,
    isFirstRun: true,
  });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const refreshAllData = useCallback(async () => {
    console.log('[DEBUG_REFRESH] refreshAllData called', { activeBusinessId: activeBusiness?.id });
    if (!activeBusiness?.id) {
      console.warn('[DEBUG_REFRESH] activeBusiness.id is missing, aborting refresh');
      return;
    }

    setIsRefreshing(true);

    try {
      // 1. Staff
      store.setStaffLoading(true);
      const fetchCallId = Math.random().toString(36).slice(2, 8);
      console.log('[DEBUG_REFRESH] calling fetchStaffForBusiness', { businessId: activeBusiness.id, fetchCallId, timestamp: Date.now() });
      const staffPromise = fetchStaffForBusiness(activeBusiness.id)
        .then((staffList) => {
          console.log('[DEBUG_STAFF_CALL] fetch END', { fetchCallId, timestamp: Date.now(), count: staffList?.length });
          if (!isMountedRef.current) return;
          store.setStaffList(staffList);
        })
        .catch((err) => {
          console.error('[DEBUG_REFRESH] fetchStaffForBusiness ERROR:', err);
        });

      // 2. Categories
      store.setCategoriesLoading(true);
      console.log('[DEBUG_REFRESH] calling fetchCategoriesForBusiness', { businessId: activeBusiness.id });
      const categoriesPromise = fetchCategoriesForBusiness(activeBusiness.id)
        .then((categoriesList) => {
          if (!isMountedRef.current) return;
          store.setCategoriesList(categoriesList);
        })
        .catch((err) => {
          console.error('[DEBUG_REFRESH] fetchCategoriesForBusiness ERROR:', err);
        });

      // 3. Products
      store.setProductsLoading(true);
      console.log('[DEBUG_REFRESH] calling fetchProductsForBusiness', { businessId: activeBusiness.id });
      const productsPromise = fetchProductsForBusiness(activeBusiness.id)
        .then((productsList) => {
          if (!isMountedRef.current) return;
          store.setProductsList(productsList);
        })
        .catch((err) => {
          console.error('[DEBUG_REFRESH] fetchProductsForBusiness ERROR:', err);
        });

      // 4. Customers
      if (typeof store.setCustomersLoading === 'function') {
        store.setCustomersLoading(true);
      }
      console.log('[DEBUG_REFRESH] calling fetchCustomersForBusiness', { businessId: activeBusiness.id });
      const customersPromise = fetchCustomersForBusiness(activeBusiness.id)
        .then((customersList) => {
          console.log('[DEBUG_EFFECT] fetchCustomersForBusiness Supabase response received:', {
            businessId: activeBusiness.id,
            customersCountReceived: customersList ? customersList.length : 0,
            customersList,
            storeCustomersBeforeUpdate: store.customers?.length,
          });
          if (!isMountedRef.current) return;
          if (typeof store.setCustomersList === 'function') {
            store.setCustomersList(customersList || []);
          } else {
            store.customers = customersList || [];
            store.notify();
          }
        })
        .catch((err) => {
          console.error('[DEBUG_REFRESH] fetchCustomersForBusiness ERROR:', err);
        });

      // 5. Orders
      console.log('[DEBUG_REFRESH] calling fetchOrdersForBusiness', { businessId: activeBusiness.id });
      const ordersPromise = fetchOrdersForBusiness(activeBusiness.id)
        .then((ordersList) => {
          if (!isMountedRef.current) return;
          if (ordersList && ordersList.length > 0) {
            store.orders = ordersList;
            store.notify();
          }
        })
        .catch((err) => {
          console.error('[DEBUG_REFRESH] fetchOrdersForBusiness ERROR:', err);
        });

      await Promise.all([staffPromise, categoriesPromise, productsPromise, customersPromise, ordersPromise]);

      if (isMountedRef.current) {
        setShowRefreshToast(true);
        if (toastTimerRef.current) {
          clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setShowRefreshToast(false);
          }
        }, 2000);
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [activeBusiness?.id, store]);

  // Load staff, categories and products from Supabase on mount and whenever active business changes
  useEffect(() => {
    const isFirstRun = prevEffectDepsRef.current.isFirstRun;
    const prevBizId = prevEffectDepsRef.current.activeBusinessId;
    const prevStoreRef = prevEffectDepsRef.current.store;
    const bizChanged = prevBizId !== activeBusiness?.id;
    const storeChanged = prevStoreRef !== store;

    console.log('[DEBUG_EFFECT] useEffect(loadData) TRIGGERED:', {
      reason: isFirstRun ? 'initial_mount' : (bizChanged ? 'activeBusiness_id_changed' : (storeChanged ? 'store_ref_changed' : 'unknown')),
      isFirstRun,
      prevActiveBusinessId: prevBizId,
      currentActiveBusinessId: activeBusiness?.id,
      storeReferenceChanged: storeChanged,
      storeCustomersCountBeforeFetch: store.customers?.length,
    });

    prevEffectDepsRef.current = {
      activeBusinessId: activeBusiness?.id,
      store,
      isFirstRun: false,
    };

    refreshAllData();
  }, [activeBusiness?.id, store, refreshAllData]);
  const businesses = store.businesses;
  const categories = store.categories;
  const products = store.products;
  const orders = store.orders;
  const agentEvents = store.agentEvents;
  const customers = store.customers;
  const isCustomersLoading = store.customersLoading;
  const cart = store.cart;
  const waMessages = store.waMessages;

  // View state
  const [viewMode, setViewMode] = useState<'client' | 'merchant'>('client');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(true); // Open simulator by default so user sees messages immediately!
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Check URL params for direct payment link click
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const payOrderId = params.get('pay_order');
      if (payOrderId) {
        const orderToPay = store.orders.find((o) => o.id === payOrderId);
        if (orderToPay) {
          setTimeout(() => setPaymentModalOrder(orderToPay), 0);
        }
      }
    }
  }, [store.orders]);

  const handleSelectBusiness = (bizId: string) => {
    store.setActiveBusiness(bizId);
  };

  const handleAddToCart = (product: any) => {
    store.addToCart(product, 1);
  };

  const handleUpdateCartQty = (productId: string, delta: number) => {
    const existing = cart.find((i) => i.product.id === productId);
    if (!existing) return;
    store.updateCartQuantity(productId, existing.quantity + delta);
  };

  const handleCreateOrder = async (data: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    paymentMethod: PaymentMethod;
    orderType?: any;
    deliveryZoneId?: string | null;
    deliveryZoneName?: string | null;
    deliveryFee?: number;
    customerLat?: number | null;
    customerLng?: number | null;
  }) => {
    const cartItemsTotal = store.getCartTotal();
    const isDelivery = (data.orderType || 'delivery') === 'delivery';
    const deliveryFee = isDelivery ? Number(data.deliveryFee || 0) : 0;
    const totalAmount = cartItemsTotal + deliveryFee;

    // 1. Trouver ou créer le client
    let customer = store.customers.find(
      (c) => c.business_id === activeBusiness.id && c.phone === data.customerPhone
    );
    if (!customer) {
      const custRes = await insertCustomer({
        business_id: activeBusiness.id,
        name: data.customerName,
        phone: data.customerPhone,
        whatsapp_id: data.customerPhone.replace(/[^0-9]/g, ''),
        channel_preference: 'whatsapp',
      });

      if (!custRes.success || !custRes.customer) {
        console.error('Erreur lors de la création du client:', custRes.error);
        alert(`Erreur lors de la création du client : ${custRes.error || 'Échec de la base de données'}`);
        return {
          order: null as any,
          clientMsg: '',
          merchantMsg: '',
        };
      }

      customer = custRes.customer;
      if (!store.customers.some((c) => c.id === customer!.id)) {
        store.customers.push(customer);
      }
    }

    const orderItems = store.cart.map((cartItem) => ({
      product_id: cartItem.product.id,
      product_name: cartItem.product.name,
      quantity: cartItem.quantity,
      unit_price: cartItem.product.price,
    }));

    // 2. Appel asynchrone à insertOrder (Supabase en premier)
    const res = await insertOrder({
      business_id: activeBusiness.id,
      customer_id: customer.id,
      total_amount: totalAmount,
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: data.paymentMethod,
      payment_reference: `${(data.paymentMethod || 'WAVE').toUpperCase()}_PAY_${Math.floor(100000 + Math.random() * 900000)}`,
      order_type: data.orderType || 'delivery',
      delivery_address: data.deliveryAddress,
      delivery_zone_id: isDelivery ? data.deliveryZoneId || null : null,
      delivery_zone_name: isDelivery ? data.deliveryZoneName || null : null,
      delivery_fee: deliveryFee,
      customer_lat: data.customerLat !== undefined ? data.customerLat : null,
      customer_lng: data.customerLng !== undefined ? data.customerLng : null,
      items: orderItems,
    });

    if (!res.success || !res.order) {
      console.error('Erreur lors de la création de la commande:', res.error);
      alert(`Erreur lors de la création de la commande : ${res.error || 'Échec de la base de données'}`);
      return {
        order: null as any,
        clientMsg: '',
        merchantMsg: '',
      };
    }

    const createdOrder: Order = {
      ...res.order,
      customer_name: customer.name,
      customer_phone: customer.phone,
      delivery_address: data.deliveryAddress,
    };

    // 3. Mise à jour du store local & déduction du stock
    store.upsertOrder(createdOrder);

    for (const item of store.cart) {
      const prod = store.products.find((p) => p.id === item.product.id);
      if (prod && prod.stock_qty !== null && prod.stock_qty >= item.quantity) {
        prod.stock_qty -= item.quantity;
      }
    }

    // 4. Déclenchement du flux WhatsApp et vidage du panier
    const { processNewOrderTrigger } = await import('@/lib/agent-engine');
    const { customerEvent, merchantEvent } = processNewOrderTrigger(createdOrder, activeBusiness);

    store.agentEvents.unshift(customerEvent, merchantEvent);
    store.waMessages.unshift(
      {
        id: `wa_${customerEvent.id}`,
        business_id: activeBusiness.id,
        order_id: createdOrder.id,
        sender: 'agent',
        recipient_phone: customer.phone,
        text: customerEvent.payload.message,
        timestamp: customerEvent.created_at,
        channel: 'client',
        status: 'delivered',
      },
      {
        id: `wa_${merchantEvent.id}`,
        business_id: activeBusiness.id,
        order_id: createdOrder.id,
        sender: 'agent',
        recipient_phone: activeBusiness.whatsapp_number,
        text: merchantEvent.payload.message,
        timestamp: merchantEvent.created_at,
        channel: 'merchant',
        status: 'delivered',
      }
    );

    store.clearCart();

    // Ouvrir le simulateur WhatsApp uniquement en cas de succès
    setIsWhatsAppOpen(true);

    return {
      order: createdOrder,
      clientMsg: customerEvent.payload.message,
      merchantMsg: merchantEvent.payload.message,
    };
  };

  const handleSimulatePayment = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (targetOrder) {
      setPaymentModalOrder(targetOrder);
    }
  };

  const handleConfirmPayment = (orderId: string, reference: string, method: PaymentMethod) => {
    store.processPayment(orderId, reference, method);
    setPaymentModalOrder(null);
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const res = await updateOrderStatus(orderId, status);
    if (!res.success) {
      console.error('Erreur Supabase updateOrderStatus:', res.error);
      alert(`Erreur lors de la mise à jour du statut de la commande : ${res.error || 'Échec Supabase'}`);
    }
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    const res = await cancelOrder(orderId, reason);
    if (!res.success) {
      console.error('Erreur Supabase cancelOrder:', res.error);
      alert(`Erreur lors de l'annulation de la commande : ${res.error || 'Échec Supabase'}`);
    }
  };

  const handleTriggerRelance = (orderId: string) => {
    const success = store.triggerRelance(orderId, true);
    if (success) {
      setIsWhatsAppOpen(true);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] font-sans antialiased text-[var(--color-text)] selection:bg-[var(--color-accent-primary)] selection:text-white">
      {/* Global Navbar */}
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeBusiness={activeBusiness}
        businesses={businesses}
        onSelectBusiness={handleSelectBusiness}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        onToggleWhatsAppSim={() => setIsWhatsAppOpen(!isWhatsAppOpen)}
        isWhatsAppOpen={isWhatsAppOpen}
        onResetData={() => {
          console.log('[DEBUG_REFRESH_CLICK] Navbar onResetData button clicked');
          refreshAllData();
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isRefreshing={isRefreshing}
      />

      {/* Main View Mode */}
      {viewMode === 'client' ? (
        <ClientStorefront
          business={activeBusiness}
          categories={categories}
          products={products}
          cart={cart}
          deliveryZones={store.getDeliveryZones(activeBusiness.id)}
          onAddToCart={handleAddToCart}
          onUpdateCartQty={handleUpdateCartQty}
          onClearCart={() => store.clearCart()}
          cartTotal={store.getCartTotal()}
          isCartOpen={isCartOpen}
          onCloseCart={() => setIsCartOpen(false)}
          onOpenCart={() => setIsCartOpen(true)}
          onCreateOrder={handleCreateOrder}
          onSimulatePayment={handleSimulatePayment}
          onSubmitRating={(orderId, rating, comment) => store.submitCustomerRating(orderId, rating, comment)}
        />
      ) : (
        <MerchantDashboard
          business={activeBusiness}
          categories={categories}
          products={products}
          orders={orders}
          agentEvents={agentEvents}
          customers={customers}
          isCustomersLoading={isCustomersLoading}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onCancelOrder={handleCancelOrder}
          onProcessPayment={(orderId, ref) => store.processPayment(orderId, ref)}
          onTriggerRelance={handleTriggerRelance}
          onSaveProduct={async (p) => {
            if (p.id) {
              const res = await updateProduct(p.id, {
                name: p.name,
                price: p.price,
                category_id: p.category_id,
                description: p.description,
                image_url: p.image_url,
                available: p.available,
                stock_qty: p.stock_qty,
              });
              if (!res.success) {
                alert(`Erreur lors de la modification du produit : ${res.error || 'Échec Supabase'}`);
              }
            } else {
              const res = await insertProduct({
                business_id: activeBusiness.id,
                category_id: p.category_id,
                name: p.name,
                price: p.price,
                description: p.description,
                image_url: p.image_url,
                available: p.available,
                stock_qty: p.stock_qty,
              });
              if (!res.success) {
                alert(`Erreur lors de la création du produit : ${res.error || 'Échec Supabase'}`);
              }
            }
          }}
          onDeleteProduct={async (id) => {
            const res = await deleteProduct(id);
            if (!res.success) {
              alert(`Erreur lors de la suppression du produit : ${res.error || 'Échec Supabase'}`);
            }
          }}
          onSaveCategory={async (name, id) => {
            if (id) {
              const res = await updateCategory(id, { name });
              if (!res.success) {
                alert(`Erreur lors de la modification de la catégorie : ${res.error || 'Échec Supabase'}`);
              }
            } else {
              const res = await insertCategory({
                business_id: activeBusiness.id,
                name,
              });
              if (!res.success) {
                alert(`Erreur lors de la création de la catégorie : ${res.error || 'Échec Supabase'}`);
              }
            }
          }}
          onDeleteCategory={async (id) => {
            const res = await deleteCategory(id);
            if (!res.success) {
              alert(`Erreur lors de la suppression de la catégorie : ${res.error || 'Échec Supabase'}`);
            }
          }}
          onUpdateConfig={(config, details) => store.updateBusinessConfig(activeBusiness.id, config, details)}
          onToggleWhatsAppSim={() => setIsWhatsAppOpen(!isWhatsAppOpen)}
        />
      )}

      {/* Floating Interactive WhatsApp Simulator Widget */}
      <WhatsAppSimulator
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        messages={waMessages}
        business={activeBusiness}
        onSimulatePayment={handleSimulatePayment}
      />

      {/* Payment Aggregator Modal Simulation */}
      {paymentModalOrder && (
        <PaymentModal
          order={paymentModalOrder}
          business={
            businesses.find((b) => b.id === paymentModalOrder.business_id) || activeBusiness
          }
          onClose={() => setPaymentModalOrder(null)}
          onConfirmPayment={handleConfirmPayment}
        />
      )}

      {/* Discreet Refresh Success Toast */}
      {showRefreshToast && (
        <div
          id="refresh-success-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#241F1B] text-[#FAF7F2] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium border border-[#3D352E] transition-all"
        >
          <Check className="w-4 h-4 text-[#C88A2E]" />
          <span>Données actualisées</span>
        </div>
      )}
    </div>
  );
}
