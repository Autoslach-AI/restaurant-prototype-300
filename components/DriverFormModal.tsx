'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2, Users } from 'lucide-react';
import { Driver } from '@/lib/types';
import { uploadDriverPhoto, insertDriver, updateDriver } from '@/lib/supabase';

export interface DriverFormModalProps {
  isOpen: boolean;
  driver: Driver | null;
  businessId: string;
  onClose: () => void;
  onSaved: (driver: Driver) => void;
}

export default function DriverFormModal({
  isOpen,
  driver,
  businessId,
  onClose,
  onSaved,
}: DriverFormModalProps) {
  const [driverFormName, setDriverFormName] = useState('');
  const [driverFormPhone, setDriverFormPhone] = useState('');
  const [driverFormNeighborhood, setDriverFormNeighborhood] = useState('');
  const [driverFormPhotoUrl, setDriverFormPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDriverSaving, setIsDriverSaving] = useState(false);
  const [driverFormError, setDriverFormError] = useState<string | null>(null);
  const driverPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (driver) {
        setDriverFormName(driver.name || '');
        setDriverFormPhone(driver.phone || '');
        setDriverFormNeighborhood(driver.neighborhood || '');
        setDriverFormPhotoUrl(driver.photo_url || null);
      } else {
        setDriverFormName('');
        setDriverFormPhone('');
        setDriverFormNeighborhood('');
        setDriverFormPhotoUrl(null);
      }
      setDriverFormError(null);
    }
  }, [isOpen, driver]);

  if (!isOpen) return null;

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setDriverFormError(null);
    try {
      const res = await uploadDriverPhoto(file, businessId);
      if (res.success && res.url) {
        setDriverFormPhotoUrl(res.url);
      } else {
        setDriverFormError(res.error || "Échec de l'upload de la photo.");
      }
    } catch (err: any) {
      setDriverFormError(err?.message || "Erreur lors de l'upload de la photo.");
    } finally {
      setIsUploadingPhoto(false);
      if (driverPhotoInputRef.current) {
        driverPhotoInputRef.current.value = '';
      }
    }
  };

  const handleSaveDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriverFormError(null);
    const cleanName = driverFormName.trim();
    const cleanPhone = driverFormPhone.trim() || null;
    const cleanNeighborhood = driverFormNeighborhood.trim() || null;
    const cleanPhotoUrl = driverFormPhotoUrl?.trim() || null;

    if (!cleanName) {
      setDriverFormError('Le nom du livreur est requis.');
      return;
    }
    if (cleanName.length > 80) {
      setDriverFormError('Le nom ne doit pas dépasser 80 caractères.');
      return;
    }
    if (cleanPhone && cleanPhone.length > 30) {
      setDriverFormError('Le téléphone ne doit pas dépasser 30 caractères.');
      return;
    }
    if (cleanNeighborhood && cleanNeighborhood.length > 80) {
      setDriverFormError('Le quartier ne doit pas dépasser 80 caractères.');
      return;
    }

    setIsDriverSaving(true);
    try {
      if (driver) {
        const res = await updateDriver(driver.id, businessId, {
          name: cleanName,
          phone: cleanPhone,
          neighborhood: cleanNeighborhood,
          photo_url: cleanPhotoUrl,
        });
        if (res.success && res.driver) {
          onSaved(res.driver);
          onClose();
        } else {
          setDriverFormError(res.error || 'Erreur lors de la modification.');
        }
      } else {
        const res = await insertDriver({
          business_id: businessId,
          name: cleanName,
          phone: cleanPhone,
          neighborhood: cleanNeighborhood,
          photo_url: cleanPhotoUrl,
          is_active: true,
        });
        if (res.success && res.driver) {
          onSaved(res.driver);
          onClose();
        } else {
          setDriverFormError(res.error || "Erreur lors de l'enregistrement.");
        }
      }
    } catch (err: any) {
      setDriverFormError(err?.message || 'Erreur inattendue.');
    } finally {
      setIsDriverSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl max-w-sm w-full p-4 shadow-xl space-y-3 text-slate-800">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#E5DCD0]">
          <h3 className="text-xs font-bold text-slate-900">
            {driver ? 'Modifier le livreur' : 'Nouveau livreur'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {driverFormError && (
          <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
            {driverFormError}
          </div>
        )}

        <form onSubmit={handleSaveDriverSubmit} className="space-y-3">
          {/* Photo du livreur (aperçu rond, ajouter, changer, retirer) */}
          <div className="flex flex-col items-center justify-center pt-1 pb-1">
            <input
              ref={driverPhotoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handlePhotoFileChange}
            />
            <div className="relative group">
              {driverFormPhotoUrl ? (
                <img
                  src={driverFormPhotoUrl}
                  alt="Aperçu livreur"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#1B4B4A] shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white border border-[#E5DCD0] flex flex-col items-center justify-center text-slate-400 shadow-xs">
                  <Users className="w-6 h-6 text-slate-300" />
                </div>
              )}

              <button
                type="button"
                onClick={() => driverPhotoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 p-1 bg-[#1B4B4A] hover:bg-[#153a39] text-white rounded-full shadow-md cursor-pointer disabled:opacity-50"
                title={driverFormPhotoUrl ? 'Changer la photo' : 'Ajouter une photo'}
              >
                {isUploadingPhoto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => driverPhotoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="text-[11px] font-semibold text-[#1B4B4A] hover:underline cursor-pointer"
              >
                {driverFormPhotoUrl ? 'Changer' : 'Ajouter une photo'}
              </button>
              {driverFormPhotoUrl && (
                <>
                  <span className="text-slate-300 text-xs">·</span>
                  <button
                    type="button"
                    onClick={() => setDriverFormPhotoUrl(null)}
                    disabled={isUploadingPhoto}
                    className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                  >
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nom complet <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={driverFormName}
              onChange={(e) => setDriverFormName(e.target.value)}
              placeholder="Ex: Moussa Diop"
              required
              maxLength={80}
              className="w-full bg-white border border-[#E5DCD0] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Téléphone
            </label>
            <input
              type="tel"
              value={driverFormPhone}
              onChange={(e) => setDriverFormPhone(e.target.value)}
              placeholder="Ex: +221 77 123 45 67"
              maxLength={30}
              className="w-full bg-white border border-[#E5DCD0] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quartier habituel (optionnel)
            </label>
            <input
              type="text"
              value={driverFormNeighborhood}
              maxLength={80}
              onChange={(e) => setDriverFormNeighborhood(e.target.value)}
              placeholder="Ex: Médina, Almadies, Sacré-Cœur..."
              className="w-full bg-white border border-[#E5DCD0] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#1B4B4A]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isDriverSaving || isUploadingPhoto}
              className="px-3.5 py-1 bg-[#1B4B4A] hover:bg-[#153a39] text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {isDriverSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
