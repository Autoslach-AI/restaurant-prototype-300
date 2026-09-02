import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { business_id, message, conversation_history } = body;

    if (!business_id || !message) {
      return NextResponse.json(
        { error: 'Parametres business_id et message requis.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    let isDemo = true;

    if (supabase) {
      try {
        const { data: businessData, error: bizError } = await (supabase as any)
          .from('platform_businesses')
          .select('enterprise_id')
          .eq('id', business_id)
          .single();

        if (!bizError && businessData && businessData.enterprise_id) {
          isDemo = false;
        }
      } catch {
        // En cas d'erreur de lecture, considerer comme mode demo par defaut
        isDemo = true;
      }

      if (isDemo) {
        try {
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const todayStartISO = todayStart.toISOString();

          const { data: convs, error: convError } = await (supabase as any)
            .from('platform_agent_conversations')
            .select('id')
            .eq('business_id', business_id);

          if (!convError && convs && convs.length > 0) {
            const convIds = convs.map((c: { id: string }) => c.id);
            const { count, error: countError } = await (supabase as any)
              .from('platform_agent_messages')
              .select('*', { count: 'exact', head: true })
              .in('conversation_id', convIds)
              .eq('sender', 'user')
              .gte('created_at', todayStartISO);

            if (!countError && count !== null && count >= 20) {
              return NextResponse.json(
                {
                  error: 'Limite quotidienne atteinte pour le mode demo (20 messages/jour). Contactez le support pour passer a la version Enterprise.',
                  code: 'RATE_LIMIT_REACHED',
                },
                { status: 429 }
              );
            }
          }
        } catch {
          // Non-bloquant si le comptage echoue
        }
      }
    }

    console.log('[DEBUG /api/agent/chat] Checking environment variables:');
    console.log('[DEBUG /api/agent/chat] process.env.GEMINI_API_KEY defined:', !!process.env.GEMINI_API_KEY);
    console.log('[DEBUG /api/agent/chat] process.env.GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
    console.log('[DEBUG /api/agent/chat] process.env.GEMINI_DEMO_API_KEY defined:', !!process.env.GEMINI_DEMO_API_KEY);
    console.log('[DEBUG /api/agent/chat] Available env keys matching GEMINI:', Object.keys(process.env).filter(k => k.toUpperCase().includes('GEMINI')));

    const apiKey = process.env.GEMINI_DEMO_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.warn('[DEBUG /api/agent/chat] API Key is missing or empty!');
      return NextResponse.json(
        {
          error: "Erreur lors de la communication avec l'assistant IA.",
          details: 'Cle API non configuree sur le serveur.',
        },
        { status: 500 }
      );
    }
    console.log('[DEBUG /api/agent/chat] API Key successfully found. Initializing GoogleGenAI...');

    const ai = new GoogleGenAI({ apiKey });

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(conversation_history)) {
      for (const msg of conversation_history) {
        if (msg && typeof msg.content === 'string') {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction: "Tu es l'assistant IA intelligent de la plateforme de commerce. Tu aides les commercants au Senegal a gerer leurs ventes, stocks, commandes, clients et strategie commerciale. Reponds de facon concise, professionnelle et bienveillante. Utilise les FCFA comme devise quand pertinent.",
      },
    });

    const responseText = response.text || '';

    return NextResponse.json({
      text: responseText,
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Erreur lors de la communication avec l'assistant IA.",
        details: err?.message || 'Erreur interne inconnue',
      },
      { status: 500 }
    );
  }
}
