'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { getStore, AppStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import ClientStorefront from '@/components/ClientStorefront';
import MerchantDashboard from '@/components/MerchantDashboard';
import WhatsAppSimulator from '@/components/WhatsAppSimulator';
import PaymentModal from '@/components/PaymentModal';
import { Order, PaymentMethod, OrderStatus } from '@/lib/types';

export default function HomePage() {
  const [store] = useState<AppStore>(() => getStore());

  // Subscribe to store updates using React 19 pattern
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, [store]);

  const activeBusiness = store.getActiveBusiness();
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

  const handleCreateOrder = (data: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    paymentMethod: PaymentMethod;
  }) => {
    const result = store.createOrder(data);
    setIsWhatsAppOpen(true); // Open WhatsApp simulator so user can see agent confirmation!
    return result;
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

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    store.updateOrderStatus(orderId, status);
  };

  const handleTriggerRelance = (orderId: string) => {
    const success = store.triggerRelance(orderId, true);
    if (success) {
      setIsWhatsAppOpen(true);
    }
  };

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
          onSaveProduct={(p) => store.saveProduct(p)}
          onDeleteProduct={(id) => store.deleteProduct(id)}
          onSaveCategory={(name, id) => store.saveCategory(name, id)}
          onDeleteCategory={(id) => store.deleteCategory(id)}
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
