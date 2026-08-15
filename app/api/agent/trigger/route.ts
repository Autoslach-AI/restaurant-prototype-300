import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_BUSINESSES, INITIAL_ORDERS } from '@/lib/initial-data';
import { checkOrderRelance, triggerPostDeliveryFollowUp } from '@/lib/agent-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, order_id, business_id } = body;

    const business = INITIAL_BUSINESSES.find((b) => b.id === business_id) || INITIAL_BUSINESSES[0];
    const order = INITIAL_ORDERS.find((o) => o.id === order_id) || INITIAL_ORDERS[0];

    if (action === 'relance') {
      const relanceEvent = checkOrderRelance(order, business, true);
      if (!relanceEvent) {
        return NextResponse.json({
          success: false,
          message: 'Relance non éligible (commande déjà payée ou limite atteinte)',
        });
      }
      return NextResponse.json({
        success: true,
        action: 'relance_sent',
        event: relanceEvent,
      });
    }

    if (action === 'followup') {
      const followUpEvent = triggerPostDeliveryFollowUp(order, business);
      return NextResponse.json({
        success: true,
        action: 'followup_sent',
        event: followUpEvent,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Action invalide. Utilisez "relance" ou "followup"' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
