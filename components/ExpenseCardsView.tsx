import React, { useMemo, useState } from 'react';
import {
  Receipt,
  RotateCcw,
  Paperclip,
  Check,
  Edit2,
  Trash2,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Business, Expense } from '@/lib/types';

export interface ExpenseCardsViewProps {
  expenses: Expense[];
  business: Business;
  expensesViewMode: 'active' | 'history';
  groupByCategory: boolean;
  expenseDeletingId: string | null;
  expenseRestoringId: string | null;
  getCategoryBadgeStyle: (category?: string | null) => string;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onRestoreExpense: (expenseId: string) => void;
  onOpenReceipt: (receiptUrl: string, label: string) => void;
}

export default function ExpenseCardsView({
  expenses,
  business,
  expensesViewMode,
  groupByCategory,
  expenseDeletingId,
  expenseRestoringId,
  getCategoryBadgeStyle,
  onEditExpense,
  onDeleteExpense,
  onRestoreExpense,
  onOpenReceipt,
}: ExpenseCardsViewProps) {
  // Sections repliées : enregistre les clés de catégorie repliées (toutes dépliées par défaut)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Calcul réel du total global des dépenses affichées (strictement supérieur à 0 pour éviter division par zéro)
  const totalAmount = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  // Groupement par catégorie et tri des catégories par total décroissant
  const groupedCategories = useMemo(() => {
    const map = new Map<string, { category: string; items: Expense[]; total: number }>();

    for (const exp of expenses) {
      const catName = (exp.category || '').trim() || 'Non catégorisé';
      const existing = map.get(catName);
      const amount = Number(exp.amount) || 0;

      if (existing) {
        existing.items.push(exp);
        existing.total += amount;
      } else {
        map.set(catName, {
          category: catName,
          items: [exp],
          total: amount,
        });
      }
    }

    // Tri des catégories par montant total décroissant
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // État vide identique à la vue Liste existante
  if (expenses.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400">
        {expensesViewMode === 'active' ? (
          <>
            <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-600">Aucune dépense enregistrée pour le moment.</p>
            <p className="text-xs text-slate-400 mt-1">Cliquez sur &quot;Ajouter une dépense&quot; pour commencer.</p>
          </>
        ) : (
          <>
            <RotateCcw className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-600">Aucune dépense dans l&apos;historique.</p>
            <p className="text-xs text-slate-400 mt-1">Les dépenses supprimées apparaîtront ici et pourront être restaurées.</p>
          </>
        )}
      </div>
    );
  }

  const currency = business.currency || 'XOF';

  // Rendu unitaire d'une carte de dépense
  const renderCard = (exp: Expense, showCategoryBadge: boolean) => {
    const amount = Number(exp.amount) || 0;
    // Calcul réel de la part dans le total des dépenses affichées
    const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
    const formattedPercentage =
      percentage < 0.1 && percentage > 0
        ? '< 0,1'
        : percentage.toLocaleString('fr-FR', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          });

    const formattedDate = exp.date
      ? new Date(exp.date).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—';

    return (
      <div
        key={exp.id}
        className="bg-white rounded-2xl border border-[#E5DCD0] p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all hover:border-[#1B4B4A]/40 gap-3"
      >
        {/* Haut de la carte : Libellé + Actions (Modifier / Supprimer ou Restaurer) */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {showCategoryBadge && (
              <div className="mb-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeStyle(
                    exp.category
                  )}`}
                >
                  {exp.category || 'Non catégorisé'}
                </span>
              </div>
            )}
            <p className="text-xs font-bold text-[#241F1B] line-clamp-2 leading-snug" title={exp.label}>
              {exp.label}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">
              {formattedDate}
            </p>
          </div>

          {/* Actions identiques à la liste */}
          <div className="flex items-center gap-1 shrink-0 -mt-0.5 -mr-1">
            {expensesViewMode === 'history' ? (
              <button
                type="button"
                onClick={() => onRestoreExpense(exp.id)}
                disabled={expenseRestoringId === exp.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="Restaurer cette dépense"
              >
                {expenseRestoringId === exp.id ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                <span>Restaurer</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEditExpense(exp)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                  title="Modifier"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteExpense(exp.id)}
                  disabled={expenseDeletingId === exp.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  title="Supprimer"
                >
                  {expenseDeletingId === exp.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Milieu de la carte : Montant en gras + Pastilles Reçu et Récurrente */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-black text-[#241F1B] tracking-tight">
              {amount.toLocaleString('fr-FR')} {currency}
            </span>

            {/* Pastilles conditionnelles */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {exp.receipt_url && (
                <button
                  type="button"
                  onClick={() => onOpenReceipt(exp.receipt_url!, exp.label)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 transition-all cursor-pointer"
                  title="Ouvrir le reçu"
                >
                  <Paperclip className="w-2.5 h-2.5 text-indigo-500" />
                  <span>Reçu</span>
                </button>
              )}

              {exp.is_recurring && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check className="w-2.5 h-2.5" />
                  <span>Récurrente</span>
                </span>
              )}
            </div>
          </div>

          {/* Barre fine de progression en bas de carte : part réelle dans le total des dépenses affichées */}
          <div className="pt-2 border-t border-[#E5DCD0]/60 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
              <span>Part du total</span>
              <span className="font-bold text-[#1B4B4A]">{formattedPercentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#FAF7F2] border border-[#E5DCD0]/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1B4B4A] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 1. Mode par défaut (non groupé) : UNE seule grille
  if (!groupByCategory) {
    return (
      <div className="p-4 sm:p-6 space-y-4 bg-[#FAF7F2]/40">
        {/* Synthèse au-dessus de la grille : n dépenses · total X devise */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5DCD0] text-xs font-bold text-slate-600">
          <span>
            {expenses.length} dépense{expenses.length > 1 ? 's' : ''}
          </span>
          <span className="text-[#1B4B4A] font-black">
            total {totalAmount.toLocaleString('fr-FR')} {currency}
          </span>
        </div>

        {/* Grille : 1 colonne sur mobile, 2 sur tablette, 3 sur grand écran, 4 sur très grand écran */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {expenses.map((exp) => renderCard(exp, true))}
        </div>
      </div>
    );
  }

  // 2. Mode groupé : sections par catégorie avec en-têtes repliables et chevron
  return (
    <div className="p-4 sm:p-6 space-y-8 bg-[#FAF7F2]/40">
      {groupedCategories.map((group) => {
        const isCollapsed = Boolean(collapsedCategories[group.category]);

        return (
          <section key={group.category} className="space-y-3.5">
            {/* En-tête cliquable pour replier/déplier avec chevron */}
            <button
              type="button"
              onClick={() => toggleCategoryCollapse(group.category)}
              className="w-full flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5DCD0] text-left hover:opacity-80 transition-opacity cursor-pointer group"
              title={isCollapsed ? 'Déplier la catégorie' : 'Replier la catégorie'}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-[#1B4B4A] transition-transform duration-200 shrink-0 ${
                    isCollapsed ? '-rotate-90' : 'rotate-0'
                  }`}
                />
                <h3 className="text-xs sm:text-sm font-black text-[#241F1B] tracking-tight truncate">
                  {group.category}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-slate-600 border border-[#E5DCD0] shadow-2xs shrink-0">
                  ({group.items.length})
                </span>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs font-black text-[#1B4B4A]">
                  {group.total.toLocaleString('fr-FR')} {currency}
                </span>
              </div>
            </button>

            {/* Grille de la section si dépliée */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {group.items.map((exp) => renderCard(exp, false))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
