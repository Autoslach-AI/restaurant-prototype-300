'use client';

import {
  Business,
  Category,
  Product,
  Customer,
  Order,
  AgentEvent,
  CartItem,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  Staff,
  StaffPermissions,
  StaffRole,
  DeliveryZone,
  OrderType,
  PaymentChannel,
  PaymentChannelId,
  PaymentGatewayConfig,
  PaymentGatewayProvider,
  AgentProject,
  AgentConversation,
  AgentChatMessage,
  AgentChatMessageAttachment,
  AttendanceRecord,
  AttendanceStatus,
} from './types';
import {
  INITIAL_BUSINESSES,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS,
  INITIAL_AGENT_EVENTS,
  INITIAL_STAFF,
  INITIAL_DELIVERY_ZONES,
  INITIAL_PAYMENT_CHANNELS,
  INITIAL_PAYMENT_GATEWAYS,
} from './initial-data';
import {
  processNewOrderTrigger,
  checkOrderRelance,
  triggerPostDeliveryFollowUp,
} from './agent-engine';

export interface WhatsAppMessage {
  id: string;
  business_id: string;
  order_id?: string;
  sender: 'system' | 'agent' | 'customer' | 'merchant';
  recipient_phone: string;
  text: string;
  timestamp: string;
  channel: 'client' | 'merchant';
  status?: 'sent' | 'delivered' | 'read';
}

const STORAGE_KEYS = {
  BUSINESSES: 'cwa_businesses',
  ACTIVE_BIZ: 'cwa_active_biz',
  CATEGORIES: 'cwa_categories',
  PRODUCTS: 'cwa_products',
  CUSTOMERS: 'cwa_customers',
  ORDERS: 'cwa_orders',
  EVENTS: 'cwa_agent_events',
  WA_MSGS: 'cwa_wa_messages',
  STAFF: 'cwa_staff',
  ACTIVE_STAFF: 'cwa_active_staff',
  DELIVERY_ZONES: 'cwa_delivery_zones',
  PAYMENT_CHANNELS: 'cwa_payment_channels',
  PAYMENT_GATEWAY: 'cwa_payment_gateway',
  AGENT_PROJECTS: 'cwa_agent_projects',
  AGENT_CONVERSATIONS: 'cwa_agent_conversations',
  AGENT_MESSAGES: 'cwa_agent_messages',
  ATTENDANCE: 'cwa_attendance',
};

// Helper to load or initialize local storage
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('Error loading storage', key, e);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving storage', key, e);
  }
}

export class AppStore {
  businesses: Business[];
  activeBusinessId: string;
  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  agentEvents: AgentEvent[];
  cart: CartItem[];
  waMessages: WhatsAppMessage[];
  staff: Staff[];
  activeStaffId: string;
  deliveryZones: DeliveryZone[];
  paymentChannels: PaymentChannel[];
  paymentGateways: PaymentGatewayConfig[];
  agentProjects: AgentProject[];
  agentConversations: AgentConversation[];
  agentMessages: AgentChatMessage[];
  attendanceRecords: AttendanceRecord[];
  listeners: Array<() => void> = [];

