import { Business, Category, Product, Customer, Order, AgentEvent, Staff, DeliveryZone, PaymentChannel, PaymentGatewayConfig } from './types';

export const INITIAL_DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'dz_1', business_id: 'biz_dakar_gourmet', name: 'Mermoz / Sacré-Cœur / Fann', fee: 1000, active: true },
  { id: 'dz_2', business_id: 'biz_dakar_gourmet', name: 'Plateau / Medina / Fass', fee: 1500, active: true },
  { id: 'dz_3', business_id: 'biz_dakar_gourmet', name: 'Almadies / Ngor / Ouakam', fee: 2000, active: true },
  { id: 'dz_4', business_id: 'biz_kente_chic', name: 'Dakar Centre / Plateau', fee: 1500, active: true },
  { id: 'dz_5', business_id: 'biz_kente_chic', name: 'Banlieue (Pikine / Guédiawaye)', fee: 2500, active: true },
];

export const INITIAL_PAYMENT_CHANNELS: PaymentChannel[] = [
  { id: 'wave', business_id: 'biz_dakar_gourmet', name: 'Wave', enabled: true },
  { id: 'orange_money', business_id: 'biz_dakar_gourmet', name: 'Orange Money', enabled: true },
  { id: 'card', business_id: 'biz_dakar_gourmet', name: 'Carte bancaire', enabled: true },
  { id: 'wave', business_id: 'biz_kente_chic', name: 'Wave', enabled: true },
  { id: 'orange_money', business_id: 'biz_kente_chic', name: 'Orange Money', enabled: true },
  { id: 'card', business_id: 'biz_kente_chic', name: 'Carte bancaire', enabled: true },
];

export const INITIAL_PAYMENT_GATEWAYS: PaymentGatewayConfig[] = [
  {
    business_id: 'biz_dakar_gourmet',
    provider: 'paydunya',
    public_key: 'pk_live_dakar_gourmet_9841',
    secret_key: 'sk_live_dakar_gourmet_sec_8812',
  },
  {
    business_id: 'biz_kente_chic',
    provider: 'paydunya',
    public_key: 'pk_live_kente_chic_1102',
    secret_key: 'sk_live_kente_chic_sec_3301',
  },
];

