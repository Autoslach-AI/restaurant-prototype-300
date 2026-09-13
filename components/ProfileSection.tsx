'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Info,
  Key,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import {
  supabase,
  updateStaffProfile,
  updateStaffNotificationPreferences,
} from '@/lib/supabase';
import { Business, Staff } from '@/lib/types';

export interface ProfileSectionProps {
  business: Business;
  activeStaff: Staff;
  getInitials: (name?: string) => string;
  cropModalOpen: boolean;
  setCropModalOpen: (open: boolean) => void;
  cropImageSrc: string | null;
  setCropImageSrc: (src: string | null) => void;
  cropTarget: 'profile' | 'staff_invite' | 'customer_create';
  setCropTarget: (target: 'profile' | 'staff_invite' | 'customer_create') => void;
  cropSaving: boolean;
  setCropSaving: (saving: boolean) => void;
}

export default function ProfileSection({
  business,
  activeStaff,
  getInitials,
  cropModalOpen,
  setCropModalOpen,
  cropImageSrc,
  setCropImageSrc,
  cropTarget,
  setCropTarget,
  cropSaving,
  setCropSaving,
}: ProfileSectionProps) {
  // Profile Edit Form States
  const [activeProfileSection, setActiveProfileSection] = useState<'personal' | 'security' | 'notifications' | 'billing'>('personal');
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const [isProfileAvatarZoomOpen, setIsProfileAvatarZoomOpen] = useState(false);

  // Split Name helper
  const splitStaffName = (fullName: string) => {
    const parts = (fullName || '').trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  };

  // Personal Info Form State
  const initialNames = splitStaffName(activeStaff.name);
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [profileEditFirstName, setProfileEditFirstName] = useState(initialNames.firstName);
  const [profileEditLastName, setProfileEditLastName] = useState(initialNames.lastName);
  const [profileEditEmail, setProfileEditEmail] = useState(activeStaff.email || '');
  const [profileEditPhone, setProfileEditPhone] = useState(activeStaff.phone || '');
  const [personalInfoSaving, setPersonalInfoSaving] = useState(false);
  const [personalInfoError, setPersonalInfoError] = useState<string | null>(null);
  const [personalInfoSuccess, setPersonalInfoSuccess] = useState(false);

  const handleCancelPersonalInfo = () => {
    const names = splitStaffName(activeStaff.name);
    setProfileEditFirstName(names.firstName);
    setProfileEditLastName(names.lastName);
    setProfileEditEmail(activeStaff.email || '');
    setProfileEditPhone(activeStaff.phone || '');
    setPersonalInfoError(null);
    setIsEditingPersonalInfo(false);
  };

  const handleSavePersonalInfo = async () => {
    setPersonalInfoError(null);
    const trimmedFirst = profileEditFirstName.trim();
    const trimmedLast = profileEditLastName.trim();
    const trimmedEmail = profileEditEmail.trim();
    const trimmedPhone = profileEditPhone.trim();

    // Validation
    if (!trimmedLast) {
      setPersonalInfoError('Le nom est obligatoire.');
      return;
    }
    if (!trimmedFirst) {
      setPersonalInfoError('Le prénom est obligatoire.');
      return;
    }
    if (!trimmedEmail) {
      setPersonalInfoError('L\'adresse email est obligatoire.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setPersonalInfoError('Veuillez saisir une adresse email valide (ex: amadou@example.com).');
      return;
    }
    if (!trimmedPhone) {
      setPersonalInfoError('Le numéro de téléphone est obligatoire.');
      return;
    }

    setPersonalInfoSaving(true);
    const combinedName = `${trimmedFirst} ${trimmedLast}`;

    try {
      const res = await updateStaffProfile(activeStaff.id, activeStaff.auth_uid, {
        name: combinedName,
        email: trimmedEmail,
        phone: trimmedPhone,
      });

      if (!res.success) {
        setPersonalInfoError(res.error || 'Erreur lors de la mise à jour des informations.');
      } else {
        setIsEditingPersonalInfo(false);
        setPersonalInfoSuccess(true);
        setTimeout(() => setPersonalInfoSuccess(false), 3500);
      }
    } catch (err: any) {
      setPersonalInfoError(err?.message || 'Une erreur inattendue est survenue.');
    } finally {
      setPersonalInfoSaving(false);
    }
  };

  // Security / Password State
  const [securityCurrentPassword, setSecurityCurrentPassword] = useState('');
  const [securityNewPassword, setSecurityNewPassword] = useState('');
  const [securityConfirmPassword, setSecurityConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  const formatLastLogin = (isoString?: string | null) => {
    if (!isoString) return 'Non disponible';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Non disponible';
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Non disponible';
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    const currentPass = securityCurrentPassword.trim();
    const newPassVal = securityNewPassword.trim();
    const confirmPassVal = securityConfirmPassword.trim();

    if (!currentPass) {
      setSecurityError('Veuillez renseigner votre mot de passe actuel pour confirmer votre identité.');
      return;
    }
    if (!newPassVal) {
      setSecurityError('Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (newPassVal.length < 8) {
      setSecurityError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassVal !== confirmPassVal) {
      setSecurityError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSecuritySaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassVal,
      });

      if (error) {
        setSecurityError(error.message || 'Erreur lors de la mise à jour du mot de passe.');
      } else {
        setSecuritySuccess('Votre mot de passe a été mis à jour avec succès.');
        setSecurityCurrentPassword('');
        setSecurityNewPassword('');
        setSecurityConfirmPassword('');
        setTimeout(() => setSecuritySuccess(null), 5000);
      }
    } catch (err: any) {
      setSecurityError(err?.message || 'Une erreur inattendue est survenue.');
    } finally {
      setSecuritySaving(false);
    }
  };

  const [notifyWhatsApp, setNotifyWhatsApp] = useState<boolean>(() => {
    return activeStaff.notification_preferences?.whatsapp ?? true;
  });
  const [notifyEmail, setNotifyEmail] = useState<boolean>(() => {
    return activeStaff.notification_preferences?.email ?? true;
  });
  const [notifySavingType, setNotifySavingType] = useState<'email' | 'whatsapp' | null>(null);
  const [notifySavedFeedback, setNotifySavedFeedback] = useState<'email' | 'whatsapp' | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const handleToggleNotification = async (channel: 'email' | 'whatsapp', targetValue: boolean) => {
    setNotifyError(null);
    setNotifySavingType(channel);

    const newEmail = channel === 'email' ? targetValue : notifyEmail;
    const newWhatsApp = channel === 'whatsapp' ? targetValue : notifyWhatsApp;

    if (channel === 'email') setNotifyEmail(targetValue);
    if (channel === 'whatsapp') setNotifyWhatsApp(targetValue);

    const res = await updateStaffNotificationPreferences(activeStaff.id, activeStaff.auth_uid, {
      email: newEmail,
      whatsapp: newWhatsApp,
    });

    setNotifySavingType(null);
    if (res.success) {
      setNotifySavedFeedback(channel);
      setTimeout(() => {
        setNotifySavedFeedback((current) => (current === channel ? null : current));
      }, 2500);
    } else {
      // Revert in case of error
      if (channel === 'email') setNotifyEmail(!targetValue);
      if (channel === 'whatsapp') setNotifyWhatsApp(!targetValue);
      setNotifyError(res.error || 'Erreur lors de la mise à jour des préférences');
    }
  };

  return (
          <div className="space-y-6">
            {/* Main Profile Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* CARTE DE GAUCHE (~30% / 4 colonnes sur 12) */}
              <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-6">
                {/* Avatar + Nom + Rôle */}
                <div className="flex flex-col items-center text-center">
                  <div className="relative group mb-4">
                    {/* Avatar Display - Click to Zoom if photo exists */}
                    {(activeStaff.photo_url || activeStaff.avatar_url) ? (
                      <button
                        type="button"
                        onClick={() => setIsProfileAvatarZoomOpen(true)}
                        className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-100 cursor-pointer block hover:ring-2 hover:ring-[#1B4B4A]/50 transition-all focus:outline-none"
                        title="Cliquer pour agrandir la photo"
                      >
                        <Image
                          src={activeStaff.photo_url || activeStaff.avatar_url!}
                          alt={activeStaff.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-[#FAF7F2] border-2 border-[#1B4B4A]/20 text-[#1B4B4A] flex items-center justify-center font-black text-3xl shadow-sm cursor-default">
                        {getInitials(activeStaff.name)}
                      </div>
                    )}

                    {/* Overlay d'upload photo - Distinct and stops event propagation */}
                    <label
                      htmlFor="profile-avatar-upload"
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-0 right-0 p-2 rounded-full cursor-pointer transition-all shadow-md z-10 ${
                        profileAvatarUploading
                          ? 'bg-slate-400 text-white cursor-not-allowed'
                          : 'bg-[#1B4B4A] text-white hover:bg-[#153a39] active:scale-95'
                      }`}
                      title="Changer la photo de profil"
                    >
                      {profileAvatarUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      <input
                        id="profile-avatar-upload"
                        type="file"
                        accept="image/*"
                        disabled={profileAvatarUploading}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setCropImageSrc(reader.result);
                              setCropTarget('profile');
                              setCropModalOpen(true);
                            }
                          };
                          reader.readAsDataURL(file);
                          // Reset input so the same file can be selected again
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <h2 className="font-extrabold text-slate-900 text-lg leading-tight">
                    {activeStaff.name}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {activeStaff.role === 'owner'
                      ? 'Gérant Principal'
                      : (activeStaff.role_title || 'Collaborateur')}
                  </p>
                </div>

                {/* Séparateur fin */}
                <div className="border-t border-slate-100" />

                {/* Menu de navigation interne vertical */}
                <nav className="space-y-1.5" aria-label="Navigation profil">
                  <button
                    type="button"
                    onClick={() => setActiveProfileSection('personal')}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                      activeProfileSection === 'personal'
                        ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <User className={`w-4 h-4 shrink-0 ${activeProfileSection === 'personal' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                    <span className="truncate">Informations Personnelles</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProfileSection('security')}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                      activeProfileSection === 'security'
                        ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Lock className={`w-4 h-4 shrink-0 ${activeProfileSection === 'security' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                    <span className="truncate">Sécurité</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProfileSection('notifications')}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                      activeProfileSection === 'notifications'
                        ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Bell className={`w-4 h-4 shrink-0 ${activeProfileSection === 'notifications' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                    <span className="truncate">Préférences de Notification</span>
                  </button>

                  {/* Visible uniquement si activeStaff.role === 'owner' */}
                  {activeStaff.role === 'owner' && (
                    <button
                      type="button"
                      onClick={() => setActiveProfileSection('billing')}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                        activeProfileSection === 'billing'
                          ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <CreditCard className={`w-4 h-4 shrink-0 ${activeProfileSection === 'billing' ? 'text-[#1B4B4A]' : 'text-slate-400'}`} />
                      <span className="truncate">Abonnement &amp; Facturation</span>
                    </button>
                  )}
                </nav>
              </div>

              {/* ZONE DE DROITE (~70% / 8 colonnes sur 12) */}
              <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6 min-h-[420px]">
                {/* En-tête de section dynamique avec bouton Modifier / Enregistrer / Annuler */}
                <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">
                      {activeProfileSection === 'personal' && 'Informations Personnelles'}
                      {activeProfileSection === 'security' && 'Sécurité (mot de passe)'}
                      {activeProfileSection === 'notifications' && 'Préférences de Notification'}
                      {activeProfileSection === 'billing' && 'Abonnement & Facturation'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {activeProfileSection === 'personal' && 'Gérez vos coordonnées et informations d\'identification.'}
                      {activeProfileSection === 'security' && 'Mettez à jour votre mot de passe et vos paramètres d\'authentification.'}
                      {activeProfileSection === 'notifications' && 'Configurez vos canaux de réception et alertes en temps réel.'}
                      {activeProfileSection === 'billing' && 'Consultez votre formule d\'abonnement et vos factures.'}
                    </p>
                  </div>

                  {/* Actions d'édition spécifiques à la section Informations Personnelles */}
                  {activeProfileSection === 'personal' && (
                    <div className="flex items-center space-x-2 shrink-0">
                      {!isEditingPersonalInfo ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPersonalInfoError(null);
                            const names = splitStaffName(activeStaff.name);
                            setProfileEditFirstName(names.firstName);
                            setProfileEditLastName(names.lastName);
                            setProfileEditEmail(activeStaff.email || '');
                            setProfileEditPhone(activeStaff.phone || '');
                            setIsEditingPersonalInfo(true);
                          }}
                          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#1B4B4A]" />
                          <span>Modifier</span>
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={personalInfoSaving}
                            onClick={handleCancelPersonalInfo}
                            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Annuler</span>
                          </button>
                          <button
                            type="button"
                            disabled={personalInfoSaving}
                            onClick={handleSavePersonalInfo}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#1B4B4A] hover:bg-[#153a39] text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {personalInfoSaving ? (
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
                      )}
                    </div>
                  )}
                </div>

                {/* Section Informations Personnelles avec vraies données */}
                {activeProfileSection === 'personal' ? (
                  <div className="space-y-6">
                    {/* Message de succès */}
                    {personalInfoSuccess && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Vos informations personnelles ont été mises à jour avec succès.</span>
                      </div>
                    )}

                    {/* Message d'erreur de validation ou réseau */}
                    {personalInfoError && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{personalInfoError}</span>
                      </div>
                    )}

                    {/* Badge Rôle (lecture seule, jamais éditable) */}
                    <div className="p-4 rounded-2xl bg-[#FAF7F2]/60 border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-white text-[#1B4B4A] border border-[#1B4B4A]/10 flex items-center justify-center shrink-0 shadow-2xs">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rôle sur le compte</div>
                          <div className="text-xs font-medium text-slate-600">Niveau d&apos;autorisation assigné</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                        activeStaff.role === 'owner'
                          ? 'bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/20'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {activeStaff.role === 'owner' ? 'Propriétaire / Gérant' : (activeStaff.role_title || 'Collaborateur')}
                      </span>
                    </div>

                    {/* Formulaire / Affichage des 4 champs : Nom, Prénom, Email, Téléphone */}
                    {!isEditingPersonalInfo ? (
                      /* MODE LECTURE SEULE (texte simple, pas d'inputs visibles) */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Prénom */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Prénom
                          </span>
                          <p className="text-sm font-extrabold text-slate-900">
                            {splitStaffName(activeStaff.name).firstName || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>

                        {/* Nom */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Nom
                          </span>
                          <p className="text-sm font-extrabold text-slate-900">
                            {splitStaffName(activeStaff.name).lastName || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>

                        {/* Email */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Adresse Email
                          </span>
                          <p className="text-sm font-extrabold text-slate-900 break-all">
                            {activeStaff.email || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>

                        {/* Téléphone */}
                        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Numéro de Téléphone
                          </span>
                          <p className="text-sm font-extrabold text-slate-900">
                            {activeStaff.phone || (
                              <span className="text-slate-400 italic font-normal text-xs">Non renseigné</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* MODE ÉDITION (4 inputs éditables avec icônes et validation en temps réel) */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Input Prénom */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Prénom <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <User className="w-4 h-4" />
                              </div>
                              <input
                                type="text"
                                value={profileEditFirstName}
                                onChange={(e) => setProfileEditFirstName(e.target.value)}
                                placeholder="Ex: Amadou"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>

                          {/* Input Nom */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Nom <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <User className="w-4 h-4" />
                              </div>
                              <input
                                type="text"
                                value={profileEditLastName}
                                onChange={(e) => setProfileEditLastName(e.target.value)}
                                placeholder="Ex: Diallo"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>

                          {/* Input Email */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Adresse Email <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <Mail className="w-4 h-4" />
                              </div>
                              <input
                                type="email"
                                value={profileEditEmail}
                                onChange={(e) => setProfileEditEmail(e.target.value)}
                                placeholder="Ex: amadou@example.com"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>

                          {/* Input Téléphone */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Numéro de Téléphone <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <Phone className="w-4 h-4" />
                              </div>
                              <input
                                type="tel"
                                value={profileEditPhone}
                                onChange={(e) => setProfileEditPhone(e.target.value)}
                                placeholder="Ex: +221 77 000 00 00"
                                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1B4B4A] focus:ring-2 focus:ring-[#1B4B4A]/20 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400">
                          Les modifications apportées seront immédiatement synchronisées avec votre profil utilisateur.
                        </p>
                      </div>
                    )}
                  </div>
                ) : activeProfileSection === 'security' ? (
                  /* Section Sécurité Réelle & Conforme */
                  <div className="space-y-6">
                    {/* Dernière connexion (lecture seule) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2]/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white text-[#1B4B4A] border border-[#1B4B4A]/10 flex items-center justify-center shrink-0 shadow-2xs">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dernière connexion</div>
                          <div className="text-xs text-slate-500 mt-0.5">Horodatage de la dernière session enregistrée</div>
                        </div>
                      </div>
                      <div className="sm:text-right pl-13 sm:pl-0">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-white border border-slate-200 text-slate-800 shadow-2xs">
                          {formatLastLogin(activeStaff.last_login_at)}
                        </span>
                      </div>
                    </div>

                    {/* Bloc Formulaire Changement de mot de passe */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-[#1B4B4A]/10 text-[#1B4B4A] flex items-center justify-center shrink-0">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">Changer le mot de passe</h4>
                          <p className="text-xs text-slate-500">Mettez à jour vos identifiants d&apos;accès sécurisé</p>
                        </div>
                      </div>

                      {/* Message d'information */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs flex items-start space-x-2.5">
                        <Info className="w-4 h-4 text-[#1B4B4A] shrink-0 mt-0.5" />
                        <span>Cette fonctionnalité sera disponible une fois le système d&apos;authentification finalisé. Revenez bientôt.</span>
                      </div>

                      {/* Message de succès */}
                      {securitySuccess && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{securitySuccess}</span>
                        </div>
                      )}

                      {/* Message d'erreur */}
                      {securityError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{securityError}</span>
                        </div>
                      )}

                      <form onSubmit={handleUpdatePassword} className="space-y-4">
                        {/* 1. Mot de passe actuel */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5 opacity-60">
                            Mot de passe actuel <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showCurrentPassword ? 'text' : 'password'}
                              value={securityCurrentPassword}
                              onChange={(e) => setSecurityCurrentPassword(e.target.value)}
                              placeholder="••••••••"
                              disabled={true}
                              className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 placeholder:text-slate-400 focus:outline-none cursor-not-allowed opacity-75"
                            />
                            <button
                              type="button"
                              disabled={true}
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 cursor-not-allowed opacity-50"
                            >
                              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* 2. Nouveau mot de passe */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5 opacity-60">
                            Nouveau mot de passe <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={securityNewPassword}
                              onChange={(e) => setSecurityNewPassword(e.target.value)}
                              placeholder="Minimum 8 caractères"
                              disabled={true}
                              className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 placeholder:text-slate-400 focus:outline-none cursor-not-allowed opacity-75"
                            />
                            <button
                              type="button"
                              disabled={true}
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 cursor-not-allowed opacity-50"
                            >
                              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* 3. Confirmer le nouveau mot de passe */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5 opacity-60">
                            Confirmer le nouveau mot de passe <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={securityConfirmPassword}
                              onChange={(e) => setSecurityConfirmPassword(e.target.value)}
                              placeholder="Répétez le nouveau mot de passe"
                              disabled={true}
                              className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 placeholder:text-slate-400 focus:outline-none cursor-not-allowed opacity-75"
                            />
                            <button
                              type="button"
                              disabled={true}
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 cursor-not-allowed opacity-50"
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Bouton de soumission */}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="submit"
                            disabled={true}
                            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#1B4B4A] text-white text-xs font-extrabold shadow-xs opacity-50 cursor-not-allowed"
                          >
                            <Check className="w-4 h-4" />
                            <span>Mettre à jour le mot de passe</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : activeProfileSection === 'notifications' ? (
                  /* Section Préférences de Notification avec 2 Toggles */
                  <div className="space-y-6">
                    {/* Alerte d'erreur éventuelle */}
                    {notifyError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center space-x-2.5 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{notifyError}</span>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-6">
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-[#1B4B4A]/10 text-[#1B4B4A] flex items-center justify-center shrink-0">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">Canaux de notification</h4>
                          <p className="text-xs text-slate-500">Choisissez les alertes que vous souhaitez recevoir pour vos commandes et activités</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Toggle 1: Email */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between transition-all hover:bg-slate-50/80">
                          <div className="flex items-center space-x-3.5 pr-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                              <Mail className="w-5 h-5 text-[#1B4B4A]" />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-900 flex items-center space-x-2">
                                <span>Notifications par Email</span>
                                {notifySavedFeedback === 'email' && (
                                  <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-in fade-in">
                                    <Check className="w-3 h-3" />
                                    <span>Enregistré</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Recevez les résumés quotidiens, rapports financiers et confirmations importantes par email.
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-2">
                            {notifySavingType === 'email' && (
                              <Loader2 className="w-4 h-4 text-[#1B4B4A] animate-spin" />
                            )}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={notifyEmail}
                              disabled={notifySavingType === 'email'}
                              onClick={() => handleToggleNotification('email', !notifyEmail)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1B4B4A]/20 ${
                                notifyEmail ? 'bg-[#1B4B4A]' : 'bg-slate-300'
                              } ${notifySavingType === 'email' ? 'opacity-50 cursor-wait' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  notifyEmail ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Toggle 2: WhatsApp */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between transition-all hover:bg-slate-50/80">
                          <div className="flex items-center space-x-3.5 pr-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                              <MessageSquare className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-900 flex items-center space-x-2">
                                <span>Notifications WhatsApp</span>
                                {notifySavedFeedback === 'whatsapp' && (
                                  <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-in fade-in">
                                    <Check className="w-3 h-3" />
                                    <span>Enregistré</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Alertes instantanées pour les nouvelles commandes entrantes et les assignations de livraison.
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-2">
                            {notifySavingType === 'whatsapp' && (
                              <Loader2 className="w-4 h-4 text-[#1B4B4A] animate-spin" />
                            )}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={notifyWhatsApp}
                              disabled={notifySavingType === 'whatsapp'}
                              onClick={() => handleToggleNotification('whatsapp', !notifyWhatsApp)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1B4B4A]/20 ${
                                notifyWhatsApp ? 'bg-emerald-600' : 'bg-slate-300'
                              } ${notifySavingType === 'whatsapp' ? 'opacity-50 cursor-wait' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  notifyWhatsApp ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Section Abonnement & Facturation */
                  <div className="space-y-6">
                    {/* Bloc 1 : Forfait actuel */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-[#1B4B4A]/10 text-[#1B4B4A] flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">Forfait actuel</h4>
                          <p className="text-xs text-slate-500">Détails de votre offre de service et maintenance</p>
                        </div>
                      </div>

                      {/* Carte du forfait */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start space-x-3.5">
                          <div className="w-10 h-10 rounded-xl bg-[#1B4B4A] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2.5">
                              <span className="text-sm font-extrabold text-slate-900">Forfait Business</span>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#1B4B4A]/10 text-[#1B4B4A] border border-[#1B4B4A]/20">
                                Actif
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Maintenance mensuelle — facturation gérée directement avec Autoslash AI.
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex sm:self-center">
                          <button
                            type="button"
                            disabled={true}
                            title="Fonctionnalité disponible prochainement"
                            className="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed opacity-75 transition-colors"
                          >
                            Changer de forfait
                          </button>
                        </div>
                      </div>

                      {/* Note informative */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs flex items-start space-x-2.5">
                        <Info className="w-4 h-4 text-[#1B4B4A] shrink-0 mt-0.5" />
                        <span>
                          Le changement de formule et la gestion automatisée des abonnements seront disponibles prochainement dans cette interface.
                        </span>
                      </div>
                    </div>

                    {/* Bloc 2 : Historique de facturation */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-5">
                      <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-[#1B4B4A]/10 text-[#1B4B4A] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">Historique de facturation</h4>
                          <p className="text-xs text-slate-500">Consultez et téléchargez vos factures de maintenance</p>
                        </div>
                      </div>

                      {/* État vide sobre et honnête */}
                      <div className="py-10 px-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center flex flex-col items-center justify-center space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center shadow-2xs mb-1">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">Aucune facture disponible pour le moment</p>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          Vos factures et reçus de maintenance apparaîtront ici dès leur émission.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Lightbox / Zoom Modal pour la photo de profil */}
            <AnimatePresence>
              {isProfileAvatarZoomOpen && (activeStaff.photo_url || activeStaff.avatar_url) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop assombri avec flou doux */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs cursor-pointer"
                    onClick={() => setIsProfileAvatarZoomOpen(false)}
                  />

                  {/* Image agrandie avec zoom doux */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 bg-white rounded-3xl p-4 shadow-2xl border border-white/20 max-w-sm sm:max-w-md w-full flex flex-col items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Bouton Fermer */}
                    <button
                      type="button"
                      onClick={() => setIsProfileAvatarZoomOpen(false)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer z-20 shadow-xs"
                      title="Fermer (Échap)"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    {/* Grande Photo */}
                    <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 mt-2 mb-4">
                      <Image
                        src={activeStaff.photo_url || activeStaff.avatar_url!}
                        alt={activeStaff.name}
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Nom et Rôle sous la grande photo */}
                    <div className="text-center pb-2">
                      <h4 className="font-extrabold text-slate-900 text-base">
                        {activeStaff.name}
                      </h4>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        {activeStaff.role === 'owner'
                          ? 'Gérant Principal'
                          : (activeStaff.role_title || 'Collaborateur')}
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

  );
}