  constructor() {
    this.businesses = loadFromStorage(STORAGE_KEYS.BUSINESSES, INITIAL_BUSINESSES);
    this.activeBusinessId = loadFromStorage(STORAGE_KEYS.ACTIVE_BIZ, INITIAL_BUSINESSES[0].id);
    this.categories = loadFromStorage(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    this.products = loadFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    this.customers = loadFromStorage(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    this.orders = loadFromStorage(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    this.agentEvents = loadFromStorage(STORAGE_KEYS.EVENTS, INITIAL_AGENT_EVENTS);
    this.cart = [];
    this.waMessages = loadFromStorage(STORAGE_KEYS.WA_MSGS, this.generateInitialWaMessages());
    const storedStaff = loadFromStorage<Staff[]>(STORAGE_KEYS.STAFF, INITIAL_STAFF);
    INITIAL_STAFF.forEach((initS) => {
      if (!storedStaff.some((s) => s.id === initS.id)) {
        storedStaff.push(initS);
      }
    });
    this.staff = storedStaff;
    saveToStorage(STORAGE_KEYS.STAFF, this.staff);
    this.activeStaffId = INITIAL_STAFF[0].id; // Ensure active staff session defaults to owner (Amadou Diop)
    saveToStorage(STORAGE_KEYS.ACTIVE_STAFF, this.activeStaffId);
    this.deliveryZones = loadFromStorage(STORAGE_KEYS.DELIVERY_ZONES, INITIAL_DELIVERY_ZONES);
    this.paymentChannels = loadFromStorage(STORAGE_KEYS.PAYMENT_CHANNELS, INITIAL_PAYMENT_CHANNELS);
    this.paymentGateways = loadFromStorage(STORAGE_KEYS.PAYMENT_GATEWAY, INITIAL_PAYMENT_GATEWAYS);
    this.agentProjects = loadFromStorage(STORAGE_KEYS.AGENT_PROJECTS, [
      { id: 'proj_1', business_id: this.activeBusinessId, name: 'Expansion Vente', created_at: new Date().toISOString() },
    ]);
    this.agentConversations = loadFromStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, []);
    this.agentMessages = loadFromStorage(STORAGE_KEYS.AGENT_MESSAGES, []);
    this.attendanceRecords = loadFromStorage(STORAGE_KEYS.ATTENDANCE, []);
  }

  private generateInitialWaMessages(): WhatsAppMessage[] {
    const initialMsgs: WhatsAppMessage[] = [];
    for (const evt of INITIAL_AGENT_EVENTS) {
      initialMsgs.push({
        id: `wa_${evt.id}`,
        business_id: evt.business_id,
        order_id: evt.order_id || undefined,
        sender: 'agent',
        recipient_phone: evt.payload.recipient_phone,
        text: evt.payload.message,
        timestamp: evt.created_at,
        channel: evt.payload.channel === 'whatsapp_merchant' ? 'merchant' : 'client',
        status: 'read',
      });
    }
    return initialMsgs;
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    saveToStorage(STORAGE_KEYS.BUSINESSES, this.businesses);
    saveToStorage(STORAGE_KEYS.ACTIVE_BIZ, this.activeBusinessId);
    saveToStorage(STORAGE_KEYS.CATEGORIES, this.categories);
    saveToStorage(STORAGE_KEYS.PRODUCTS, this.products);
    saveToStorage(STORAGE_KEYS.CUSTOMERS, this.customers);
    saveToStorage(STORAGE_KEYS.ORDERS, this.orders);
    saveToStorage(STORAGE_KEYS.EVENTS, this.agentEvents);
    saveToStorage(STORAGE_KEYS.WA_MSGS, this.waMessages);
    saveToStorage(STORAGE_KEYS.STAFF, this.staff);
    saveToStorage(STORAGE_KEYS.ACTIVE_STAFF, this.activeStaffId);
    saveToStorage(STORAGE_KEYS.DELIVERY_ZONES, this.deliveryZones);
    saveToStorage(STORAGE_KEYS.PAYMENT_CHANNELS, this.paymentChannels);
    saveToStorage(STORAGE_KEYS.PAYMENT_GATEWAY, this.paymentGateways);

    this.listeners.forEach((listener) => listener());
  }

  // Get current active business
  getActiveBusiness(): Business {
    const biz = this.businesses.find((b) => b.id === this.activeBusinessId);
    return biz || this.businesses[0];
  }

  setActiveBusiness(businessId: string) {
    this.activeBusinessId = businessId;
    this.cart = []; // clear cart on business change
    this.notify();
  }

  // Cart operations
  addToCart(product: Product, quantity: number = 1) {
    const existingIndex = this.cart.findIndex((item) => item.product.id === product.id);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({ product, quantity });
    }
    this.notify();
  }

  updateCartQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      this.cart = this.cart.filter((item) => item.product.id !== productId);
    } else {
      const item = this.cart.find((i) => i.product.id === productId);
      if (item) item.quantity = quantity;
    }
    this.notify();
  }

  clearCart() {
    this.cart = [];
    this.notify();
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  // Create new order (Section 3 rule 1 & Section 13 delivery)
  createOrder(orderData: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    paymentMethod: PaymentMethod;
    orderType?: OrderType;
    deliveryZoneId?: string | null;
    deliveryZoneName?: string | null;
    deliveryFee?: number;
    customerLat?: number | null;
    customerLng?: number | null;
  }): { order: Order; clientMsg: string; merchantMsg: string } {
    const activeBiz = this.getActiveBusiness();
    const cartItemsTotal = this.getCartTotal();
    const isDelivery = (orderData.orderType || 'delivery') === 'delivery';
    const deliveryFee = isDelivery ? Number(orderData.deliveryFee || 0) : 0;
    const totalAmount = cartItemsTotal + deliveryFee;

    // Find or create customer
    let customer = this.customers.find(
      (c) => c.business_id === activeBiz.id && c.phone === orderData.customerPhone
    );
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}`,
        business_id: activeBiz.id,
        name: orderData.customerName,
        phone: orderData.customerPhone,
        whatsapp_id: orderData.customerPhone.replace(/[^0-9]/g, ''),
        created_at: new Date().toISOString(),
      };
      this.customers.push(customer);
    }

    const orderId = `ord_${Math.floor(1000 + Math.random() * 9000)}`;

    const orderItems = this.cart.map((cartItem, idx) => ({
      id: `item_${orderId}_${idx + 1}`,
      order_id: orderId,
      product_id: cartItem.product.id,
      product_name: cartItem.product.name,
      quantity: cartItem.quantity,
      unit_price: cartItem.product.price,
    }));

    const newOrder: Order = {
      id: orderId,
      business_id: activeBiz.id,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      delivery_address: orderData.deliveryAddress,
      order_type: orderData.orderType || 'delivery',
      delivery_zone_id: isDelivery ? orderData.deliveryZoneId || null : null,
      delivery_zone_name: isDelivery ? orderData.deliveryZoneName || null : null,
      delivery_fee: deliveryFee,
      customer_lat: orderData.customerLat !== undefined ? orderData.customerLat : null,
      customer_lng: orderData.customerLng !== undefined ? orderData.customerLng : null,
      status: 'confirmed',
      total_amount: totalAmount,
      payment_status: 'paid',
      payment_method: orderData.paymentMethod,
      payment_reference: `${(orderData.paymentMethod || 'WAVE').toUpperCase()}_PAY_${Math.floor(100000 + Math.random() * 900000)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: orderItems,
      relance_count: 0,
    };

    // Deduct stock if tracked
    for (const item of this.cart) {
      const prod = this.products.find((p) => p.id === item.product.id);
      if (prod && prod.stock_qty !== null && prod.stock_qty >= item.quantity) {
        prod.stock_qty -= item.quantity;
      }
    }

    this.orders.unshift(newOrder);

    // Trigger Agent Workflow (Rule 1)
    const { customerEvent, merchantEvent } = processNewOrderTrigger(newOrder, activeBiz);

    this.agentEvents.unshift(customerEvent, merchantEvent);

    // Push into simulated WhatsApp message stream
    const waClientMsg: WhatsAppMessage = {
      id: `wa_${customerEvent.id}`,
      business_id: activeBiz.id,
      order_id: newOrder.id,
      sender: 'agent',
      recipient_phone: customer.phone,
      text: customerEvent.payload.message,
      timestamp: customerEvent.created_at,
      channel: 'client',
      status: 'delivered',
    };

    const waMerchantMsg: WhatsAppMessage = {
      id: `wa_${merchantEvent.id}`,
      business_id: activeBiz.id,
      order_id: newOrder.id,
      sender: 'agent',
      recipient_phone: activeBiz.whatsapp_number,
      text: merchantEvent.payload.message,
      timestamp: merchantEvent.created_at,
      channel: 'merchant',
      status: 'delivered',
    };

    this.waMessages.unshift(waClientMsg, waMerchantMsg);

    // Clear cart
    this.cart = [];

    this.notify();

    return {
      order: newOrder,
      clientMsg: customerEvent.payload.message,
      merchantMsg: merchantEvent.payload.message,
    };
  }

  // Update order status & trigger post-delivery follow-up if applicable
  updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return;

    order.status = status;
    order.updated_at = new Date().toISOString();

    const activeBiz = this.businesses.find((b) => b.id === order.business_id) || this.getActiveBusiness();

    // Trigger 4: Post delivery follow-up
    if (status === 'delivered') {
      const followUpEvent = triggerPostDeliveryFollowUp(order, activeBiz);
      this.agentEvents.unshift(followUpEvent);

      this.waMessages.unshift({
        id: `wa_${followUpEvent.id}`,
        business_id: activeBiz.id,
        order_id: order.id,
        sender: 'agent',
        recipient_phone: order.customer_phone || '',
        text: followUpEvent.payload.message,
        timestamp: followUpEvent.created_at,
        channel: 'client',
        status: 'delivered',
      });
    }

    this.notify();
  }

  // Process payment webhook / simulated aggregator callback (Section 3 Rule 2)
  processPayment(orderId: string, paymentReference: string, paymentMethod?: PaymentMethod): boolean {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return false;

    order.payment_status = 'paid';
    order.payment_reference = paymentReference;
    if (paymentMethod) order.payment_method = paymentMethod;
    if (order.status === 'pending') {
      order.status = 'confirmed';
    }
    order.updated_at = new Date().toISOString();

    const biz = this.businesses.find((b) => b.id === order.business_id) || this.getActiveBusiness();

    const confirmPaymentMsg = `✅ *PAIEMENT CONFIRMÉ (${order.payment_method.toUpperCase()})*\n` +
      `Merci ${order.customer_name} ! Nous avons bien reçu le paiement de ${order.total_amount.toLocaleString()} ${biz.currency} pour la commande #${order.id}.\n` +
      `Réf transaction : ${paymentReference}\n` +
      `Votre commande est transmise en cuisine / préparation !`;

    const payEvent: AgentEvent = {
      id: `evt_pay_${Date.now()}`,
      business_id: biz.id,
      order_id: order.id,
      event_type: 'order_confirmed',
      payload: {
        recipient_name: order.customer_name || 'Client',
        recipient_phone: order.customer_phone || '',
        channel: 'whatsapp_client',
        message: confirmPaymentMsg,
      },
      created_at: new Date().toISOString(),
    };

    this.agentEvents.unshift(payEvent);

    this.waMessages.unshift({
      id: `wa_${payEvent.id}`,
      business_id: biz.id,
      order_id: order.id,
      sender: 'agent',
      recipient_phone: order.customer_phone || '',
      text: confirmPaymentMsg,
      timestamp: payEvent.created_at,
      channel: 'client',
      status: 'read',
    });

    this.notify();
    return true;
  }

  // Trigger relance for order (Section 3 Rule 3)
  triggerRelance(orderId: string, force: boolean = true): boolean {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return false;

    const biz = this.businesses.find((b) => b.id === order.business_id) || this.getActiveBusiness();

    const relanceEvent = checkOrderRelance(order, biz, force);
    if (!relanceEvent) return false;

    order.relance_count = (order.relance_count || 0) + 1;
    this.agentEvents.unshift(relanceEvent);

    this.waMessages.unshift({
      id: `wa_${relanceEvent.id}`,
      business_id: biz.id,
      order_id: order.id,
      sender: 'agent',
      recipient_phone: order.customer_phone || '',
      text: relanceEvent.payload.message,
      timestamp: relanceEvent.created_at,
      channel: 'client',
      status: 'delivered',
    });

    this.notify();
    return true;
  }

  // Product CRUD
  saveProduct(productData: Partial<Product> & { name: string; price: number; category_id: string }): Product {
    const activeBiz = this.getActiveBusiness();
    if (productData.id) {
      const idx = this.products.findIndex((p) => p.id === productData.id);
      if (idx > -1) {
        this.products[idx] = { ...this.products[idx], ...productData };
        this.notify();
        return this.products[idx];
      }
    }

    const newProd: Product = {
      id: `prod_${Date.now()}`,
      business_id: activeBiz.id,
      category_id: productData.category_id,
      name: productData.name,
      price: productData.price,
      description: productData.description || '',
      image_url:
        productData.image_url ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      available: productData.available !== undefined ? productData.available : true,
      stock_qty: productData.stock_qty !== undefined ? productData.stock_qty : null,
    };

    this.products.unshift(newProd);
    this.notify();
    return newProd;
  }

  deleteProduct(productId: string) {
    this.products = this.products.filter((p) => p.id !== productId);
    this.notify();
  }

  // Category CRUD
  saveCategory(name: string, categoryId?: string): Category {
    const activeBiz = this.getActiveBusiness();
    if (categoryId) {
      const cat = this.categories.find((c) => c.id === categoryId);
      if (cat) {
        cat.name = name;
        this.notify();
        return cat;
      }
    }

    const newCat: Category = {
      id: `cat_${Date.now()}`,
      business_id: activeBiz.id,
      name,
      display_order: this.categories.filter((c) => c.business_id === activeBiz.id).length + 1,
    };

    this.categories.push(newCat);
    this.notify();
    return newCat;
  }

  deleteCategory(categoryId: string) {
    this.categories = this.categories.filter((c) => c.id !== categoryId);
    this.notify();
  }

  // Update business message templates or config
  updateBusinessConfig(businessId: string, newConfig: Partial<Business['config']>, newDetails?: Partial<Business>) {
    const biz = this.businesses.find((b) => b.id === businessId);
    if (!biz) return;

    if (newConfig) {
      biz.config = {
        ...biz.config,
        ...newConfig,
        message_templates: {
          ...biz.config.message_templates,
          ...(newConfig.message_templates || {}),
        },
      };
    }

    if (newDetails) {
      Object.assign(biz, newDetails);
    }

    this.notify();
  }

  // Staff and Roles Management (Section 8)
  getActiveStaff(): Staff {
    const activeBiz = this.getActiveBusiness();
    const currentStaff = this.staff.find((s) => s.id === this.activeStaffId && s.business_id === activeBiz.id);
    if (currentStaff) return currentStaff;

    // Fallback to business owner
    const owner = this.staff.find((s) => s.business_id === activeBiz.id && s.role === 'owner');
    if (owner) return owner;

    // Default auto-created owner if missing
    const fallbackOwner: Staff = {
      id: `staff_owner_${activeBiz.id}`,
      business_id: activeBiz.id,
      auth_uid: `auth_owner_${activeBiz.id}`,
      name: `Gérant ${activeBiz.name}`,
      email: `gerant@${activeBiz.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      role: 'owner',
      permissions: {
        orders: true,
        products: true,
        customers: true,
        agent: true,
        settings: true,
        staff: true,
        finance: true,
      },
      invited_by: null,
      created_at: new Date().toISOString(),
    };
    this.staff.push(fallbackOwner);
    return fallbackOwner;
  }

  setActiveStaff(staffId: string) {
    this.activeStaffId = staffId;
    this.notify();
  }

  getStaffForBusiness(businessId?: string): Staff[] {
    const bizId = businessId || this.activeBusinessId;
    return this.staff.filter((s) => s.business_id === bizId);
  }

  inviteStaff(data: { name: string; email: string; phone?: string; role_title?: string; salary?: number | string; permissions: StaffPermissions; avatar_url?: string; photo_url?: string }): Staff {
    const activeBiz = this.getActiveBusiness();
    const currentStaff = this.getActiveStaff();

    const newStaff: Staff = {
      id: `staff_${Date.now()}`,
      business_id: activeBiz.id,
      auth_uid: `auth_${Date.now()}`,
      name: data.name,
      email: data.email,
      phone: data.phone || '+221 77 000 00 00',
      role_title: data.role_title || 'Collaborateur',
      salary: data.salary ?? 250000,
      role: 'collaborator',
      permissions: data.permissions,
      invited_by: currentStaff.id,
      created_at: new Date().toISOString(),
      avatar_url: data.avatar_url || data.photo_url,
      photo_url: data.photo_url || data.avatar_url,
    };

    this.staff.push(newStaff);
    this.notify();
    return newStaff;
  }

  updateStaff(staffId: string, data: Partial<Staff>) {
    const member = this.staff.find((s) => s.id === staffId);
    if (!member) return;

    Object.assign(member, data);
    this.notify();
  }

  updateStaffPermissions(staffId: string, permissions: Partial<StaffPermissions>) {
    const member = this.staff.find((s) => s.id === staffId);
    if (!member) return;

    member.permissions = { ...member.permissions, ...permissions };
    this.notify();
  }

  revokeStaff(staffId: string, reason: string) {
    const member = this.staff.find((s) => s.id === staffId);
    if (!member || member.role === 'owner') return;

    member.revoked = true;
    member.revocation_reason = reason;
    this.notify();
  }

  reactivateStaff(staffId: string) {
    const member = this.staff.find((s) => s.id === staffId);
    if (!member) return;

    member.revoked = false;
    member.revocation_reason = undefined;
    this.notify();
  }

  deleteStaff(staffId: string) {
    // Cannot delete owners
    const member = this.staff.find((s) => s.id === staffId);
    if (member && member.role === 'owner') return;

    this.staff = this.staff.filter((s) => s.id !== staffId);
    this.notify();
  }

  // Delivery Zone CRUD (Section 13)
  getDeliveryZones(businessId?: string): DeliveryZone[] {
    const bizId = businessId || this.activeBusinessId;
    return this.deliveryZones.filter((z) => z.business_id === bizId);
  }

  saveDeliveryZone(data: Partial<DeliveryZone> & { name: string; fee: number }): DeliveryZone {
    const activeBiz = this.getActiveBusiness();

    if (data.id) {
      const existingIdx = this.deliveryZones.findIndex((z) => z.id === data.id);
      if (existingIdx > -1) {
        this.deliveryZones[existingIdx] = {
          ...this.deliveryZones[existingIdx],
          ...data,
        };
        this.notify();
        return this.deliveryZones[existingIdx];
      }
    }

    const newZone: DeliveryZone = {
      id: `dz_${Date.now()}`,
      business_id: data.business_id || activeBiz.id,
      name: data.name,
      fee: Number(data.fee) || 0,
      active: data.active !== undefined ? data.active : true,
    };

    this.deliveryZones.push(newZone);
    this.notify();
    return newZone;
  }

  toggleDeliveryZoneActive(zoneId: string) {
    const zone = this.deliveryZones.find((z) => z.id === zoneId);
    if (zone) {
      zone.active = !zone.active;
      this.notify();
    }
  }

  deleteDeliveryZone(zoneId: string) {
    this.deliveryZones = this.deliveryZones.filter((z) => z.id !== zoneId);
    this.notify();
  }

  // Payment Gateway Config & Channels Management
  getPaymentGateway(businessId?: string): PaymentGatewayConfig {
    const bizId = businessId || this.activeBusinessId;
    let config = this.paymentGateways.find((pg) => pg.business_id === bizId);

    if (!config) {
      config = {
        business_id: bizId,
        provider: 'paydunya',
        public_key: '',
        secret_key: '',
      };
      this.paymentGateways.push(config);
      this.notify();
    }
    return config;
  }

  updatePaymentGateway(provider: PaymentGatewayProvider, publicKey: string, secretKey: string) {
    const activeBiz = this.getActiveBusiness();
    const config = this.getPaymentGateway(activeBiz.id);

    config.provider = provider;
    config.public_key = publicKey.trim();
    config.secret_key = secretKey.trim();
    config.updated_at = new Date().toISOString();

    this.notify();
  }

  getPaymentChannels(businessId?: string): PaymentChannel[] {
    const bizId = businessId || this.activeBusinessId;
    let channels = this.paymentChannels.filter((pc) => pc.business_id === bizId);

    if (channels.length === 0) {
      const defaultChannels: PaymentChannel[] = [
        { id: 'wave', business_id: bizId, name: 'Wave', enabled: true },
        { id: 'orange_money', business_id: bizId, name: 'Orange Money', enabled: true },
        { id: 'card', business_id: bizId, name: 'Carte bancaire', enabled: true },
      ];
      this.paymentChannels.push(...defaultChannels);
      this.notify();
      channels = defaultChannels;
    }
    return channels;
  }

  updatePaymentChannel(channelId: PaymentChannelId | string, enabled: boolean) {
    const activeBiz = this.getActiveBusiness();
    const channels = this.getPaymentChannels(activeBiz.id);
    const channel = channels.find((c) => c.id === channelId);

    if (channel) {
      channel.enabled = enabled;
      channel.updated_at = new Date().toISOString();
      this.notify();
    }
  }

  getActivePaymentChannels(businessId?: string): PaymentChannel[] {
    return this.getPaymentChannels(businessId).filter((c) => c.enabled);
  }

  // Order Operations: Driver, Note, Cancellation Reason, Rating
  assignDriver(orderId: string, driverName: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      order.assigned_to = driverName.trim() ? driverName.trim() : null;
      order.updated_at = new Date().toISOString();
      this.notify();
    }
  }

  updateOrderInternalNote(orderId: string, note: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      order.internal_note = note.trim() ? note.trim() : null;
      order.updated_at = new Date().toISOString();
      this.notify();
    }
  }

  cancelOrder(orderId: string, cancellationReason: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = 'cancelled';
      order.cancellation_reason = cancellationReason.trim();
      order.updated_at = new Date().toISOString();
      this.notify();
    }
  }

  submitCustomerRating(orderId: string, rating: number, comment: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      order.rating = rating;
      order.rating_comment = comment.trim();
      order.updated_at = new Date().toISOString();
      this.notify();
    }
  }

  // Customer channel preference (Section 2 & 7)
  updateCustomerChannelPreference(customerId: string, channel: 'whatsapp' | 'app') {
    const customer = this.customers.find((c) => c.id === customerId);
    if (customer) {
      customer.channel_preference = channel;
      this.notify();
    }
  }

  // Agent Chat / Projects / Conversations methods
  createAgentProject(name: string): AgentProject {
    const newProj: AgentProject = {
      id: 'proj_' + Date.now(),
      business_id: this.activeBusinessId,
      name: name.trim(),
      created_at: new Date().toISOString(),
    };
    this.agentProjects.push(newProj);
    saveToStorage(STORAGE_KEYS.AGENT_PROJECTS, this.agentProjects);
    this.notify();
    return newProj;
  }

  renameAgentProject(projectId: string, newName: string) {
    const proj = this.agentProjects.find((p) => p.id === projectId);
    if (proj) {
      proj.name = newName.trim();
      saveToStorage(STORAGE_KEYS.AGENT_PROJECTS, this.agentProjects);
      this.notify();
    }
  }

  deleteAgentProject(projectId: string) {
    this.agentProjects = this.agentProjects.filter((p) => p.id !== projectId);
    this.agentConversations.forEach((c) => {
      if (c.project_id === projectId) {
        c.project_id = null;
      }
    });
    saveToStorage(STORAGE_KEYS.AGENT_PROJECTS, this.agentProjects);
    saveToStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, this.agentConversations);
    this.notify();
  }

  createAgentConversation(projectId: string | null = null, title: string = 'Nouvelle discussion'): AgentConversation {
    const newConv: AgentConversation = {
      id: 'conv_' + Date.now(),
      business_id: this.activeBusinessId,
      project_id: projectId,
      title: title.trim(),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.agentConversations.unshift(newConv);
    saveToStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, this.agentConversations);
    this.notify();
    return newConv;
  }

  assignConversationToProject(conversationId: string, projectId: string | null) {
    const conv = this.agentConversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.project_id = projectId;
      conv.updated_at = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, this.agentConversations);
      this.notify();
    }
  }

  moveConversationToTrash(conversationId: string) {
    const conv = this.agentConversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.status = 'trashed';
      conv.updated_at = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, this.agentConversations);
      this.notify();
    }
  }

  restoreConversationFromTrash(conversationId: string) {
    const conv = this.agentConversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.status = 'active';
      conv.updated_at = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, this.agentConversations);
      this.notify();
    }
  }

  deleteConversationPermanently(conversationId: string) {
    this.agentConversations = this.agentConversations.filter((c) => c.id !== conversationId);
    this.agentMessages = this.agentMessages.filter((m) => m.conversation_id !== conversationId);
    saveToStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, this.agentConversations);
    saveToStorage(STORAGE_KEYS.AGENT_MESSAGES, this.agentMessages);
    this.notify();
  }

  addAgentChatMessage(
    conversationId: string,
    sender: 'user' | 'assistant',
    text: string,
    attachments?: AgentChatMessageAttachment[]
  ): AgentChatMessage {
    const newMsg: AgentChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      conversation_id: conversationId,
      sender,
      text,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      created_at: new Date().toISOString(),
    };
    this.agentMessages.push(newMsg);

    const conv = this.agentConversations.find((c) => c.id === conversationId);
    if (conv) {
      if ((conv.title === 'Nouvelle discussion' || !conv.title) && sender === 'user') {
        conv.title = text.length > 30 ? text.substring(0, 30) + '...' : text;
      }
      conv.updated_at = new Date().toISOString();
    }

    saveToStorage(STORAGE_KEYS.AGENT_MESSAGES, this.agentMessages);
    saveToStorage(STORAGE_KEYS.AGENT_CONVERSATIONS, this.agentConversations);
    this.notify();
    return newMsg;
  }

  getAttendanceRecords(businessId: string, startDate?: string, endDate?: string): AttendanceRecord[] {
    return this.attendanceRecords.filter((r) => {
      if (r.business_id !== businessId) return false;
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }

  upsertAttendanceRecord(record: {
    business_id: string;
    staff_id: string;
    date: string;
    status: AttendanceStatus;
    reason?: string | null;
  }): AttendanceRecord {
    const existingIndex = this.attendanceRecords.findIndex(
      (r) => r.business_id === record.business_id && r.staff_id === record.staff_id && r.date === record.date
    );

    const updatedRecord: AttendanceRecord = {
      id: existingIndex >= 0 ? this.attendanceRecords[existingIndex].id : 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      business_id: record.business_id,
      staff_id: record.staff_id,
      date: record.date,
      status: record.status,
      reason: record.reason || null,
      created_at: existingIndex >= 0 ? this.attendanceRecords[existingIndex].created_at : new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.attendanceRecords[existingIndex] = updatedRecord;
    } else {
      this.attendanceRecords.push(updatedRecord);
    }

    saveToStorage(STORAGE_KEYS.ATTENDANCE, this.attendanceRecords);
    this.notify();
    return updatedRecord;
  }

  // Reset store to initial seed data
  resetStore() {
    this.businesses = INITIAL_BUSINESSES;
    this.activeBusinessId = INITIAL_BUSINESSES[0].id;
    this.categories = INITIAL_CATEGORIES;
    this.products = INITIAL_PRODUCTS;
    this.customers = INITIAL_CUSTOMERS;
    this.orders = INITIAL_ORDERS;
    this.agentEvents = INITIAL_AGENT_EVENTS;
    this.staff = INITIAL_STAFF;
    this.activeStaffId = INITIAL_STAFF[0].id;
    this.deliveryZones = INITIAL_DELIVERY_ZONES;
    this.waMessages = this.generateInitialWaMessages();
    this.cart = [];
    this.notify();
  }
}

// Global Singleton for Client Side state
let storeInstance: AppStore | null = null;

export function getStore(): AppStore {
  if (typeof window === 'undefined') {
    return new AppStore();
  }
  if (!storeInstance) {
    storeInstance = new AppStore();
  }
  return storeInstance;
}