export const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'biz_dakar_gourmet',
    name: 'Chez Ami - Grillades & Maquis Dakar',
    type: 'restaurant',
    whatsapp_number: '+221 77 845 12 90',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
    currency: 'XOF',
    opening_hours: {
      'Lundi - Vendredi': '11:00 - 23:00',
      'Samedi - Dimanche': '12:00 - 00:00',
    },
    config: {
      message_templates: {
        confirmation:
          'Bonjour {customer_name} ! 👋 Merci pour votre commande chez {business_name}.\n\n' +
          '✅ *PAIEMENT CONFIRMÉ ({payment_method})*\n\n' +
          '📦 *Récapitulatif commande #{order_id}* :\n{items_summary}\n\n' +
          '💰 *Total réglé* : {total_amount} {currency}\n\n' +
          'Votre commande est transmise en cuisine / préparation !',
        alert:
          '🚨 *NOUVELLE COMMANDE PAYÉE* (Commande #{order_id})\n\n' +
          '👤 Client : {customer_name} ({customer_phone})\n' +
          '💵 Montant réglé : {total_amount} {currency} (PAYÉ via {payment_method})\n' +
          '📍 Référence : {payment_reference}\n\n' +
          '📋 Produits :\n{items_summary}',
        relance:
          'Bonjour {customer_name} 😊, votre commande #{order_id} chez {business_name} est en cours de traitement.\n\n' +
          'Si vous avez une question sur votre livraison, vous pouvez répondre directement à ce message.',
        follow_up:
          'Bonjour {customer_name} 🎉 ! Nous espérons que vous avez apprécié votre commande chez {business_name}.\n\n' +
          '⭐ Laissez-nous votre avis ou profitez de -10% sur votre prochaine commande avec le code *MERCI10* !',
      },
      display_preferences: {
        primary_color: '#ea580c',
        banner_text: 'Livraison express à Dakar et banlieue en 35 min ! 🛵',
      },
    },
  },
  {
    id: 'biz_kente_chic',
    name: 'Kente & Style - Mode & Bazin Dakar',
    type: 'boutique',
    whatsapp_number: '+221 78 123 45 67',
    logo_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=300&q=80',
    currency: 'XOF',
    opening_hours: {
      'Lundi - Samedi': '09:00 - 20:00',
    },
    config: {
      message_templates: {
        confirmation:
          'Bonjour {customer_name} ✨, merci pour votre achat chez {business_name} !\n\n' +
          '🛍️ *Commande #{order_id}* :\n{items_summary}\n\n' +
          '💰 *Total à régler* : {total_amount} {currency}\n' +
          '📲 *Valider votre règlement Wave / OM* :\n{payment_link}',
        alert:
          '📦 *NOUVELLE VENTE EN LIGNE* (#{order_id})\n\n' +
          '👤 Client : {customer_name}\n' +
          '📞 Tel : {customer_phone}\n' +
          '💵 Montant total : {total_amount} {currency}',
        relance:
          'Bonjour {customer_name}, vos articles sélectionnés sont réservés pour la commande #{order_id}. Finalisez votre commande ici : {payment_link}',
        follow_up:
          'Merci {customer_name} d’avoir choisi {business_name} ! Partagez votre tenue sur Instagram en nous mentionnant ! 📸',
      },
      display_preferences: {
        primary_color: '#0d9488',
        banner_text: 'Nouvelle collection Wax & Bazin disponible ! 👗',
      },
    },
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  // Dakar Gourmet
  { id: 'cat_dg_1', business_id: 'biz_dakar_gourmet', name: 'Plats Principaux & Spécialités', display_order: 1 },
  { id: 'cat_dg_2', business_id: 'biz_dakar_gourmet', name: 'Grillades & Dibiterie', display_order: 2 },
  { id: 'cat_dg_3', business_id: 'biz_dakar_gourmet', name: 'Entrées & Pastels', display_order: 3 },
  { id: 'cat_dg_4', business_id: 'biz_dakar_gourmet', name: 'Boissons & Jus Locaux', display_order: 4 },

  // Kente Chic
  { id: 'cat_kc_1', business_id: 'biz_kente_chic', name: 'Robes & Ensembles Wax', display_order: 1 },
  { id: 'cat_kc_2', business_id: 'biz_kente_chic', name: 'Sacs & Chaussures', display_order: 2 },
  { id: 'cat_kc_3', business_id: 'biz_kente_chic', name: 'Accessoires & Bijoux', display_order: 3 },
];

