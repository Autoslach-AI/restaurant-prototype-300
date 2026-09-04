import { NextRequest, NextResponse } from 'next/server';
import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

function getStartDateForPeriod(period?: string): { dateStr: string; isoStr: string } {
  const now = new Date();
  let start: Date;
  switch (period) {
    case 'today':
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      break;
    case 'week': {
      const day = now.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff, 0, 0, 0));
      break;
    }
    case 'year':
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0));
      break;
    case 'month':
    default:
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
      break;
  }
  const isoStr = start.toISOString();
  const dateStr = isoStr.split('T')[0];
  return { dateStr, isoStr };
}

async function executeGetRecentOrders(supabase: any, businessId: string, args: any) {
  const limitParam = typeof args?.limit === 'number' ? args.limit : 10;
  const limit = Math.min(Math.max(Math.floor(limitParam), 1), 50);

  const { data, error } = await supabase
    .from('platform_orders')
    .select('id, status, total_amount, payment_status, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { error: 'Erreur lors de la recuperation des commandes: ' + error.message };
  }

  const orders = Array.isArray(data) ? data : [];
  return {
    total_orders_returned: orders.length,
    orders: orders.map((o: any) => ({
      id: o.id,
      status: o.status,
      total_amount: Number(o.total_amount) || 0,
      payment_status: o.payment_status,
      created_at: o.created_at,
    })),
  };
}

async function executeGetCustomersSummary(supabase: any, businessId: string) {
  const [customersRes, ordersRes] = await Promise.all([
    supabase
      .from('platform_customers')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId),
    supabase
      .from('platform_orders')
      .select('customer_id')
      .eq('business_id', businessId)
      .not('customer_id', 'is', null),
  ]);

  if (customersRes.error) {
    return { error: 'Erreur lors de la recuperation des clients: ' + customersRes.error.message };
  }

  const totalCustomers = typeof customersRes.count === 'number'
    ? customersRes.count
    : (Array.isArray(customersRes.data) ? customersRes.data.length : 0);

  const orderCountsByCustomer: Record<string, number> = {};
  if (Array.isArray(ordersRes.data)) {
    for (const row of ordersRes.data) {
      if (row.customer_id) {
        orderCountsByCustomer[row.customer_id] = (orderCountsByCustomer[row.customer_id] || 0) + 1;
      }
    }
  }

  const loyalCustomersCount = Object.values(orderCountsByCustomer).filter((c) => c > 1).length;
  const loyaltyRatePercent = totalCustomers > 0
    ? Number(((loyalCustomersCount / totalCustomers) * 100).toFixed(1))
    : 0;

  return {
    total_customers: totalCustomers,
    loyal_customers_count: loyalCustomersCount,
    loyalty_rate_percent: loyaltyRatePercent,
  };
}

async function executeGetProductsStock(supabase: any, businessId: string) {
  const { data, error } = await supabase
    .from('platform_products')
    .select('id, name, price, stock_qty, available')
    .eq('business_id', businessId)
    .order('name', { ascending: true });

  if (error) {
    return { error: 'Erreur lors de la recuperation des produits: ' + error.message };
  }

  const products = Array.isArray(data) ? data : [];
  const outOfStock = products.filter((p: any) => (p.stock_qty ?? 0) <= 0);
  const lowStock = products.filter((p: any) => (p.stock_qty ?? 0) > 0 && (p.stock_qty ?? 0) <= 5);
  const inStock = products.filter((p: any) => (p.stock_qty ?? 0) > 5);

  return {
    total_products: products.length,
    out_of_stock_count: outOfStock.length,
    low_stock_count: lowStock.length,
    in_stock_count: inStock.length,
    out_of_stock_products: outOfStock.map((p: any) => ({
      id: p.id,
      name: p.name,
      stock_qty: p.stock_qty ?? 0,
      price: Number(p.price) || 0,
    })),
    low_stock_products: lowStock.map((p: any) => ({
      id: p.id,
      name: p.name,
      stock_qty: p.stock_qty ?? 0,
      price: Number(p.price) || 0,
    })),
    all_products: products.map((p: any) => ({
      id: p.id,
      name: p.name,
      stock_qty: p.stock_qty ?? 0,
      price: Number(p.price) || 0,
      available: Boolean(p.available),
    })),
  };
}

