'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
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
  insertOrder,
  updateOrderStatus,
  cancelOrder,
} from '@/lib/supabase';

export default function HomePage() {
  const [store] = useState<AppStore>(() => getStore());
  const [mounted, setMounted] = useState(false);

  // Subscribe to store updates using React 19 pattern
  const [, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = store.subscribe(() => {
      setTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, [store]);

  const activeBusiness = store.getActiveBusiness();

  // Load staff, categories and products from Supabase on mount and whenever active business changes
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!activeBusiness?.id) return;

      // 1. Staff
      store.setStaffLoading(true);
      fetchStaffForBusiness(activeBusiness.id).then((staffList) => {
        if (!isMounted) return;
        store.setStaffList(staffList);
      });

      // 2. Categories
      store.setCategoriesLoading(true);
      fetchCategoriesForBusiness(activeBusiness.id).then((categoriesList) => {
        if (!isMounted) return;
        store.setCategoriesList(categoriesList);
      });

      // 3. Products
      store.setProductsLoading(true);
      fetchProductsForBusiness(activeBusiness.id).then((productsList) => {
        if (!isMounted) return;
        store.setProductsList(productsList);
      });

      // 4. Customers
      store.setCustomersLoading(true);
      fetchCustomersForBusiness(activeBusiness.id).then((customersList) => {
        if (!isMounted) return;
        store.setCustomersList(customersList);
      });

      // 5. Orders
      fetchOrdersForBusiness(activeBusiness.id).then((ordersList) => {
        if (!isMounted) return;
        if (ordersList && ordersList.length > 0) {
          store.orders = ordersList;
          store.notify();
        }
      });
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeBusiness?.id, store]);
  const businesses = store.businesses;
  const categories = store.categories;
  const products = store.products;
  const orders = store.orders;
  const agentEvents = store.agentEvents;
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

    // 1. Trouver ou préparer le client
    let customer = store.customers.find(
      (c) => c.business_id === activeBusiness.id && c.phone === data.customerPhone
    );
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}`,
        business_id: activeBusiness.id,
        name: data.customerName,
        phone: data.customerPhone,
        whatsapp_id: data.customerPhone.replace(/[^0-9]/g, ''),
        created_at: new Date().toISOString(),
      };
      store.customers.push(customer);
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
    const existingIdx = store.orders.findIndex((o) => o.id === createdOrder.id);
    if (existingIdx > -1) {
      store.orders[existingIdx] = createdOrder;
    } else {
      store.orders.unshift(createdOrder);
    }

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

    store.cart = [];
    store.notify();

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
        onResetData={() => store.resetStore()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
          onUpdateOrderStatus={handleUpdateOrderStatus}
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
    </div>
  );
}