export const INITIAL_PRODUCTS: Product[] = [
  // Dakar Gourmet
  {
    id: 'prod_dg_1',
    business_id: 'biz_dakar_gourmet',
    category_id: 'cat_dg_1',
    name: 'Thiéboudienne Penda Mbaye (Riz au Poisson Rouge)',
    price: 3500,
    description: 'Le grand classique sénégalais : riz parfumé au poisson frais, légumes du marché (cassave, carotte, chou) et tamarins.',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 25,
  },
  {
    id: 'prod_dg_2',
    business_id: 'biz_dakar_gourmet',
    category_id: 'cat_dg_2',
    name: "Dibiterie d'Agneau Braisé (500g)",
    price: 6000,
    description: 'Morceaux d’agneau tendres grillés au feu de bois, assaisonnés à la moutarde fort, oignons mijotés et piment vert.',
    image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 15,
  },
  {
    id: 'prod_dg_3',
    business_id: 'biz_dakar_gourmet',
    category_id: 'cat_dg_1',
    name: 'Poulet Yassa avec Riz Blanc Parfum',
    price: 3000,
    description: 'Poulet cuit au feu, confit d’oignons caramélisés au citron vert et moutarde à l’ancienne.',
    image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: null,
  },
  {
    id: 'prod_dg_4',
    business_id: 'biz_dakar_gourmet',
    category_id: 'cat_dg_3',
    name: 'Boîte de Pastels au Poisson (12 pcs)',
    price: 1500,
    description: 'Beignets croustillants farcis au poisson épicé, servis avec une sauce tomate pimentée maison.',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 40,
  },
  {
    id: 'prod_dg_5',
    business_id: 'biz_dakar_gourmet',
    category_id: 'cat_dg_4',
    name: 'Jus de Bissap Maison (1 Litre)',
    price: 1000,
    description: 'Infusion fraîche de fleurs d’hibiscus biologique, menthe poivrée et fleur d’oranger.',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 50,
  },
  {
    id: 'prod_dg_6',
    business_id: 'biz_dakar_gourmet',
    category_id: 'cat_dg_4',
    name: 'Jus de Bouye / Baobab (1 Litre)',
    price: 1200,
    description: 'Nectar onctueux de fruit de baobab à la vanille bourbon et lait condensé.',
    image_url: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 30,
  },

  // Kente Chic
  {
    id: 'prod_kc_1',
    business_id: 'biz_kente_chic',
    category_id: 'cat_kc_1',
    name: 'Robe Longue Wax & Bazin "Élégance Dakar"',
    price: 28000,
    description: 'Sublime coupe ajustée mariant le vrai Bazin Riche brodé au Wax Hollandais Premium.',
    image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 5,
  },
  {
    id: 'prod_kc_2',
    business_id: 'biz_kente_chic',
    category_id: 'cat_kc_2',
    name: 'Sac à Main Cuir & Pagne Kente Artisanal',
    price: 18500,
    description: 'Sac à bandoulière fait main à Dakar en cuir naturel de maroquinerie et tissage traditionnel.',
    image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 8,
  },
  {
    id: 'prod_kc_3',
    business_id: 'biz_kente_chic',
    category_id: 'cat_kc_3',
    name: 'Parure Colliers Perles & Laiton Doré',
    price: 9500,
    description: 'Collier double rangée en perles de verre africaines et médaillon martelé main.',
    image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80',
    available: true,
    stock_qty: 12,
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_101',
    business_id: 'biz_dakar_gourmet',
    name: 'Fatou Diallo',
    phone: '+221 77 654 32 10',
    whatsapp_id: '221776543210',
    channel_preference: 'whatsapp',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'cust_102',
    business_id: 'biz_dakar_gourmet',
    name: 'Moussa Ndiaye',
    phone: '+221 78 987 65 43',
    whatsapp_id: '221789876543',
    channel_preference: 'whatsapp',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'cust_103',
    business_id: 'biz_kente_chic',
    name: 'Awa Sow',
    phone: '+221 70 333 22 11',
    whatsapp_id: '221703332211',
    channel_preference: 'app',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord_1001',
    business_id: 'biz_dakar_gourmet',
    customer_id: 'cust_101',
    customer_name: 'Fatou Diallo',
    customer_phone: '+221 77 654 32 10',
    delivery_address: 'Mermoz Pyrotechnie, Villa 14, Dakar',
    order_type: 'delivery',
    delivery_zone_id: 'dz_1',
    delivery_zone_name: 'Mermoz / Sacré-Cœur / Fann',
    delivery_fee: 1000,
    customer_lat: 14.7167,
    customer_lng: -17.4677,
    assigned_to: '',
    internal_note: 'Client demande de livrer devant la villa principale',
    status: 'confirmed',
    total_amount: 9000, // 8000 + 1000 fee
    payment_status: 'paid',
    payment_method: 'wave',
    payment_reference: 'WAVE_PAY_881023',
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(), // 20 mins ago (eligible for relance)
    updated_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    relance_count: 0,
    items: [
      {
        id: 'item_1',
        order_id: 'ord_1001',
        product_id: 'prod_dg_1',
        product_name: 'Thiéboudienne Penda Mbaye',
        quantity: 2,
        unit_price: 3500,
      },
      {
        id: 'item_2',
        order_id: 'ord_1001',
        product_id: 'prod_dg_5',
        product_name: 'Jus de Bissap Maison (1L)',
        quantity: 1,
        unit_price: 1000,
      },
    ],
  },
  {
    id: 'ord_1002',
    business_id: 'biz_dakar_gourmet',
    customer_id: 'cust_102',
    customer_name: 'Moussa Ndiaye',
    customer_phone: '+221 78 987 65 43',
    delivery_address: 'Plateau, Rue du docteur Théze, Dakar',
    order_type: 'delivery',
    delivery_zone_id: 'dz_2',
    delivery_zone_name: 'Plateau / Medina / Fass',
    delivery_fee: 1500,
    customer_lat: 14.6685,
    customer_lng: -17.4338,
    assigned_to: '',
    internal_note: 'Commande urgente pour pause déjeuner',
    status: 'preparing',
    total_amount: 9000, // 7500 + 1500 fee
    payment_status: 'paid',
    payment_method: 'orange_money',
    payment_reference: 'OM_REF_8849201',
    created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    relance_count: 0,
    items: [
      {
        id: 'item_3',
        order_id: 'ord_1002',
        product_id: 'prod_dg_2',
        product_name: "Dibiterie d'Agneau Braisé (500g)",
        quantity: 1,
        unit_price: 6000,
      },
      {
        id: 'item_4',
        order_id: 'ord_1002',
        product_id: 'prod_dg_4',
        product_name: 'Boîte de Pastels au Poisson',
        quantity: 1,
        unit_price: 1500,
      },
    ],
  },
  {
    id: 'ord_1003',
    business_id: 'biz_kente_chic',
    customer_id: 'cust_103',
    customer_name: 'Awa Sow',
    customer_phone: '+221 70 333 22 11',
    delivery_address: 'À récupérer en magasin (Showroom Plateau)',
    order_type: 'pickup',
    delivery_fee: 0,
    status: 'delivered',
    total_amount: 28000,
    payment_status: 'paid',
    payment_method: 'wave',
    payment_reference: 'WAVE_REF_991823',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    relance_count: 0,
    rating: 5,
    rating_comment: 'Livraison rapide & produit parfait !',
    items: [
      {
        id: 'item_5',
        order_id: 'ord_1003',
        product_id: 'prod_kc_1',
        product_name: 'Robe Longue Wax & Bazin "Élégance Dakar"',
        quantity: 1,
        unit_price: 28000,
      },
    ],
  },
];