async function executeGetFinanceSummary(supabase: any, businessId: string, args: any) {
  const validPeriods = ['today', 'week', 'month', 'year'];
  const requestedPeriod = typeof args?.period === 'string' ? args.period.toLowerCase() : 'month';
  const period = validPeriods.includes(requestedPeriod) ? requestedPeriod : 'month';
  const { dateStr, isoStr } = getStartDateForPeriod(period);

  const [ordersRes, expensesRes] = await Promise.all([
    supabase
      .from('platform_orders')
      .select('total_amount, payment_status, created_at')
      .eq('business_id', businessId)
      .eq('payment_status', 'paid')
      .gte('created_at', isoStr),
    supabase
      .from('platform_expenses')
      .select('amount, date')
      .eq('business_id', businessId)
      .gte('date', dateStr),
  ]);

  if (ordersRes.error) {
    return { error: 'Erreur lors de la recuperation des revenus: ' + ordersRes.error.message };
  }
  if (expensesRes.error) {
    return { error: 'Erreur lors de la recuperation des depenses: ' + expensesRes.error.message };
  }

  const paidOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
  const expenses = Array.isArray(expensesRes.data) ? expensesRes.data : [];

  const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  return {
    period,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    paid_orders_count: paidOrders.length,
    expenses_count: expenses.length,
    currency: 'FCFA',
  };
}

async function executeGetExpensesBreakdown(supabase: any, businessId: string, args: any) {
  const validPeriods = ['today', 'week', 'month', 'year'];
  const requestedPeriod = typeof args?.period === 'string' ? args.period.toLowerCase() : 'month';
  const period = validPeriods.includes(requestedPeriod) ? requestedPeriod : 'month';
  const { dateStr } = getStartDateForPeriod(period);

  const { data, error } = await supabase
    .from('platform_expenses')
    .select('amount, category, date')
    .eq('business_id', businessId)
    .gte('date', dateStr);

  if (error) {
    return { error: 'Erreur lors de la recuperation des depenses: ' + error.message };
  }

  const expenses = Array.isArray(data) ? data : [];
  const categoriesMap: Record<string, { total: number; count: number }> = {};
  let totalAmount = 0;

  for (const item of expenses) {
    const cat = item.category?.trim() || 'Autre';
    const amt = Number(item.amount) || 0;
    totalAmount += amt;

    if (!categoriesMap[cat]) {
      categoriesMap[cat] = { total: 0, count: 0 };
    }
    categoriesMap[cat].total += amt;
    categoriesMap[cat].count += 1;
  }

  const categories = Object.entries(categoriesMap).map(([category, stats]) => ({
    category,
    total_amount: stats.total,
    count: stats.count,
  }));

  const result = {
    period,
    total_expenses: totalAmount,
    currency: 'FCFA',
    categories_count: categories.length,
    categories,
  };
  console.log('[DEBUG get_expenses_breakdown]:', JSON.stringify(result));
  try {
    const fs = await import('fs');
    fs.appendFileSync('agent_debug.log', `[DEBUG get_expenses_breakdown]: ${JSON.stringify(result)}\n`);
  } catch (err) {
    console.error('Failed to write debug log:', err);
  }
  return result;
}

