export type BusinessType = 'restaurant' | 'boutique' | 'pharmacie' | 'epicerie' | 'autre';

export interface BusinessConfig {
  message_templates: {
    confirmation: string;
    alert: string;
    relance: string;
    follow_up: string;
  };
  display_preferences?: {
    primary_color?: string;
    banner_text?: string;
  };
}

export interface Business {
  id: string;
  name: string;
  type: BusinessType | string;
  whatsapp_number: string;
  logo_url: string;
  currency: string; // e.g. "XOF", "EUR"
  opening_hours: Record<string, string>;
  config: BusinessConfig;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  display_order: number;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  available: boolean;
  stock_qty: number | null; // null = stock illimité / non suivi
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  whatsapp_id: string;
  channel_preference?: 'whatsapp' | 'app';
  created_at: string;
  avatar_url?: string;
}

export type StaffRole = 'owner' | 'collaborator';

export interface StaffPermissions {
  orders: boolean;
  products: boolean;
  customers: boolean;
  agent: boolean;
  settings: boolean;
  staff: boolean;
  finance: boolean;
}

export interface Staff {
  id: string;
  business_id: string;
  auth_uid: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: StaffPermissions;
  invited_by: string | null;
  created_at: string;
  avatar_url?: string;
  photo_url?: string;
  phone?: string;
  role_title?: string;
  salary?: number | string;
  revoked?: boolean;
  revocation_reason?: string;
  last_login_at?: string;
  is_active?: boolean;
  joined_at?: string;
}

export interface DeliveryZone {
  id: string;
  business_id: string;
  name: string;
  fee: number;
  active: boolean;
}

export type PaymentChannelId = 'wave' | 'orange_money' | 'card';

export type PaymentGatewayProvider = 'paydunya' | 'cinetpay';

export interface PaymentGatewayConfig {
  business_id: string;
  provider: PaymentGatewayProvider;
  public_key: string;
  secret_key: string; // Stored securely; masked in UI
  updated_at?: string;
}

export interface PaymentChannel {
  id: PaymentChannelId | string;
  business_id: string;
  name: string;
  enabled: boolean;
  updated_at?: string;
}

export type OrderStatus = 'confirmed' | 'preparing' | 'delivered' | 'cancelled' | 'pending' | 'ready';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export type PaymentMethod = 'wave' | 'orange_money' | 'paydunya' | 'cinetpay' | 'cash';

export type OrderType = 'delivery' | 'pickup';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number; // Prix au moment de la commande
  product_name?: string;
}

export interface Order {
  id: string;
  business_id: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | string;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  
  // Delivery & Management fields
  order_type?: OrderType; // 'delivery' | 'pickup'
  delivery_zone_id?: string | null;
  delivery_zone_name?: string | null;
  delivery_fee?: number; // fixed fee
  customer_lat?: number | null; // optional GPS lat
  customer_lng?: number | null; // optional GPS lng
  assigned_to?: string | null; // name of driver (simple text)
  cancellation_reason?: string | null; // mandatory if status = 'cancelled'
  internal_note?: string | null; // free text note
  rating?: number | null; // 1 to 5
  rating_comment?: string | null; // client review comment

  priority_level?: 'urgent' | 'moyen' | 'faible' | string;
  urgent_surcharge_applied?: number | null;

  // Included fields for convenience in UI
  customer_name?: string;
  customer_phone?: string;
  customer_avatar?: string;
  delivery_address?: string;
  items?: OrderItem[];
  relance_count?: number;
}

export type AgentEventType = 'order_confirmed' | 'order_alert_sent' | 'relance_sent' | 'follow_up_sent';

export interface AgentEventPayload {
  recipient_phone: string;
  recipient_name: string;
  message: string;
  channel: 'whatsapp_client' | 'whatsapp_merchant';
  payment_link?: string;
  order_summary?: string;
  relance_number?: number;
  [key: string]: unknown;
}

export interface AgentEvent {
  id: string;
  business_id: string;
  order_id: string | null;
  event_type: AgentEventType;
  payload: AgentEventPayload;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface AgentProject {
  id: string;
  business_id: string;
  name: string;
  created_at: string;
}

export interface AgentConversation {
  id: string;
  business_id: string;
  project_id: string | null;
  title: string;
  status: 'active' | 'trashed';
  created_at: string;
  updated_at: string;
}

export interface AgentChatMessageAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface AgentChatMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant';
  text: string;
  attachments?: AgentChatMessageAttachment[];
  created_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceRecord {
  id: string;
  business_id: string;
  staff_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  reason?: string | null;
  created_at: string;
}