export const INITIAL_AGENT_EVENTS: AgentEvent[] = [
  {
    id: 'evt_1',
    business_id: 'biz_dakar_gourmet',
    order_id: 'ord_1001',
    event_type: 'order_confirmed',
    payload: {
      recipient_name: 'Fatou Diallo',
      recipient_phone: '+221 77 654 32 10',
      channel: 'whatsapp_client',
      message: 'Bonjour Fatou Diallo ! 👋 Confirmation de la commande #ord_1001 chez Chez Ami. Total: 8,000 XOF.',
      payment_link: 'https://pay.commercewa.app/pay/ord_1001',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'evt_2',
    business_id: 'biz_dakar_gourmet',
    order_id: 'ord_1001',
    event_type: 'order_alert_sent',
    payload: {
      recipient_name: 'Commerçant - Chez Ami',
      recipient_phone: '+221 77 845 12 90',
      channel: 'whatsapp_merchant',
      message: '🚨 NOUVELLE COMMANDE REÇUE (#ord_1001) - Fatou Diallo - 8,000 XOF',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'evt_3',
    business_id: 'biz_dakar_gourmet',
    order_id: 'ord_1002',
    event_type: 'order_confirmed',
    payload: {
      recipient_name: 'Moussa Ndiaye',
      recipient_phone: '+221 78 987 65 43',
      channel: 'whatsapp_client',
      message: 'Bonjour Moussa Ndiaye ! Votre paiement de 7,500 XOF a été confirmé pour la commande #ord_1002.',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
  },
];

export const INITIAL_STAFF: Staff[] = [
  {
    id: 'staff_101',
    business_id: 'biz_dakar_gourmet',
    auth_uid: 'auth_amadou_owner',
    name: 'Amadou Diop',
    email: 'amadou.diop@chezami.sn',
    phone: '+221 77 800 11 22',
    role_title: 'Gérant',
    role: 'owner',
    salary: 450000,
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
    created_at: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
  },
  {
    id: 'staff_102',
    business_id: 'biz_dakar_gourmet',
    auth_uid: 'auth_penda_staff',
    name: 'Penda Mbaye',
    email: 'penda.mbaye@chezami.sn',
    phone: '+221 77 450 33 11',
    role_title: 'Caissière & Opérations',
    role: 'collaborator',
    salary: 250000,
    permissions: {
      orders: true,
      products: true,
      customers: true,
      agent: false,
      settings: false,
      staff: true,
      finance: false,
    },
    invited_by: 'staff_101',
    created_at: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
  },
  {
    id: 'staff_103',
    business_id: 'biz_kente_chic',
    auth_uid: 'auth_aminata_owner',
    name: 'Aminata Kébé',
    email: 'aminata@kente.sn',
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
    created_at: new Date(Date.now() - 3600000 * 24 * 60).toISOString(),
  },
];