async function executeToolCall(
  supabase: any,
  businessId: string,
  name: string,
  args: any
): Promise<Record<string, unknown>> {
  if (!supabase) {
    return { error: 'Base de donnees non accessible' };
  }

  try {
    switch (name) {
      case 'get_recent_orders':
        return await executeGetRecentOrders(supabase, businessId, args);
      case 'get_customers_summary':
        return await executeGetCustomersSummary(supabase, businessId);
      case 'get_products_stock':
        return await executeGetProductsStock(supabase, businessId);
      case 'get_finance_summary':
        return await executeGetFinanceSummary(supabase, businessId, args);
      case 'get_expenses_breakdown':
        return await executeGetExpensesBreakdown(supabase, businessId, args);
      default:
        return { error: 'Fonction non reconnue: ' + name };
    }
  } catch (err: any) {
    return { error: 'Erreur pendant l execution: ' + (err?.message || 'inconnue') };
  }
}

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_recent_orders',
    description: 'Retourne les dernieres commandes enregistrees du commerce avec statut, montant, statut de paiement et date',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.INTEGER,
          description: 'Nombre de commandes a retourner (par defaut 10, maximum 50)',
        },
      },
    },
  },
  {
    name: 'get_customers_summary',
    description: 'Retourne le nombre total de clients et le taux de fidelite (clients ayant passe plus d une commande)',
  },
  {
    name: 'get_products_stock',
    description: 'Retourne la liste des produits avec stock_qty et disponibilite, identifie les ruptures et stocks faibles',
  },
  {
    name: 'get_finance_summary',
    description: 'Retourne le revenu total, les depenses totales et le benefice net pour la periode demandee',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: 'Periode demandee : today, week, month, ou year (par defaut month)',
        },
      },
    },
  },
  {
    name: 'get_expenses_breakdown',
    description: 'Retourne les depenses groupees par categorie pour la periode demandee',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: 'Periode demandee : today, week, month, ou year (par defaut month)',
        },
      },
    },
  },
];

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
        }
      }
    }

    const apiKey = process.env.GEMINI_DEMO_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Erreur lors de la communication avec l assistant IA.',
          details: 'Cle API non configuree sur le serveur.',
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const contents: Array<any> = [];

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

    const baseSystemInstruction =
      'Tu es l assistant IA intelligent de la plateforme de commerce. Tu aides les commercants au Senegal a gerer leurs ventes, stocks, commandes, clients et strategie commerciale. Tu as acces a des fonctions dediees pour consulter les donnees reelles du commerce en direct (commandes recentes, stock des produits, resume des clients et fidelite, resume financier, repartition des depenses). Utilise toujours ces fonctions pour repondre precisement avec les donnees reelles au lieu d indiquer que tu n y as pas acces. Reponds de facon concise, professionnelle et bienveillante. Utilise les FCFA comme devise quand pertinent. IMPORTANT : Quand tu recois un resultat de fonction, tu dois UNIQUEMENT rapporter les donnees exactement telles qu\'elles sont retournees. Ne complete jamais avec des categories, produits, ou chiffres qui n\'apparaissent pas explicitement dans le resultat de la fonction. Si une liste de categories est vide ou courte, rapporte-la telle quelle, n\'ajoute jamais de categories inventees ou d\'exemples generiques.';

    const maxTurns = 3;
    let turn = 0;
    let responseText = '';

    while (turn < maxTurns) {
      turn++;
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
        config: {
          systemInstruction: baseSystemInstruction,
          tools: [{ functionDeclarations }],
        },
      });

      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        if (response.candidates && response.candidates[0]?.content) {
          contents.push(response.candidates[0].content);
        }

        const responseParts: any[] = [];
        for (const call of functionCalls) {
          const callName = call.name || '';
          const callArgs = call.args || {};
          const toolResult = await executeToolCall(supabase, business_id, callName, callArgs);

          responseParts.push({
            functionResponse: {
              name: callName,
              response: toolResult,
              ...(call.id ? { id: call.id } : {}),
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });
      } else {
        responseText = response.text || '';
        break;
      }
    }

    if (!responseText && turn >= maxTurns) {
      const finalRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents,
        config: {
          systemInstruction: baseSystemInstruction,
        },
      });
      responseText = finalRes.text || '';
    }

    return NextResponse.json({
      text: responseText,
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Erreur lors de la communication avec l assistant IA.',
        details: err?.message || 'Erreur interne inconnue',
      },
      { status: 500 }
    );
  }
}
