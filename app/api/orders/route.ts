import { NextRequest, NextResponse } from 'next/server';
import { processNewOrderTrigger } from '@/lib/agent-engine';
import { INITIAL_BUSINESSES, INITIAL_ORDERS } from '@/lib/initial-data';
import { Order, PaymentMethod } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get('business_id');
  const status = searchParams.get('status');

  let filtered = [...INITIAL_ORDERS];
  if (businessId) {
    filtered = filtered.filter((o) => o.business_id === businessId);
  }
  if (status) {
    filtered = filtered.filter((o) => o.status === status);
  }

  return NextResponse.json({ orders: filtered });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      business_id,
      customer_name,
      customer_phone,
      delivery_address,
      payment_method,
      items,
      total_amount,
    } = body;

    const business = INITIAL_BUSINESSES.find((b) => b.id === business_id) || INITIAL_BUSINESSES[0];

    const orderId = `ord_${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: Order = {
      id: orderId,
      business_id: business.id,
      customer_id: `cust_${Date.now()}`,
      customer_name: customer_name || 'Client',
      customer_phone: customer_phone || '+221 77 000 00 00',
      delivery_address: delivery_address || 'Dakar',
      status: 'pending',
      total_amount: total_amount || 5000,
      payment_status: 'unpaid',
      payment_method: (payment_method as PaymentMethod) || 'wave',
      payment_reference: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: items || [],
      relance_count: 0,
    };

    // Trigger WhatsApp Agent Engine (Section 3 Rule 1)
    const { customerEvent, merchantEvent } = processNewOrderTrigger(newOrder, business);

    return NextResponse.json({
      success: true,
      order: newOrder,
      events: [customerEvent, merchantEvent],
      whatsapp_messages: [
        {
          channel: 'client',
          recipient: customer_phone,
          message: customerEvent.payload.message,
          payment_link: customerEvent.payload.payment_link,
        },
        {
          channel: 'merchant',
          recipient: business.whatsapp_number,
          message: merchantEvent.payload.message,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
