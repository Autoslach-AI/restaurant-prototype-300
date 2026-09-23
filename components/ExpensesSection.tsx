import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Loader2,
  Search,
  Check,
  Edit2,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  Business,
  Staff,
  Expense,
  ExpenseCategoryItem,
} from '@/lib/types';
import {
  fetchExpensesForBusiness,
  fetchExpenseCategoriesForBusiness,
  insertExpenseCategory,
  deleteExpenseCategory,
  insertExpense,
  updateExpense,
  deleteExpense,
} from '@/lib/supabase';

function getCategoryBadgeStyle(category?: string | null): string {
  const palette = [
    'bg-purple-50 text-purple-700 border-purple-200',
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-amber-50 text-amber-700 border-amber-200',
    'bg-rose-50 text-rose-700 border-rose-200',
    'bg-indigo-50 text-indigo-700 border-indigo-200',
    'bg-teal-50 text-teal-700 border-teal-200',
    'bg-cyan-50 text-cyan-700 border-cyan-200',
  ];
  if (!category || !category.trim()) return 'bg-slate-100 text-slate-700 border-slate-200';
  let hash = 0;
  const str = category.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
}

export interface ExpensesSectionProps {
  business: Business;
  activeStaff?: Staff | null;
}

export default function ExpensesSection({
  business,
  activeStaff,
}: ExpensesSectionProps) {
  // Expenses state & modal
  const [businessExpenses, setBusinessExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryItem[]>([]);
  const [expensesLoading, setExpensesLoading] = useState<boolean>(false);
  const [expenseSearch, setExpenseSearch] = useState<string>('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseFormCategory, setExpenseFormCategory] = useState<string>('');
  const [expenseFormLabel, setExpenseFormLabel] = useState<string>('');
  const [expenseFormAmount, setExpenseFormAmount] = useState<string>('');
  const [expenseFormDate, setExpenseFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expenseFormIsRecurring, setExpenseFormIsRecurring] = useState<boolean>(false);
  const [expenseSaving, setExpenseSaving] = useState<boolean>(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseDeletingId, setExpenseDeletingId] = useState<string | null>(null);

  // Soft-deleted categories state with localStorage persistence
  const [deletedCategoryIds, setDeletedCategoryIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && business?.id) {
      try {
        const saved = localStorage.getItem(`expenses_deleted_categories_${business.id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [isTrashModalOpen, setIsTrashModalOpen] = useState<boolean>(false);

  // Expense Category modal & actions state
  const [isExpenseCategoryModalOpen, setIsExpenseCategoryModalOpen] = useState<boolean>(false);
  const [newExpenseCatName, setNewExpenseCatName] = useState<string>('');
  const [expenseCatSaving, setExpenseCatSaving] = useState<boolean>(false);
  const [expenseCatError, setExpenseCatError] = useState<string | null>(null);
  const [expenseCatDeletingId, setExpenseCatDeletingId] = useState<string | null>(null);

  // Sync deleted categories to localStorage
  useEffect(() => {
    if (business?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`expenses_deleted_categories_${business.id}`, JSON.stringify(deletedCategoryIds));
      } catch {
        // ignore
      }
    }
  }, [deletedCategoryIds, business?.id]);

  // Derived active and trashed categories
  const activeCategories = expenseCategories.filter((cat) => !deletedCategoryIds.includes(cat.id));
  const trashedCategories = expenseCategories.filter((cat) => deletedCategoryIds.includes(cat.id));

  // Load expenses and categories effect
  useEffect(() => {
    let isMounted = true;
    async function loadExpensesData() {
      if (!business?.id) return;
      setExpensesLoading(true);
      try {
        const [expensesData, categoriesData] = await Promise.all([
          fetchExpensesForBusiness(business.id),
          fetchExpenseCategoriesForBusiness(business.id),
        ]);
        if (isMounted) {
          setBusinessExpenses(expensesData || []);
          setExpenseCategories(categoriesData || []);
          setExpensesLoading(false);
        }
      } catch (err) {
        console.error('Error fetching expenses/categories:', err);
        if (isMounted) setExpensesLoading(false);
      }
    }
    loadExpensesData();
    return () => {
      isMounted = false;
    };
  }, [business?.id]);

  const handleOpenNewExpenseCategoryModal = () => {
    setNewExpenseCatName('');
    setExpenseCatError(null);
    setIsExpenseCategoryModalOpen(true);
  };

  const handleSaveExpenseCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id) return;
    const trimmed = newExpenseCatName.trim();
    if (!trimmed) {
      setExpenseCatError('Le nom de la catégorie est requis.');
      return;
    }

    setExpenseCatSaving(true);
    setExpenseCatError(null);
    const res = await insertExpenseCategory({
      business_id: business.id,
      name: trimmed,
    });
    setExpenseCatSaving(false);

    if (res.success && res.category) {
      setExpenseCategories((prev) =>
        [...prev, res.category!].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
      );
      // Ensure it's not marked deleted
      setDeletedCategoryIds((prev) => prev.filter((id) => id !== res.category!.id));
      setNewExpenseCatName('');
      setIsExpenseCategoryModalOpen(false);
    } else {
      setExpenseCatError(res.error || 'Erreur lors de la création de la catégorie.');
    }
  };

  const handleSoftDeleteCategory = (catId: string) => {
    setDeletedCategoryIds((prev) => (prev.includes(catId) ? prev : [...prev, catId]));
    const targetCat = expenseCategories.find((c) => c.id === catId);
    if (targetCat && expenseCategoryFilter === targetCat.name) {
      setExpenseCategoryFilter('all');
    }
  };

  const handleRestoreCategory = (catId: string) => {
    setDeletedCategoryIds((prev) => prev.filter((id) => id !== catId));
  };

  const handlePermanentDeleteCategory = async (catId: string, catName: string) => {
    if (!window.confirm(`Supprimer définitivement la catégorie "${catName}" de la base de données ?`)) {
      return;
    }
    setExpenseCatDeletingId(catId);
    const res = await deleteExpenseCategory(catId);
    setExpenseCatDeletingId(null);
    if (res.success) {
      setExpenseCategories((prev) => prev.filter((c) => c.id !== catId));
      setDeletedCategoryIds((prev) => prev.filter((id) => id !== catId));
    } else {
      alert(res.error || 'Erreur lors de la suppression définitive de la catégorie.');
    }
  };

  const handleOpenNewExpenseModal = () => {
    setEditingExpense(null);
    setExpenseFormCategory(activeCategories[0]?.name || '');
    setExpenseFormLabel('');
    setExpenseFormAmount('');
    setExpenseFormDate(new Date().toISOString().split('T')[0]);
    setExpenseFormIsRecurring(false);
    setExpenseError(null);
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpenseModal = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseFormCategory(expense.category || '');
    setExpenseFormLabel(expense.label || '');
    setExpenseFormAmount(String(expense.amount || ''));
    setExpenseFormDate(expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setExpenseFormIsRecurring(Boolean(expense.is_recurring));
    setExpenseError(null);
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id) return;
    const trimmedCategory = expenseFormCategory.trim();
    if (!trimmedCategory) {
      setExpenseError('La catégorie est requise');
      return;
    }
    const trimmedLabel = expenseFormLabel.trim();
    if (!trimmedLabel) {
      setExpenseError('Le libellé est requis');
      return;
    }
    const numAmount = parseFloat(expenseFormAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setExpenseError('Veuillez renseigner un montant valide (> 0)');
      return;
    }
    if (!expenseFormDate) {
      setExpenseError('Veuillez sélectionner une date');
      return;
    }

    setExpenseSaving(true);
    setExpenseError(null);

    if (editingExpense) {
      const res = await updateExpense(editingExpense.id, {
        category: trimmedCategory,
        label: trimmedLabel,
        amount: numAmount,
        date: expenseFormDate,
        is_recurring: expenseFormIsRecurring,
      });

      setExpenseSaving(false);
      if (res.success && res.expense) {
        setBusinessExpenses((prev) => prev.map((exp) => (exp.id === editingExpense.id ? res.expense! : exp)));
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
      } else {
        setExpenseError(res.error || 'Erreur lors de la modification de la dépense');
      }
    } else {
      const res = await insertExpense({
        business_id: business.id,
        category: trimmedCategory,
        label: trimmedLabel,
        amount: numAmount,
        date: expenseFormDate,
        is_recurring: expenseFormIsRecurring,
        created_by: activeStaff?.id || 'owner',
      });

      setExpenseSaving(false);
      if (res.success && res.expense) {
        setBusinessExpenses((prev) => [res.expense!, ...prev]);
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
      } else {
        setExpenseError(res.error || "Erreur lors de l'enregistrement de la dépense");
      }
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      return;
    }
    setExpenseDeletingId(expenseId);
    const res = await deleteExpense(expenseId);
    setExpenseDeletingId(null);
    if (res.success) {
      setBusinessExpenses((prev) => prev.filter((exp) => exp.id !== expenseId));
    } else {
      alert(res.error || 'Erreur lors de la suppression de la dépense');
    }
  };

  return (
    <div className="space-y-5">
      {/* Title & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
          <Receipt className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Gestion des Dépenses</h2>
          <p className="text-xs text-slate-500 font-medium">Suivez et catégorisez les charges de votre entreprise</p>
        </div>
      </div>

      {/* Header Toolbar on a single line: Search + Filter + Corbeille on left, Action buttons on right */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Barre de recherche (largeur réduite max-w-xs) */}
          <div className="relative w-full sm:w-64 max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par libellé..."
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl pl-10 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
            />
          </div>

          {/* Filtre catégorie */}
          <div className="flex items-center gap-2">
            <select
              value={expenseCategoryFilter}
              onChange={(e) => setExpenseCategoryFilter(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-700 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[190px]"
            >
              <option value="all">Toutes les catégories</option>
              {activeCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Petit lien discret Corbeille (X) près du filtre */}
          <button
            type="button"
            onClick={() => setIsTrashModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              trashedCategories.length > 0
                ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200/80'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 border-transparent'
            }`}
            title="Ouvrir la corbeille des catégories"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Corbeille ({trashedCategories.length})</span>
          </button>
        </div>

        {/* Boutons d'actions à droite */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenNewExpenseCategoryModal}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl flex items-center gap-1.5 border border-slate-200 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Catégorie</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewExpenseModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une dépense</span>
          </button>
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {expensesLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-bold">Chargement des dépenses...</p>
          </div>
        ) : (() => {
          const filteredExpenses = businessExpenses.filter((exp) => {
            const matchesSearch = !expenseSearch.trim() || exp.label.toLowerCase().includes(expenseSearch.toLowerCase());
            const matchesCategory =
              expenseCategoryFilter === 'all' ||
              (exp.category || '').trim().toLowerCase() === expenseCategoryFilter.trim().toLowerCase();
            return matchesSearch && matchesCategory;
          });

          if (filteredExpenses.length === 0) {
            return (
              <div className="py-16 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-1" />
                <p className="text-sm font-bold text-slate-600">Aucune dépense enregistrée pour le moment.</p>
                <p className="text-xs text-slate-400 mt-1">Cliquez sur &quot;Ajouter une dépense&quot; pour commencer.</p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4 sm:px-6">Date</th>
                    <th className="py-3.5 px-4">Catégorie</th>
                    <th className="py-3.5 px-4">Libellé</th>
                    <th className="py-3.5 px-4 text-right">Montant</th>
                    <th className="py-3.5 px-4 text-center">Récurrente</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((exp) => {
                    const formattedDate = exp.date
                      ? new Date(exp.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';

                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 sm:px-6 font-bold text-slate-700 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeStyle(exp.category)}`}>
                            {exp.category || 'Non catégorisé'}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-900 max-w-[240px] truncate">
                          {exp.label}
                        </td>
                        <td className="py-4 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                          {Number(exp.amount || 0).toLocaleString('fr-FR')} {business.currency || 'XOF'}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {exp.is_recurring ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3" /> Oui
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium text-[11px]">Non</span>
                          )}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenEditExpenseModal(exp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              disabled={expenseDeletingId === exp.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                              title="Supprimer"
                            >
                              {expenseDeletingId === exp.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Expense Category Modal */}
      {isExpenseCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">Nouvelle Catégorie de Dépense</h3>
              <button
                type="button"
                onClick={() => setIsExpenseCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseCategory} className="space-y-4 text-xs">
              {expenseCatError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-2xl border border-red-200">
                  {expenseCatError}
                </div>
              )}

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Nom de la catégorie</label>
                <input
                  type="text"
                  value={newExpenseCatName}
                  onChange={(e) => setNewExpenseCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Loyer, Salaires, Achats stock, Électricité..."
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={expenseCatSaving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {expenseCatSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Création en cours...</span>
                  </>
                ) : (
                  <span>Créer la Catégorie</span>
                )}
              </button>
            </form>

            {/* Existing Active Categories with Soft-Delete */}
            {activeCategories.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">
                    Catégories existantes ({activeCategories.length})
                  </span>
                  {trashedCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsExpenseCategoryModalOpen(false);
                        setIsTrashModalOpen(true);
                      }}
                      className="text-[11px] font-semibold text-amber-700 hover:underline"
                    >
                      Corbeille ({trashedCategories.length})
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs"
                    >
                      <span className="font-semibold text-slate-800 truncate pr-2">{cat.name}</span>
                      <button
                        type="button"
                        onClick={() => handleSoftDeleteCategory(cat.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Mettre dans la corbeille"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Trash Modal (Corbeille) */}
      {isTrashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Corbeille des Catégories</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {trashedCategories.length} catégorie(s) dans la corbeille
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {trashedCategories.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-300">
                  <Trash2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-600">La corbeille est vide</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Toutes vos catégories sont actives. Lorsqu&apos;une catégorie est supprimée, elle apparaît ici et peut être restaurée à tout moment.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {trashedCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs gap-2"
                  >
                    <div className="truncate flex-1">
                      <span className="font-bold text-slate-800 block truncate">{cat.name}</span>
                      <span className="text-[10px] text-slate-400">Dans la corbeille</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreCategory(cat.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
                        title="Restaurer la catégorie"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePermanentDeleteCategory(cat.id, cat.name)}
                        disabled={expenseCatDeletingId === cat.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        title="Supprimer définitivement"
                      >
                        {expenseCatDeletingId === cat.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              {trashedCategories.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDeletedCategoryIds([])}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  Tout restaurer
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="ml-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Creation / Edit Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingExpense ? 'Modifier la dépense' : 'Ajouter une dépense'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Remplissez les informations ci-dessous</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              {expenseError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-2xl border border-red-200">
                  {expenseError}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Catégorie <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExpenseCategoryModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nouvelle Catégorie</span>
                  </button>
                </div>
                <select
                  value={expenseFormCategory}
                  onChange={(e) => setExpenseFormCategory(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="" disabled>
                    {activeCategories.length === 0 ? 'Aucune catégorie disponible — créez-en une d’abord' : 'Sélectionner une catégorie'}
                  </option>
                  {editingExpense?.category && !activeCategories.some((c) => c.name === editingExpense.category) && (
                    <option value={editingExpense.category}>
                      {editingExpense.category} (archivée)
                    </option>
                  )}
                  {activeCategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {activeCategories.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1 font-medium">
                    Vous n&apos;avez pas encore créé de catégorie. Cliquez sur &quot;Nouvelle Catégorie&quot; ci-dessus.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Libellé <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Loyer du local commercial, Achat carton..."
                  value={expenseFormLabel}
                  onChange={(e) => setExpenseFormLabel(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Montant ({business.currency || 'XOF'}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={expenseFormAmount}
                    onChange={(e) => setExpenseFormAmount(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expenseFormDate}
                    onChange={(e) => setExpenseFormDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={expenseFormIsRecurring}
                    onChange={(e) => setExpenseFormIsRecurring(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-lg border-slate-300 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Dépense récurrente</span>
                    <p className="text-[11px] text-slate-400 font-medium">Cochez si cette dépense revient mensuellement</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={expenseSaving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {expenseSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>{editingExpense ? 'Enregistrer les modifications' : 'Ajouter la dépense'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
