'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  X,
  Upload,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Business, Category, Product } from '@/lib/types';
import { uploadProductImage } from '@/lib/supabase';

export interface ProductsSectionProps {
  business: Business;
  businessProducts: Product[];
  businessCategories: Category[];
  onSaveProduct: (productData: Partial<Product> & { name: string; price: number; category_id: string }) => void;
  onDeleteProduct: (productId: string) => void;
  onSaveCategory: (name: string, categoryId?: string) => void;
  onDeleteCategory: (categoryId: string) => void;
}

export default function ProductsSection({
  business,
  businessProducts,
  businessCategories,
  onSaveProduct,
  onDeleteProduct,
  onSaveCategory,
  onDeleteCategory,
}: ProductsSectionProps) {
  // Category filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Product modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [productImageError, setProductImageError] = useState<string | null>(null);

  // Category modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.price || !editingProduct?.category_id) return;

    onSaveProduct({
      id: editingProduct.id,
      name: editingProduct.name,
      price: Number(editingProduct.price),
      category_id: editingProduct.category_id,
      description: editingProduct.description || '',
      image_url:
        editingProduct.image_url ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      available: editingProduct.available !== undefined ? editingProduct.available : true,
      stock_qty: editingProduct.stock_qty !== undefined ? Number(editingProduct.stock_qty) : null,
    });

    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onSaveCategory(newCatName.trim());
    setNewCatName('');
  };

  // Filtered products according to selected category
  const filteredProducts = businessProducts.filter((prod) => {
    if (selectedCategoryId === 'all') return true;
    return prod.category_id === selectedCategoryId;
  });

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-500 font-bold px-2 whitespace-nowrap">
            Catalogue : <span className="text-slate-900 font-black">{businessProducts.length}</span> produit(s), <span className="text-slate-900 font-black">{businessCategories.length}</span> catégorie(s)
          </div>

          {/* Menu déroulant de filtre par catégorie */}
          <div className="relative">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-2xs"
            >
              <option value="all">Toutes les catégories ({businessProducts.length})</option>
              {businessCategories.map((cat) => {
                const count = businessProducts.filter((p) => p.category_id === cat.id).length;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl flex items-center space-x-2 border border-slate-200 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Catégorie</span>
          </button>

          <button
            onClick={() => {
              setEditingProduct({ category_id: selectedCategoryId !== 'all' ? selectedCategoryId : (businessCategories[0]?.id || '') });
              setIsProductModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Produit</span>
          </button>
        </div>
      </div>

      {/* Products Grid */}
      {businessProducts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Package className="w-7 h-7" />
          </div>
          <h4 className="text-base font-extrabold text-slate-900">Aucun produit</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Votre catalogue est vide. Créez une catégorie puis ajoutez votre premier produit pour qu&apos;il soit disponible sur la boutique.
          </p>
          <button
            onClick={() => {
              setEditingProduct({ category_id: businessCategories[0]?.id || '' });
              setIsProductModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Produit</span>
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Package className="w-7 h-7" />
          </div>
          <h4 className="text-base font-extrabold text-slate-900">Aucun produit dans cette catégorie</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            Aucun produit ne correspond à la catégorie sélectionnée. Vous pouvez en ajouter un ou changer de filtre.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
            >
              Afficher tous les produits
            </button>
            <button
              onClick={() => {
                setEditingProduct({ category_id: selectedCategoryId !== 'all' ? selectedCategoryId : (businessCategories[0]?.id || '') });
                setIsProductModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un Produit</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((prod) => {
            const cat = businessCategories.find((c) => c.id === prod.category_id);
            return (
              <div key={prod.id} className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <Image
                      src={prod.image_url}
                      alt={prod.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                    <div className="absolute top-3 right-3 flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-2xs ${
                          prod.available
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {prod.available ? 'Disponible' : 'Épuisé'}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      {cat?.name || 'Catégorie'}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base mt-1">{prod.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{prod.description}</p>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                  <div className="mt-3">
                    <span className="text-lg font-black text-emerald-700 block">
                      {prod.price.toLocaleString()} {business.currency}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Stock : {prod.stock_qty === null ? 'Illimité' : `${prod.stock_qty} unités`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mt-3">
                    <button
                      onClick={() => {
                        setEditingProduct(prod);
                        setIsProductModalOpen(true);
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                      title="Modifier"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProduct(prod.id);
                      }}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      title="Supprimer le produit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingProduct?.id ? 'Modifier le Produit' : 'Ajouter un Produit'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Catégorie</label>
                <select
                  value={editingProduct?.category_id || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs"
                  required
                >
                  <option value="">Sélectionner une catégorie...</option>
                  {businessCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Nom du Produit</label>
                <input
                  type="text"
                  value={editingProduct?.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Thieboudienne au Poisson"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Prix ({business.currency})</label>
                  <input
                    type="number"
                    value={editingProduct?.price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-extrabold focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="3500"
                    required
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Stock Quantité (Optionnel)</label>
                  <input
                    type="number"
                    value={editingProduct?.stock_qty ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock_qty: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="Illimité si vide"
                  />
                </div>
              </div>

              {/* Image Input: File Upload OR Direct URL */}
              <div className="space-y-2">
                <label className="font-extrabold text-slate-700 block mb-1">
                  Photo du produit
                </label>

                {/* Upload Button + File Input + Direct URL */}
                <div className="space-y-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      id="product-image-upload-input"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setProductImageError(null);

                        // Client-side 5MB size check
                        const MAX_SIZE_BYTES = 5 * 1024 * 1024;
                        if (file.size > MAX_SIZE_BYTES) {
                          const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
                          setProductImageError(`L'image est trop volumineuse (${sizeMb} Mo). La taille maximale est de 5 Mo.`);
                          e.target.value = '';
                          return;
                        }

                        setProductImageUploading(true);
                        try {
                          const res = await uploadProductImage(file, business.id);
                          if (res.success && res.url) {
                            setEditingProduct((prev) => ({ ...(prev || {}), image_url: res.url }));
                          } else {
                            setProductImageError(res.error || "Échec de l'upload de l'image.");
                          }
                        } catch (err: any) {
                          setProductImageError(err?.message || "Erreur lors de l'envoi de l'image.");
                        } finally {
                          setProductImageUploading(false);
                          e.target.value = '';
                        }
                      }}
                    />

                    {/* Trigger Button */}
                    <label
                      htmlFor="product-image-upload-input"
                      className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-2xs border ${
                        productImageUploading
                          ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {productImageUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                          <span>Upload en cours...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-emerald-600" />
                          <span>Uploader une image</span>
                        </>
                      )}
                    </label>

                    <span className="text-[11px] text-slate-400 font-medium">
                      Max 5 Mo (JPEG, PNG, WEBP, GIF, HEIC/iPhone)
                    </span>
                  </div>

                  {/* Direct Image URL input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-500">Ou saisir une URL directe :</span>
                      {editingProduct?.image_url && (
                        <button
                          type="button"
                          onClick={() => setEditingProduct((prev) => ({ ...(prev || {}), image_url: '' }))}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Effacer l&apos;image
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={editingProduct?.image_url || ''}
                      onChange={(e) => {
                        setProductImageError(null);
                        setEditingProduct({ ...editingProduct, image_url: e.target.value });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono text-[11px] focus:outline-none focus:border-emerald-500 shadow-2xs"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  {/* Error Message */}
                  {productImageError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{productImageError}</span>
                    </div>
                  )}

                  {/* Image Preview */}
                  {editingProduct?.image_url && (
                    <div className="flex items-center space-x-2.5 pt-1">
                      <div className="relative w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-2xs">
                        <img
                          src={editingProduct.image_url}
                          alt="Aperçu produit"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-emerald-700 block">✓ Image prête</span>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{editingProduct.image_url}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editingProduct?.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="Composition du plat ou détails..."
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="prod_available"
                  checked={editingProduct?.available !== false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, available: e.target.checked })}
                  className="rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="prod_available" className="font-extrabold text-slate-800 cursor-pointer">
                  Produit disponible à la commande
                </label>
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Sauvegarder le Produit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">Gestion des Catégories</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulaire d'ajout */}
            <form onSubmit={handleCategorySubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Ajouter une nouvelle catégorie</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="ex: Desserts, Boissons Fraîches"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </form>

            {/* Liste des catégories existantes avec suppression */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">
                Catégories existantes ({businessCategories.length})
              </span>

              {businessCategories.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Aucune catégorie pour le moment.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {businessCategories.map((cat) => {
                    const count = businessProducts.filter((p) => p.category_id === cat.id).length;
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 truncate">{cat.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">({count} produit{count > 1 ? 's' : ''})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (count > 0) {
                              if (!confirm(`Cette catégorie contient ${count} produit(s). Confirmez-vous la suppression ?`)) {
                                return;
                              }
                            }
                            onDeleteCategory(cat.id);
                            if (selectedCategoryId === cat.id) {
                              setSelectedCategoryId('all');
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                          title="Supprimer la catégorie"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
