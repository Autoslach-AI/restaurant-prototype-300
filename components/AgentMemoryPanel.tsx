'use client';

// À restreindre au propriétaire après l'authentification réelle.

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Bookmark,
  AlertCircle,
  Info,
  Check,
} from 'lucide-react';
import {
  fetchAgentMemoryConfig,
  fetchAgentMemories,
  insertAgentMemory,
  updateAgentMemory,
  softDeleteAgentMemory,
} from '@/lib/supabase';
import { AgentMemory } from '@/lib/types';
import { ResolvedAgentMemoryConfig } from '@/lib/agent-config';

interface AgentMemoryPanelProps {
  businessId: string;
  onClose: () => void;
}

export default function AgentMemoryPanel({ businessId, onClose }: AgentMemoryPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<ResolvedAgentMemoryConfig | null>(null);
  const [memories, setMemories] = useState<AgentMemory[]>([]);

  // Ajout d'un souvenir
  const [newSection, setNewSection] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Modification en place
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Suppression avec modale de confirmation React
  const [deletingMemory, setDeletingMemory] = useState<AgentMemory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      fetchAgentMemoryConfig(businessId),
      fetchAgentMemories(businessId),
    ])
      .then(([cfg, mems]) => {
        if (!isMounted) return;
        setConfig(cfg);
        setMemories(mems || []);
        if (cfg?.sections && cfg.sections.length > 0) {
          setNewSection(cfg.sections[0].id);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement configuration mémoire:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [businessId]);

  const isLimitReached = config ? memories.length >= config.maxItems : false;

  const groupedMemories = useMemo(() => {
    if (!config) return [];
    return config.sections.map((sec) => ({
      section: sec,
      items: memories.filter((m) => m.section === sec.id),
    }));
  }, [config, memories]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || isLimitReached || isAdding) return;

    setAddError(null);
    setIsAdding(true);

    const res = await insertAgentMemory({
      business_id: businessId,
      section: newSection,
      content: newContent,
      source: 'merchant',
      config,
    });

    if (res.success && res.memory) {
      setMemories((prev) => [...prev, res.memory!]);
      setNewContent('');
      setAddError(null);
    } else {
      setAddError(res.error || "Impossible d'enregistrer le souvenir.");
    }

    setIsAdding(false);
  };

  const handleStartEdit = (m: AgentMemory) => {
    setEditingMemoryId(m.id);
    setEditSection(m.section);
    setEditContent(m.content);
    setUpdateError(null);
  };

  const handleCancelEdit = () => {
    setEditingMemoryId(null);
    setEditSection('');
    setEditContent('');
    setUpdateError(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!config || isUpdating) return;

    setUpdateError(null);
    setIsUpdating(true);

    const res = await updateAgentMemory({
      id,
      business_id: businessId,
      section: editSection,
      content: editContent,
      config,
    });

    if (res.success && res.memory) {
      setMemories((prev) => prev.map((item) => (item.id === id ? res.memory! : item)));
      handleCancelEdit();
    } else {
      setUpdateError(res.error || 'Erreur lors de la mise à jour.');
    }

    setIsUpdating(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMemory || isDeleting) return;

    setDeleteError(null);
    setIsDeleting(true);

    const res = await softDeleteAgentMemory({
      id: deletingMemory.id,
      business_id: businessId,
    });

    if (res.success) {
      setMemories((prev) => prev.filter((m) => m.id !== deletingMemory.id));
      setDeletingMemory(null);
    } else {
      setDeleteError(res.error || 'Erreur lors de la suppression.');
    }

    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E5DCD0] flex flex-col max-h-[90vh] space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DCD0]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#F4EFEA] text-[#1B4B4A] rounded-xl border border-[#E5DCD0]">
              <Bookmark className="w-5 h-5 text-[#1B4B4A]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#241F1B]">Mémoire du commerce</h2>
              <p className="text-xs text-slate-500">
                Connaissances durables utilisées par l&apos;Assistant IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B4B4A]" />
            <p className="text-xs text-slate-500">Chargement de la mémoire...</p>
          </div>
        ) : !config ? (
          <div className="p-6 text-center space-y-3 bg-[#FAF7F2] rounded-xl border border-[#E5DCD0]">
            <AlertCircle className="w-8 h-8 text-[#B5451B] mx-auto" />
            <p className="text-sm font-semibold text-[#241F1B]">
              La mémoire n&apos;est pas configurée pour ce commerce.
            </p>
            <p className="text-xs text-slate-500">
              Contactez le support ou l&apos;administrateur pour activer et définir les sections de mémoire pour votre commerce.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Bannière d'information */}
            <div className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl p-3 flex items-start space-x-2.5 text-xs text-slate-600">
              <Info className="w-4 h-4 text-[#1B4B4A] shrink-0 mt-0.5" />
              <p>
                Ces informations sont transmises à l&apos;Assistant à chaque question et consomment des tokens. N&apos;y mettez ni mot de passe ni numéro de carte.
              </p>
            </div>

            {/* Compteur de souvenirs */}
            <div className="flex items-center justify-between text-xs font-medium px-1">
              <span className="text-slate-500">Capacité de stockage</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-full border ${
                  isLimitReached
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-[#F4EFEA] text-[#1B4B4A] border-[#E5DCD0]'
                }`}
              >
                {memories.length} / {config.maxItems} souvenirs
              </span>
            </div>

            {/* Formulaire d'ajout */}
            <form onSubmit={handleAddMemory} className="p-4 bg-[#FAF7F2] rounded-xl border border-[#E5DCD0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#241F1B] flex items-center space-x-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#1B4B4A]" />
                  <span>Ajouter un souvenir</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {newContent.length} / {config.maxChars} caractères
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Section</label>
                  <select
                    disabled={isLimitReached || isAdding}
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full text-xs bg-white border border-[#E5DCD0] rounded-lg px-2.5 py-2 text-[#241F1B] focus:outline-none focus:border-[#1B4B4A] disabled:opacity-50"
                  >
                    {config.sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Information à mémoriser</label>
                  <textarea
                    disabled={isLimitReached || isAdding}
                    rows={2}
                    value={newContent}
                    maxLength={config.maxChars}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Ex: Le restaurant ne livre pas les dimanches soir..."
                    className="w-full text-xs bg-white border border-[#E5DCD0] rounded-lg p-2.5 text-[#241F1B] focus:outline-none focus:border-[#1B4B4A] disabled:opacity-50 resize-none"
                  />
                </div>
              </div>

              {addError && (
                <div className="text-xs text-[#B5451B] bg-red-50 border border-red-200 rounded-lg p-2 flex items-start space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}

              {isLimitReached && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  La limite maximale de souvenirs est atteinte ({config.maxItems} / {config.maxItems}). Supprimez un souvenir existant pour en ajouter un nouveau.
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLimitReached || !newContent.trim() || isAdding}
                  className="px-4 py-2 bg-[#1B4B4A] hover:bg-[#153B3A] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 shadow-2xs"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Enregistrer</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Liste groupée des souvenirs */}
            <div className="space-y-4">
              {memories.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs bg-[#FAF7F2] rounded-xl border border-[#E5DCD0]">
                  Aucun souvenir pour le moment
                </div>
              ) : (
                groupedMemories.map(({ section, items }) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={section.id} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#1B4B4A] bg-[#F4EFEA] px-2.5 py-0.5 rounded-md border border-[#E5DCD0]">
                          {section.label}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({items.length})
                        </span>
                      </div>

                      <div className="space-y-2">
                        {items.map((m) => {
                          const isEditing = editingMemoryId === m.id;

                          if (isEditing) {
                            return (
                              <div
                                key={m.id}
                                className="p-3 bg-white border-2 border-[#1B4B4A] rounded-xl shadow-xs space-y-2.5"
                              >
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-slate-700">Modifier le souvenir</span>
                                    <select
                                      value={editSection}
                                      onChange={(e) => setEditSection(e.target.value)}
                                      className="text-xs bg-[#F4EFEA] border border-[#E5DCD0] rounded-md px-2 py-0.5 text-[#241F1B]"
                                    >
                                      {config.sections.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <span>
                                    {editContent.length} / {config.maxChars}
                                  </span>
                                </div>

                                <textarea
                                  rows={2}
                                  maxLength={config.maxChars}
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full text-xs border border-[#E5DCD0] rounded-lg p-2 text-[#241F1B] focus:outline-none focus:border-[#1B4B4A] resize-none"
                                />

                                {updateError && (
                                  <div className="text-xs text-[#B5451B] bg-red-50 border border-red-200 rounded-md p-1.5 flex items-start space-x-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>{updateError}</span>
                                  </div>
                                )}

                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={isUpdating}
                                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(m.id)}
                                    disabled={!editContent.trim() || isUpdating}
                                    className="px-3 py-1.5 text-xs font-semibold bg-[#1B4B4A] text-white rounded-lg hover:bg-[#153B3A] transition-colors cursor-pointer flex items-center space-x-1 disabled:opacity-50"
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <span>Enregistrer</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={m.id}
                              className="p-3 bg-white border border-[#E5DCD0] rounded-xl hover:border-slate-300 transition-all flex items-start justify-between space-x-3 group"
                            >
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <p className="text-xs text-[#241F1B] whitespace-pre-wrap break-words leading-relaxed">
                                  {m.content}
                                </p>
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                      m.source === 'agent'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}
                                  >
                                    {m.source === 'agent' ? "Appris par l'assistant" : 'Ajouté par vous'}
                                  </span>
                                  {m.created_at && (
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(m.created_at).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  onClick={() => handleStartEdit(m)}
                                  className="p-1.5 text-slate-400 hover:text-[#1B4B4A] hover:bg-[#F4EFEA] rounded-lg transition-colors cursor-pointer"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingMemory(m)}
                                  className="p-1.5 text-slate-400 hover:text-[#B5451B] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-[#E5DCD0] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </motion.div>

      {/* Modale React de confirmation de suppression */}
      <AnimatePresence>
        {deletingMemory && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#E5DCD0] space-y-4"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-[#B5451B] shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#241F1B]">Supprimer ce souvenir ?</h3>
                  <p className="text-xs text-slate-500">
                    Cette action désactivera durablement ce souvenir de la mémoire de l&apos;assistant.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DCD0] text-xs text-slate-700 italic max-h-24 overflow-y-auto">
                &ldquo;{deletingMemory.content}&rdquo;
              </div>

              {deleteError && (
                <div className="text-xs text-[#B5451B] bg-red-50 border border-red-200 rounded-md p-2 flex items-start space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingMemory(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-semibold bg-[#B5451B] hover:bg-[#963713] text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Suppression...</span>
                    </>
                  ) : (
                    <span>Confirmer la suppression</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
