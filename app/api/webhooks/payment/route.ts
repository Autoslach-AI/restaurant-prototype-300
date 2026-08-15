import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, payment_reference, payment_status, payment_method, aggregator } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: 'Paramètre order_id requis' },
        { status: 400 }
      );
    }

    const ref = payment_reference || `WAVE_REF_${Math.floor(100000 + Math.random() * 900000)}`;
    const status = payment_status || 'paid';

    // Simulated webhook response
    return NextResponse.json({
      success: true,
      message: `Webhook ${aggregator || 'PayDunya/CinetPay'} traité avec succès`,
      data: {
        order_id,
        payment_reference: ref,
        payment_status: status,
        payment_method: payment_method || 'wave',
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
