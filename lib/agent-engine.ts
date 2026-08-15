import { Order, Business, AgentEvent, AgentEventType, AgentEventPayload } from './types';

/**
 * Utility to replace placeholders in message templates
 */
export function formatTemplateMessage(
  template: string,
  data: {
    customer_name: string;
    customer_phone: string;
    business_name: string;
    order_id: string;
    total_amount: number;
    currency: string;
    payment_status: string;
    payment_method: string;
    payment_link: string;
    items_summary: string;
  }
): string {
  return template
    .replace(/{customer_name}/g, data.customer_name || 'Client')
    .replace(/{customer_phone}/g, data.customer_phone || '')
    .replace(/{business_name}/g, data.business_name || '')
    .replace(/{order_id}/g, data.order_id || '')
    .replace(/{total_amount}/g, data.total_amount ? data.total_amount.toLocaleString() : '0')
    .replace(/{currency}/g, data.currency || 'XOF')
    .replace(/{payment_status}/g, data.payment_status === 'paid' ? 'PAYÉ' : 'NON PAYÉ')
    .replace(/{payment_method}/g, (data.payment_method || '').toUpperCase())
    .replace(/{payment_link}/g, data.payment_link)
    .replace(/{items_summary}/g, data.items_summary);
}

/**
 * Format order items summary string
 */
export function formatOrderItemsSummary(order: Order, currency: string = 'XOF'): string {
  if (!order.items || order.items.length === 0) {
    return '• 1x Commande personnalisée';
  }
  return order.items
    .map(
      (item) =>
        `• ${item.quantity}x ${item.product_name || 'Produit'} (${(item.unit_price * item.quantity).toLocaleString()} ${currency})`
    )
    .join('\n');
}

/**
 * Generates payment link simulation URL
 */
export function generatePaymentLink(orderId: string, baseUrl?: string): string {
  const host = typeof window !== 'undefined' ? window.location.origin : (baseUrl || 'https://commercewa.app');
  return `${host}?pay_order=${orderId}`;
}

/**
 * Rule 1: On new pending order created
 */
export function processNewOrderTrigger(
  order: Order,
  business: Business
): { customerEvent: AgentEvent; merchantEvent: AgentEvent } {
  const itemsSummary = formatOrderItemsSummary(order, business.currency);
  const paymentLink = generatePaymentLink(order.id);

  const templateData = {
    customer_name: order.customer_name || 'Client',
    customer_phone: order.customer_phone || '',
    business_name: business.name,
    order_id: order.id,
    total_amount: order.total_amount,
    currency: business.currency,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_link: paymentLink,
    items_summary: itemsSummary,
  };

  const clientMsg = formatTemplateMessage(
    business.config.message_templates.confirmation,
    templateData
  );

  const merchantMsg = formatTemplateMessage(
    business.config.message_templates.alert,
    templateData
  );

  const now = new Date().toISOString();

  const customerEvent: AgentEvent = {
    id: `evt_${Date.now()}_client`,
    business_id: business.id,
    order_id: order.id,
    event_type: 'order_confirmed',
    payload: {
      recipient_name: order.customer_name || 'Client',
      recipient_phone: order.customer_phone || '',
      channel: 'whatsapp_client',
      message: clientMsg,
      payment_link: paymentLink,
      order_summary: itemsSummary,
    },
    created_at: now,
  };

  const merchantEvent: AgentEvent = {
    id: `evt_${Date.now()}_merchant`,
    business_id: business.id,
    order_id: order.id,
    event_type: 'order_alert_sent',
    payload: {
      recipient_name: `Gérant - ${business.name}`,
      recipient_phone: business.whatsapp_number,
      channel: 'whatsapp_merchant',
      message: merchantMsg,
      order_summary: itemsSummary,
    },
    created_at: now,
  };

  return { customerEvent, merchantEvent };
}

/**
 * Rule 3: Check and trigger automatic relance for unpaid pending orders
 */
export function checkOrderRelance(
  order: Order,
  business: Business,
  force: boolean = false
): AgentEvent | null {
  // Order must not be cancelled or delivered
  if (order.status === 'cancelled' || order.status === 'delivered') {
    return null;
  }

  const currentRelanceCount = order.relance_count || 0;
  if (currentRelanceCount >= 2 && !force) {
    return null;
  }

  const createdAt = new Date(order.created_at).getTime();
  const fifteenMinutesInMs = 15 * 60 * 1000;
  const isOlderThan15Min = Date.now() - createdAt > fifteenMinutesInMs;

  if (!isOlderThan15Min && !force) {
    return null;
  }

  const itemsSummary = formatOrderItemsSummary(order, business.currency);
  const paymentLink = generatePaymentLink(order.id);

  const templateData = {
    customer_name: order.customer_name || 'Client',
    customer_phone: order.customer_phone || '',
    business_name: business.name,
    order_id: order.id,
    total_amount: order.total_amount,
    currency: business.currency,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_link: paymentLink,
    items_summary: itemsSummary,
  };

  const relanceMsg = formatTemplateMessage(
    business.config.message_templates.relance,
    templateData
  );

  const newRelanceNum = currentRelanceCount + 1;

  const event: AgentEvent = {
    id: `evt_${Date.now()}_relance_${newRelanceNum}`,
    business_id: business.id,
    order_id: order.id,
    event_type: 'relance_sent',
    payload: {
      recipient_name: order.customer_name || 'Client',
      recipient_phone: order.customer_phone || '',
      channel: 'whatsapp_client',
      message: relanceMsg,
      payment_link: paymentLink,
      relance_number: newRelanceNum,
    },
    created_at: new Date().toISOString(),
  };

  return event;
}

/**
 * Rule 4: Post-delivery follow-up trigger
 */
export function triggerPostDeliveryFollowUp(
  order: Order,
  business: Business
): AgentEvent {
  const itemsSummary = formatOrderItemsSummary(order, business.currency);
  const paymentLink = generatePaymentLink(order.id);

  const templateData = {
    customer_name: order.customer_name || 'Client',
    customer_phone: order.customer_phone || '',
    business_name: business.name,
    order_id: order.id,
    total_amount: order.total_amount,
    currency: business.currency,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    payment_link: paymentLink,
    items_summary: itemsSummary,
  };

  const followUpMsg = formatTemplateMessage(
    business.config.message_templates.follow_up,
    templateData
  );

  return {
    id: `evt_${Date.now()}_followup`,
    business_id: business.id,
    order_id: order.id,
    event_type: 'follow_up_sent',
    payload: {
      recipient_name: order.customer_name || 'Client',
      recipient_phone: order.customer_phone || '',
      channel: 'whatsapp_client',
      message: followUpMsg,
    },
    created_at: new Date().toISOString(),
  };
}
