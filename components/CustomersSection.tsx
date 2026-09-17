'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  MoreVertical,
  UserPlus,
  Bookmark,
  Loader2,
  MessageSquareWarning,
  X,
  Trash2,
  CheckSquare,
  Square,
  MessageSquare,
  File,
  ExternalLink,
  CheckCheck,
  Video,
  FileText,
  Paperclip,
  Send,
  Camera,
  User,
  Users,
  Settings,
  Download,
  FileSpreadsheet,
  Presentation,
  Music,
} from 'lucide-react';
import { Business, Customer, Order } from '@/lib/types';
import { getStore } from '@/lib/store';
import {
  getSupabase,
  fetchMessagesForCustomer,
  sendMessage,
  uploadCustomerMedia,
  markMessageAsRead,
  markCustomerAsFavorite,
  deleteMessage,
  insertCustomer,
  updateCustomer,
  uploadStaffAvatar,
} from '@/lib/supabase';
import { MediaViewer, MediaViewerItem } from '@/components/MediaViewer';

function getDocumentDetails(fileName?: string | null, mediaType?: string | null) {
  const name = (fileName || '').toLowerCase();
  const type = (mediaType || '').toLowerCase();

  if (name.endsWith('.pdf') || type.includes('pdf')) {
    return {
      Icon: FileText,
      badge: 'PDF',
      accentColor: 'text-rose-600 bg-rose-50 border-rose-200',
    };
  }
  if (name.match(/\.(doc|docx)$/i) || type.includes('word')) {
    return {
      Icon: FileText,
      badge: 'DOCX',
      accentColor: 'text-blue-600 bg-blue-50 border-blue-200',
    };
  }
  if (name.match(/\.(xls|xlsx|csv)$/i) || type.includes('sheet') || type.includes('excel')) {
    return {
      Icon: FileSpreadsheet,
      badge: 'XLS',
      accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    };
  }
  if (name.match(/\.(ppt|pptx)$/i) || type.includes('presentation') || type.includes('powerpoint')) {
    return {
      Icon: Presentation,
      badge: 'PPT',
      accentColor: 'text-amber-600 bg-amber-50 border-amber-200',
    };
  }
  if (type.startsWith('video') || name.match(/\.(mp4|webm|mov|mkv)$/i)) {
    return {
      Icon: Video,
      badge: 'VIDÉO',
      accentColor: 'text-purple-600 bg-purple-50 border-purple-200',
    };
  }
  if (type.startsWith('audio') || name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
    return {
      Icon: Music,
      badge: 'AUDIO',
      accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    };
  }
  return {
    Icon: File,
    badge: 'DOC',
    accentColor: 'text-slate-600 bg-slate-100 border-slate-200',
  };
}

export interface CustomersSectionProps {
  business: Business;
  businessCustomers: Customer[];
  isCustomersLoading?: boolean;
  cropModalOpen: boolean;
  setCropModalOpen: (open: boolean) => void;
  cropImageSrc: string | null;
  setCropImageSrc: (src: string | null) => void;
  cropTarget: 'profile' | 'staff_invite' | 'customer_create';
  setCropTarget: (target: 'profile' | 'staff_invite' | 'customer_create') => void;
  cropSaving: boolean;
  setCropSaving: (saving: boolean) => void;
  selectedCustomerId?: string | null;
  setSelectedCustomerId?: (id: string | null) => void;
  customerFilter?: 'all' | 'unread' | 'favorites' | 'recurrent' | 'inactive';
  setCustomerFilter?: (filter: 'all' | 'unread' | 'favorites' | 'recurrent' | 'inactive') => void;
}

export default function CustomersSection({
  business,
  businessCustomers,
  isCustomersLoading: propIsCustomersLoading,
  cropModalOpen,
  setCropModalOpen,
  cropImageSrc,
  setCropImageSrc,
  cropTarget,
  setCropTarget,
  cropSaving,
  setCropSaving,
  selectedCustomerId: propSelectedCustomerId,
  setSelectedCustomerId: propSetSelectedCustomerId,
  customerFilter: propCustomerFilter,
  setCustomerFilter: propSetCustomerFilter,
}: CustomersSectionProps) {
  const store = getStore();
  const [nowMs] = useState(() => Date.now());

  // Customer filter and search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [internalCustomerFilter, setInternalCustomerFilter] = useState<'all' | 'unread' | 'favorites' | 'recurrent' | 'inactive'>('all');
  const customerFilter = propCustomerFilter !== undefined ? propCustomerFilter : internalCustomerFilter;
  const setCustomerFilter = propSetCustomerFilter || setInternalCustomerFilter;

  const [internalSelectedCustomerId, setInternalSelectedCustomerId] = useState<string | null>(null);
  const selectedCustomerId = propSelectedCustomerId !== undefined ? propSelectedCustomerId : internalSelectedCustomerId;
  const setSelectedCustomerId = propSetSelectedCustomerId || setInternalSelectedCustomerId;

  // View mode: 'chat' for conversation list, 'list' for all customers directory
  const [customersViewMode, setCustomersViewMode] = useState<'chat' | 'list'>('chat');

  // Chat message & attachment states
  const [customerChatInput, setCustomerChatInput] = useState('');
  const [customerPendingAttachments, setCustomerPendingAttachments] = useState<
    Array<{
      id: string;
      file: File;
      previewUrl: string;
      mediaType: 'image' | 'video' | 'audio' | 'document' | 'other';
      name: string;
      size: number;
    }>
  >([]);
  const [customerChatSending, setCustomerChatSending] = useState(false);
  const [customerChatMediaUploading, setCustomerChatMediaUploading] = useState(false);
  const [customerChatError, setCustomerChatError] = useState<string | null>(null);
  const [customerMessagesLoading, setCustomerMessagesLoading] = useState(false);
  const [activeMediaViewer, setActiveMediaViewer] = useState<MediaViewerItem | null>(null);

  // Message selection & deletion states
  const [isCustomerMessageSelectMode, setIsCustomerMessageSelectMode] = useState(false);
  const [selectedCustomerMessageIds, setSelectedCustomerMessageIds] = useState<string[]>([]);
  const [customerMessageDeleting, setCustomerMessageDeleting] = useState(false);
  const [showDeleteMessagesConfirmModal, setShowDeleteMessagesConfirmModal] = useState(false);
  const [customerMessageDeleteError, setCustomerMessageDeleteError] = useState<string | null>(null);

  // Permanent customer deletion states
  const [customerToDeletePermanently, setCustomerToDeletePermanently] = useState<Customer | null>(null);
  const [isDeletingCustomerPermanently, setIsDeletingCustomerPermanently] = useState(false);
  const [deleteCustomerPermanentlyError, setDeleteCustomerPermanentlyError] = useState<string | null>(null);
  const [locallyDeletedCustomerIds, setLocallyDeletedCustomerIds] = useState<string[]>([]);

  // Discussion history deletion states
  const [discussionToDelete, setDiscussionToDelete] = useState<Customer | null>(null);
  const [isDeletingDiscussion, setIsDeletingDiscussion] = useState(false);
  const [deleteDiscussionError, setDeleteDiscussionError] = useState<string | null>(null);

  // UI menu states
  const [isCustomerActionsMenuOpen, setIsCustomerActionsMenuOpen] = useState(false);
  const [activeCustomerRowMenuId, setActiveCustomerRowMenuId] = useState<string | null>(null);

  // Customer creation modal states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerPhotoUrl, setNewCustomerPhotoUrl] = useState('');
  const [newCustomerPhotoUploading, setNewCustomerPhotoUploading] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerChannel, setNewCustomerChannel] = useState<'whatsapp' | 'app'>('whatsapp');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerModalError, setCustomerModalError] = useState<string | null>(null);

  // Customer edit modal states
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomerPhotoUrl, setEditCustomerPhotoUrl] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerChannel, setEditCustomerChannel] = useState<'whatsapp' | 'app'>('whatsapp');
  const [editCustomerNotes, setEditCustomerNotes] = useState('');
  const [editCustomerSaving, setEditCustomerSaving] = useState(false);
  const [editCustomerModalError, setEditCustomerModalError] = useState<string | null>(null);

  // Loading state to prevent initial 0-customer flash
  const isCustomersLoadingEffective =
    propIsCustomersLoading !== undefined
      ? propIsCustomersLoading
      : store.customersLoading;

  const [isInitialCustomersLoading, setIsInitialCustomersLoading] = useState<boolean>(() => {
    if (propIsCustomersLoading !== undefined) return propIsCustomersLoading;
    if (businessCustomers.length > 0) return false;
    const s = getStore();
    return s.customersLoading || s.customers.length === 0;
  });

  useEffect(() => {
    if (propIsCustomersLoading === true) {
      setIsInitialCustomersLoading(true);
      return;
    }

    if (businessCustomers.length > 0 || propIsCustomersLoading === false) {
      const immediateTimer = setTimeout(() => {
        setIsInitialCustomersLoading(false);
      }, 0);
      return () => clearTimeout(immediateTimer);
    }

    const unsubscribe = store.subscribe(() => {
      const bizCusts = (store.customers || []).filter((c) => c.business_id === business.id);
      if (bizCusts.length > 0 || !store.customersLoading) {
        setIsInitialCustomersLoading(false);
      }
    });

    const fallbackTimer = setTimeout(() => {
      setIsInitialCustomersLoading(false);
    }, 500);

    return () => {
      unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [business.id, businessCustomers.length, propIsCustomersLoading, store]);

  // DOM refs
  const customerFileInputRef = useRef<HTMLInputElement | null>(null);
  const customerMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize cropped photo when uploaded via shared crop modal
  useEffect(() => {
    const handleCroppedPhoto = (e: Event) => {
      const customEvt = e as CustomEvent<string>;
      if (customEvt.detail) {
        if (isEditCustomerModalOpen) {
          setEditCustomerPhotoUrl(customEvt.detail);
        } else {
          setNewCustomerPhotoUrl(customEvt.detail);
        }
      }
    };
    window.addEventListener('customer_photo_cropped', handleCroppedPhoto);
    return () => {
      window.removeEventListener('customer_photo_cropped', handleCroppedPhoto);
    };
  }, [isEditCustomerModalOpen]);

  const getInitials = (name?: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const businessOrders: Order[] = (store.orders || []).filter(
    (o) => o.business_id === business.id
  );

  const [localFavoriteOverrides, setLocalFavoriteOverrides] = useState<Record<string, boolean>>({});

  const displayCustomers = useMemo(() => {
    return businessCustomers
      .filter((c) => !locallyDeletedCustomerIds.includes(c.id))
      .map((c) => ({
        ...c,
        is_favorite: localFavoriteOverrides[c.id] !== undefined ? localFavoriteOverrides[c.id] : c.is_favorite,
      }));
  }, [businessCustomers, localFavoriteOverrides, locallyDeletedCustomerIds]);

  const unreadCustomersCount = displayCustomers.filter((c) => {
    const custMsgs = store.getCustomerMessages(c.id);
    return custMsgs.some((m) => !m.is_read && m.sender === 'customer');
  }).length;

  const favoriteCustomersCount = displayCustomers.filter((c) => c.is_favorite).length;

  const filteredCustomers = displayCustomers.filter((c) => {
    const custOrders = businessOrders.filter(
      (o) => o.customer_id === c.id || o.customer_phone === c.phone
    );

    const custMsgs = store.getCustomerMessages(c.id);
    const hasUnread = custMsgs.some((m) => !m.is_read && m.sender === 'customer');

    if (customerFilter === 'unread' && !hasUnread) {
      return false;
    }

    if (customerFilter === 'favorites' && !c.is_favorite) {
      return false;
    }

    if (customerFilter === 'recurrent' && custOrders.length <= 1) {
      return false;
    }

    if (customerFilter === 'inactive') {
      if (custOrders.length < 2) return false;
      const latestOrderMs = Math.max(...custOrders.map((o) => new Date(o.created_at).getTime()));
      const daysSinceLast = Math.floor((nowMs - latestOrderMs) / (24 * 60 * 60 * 1000));
      if (daysSinceLast <= 21) return false;
    }

    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  // Liste triee pour la vue Chat : uniquement les clients avec au moins 1 message echange,
  // favoris d'abord, puis tri secondaire par activite recente
  const sortedChatCustomers = useMemo(() => {
    const getActivityMs = (c: Customer): number => {
      const custMsgs = store.getCustomerMessages(c.id);
      const latestMsg = custMsgs.length > 0 ? custMsgs[custMsgs.length - 1] : null;
      if (latestMsg?.created_at) {
        const t = new Date(latestMsg.created_at).getTime();
        if (!isNaN(t)) return t;
      }
      if (c.last_active_at) {
        const t = new Date(c.last_active_at).getTime();
        if (!isNaN(t)) return t;
      }
      if (c.created_at) {
        const t = new Date(c.created_at).getTime();
        if (!isNaN(t)) return t;
      }
      return 0;
    };

    const chatEligibleCustomers = filteredCustomers.filter((c) => {
      const msgs = store.getCustomerMessages(c.id);
      return Array.isArray(msgs) && msgs.length > 0;
    });

    return [...chatEligibleCustomers].sort((a, b) => {
      const aFav = a.is_favorite ? 1 : 0;
      const bFav = b.is_favorite ? 1 : 0;
      if (aFav !== bFav) {
        return bFav - aFav;
      }
      const aTime = getActivityMs(a);
      const bTime = getActivityMs(b);
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filteredCustomers, store, store.customerMessages]);

  // Complete list of all business customers filtered by search
  const allFilteredCustomers = displayCustomers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  console.log('[DEBUG_RENDER] CustomersSection render', {
    timestamp: Date.now(),
    businessCustomersLength: businessCustomers.length,
    displayCustomersLength: displayCustomers.length,
    allFilteredCustomersLength: allFilteredCustomers.length,
    filteredCustomersLength: filteredCustomers.length,
    isInitialCustomersLoading,
    storeCustomersLoading: store.customersLoading,
    locallyDeletedCustomerIds,
  });

  const effectiveActiveCustomer =
    displayCustomers.find((c) => c.id === selectedCustomerId) ||
    sortedChatCustomers[0] ||
    allFilteredCustomers[0] ||
    null;

  // Load customer messages when active customer changes
  useEffect(() => {
    if (!effectiveActiveCustomer?.id) return;
    let isCancelled = false;

    Promise.resolve().then(() => {
      if (!isCancelled) setCustomerMessagesLoading(true);
    });

    fetchMessagesForCustomer(effectiveActiveCustomer.id)
      .then((msgs) => {
        if (isCancelled) return;
        setCustomerMessagesLoading(false);
        msgs.forEach((m) => {
          if (!m.is_read && m.sender === 'customer') {
            markMessageAsRead(m.id);
          }
        });
      })
      .catch((err) => {
        if (isCancelled) return;
        setCustomerMessagesLoading(false);
        console.warn('Error fetching customer messages:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [effectiveActiveCustomer?.id]);

  // Auto-scroll customer messages
  useEffect(() => {
    if (effectiveActiveCustomer?.id) {
      customerMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [effectiveActiveCustomer?.id, store.customerMessages[effectiveActiveCustomer?.id || '']?.length]);

  const handleCustomerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const validAttachments: Array<{
      id: string;
      file: File;
      previewUrl: string;
      mediaType: 'image' | 'video' | 'audio' | 'document' | 'other';
      name: string;
      size: number;
    }> = [];
    const oversizedFiles: string[] = [];

    fileList.forEach((file) => {
      // Validation de taille (10 Mo par fichier)
      if (file.size > 10 * 1024 * 1024) {
        oversizedFiles.push(file.name);
        return;
      }

      const mime = file.type || '';
      let mediaType: 'image' | 'video' | 'audio' | 'document' | 'other' = 'other';
      if (mime.startsWith('image/')) mediaType = 'image';
      else if (mime.startsWith('video/')) mediaType = 'video';
      else if (mime.startsWith('audio/')) mediaType = 'audio';
      else if (
        mime.includes('pdf') ||
        mime.includes('word') ||
        mime.includes('document') ||
        mime.includes('excel') ||
        mime.includes('sheet') ||
        mime.includes('text') ||
        mime.includes('presentation') ||
        file.name.match(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i)
      ) {
        mediaType = 'document';
      }

      const previewUrl = URL.createObjectURL(file);
      validAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl,
        mediaType,
        name: file.name,
        size: file.size,
      });
    });

    if (oversizedFiles.length > 0) {
      setCustomerChatError(
        `Fichier(s) supérieur(s) à 10 Mo ignoré(s) : ${oversizedFiles.join(', ')}`
      );
    } else {
      setCustomerChatError(null);
    }

    if (validAttachments.length > 0) {
      setCustomerPendingAttachments((prev) => [...prev, ...validAttachments]);
    }

    if (customerFileInputRef.current) {
      customerFileInputRef.current.value = '';
    }
  };

  const handleRemoveCustomerPendingAttachment = (indexToRemove: number) => {
    setCustomerPendingAttachments((prev) => {
      const target = prev[indexToRemove];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
    if (customerFileInputRef.current) {
      customerFileInputRef.current.value = '';
    }
  };

  const handleClearAllCustomerPendingAttachments = () => {
    customerPendingAttachments.forEach((att) => {
      if (att.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
    });
    setCustomerPendingAttachments([]);
    if (customerFileInputRef.current) {
      customerFileInputRef.current.value = '';
    }
  };

  const handleSendCustomerMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!effectiveActiveCustomer?.id || customerChatSending) return;

    const text = customerChatInput.trim();
    const pendingList = [...customerPendingAttachments];

    if (!text && pendingList.length === 0) return;

    setCustomerChatSending(true);
    setCustomerChatError(null);

    if (pendingList.length === 0) {
      const res = await sendMessage({
        business_id: business.id,
        customer_id: effectiveActiveCustomer.id,
        sender: 'merchant',
        content: text || undefined,
      });

      setCustomerChatSending(false);
      if (res.success) {
        setCustomerChatInput('');
        customerMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setCustomerChatError(res.error || "Echec de l'envoi du message");
      }
      return;
    }

    setCustomerChatMediaUploading(true);
    let anySuccess = false;
    let anyError: string | null = null;

    for (let i = 0; i < pendingList.length; i++) {
      const pending = pendingList[i];
      const uploadRes = await uploadCustomerMedia(pending.file, business.id);

      if (!uploadRes.success || !uploadRes.url) {
        anyError = uploadRes.error || `Echec de l'upload de ${pending.name}`;
        break;
      }

      // La légende texte saisie est associée au premier message envoyé
      const messageContent = i === 0 && text ? text : undefined;

      const res = await sendMessage({
        business_id: business.id,
        customer_id: effectiveActiveCustomer.id,
        sender: 'merchant',
        content: messageContent,
        media_url: uploadRes.url,
        media_type: uploadRes.media_type,
        media_name: uploadRes.media_name,
        media_size: uploadRes.media_size,
      });

      if (!res.success) {
        anyError = res.error || `Echec de l'envoi du message pour ${pending.name}`;
        break;
      }
      anySuccess = true;
    }

    setCustomerChatMediaUploading(false);
    setCustomerChatSending(false);

    // Révoquer les URLs de prévisualisation locales
    pendingList.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setCustomerPendingAttachments([]);
    if (customerFileInputRef.current) {
      customerFileInputRef.current.value = '';
    }

    if (anySuccess) {
      setCustomerChatInput('');
      customerMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    if (anyError) {
      setCustomerChatError(anyError);
    }
  };

  const handleToggleCustomerFavorite = async (customerId: string, currentFav?: boolean) => {
    const nextFav = !currentFav;
    // Mise à jour immédiate du state local pour un retour visuel instantané
    setLocalFavoriteOverrides((prev) => ({ ...prev, [customerId]: nextFav }));

    const res = await markCustomerAsFavorite(customerId, nextFav);
    if (!res.success) {
      // Annulation du changement visuel local en cas d'échec
      setLocalFavoriteOverrides((prev) => ({ ...prev, [customerId]: !!currentFav }));
      alert(`Erreur lors de la mise à jour des favoris : ${res.error || 'Échec de la mise à jour'}`);
    } else {
      if (typeof store.updateCustomerLocally === 'function') {
        store.updateCustomerLocally(customerId, { is_favorite: nextFav });
      }
    }
  };

  // Reset message selection when customer changes
  useEffect(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const timer = setTimeout(() => {
      setIsCustomerMessageSelectMode(false);
      setSelectedCustomerMessageIds([]);
      setCustomerMessageDeleteError(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [effectiveActiveCustomer?.id]);

  const handleMessagePointerDown = (messageId: string) => {
    if (isCustomerMessageSelectMode) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setIsCustomerMessageSelectMode(true);
      setSelectedCustomerMessageIds([messageId]);
    }, 450);
  };

  const handleMessagePointerUpOrLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleToggleMessageSelection = (messageId: string) => {
    setSelectedCustomerMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    );
  };

  const handleSelectAllMessages = (allIds: string[]) => {
    if (selectedCustomerMessageIds.length === allIds.length) {
      setSelectedCustomerMessageIds([]);
    } else {
      setSelectedCustomerMessageIds(allIds);
    }
  };

  const handleExitMessageSelectMode = () => {
    setIsCustomerMessageSelectMode(false);
    setSelectedCustomerMessageIds([]);
    setCustomerMessageDeleteError(null);
  };

  const handleConfirmDeleteSelectedMessages = async () => {
    if (selectedCustomerMessageIds.length === 0 || customerMessageDeleting) return;

    setCustomerMessageDeleting(true);
    setCustomerMessageDeleteError(null);

    const idsToDelete = [...selectedCustomerMessageIds];
    const errors: string[] = [];

    for (const msgId of idsToDelete) {
      const res = await deleteMessage(msgId);
      if (!res.success) {
        errors.push(res.error || `Echec suppression #${msgId}`);
      } else {
        setSelectedCustomerMessageIds((prev) => prev.filter((id) => id !== msgId));
      }
    }

    setCustomerMessageDeleting(false);
    setShowDeleteMessagesConfirmModal(false);

    if (errors.length > 0) {
      setCustomerMessageDeleteError(
        `Certains messages n'ont pas pu etre supprimes (${errors.length}/${idsToDelete.length}) : ${errors[0]}`
      );
    } else {
      setIsCustomerMessageSelectMode(false);
      setSelectedCustomerMessageIds([]);
    }
  };

  // Suppression definitive d'un client et de ses messages associes
  const deleteCustomerPermanently = async (
    customerId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const client = getSupabase();

      // 1. Detacher le client de toutes ses commandes dans platform_orders (evite violation FK)
      const { error: orderDetachError } = await (client as any)
        .from('platform_orders')
        .update({ customer_id: null })
        .eq('customer_id', customerId);

      if (orderDetachError) {
        return {
          success: false,
          error: `Erreur lors du detachement des commandes : ${orderDetachError.message}`,
        };
      }

      // 2. Supprimer ensuite tous les messages lies a ce client
      const { error: msgError } = await (client as any)
        .from('platform_customer_messages')
        .delete()
        .eq('customer_id', customerId)
        .select();

      if (msgError) {
        return {
          success: false,
          error: `Erreur lors de la suppression des messages : ${msgError.message}`,
        };
      }

      // 3. Supprimer enfin le client de platform_customers
      const { data: deletedCustomers, error: custError } = await (client as any)
        .from('platform_customers')
        .delete()
        .eq('id', customerId)
        .select();

      if (custError) {
        return {
          success: false,
          error: `Erreur lors de la suppression du client : ${custError.message}`,
        };
      }

      if (!deletedCustomers || deletedCustomers.length === 0) {
        return {
          success: false,
          error: 'Aucun enregistrement client supprime dans Supabase.',
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Exception lors de la suppression.',
      };
    }
  };

  const handleConfirmDeleteCustomerPermanently = async () => {
    if (!customerToDeletePermanently || isDeletingCustomerPermanently) return;
    const target = customerToDeletePermanently;
    setIsDeletingCustomerPermanently(true);
    setDeleteCustomerPermanentlyError(null);

    const res = await deleteCustomerPermanently(target.id);
    if (!res.success) {
      setDeleteCustomerPermanentlyError(res.error || 'Erreur lors de la suppression du client.');
      setIsDeletingCustomerPermanently(false);
      return;
    }

    // Retirer le client de la liste locale et du store apres verification stricte
    setLocallyDeletedCustomerIds((prev) => [...prev, target.id]);

    const s = getStore();
    s.customers = s.customers.filter((c) => c.id !== target.id);
    delete s.customerMessages[target.id];
    s.notify();

    // Deselectionner si le client supprime etait selectionne
    if (selectedCustomerId === target.id) {
      if (typeof setSelectedCustomerId === 'function') {
        setSelectedCustomerId(null);
      }
    }

    setIsDeletingCustomerPermanently(false);
    setCustomerToDeletePermanently(null);
  };

  // Suppression de l'historique d'une discussion sans supprimer le client
  const deleteDiscussionHistory = async (
    customerId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const client = getSupabase();
      const { error: msgError } = await (client as any)
        .from('platform_customer_messages')
        .delete()
        .eq('customer_id', customerId)
        .select();

      if (msgError) {
        return {
          success: false,
          error: `Erreur lors de la suppression des messages : ${msgError.message}`,
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Exception lors de la suppression.',
      };
    }
  };

  const handleConfirmDeleteDiscussion = async () => {
    if (!discussionToDelete || isDeletingDiscussion) return;
    const target = discussionToDelete;
    setIsDeletingDiscussion(true);
    setDeleteDiscussionError(null);

    const res = await deleteDiscussionHistory(target.id);
    if (!res.success) {
      setDeleteDiscussionError(res.error || 'Erreur lors de la suppression de la discussion.');
      setIsDeletingDiscussion(false);
      return;
    }

    // Vider le fil de discussion local
    const s = getStore();
    console.log('[DEBUG_STORE] BEFORE store.notify() in handleConfirmDeleteDiscussion:', {
      targetCustomerId: target.id,
      customersCount: s.customers?.length,
      customers: s.customers,
      customerMessagesForTarget: s.customerMessages[target.id],
      activeBusinessId: s.activeBusinessId,
    });
    s.customerMessages[target.id] = [];
    s.notify();
    console.log('[DEBUG_STORE] AFTER store.notify() in handleConfirmDeleteDiscussion:', {
      targetCustomerId: target.id,
      customersCount: s.customers?.length,
      customers: s.customers,
      customerMessagesForTarget: s.customerMessages[target.id],
      activeBusinessId: s.activeBusinessId,
    });

    // Reinitialiser les etats de selection de message
    setIsCustomerMessageSelectMode(false);
    setSelectedCustomerMessageIds([]);

    setIsDeletingDiscussion(false);
    setDiscussionToDelete(null);
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      setCustomerModalError('Veuillez renseigner le nom et le numero de telephone.');
      return;
    }

    setCustomerSaving(true);
    setCustomerModalError(null);

    try {
      const res = await insertCustomer({
        business_id: business.id,
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        channel_preference: newCustomerChannel,
        notes: newCustomerNotes.trim() || undefined,
        avatar_url: newCustomerPhotoUrl || undefined,
      });

      if (!res.success) {
        setCustomerModalError(res.error || "Une erreur est survenue lors de l'enregistrement du client.");
        return;
      }

      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerChannel('whatsapp');
      setNewCustomerNotes('');
      setNewCustomerPhotoUrl('');
      setCustomerModalError(null);
      setIsCustomerModalOpen(false);
    } catch (err: any) {
      setCustomerModalError(err?.message || "Erreur inattendue lors de la creation du client.");
    } finally {
      setCustomerSaving(false);
    }
  };

  const handleOpenEditCustomerModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.name || '');
    setEditCustomerPhone(customer.phone || '');
    setEditCustomerChannel(customer.channel_preference || 'whatsapp');
    setEditCustomerNotes(customer.notes || '');
    setEditCustomerPhotoUrl(customer.avatar_url || '');
    setEditCustomerModalError(null);
    setIsEditCustomerModalOpen(true);
  };

  const handleEditCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editCustomerName.trim() || !editCustomerPhone.trim()) {
      setEditCustomerModalError('Veuillez renseigner le nom et le numero de telephone.');
      return;
    }

    setEditCustomerSaving(true);
    setEditCustomerModalError(null);

    try {
      const updates = {
        name: editCustomerName.trim(),
        phone: editCustomerPhone.trim(),
        channel_preference: editCustomerChannel,
        notes: editCustomerNotes.trim() || undefined,
        avatar_url: editCustomerPhotoUrl || undefined,
      };

      const res = await updateCustomer(editingCustomer.id, updates);

      if (!res.success) {
        setEditCustomerModalError(res.error || "Une erreur est survenue lors de la mise à jour du client.");
        return;
      }

      // Mettre a jour le store localement
      getStore().updateCustomer(editingCustomer.id, {
        name: updates.name,
        phone: updates.phone,
        channel_preference: updates.channel_preference,
        notes: updates.notes,
        avatar_url: updates.avatar_url,
      });

      setEditCustomerModalError(null);
      setIsEditCustomerModalOpen(false);
      setEditingCustomer(null);
    } catch (err: any) {
      setEditCustomerModalError(err?.message || "Erreur inattendue lors de la modification du client.");
    } finally {
      setEditCustomerSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col md:flex-row min-h-[680px] h-[calc(100vh-220px)]">
      {/* Hidden File Input for Customer Media Upload */}
      <input
        type="file"
        ref={customerFileInputRef}
        onChange={handleCustomerFileSelect}
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,audio/*,video/*"
      />

      {/* LEFT COLUMN: Customer Conversations List */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col bg-white shrink-0">
        {/* Header & Search Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-2">
              <span>Clients & Messagerie</span>
              {isInitialCustomersLoading || isCustomersLoadingEffective ? (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200/80 rounded-full text-[10px] font-medium flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-400" />
                  <span>...</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-full text-[10px] font-black">
                  {customersViewMode === 'chat' ? filteredCustomers.length : allFilteredCustomers.length}
                </span>
              )}
            </h3>
            <div className="flex items-center space-x-1 text-slate-500">
              <span className="text-[10px] text-slate-400 font-medium">Supabase live</span>
            </div>
          </div>

          {/* Toggle View: Chat vs Liste complete */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setCustomersViewMode('chat')}
              className={`py-1.5 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center ${
                customersViewMode === 'chat'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setCustomersViewMode('list')}
              className={`py-1.5 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center ${
                customersViewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Liste complete
            </button>
          </div>

          {/* Search Input & Actions Menu */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou numero..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
              />
            </div>

            {/* 3-dots Menu for Customer Actions */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsCustomerActionsMenuOpen(!isCustomerActionsMenuOpen)}
                className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl transition-all cursor-pointer shadow-2xs"
                title="Options clients"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isCustomerActionsMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsCustomerActionsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-30 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomerActionsMenuOpen(false);
                        setNewCustomerName('');
                        setNewCustomerPhone('');
                        setNewCustomerChannel('whatsapp');
                        setNewCustomerNotes('');
                        setCustomerModalError(null);
                        setIsCustomerModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-emerald-600" />
                      <span>Nouveau client</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Filter Chips (Chat mode only) */}
          {customersViewMode === 'chat' && (
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto">
              <button
                onClick={() => setCustomerFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  customerFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tous ({isInitialCustomersLoading || isCustomersLoadingEffective ? '...' : displayCustomers.length})
              </button>
              <button
                onClick={() => setCustomerFilter('unread')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  customerFilter === 'unread'
                    ? 'bg-slate-900 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Non lus</span>
                {unreadCustomersCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[9px] font-black rounded-full">
                    {unreadCustomersCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCustomerFilter('favorites')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  customerFilter === 'favorites'
                    ? 'bg-slate-900 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Favoris</span>
                {favoriteCustomersCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 text-[9px] font-bold rounded-full">
                    {favoriteCustomersCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Scrollable List: Chat vs Liste complete */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
          {isInitialCustomersLoading || isCustomersLoadingEffective ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              <span>Chargement des clients...</span>
            </div>
          ) : customersViewMode === 'list' ? (
            allFilteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                Aucun client trouve.
              </div>
            ) : (
              allFilteredCustomers.map((cust) => {
                const isSelected = effectiveActiveCustomer?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => {
                      setSelectedCustomerId(cust.id);
                      setCustomersViewMode('chat');
                    }}
                    className={`group p-3.5 flex items-center space-x-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-100/90 border-l-4 border-l-slate-900 font-bold'
                        : 'hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    {/* Avatar */}
                    {cust.avatar_url ? (
                      <img
                        src={cust.avatar_url}
                        alt={cust.name}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                        {getInitials(cust.name)}
                      </div>
                    )}

                    {/* Customer Info (Nom uniquement) */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{cust.name}</span>
                        {cust.is_favorite && (
                          <Bookmark className="w-3.5 h-3.5 fill-slate-700 text-slate-700 shrink-0" />
                        )}
                      </h4>
                    </div>

                    {/* 3-dots discrete menu on list row */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCustomerRowMenuId(activeCustomerRowMenuId === cust.id ? null : cust.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                        title="Options du client"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeCustomerRowMenuId === cust.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCustomerRowMenuId(null);
                            }}
                          />
                          <div
                            className="absolute right-0 mt-1 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-30 py-1 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCustomerRowMenuId(null);
                                handleToggleCustomerFavorite(cust.id, cust.is_favorite);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                            >
                              <Bookmark
                                className={`w-3.5 h-3.5 ${
                                  cust.is_favorite ? 'fill-slate-700 text-slate-700' : 'text-slate-400'
                                }`}
                              />
                              <span>{cust.is_favorite ? 'Retirer des favoris' : 'Marquer comme favori'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveCustomerRowMenuId(null);
                                setCustomerToDeletePermanently(cust);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer border-t border-slate-100"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Supprimer le client</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : sortedChatCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              {customerFilter === 'unread'
                ? 'Aucun message non lu.'
                : customerFilter === 'favorites'
                ? 'Aucun client marque en favori.'
                : 'Aucun client trouve.'}
            </div>
          ) : (
            sortedChatCustomers.map((cust) => {
              const custMsgs = store.getCustomerMessages(cust.id);
              const unreadCount = custMsgs.filter((m) => !m.is_read && m.sender === 'customer').length;
              const latestMsg = custMsgs.length > 0 ? custMsgs[custMsgs.length - 1] : null;
              const isSelected = effectiveActiveCustomer?.id === cust.id;

              const rawText = latestMsg
                ? latestMsg.content || (latestMsg.media_name ? `[Fichier: ${latestMsg.media_name}]` : 'Media joint')
                : 'Aucun message';

              const lastActivityText =
                rawText.length > 34 ? rawText.slice(0, 34) + '...' : rawText;

              const lastActivityTime = latestMsg
                ? new Date(latestMsg.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className={`group p-3.5 flex items-center space-x-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-100/90 border-l-4 border-l-slate-900 font-bold'
                      : 'hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  {/* Avatar */}
                  {cust.avatar_url ? (
                    <img
                      src={cust.avatar_url}
                      alt={cust.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                      {getInitials(cust.name)}
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-sm font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{cust.name}</span>
                        {cust.is_favorite && (
                          <Bookmark className="w-3.5 h-3.5 fill-slate-700 text-slate-700 shrink-0" />
                        )}
                      </h4>
                      {lastActivityTime && (
                        <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                          {lastActivityTime}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {lastActivityText}
                      </p>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[10px] font-black rounded-full shrink-0">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-dots discrete menu on each customer line */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCustomerRowMenuId(activeCustomerRowMenuId === cust.id ? null : cust.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                      title="Options du client"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeCustomerRowMenuId === cust.id && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCustomerRowMenuId(null);
                          }}
                        />
                        <div
                          className="absolute right-0 mt-1 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-30 py-1 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCustomerRowMenuId(null);
                              handleToggleCustomerFavorite(cust.id, cust.is_favorite);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${
                                cust.is_favorite ? 'fill-slate-700 text-slate-700' : 'text-slate-400'
                              }`}
                            />
                            <span>{cust.is_favorite ? 'Retirer des favoris' : 'Marquer comme favori'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveCustomerRowMenuId(null);
                              setDiscussionToDelete(cust);
                              setDeleteDiscussionError(null);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer border-t border-slate-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Supprimer la discussion</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Selected Conversation Thread */}
      {(() => {
        const activeCustomer = effectiveActiveCustomer;

        if (!activeCustomer) {
          if (isInitialCustomersLoading || isCustomersLoadingEffective) {
            return (
              <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 text-center">
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin mb-2" />
                <p className="text-xs text-slate-500 font-medium">Chargement des clients...</p>
              </div>
            );
          }
          return (
            <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 text-center">
              <MessageSquareWarning className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 font-medium">Selectionnez un client pour voir la conversation.</p>
            </div>
          );
        }

        const custMessages = store.getCustomerMessages(activeCustomer.id);
        const isCustomerOnline = activeCustomer.last_active_at
          ? nowMs - new Date(activeCustomer.last_active_at).getTime() < 10 * 60 * 1000
          : false;

        return (
          <div className="flex-1 flex flex-col bg-[#FAF7F2]/50 h-full min-h-0 min-w-0 overflow-hidden">
            {/* Conversation Header / Selection Action Bar */}
            {isCustomerMessageSelectMode ? (
              <div className="p-3.5 sm:p-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shadow-sm shrink-0 animate-in fade-in duration-150">
                <div className="flex items-center space-x-3 min-w-0">
                  <button
                    type="button"
                    onClick={handleExitMessageSelectMode}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Quitter la selection (Annuler)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-white text-sm truncate">
                      {selectedCustomerMessageIds.length} message{selectedCustomerMessageIds.length > 1 ? 's' : ''} selectionne{selectedCustomerMessageIds.length > 1 ? 's' : ''}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {selectedCustomerMessageIds.length === 0
                        ? 'Touchez ou cochez des messages'
                        : 'Pret a etre supprime'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {custMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAllMessages(custMessages.map((m) => m.id))}
                      className="hidden sm:inline-flex px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                    >
                      {selectedCustomerMessageIds.length === custMessages.length
                        ? 'Tout deselectionner'
                        : 'Tout selectionner'}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={selectedCustomerMessageIds.length === 0 || customerMessageDeleting}
                    onClick={() => setShowDeleteMessagesConfirmModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                    title="Supprimer les messages coches"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer ({selectedCustomerMessageIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExitMessageSelectMode}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between shadow-2xs shrink-0">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="relative shrink-0">
                    {activeCustomer.avatar_url ? (
                      <img
                        src={activeCustomer.avatar_url}
                        alt={activeCustomer.name}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                        {getInitials(activeCustomer.name)}
                      </div>
                    )}
                    {isCustomerOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-slate-900 text-base truncate leading-tight">
                        {activeCustomer.name}
                      </h3>
                      <button
                        onClick={() => handleToggleCustomerFavorite(activeCustomer.id, activeCustomer.is_favorite)}
                        className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-lg hover:bg-slate-100"
                        title={activeCustomer.is_favorite ? 'Retirer des favoris' : 'Marquer comme favori'}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${
                            activeCustomer.is_favorite
                              ? 'fill-slate-700 text-slate-700'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditCustomerModal(activeCustomer)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Modifier le profil du client"
                      >
                        <Settings className="w-4 h-4 text-slate-400 hover:text-slate-700" />
                      </button>
                    </div>
                  </div>
                </div>

                {custMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCustomerMessageSelectMode(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    title="Selectionner des messages pour les supprimer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Selectionner</span>
                  </button>
                )}
              </div>
            )}

            {/* Customer Message Deletion Error Alert */}
            {customerMessageDeleteError && (
              <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between shadow-2xs shrink-0">
                <div className="flex items-center space-x-2 min-w-0">
                  <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium truncate">{customerMessageDeleteError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerMessageDeleteError(null)}
                  className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer shrink-0 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Messages Thread Body */}
            <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#FAF7F2]/40 select-none">
              {customerMessagesLoading ? (
                <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center my-auto min-h-[360px]">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Chargement des messages...</p>
                </div>
              ) : custMessages.length === 0 ? (
                <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center my-auto min-h-[360px]">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/80">
                    <MessageSquare className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-700 mb-1">Aucun message pour le moment.</p>
                  <p className="text-xs text-slate-400 font-medium max-w-xs">
                    Envoyez un message ou partagez un document ci-dessous pour demarrer l&apos;echange avec ce client.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-w-2xl mx-auto">
                  {custMessages.map((msg) => {
                    const isSentByMerchant = msg.sender === 'merchant';
                    const isSelected = selectedCustomerMessageIds.includes(msg.id);

                    return (
                      <div
                        key={msg.id}
                        className={`group flex items-center gap-2.5 transition-all ${
                          isSentByMerchant ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {/* Left Checkbox (for customer messages in select mode) */}
                        {isCustomerMessageSelectMode && !isSentByMerchant && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMessageSelection(msg.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-[#1B4B4A] fill-[#1B4B4A]/10" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </button>
                        )}

                        {/* Message Bubble Container */}
                        <div
                          onMouseDown={() => handleMessagePointerDown(msg.id)}
                          onMouseUp={handleMessagePointerUpOrLeave}
                          onMouseLeave={handleMessagePointerUpOrLeave}
                          onTouchStart={() => handleMessagePointerDown(msg.id)}
                          onTouchEnd={handleMessagePointerUpOrLeave}
                          onTouchCancel={handleMessagePointerUpOrLeave}
                          onClick={() => {
                            if (isCustomerMessageSelectMode) {
                              handleToggleMessageSelection(msg.id);
                            }
                          }}
                          className={`relative p-3.5 rounded-2xl max-w-md text-xs font-medium shadow-2xs transition-all ${
                            isCustomerMessageSelectMode ? 'cursor-pointer' : ''
                          } ${
                            isSelected
                              ? 'ring-2 ring-[#1B4B4A] ring-offset-2 scale-[1.01]'
                              : ''
                          } ${
                            isSentByMerchant
                              ? 'bg-[#1B4B4A] text-white rounded-tr-xs'
                              : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
                          }`}
                        >
                          {/* Media attachment preview */}
                          {msg.media_url && (
                            <div className="mb-2">
                              {msg.media_type === 'image' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (isCustomerMessageSelectMode) {
                                      e.stopPropagation();
                                      handleToggleMessageSelection(msg.id);
                                      return;
                                    }
                                    setActiveMediaViewer({
                                      url: msg.media_url!,
                                      mediaType: 'image',
                                      name: msg.media_name || 'Image',
                                      size: msg.media_size,
                                    });
                                  }}
                                  className="block w-full text-left overflow-hidden rounded-xl border border-white/20 hover:opacity-95 transition-opacity cursor-pointer"
                                  title={
                                    isCustomerMessageSelectMode
                                      ? 'Cliquer pour selectionner'
                                      : 'Cliquer pour afficher en grand'
                                  }
                                >
                                  <img
                                    src={msg.media_url}
                                    alt={msg.media_name || 'Image'}
                                    className="max-h-60 w-full object-cover rounded-xl"
                                  />
                                </button>
                              ) : (
                                (() => {
                                  const { Icon: DocIcon, badge, accentColor } = getDocumentDetails(
                                    msg.media_name,
                                    msg.media_type
                                  );
                                  const formattedSize = msg.media_size
                                    ? msg.media_size > 1024 * 1024
                                      ? `${(msg.media_size / (1024 * 1024)).toFixed(1)} Mo`
                                      : `${Math.max(1, Math.round(msg.media_size / 1024))} Ko`
                                    : null;

                                  return (
                                    <div
                                      onClick={(e) => {
                                        if (isCustomerMessageSelectMode) {
                                          e.stopPropagation();
                                          handleToggleMessageSelection(msg.id);
                                          return;
                                        }
                                        setActiveMediaViewer({
                                          url: msg.media_url!,
                                          mediaType: msg.media_type || 'document',
                                          name: msg.media_name || 'Document joint',
                                          size: msg.media_size,
                                        });
                                      }}
                                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left cursor-pointer group select-none ${
                                        isSentByMerchant
                                          ? 'bg-white/10 hover:bg-white/15 border-white/20 text-white'
                                          : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800'
                                      }`}
                                      title={
                                        isCustomerMessageSelectMode
                                          ? 'Cliquer pour selectionner'
                                          : 'Cliquer pour ouvrir en plein écran'
                                      }
                                    >
                                      <div
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                          isSentByMerchant
                                            ? 'bg-white/15 text-white'
                                            : `${accentColor} border`
                                        }`}
                                      >
                                        <DocIcon className="w-4 h-4" />
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate">
                                          {msg.media_name || 'Document joint'}
                                        </p>
                                        <div
                                          className={`text-[10px] flex items-center gap-1.5 mt-0.5 ${
                                            isSentByMerchant ? 'text-emerald-200' : 'text-slate-400'
                                          }`}
                                        >
                                          <span className="font-semibold uppercase tracking-wider text-[9px] opacity-90">
                                            {badge}
                                          </span>
                                          {formattedSize && (
                                            <>
                                              <span>•</span>
                                              <span>{formattedSize}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const link = document.createElement('a');
                                          link.href = msg.media_url!;
                                          link.download = msg.media_name || 'document';
                                          link.target = '_blank';
                                          link.rel = 'noopener noreferrer';
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                        }}
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                                          isSentByMerchant
                                            ? 'text-white/80 hover:text-white hover:bg-white/20'
                                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
                                        }`}
                                        title="Télécharger le fichier"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          )}

                          {/* Text content */}
                          {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}

                          {/* Time and status */}
                          <div
                            className={`text-[9px] flex items-center justify-end gap-1 mt-1.5 ${
                              isSentByMerchant ? 'text-emerald-200' : 'text-slate-400'
                            }`}
                          >
                            <span>
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isSentByMerchant && (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                            )}
                          </div>
                        </div>

                        {/* Right Checkbox (for merchant messages in select mode) */}
                        {isCustomerMessageSelectMode && isSentByMerchant && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMessageSelection(msg.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-[#1B4B4A] fill-[#1B4B4A]/10" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div ref={customerMessagesEndRef} />
                </div>
              )}
            </div>

            {/* Active Message Input Bar */}
            <div className="p-4 bg-white border-t border-slate-200/80 space-y-2 shrink-0">
              {customerChatError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
                  <span className="font-medium">{customerChatError}</span>
                  <button
                    onClick={() => setCustomerChatError(null)}
                    className="p-1 hover:bg-rose-100 rounded-lg text-rose-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Pending Attachments Preview Box */}
              {customerPendingAttachments.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-2.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-slate-700">
                      {customerPendingAttachments.length}{' '}
                      {customerPendingAttachments.length > 1
                        ? 'pièces jointes prêtes à être envoyées'
                        : 'pièce jointe prête à être envoyée'}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllCustomerPendingAttachments}
                      disabled={customerChatSending || customerChatMediaUploading}
                      className="text-[10px] font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      Tout retirer
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                    {customerPendingAttachments.map((att, idx) => (
                      <div
                        key={att.id || idx}
                        className="relative group bg-white border border-slate-200 rounded-xl p-1.5 flex items-center gap-2 shrink-0 max-w-[220px] shadow-2xs hover:border-[#1B4B4A]/30 transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMediaViewer({
                              url: att.previewUrl,
                              mediaType: att.mediaType,
                              name: att.name,
                              size: att.size,
                            });
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                          title="Cliquer pour prévisualiser"
                        >
                          {att.mediaType === 'image' ? (
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                              <img
                                src={att.previewUrl}
                                alt={att.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : att.mediaType === 'video' ? (
                            <div className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-900 text-white flex items-center justify-center shrink-0">
                              <Video className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-[#1B4B4A] flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-slate-800 truncate group-hover:text-[#1B4B4A]">
                              {att.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-medium">
                              {att.size > 1024 * 1024
                                ? (att.size / (1024 * 1024)).toFixed(1) + ' Mo'
                                : Math.max(1, Math.round(att.size / 1024)) + ' Ko'}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomerPendingAttachment(idx);
                          }}
                          disabled={customerChatSending || customerChatMediaUploading}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Retirer ce fichier"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSendCustomerMessage} className="flex items-center space-x-2">
                {/* Media Attachment Button */}
                <button
                  type="button"
                  onClick={() => customerFileInputRef.current?.click()}
                  disabled={customerChatMediaUploading || customerChatSending}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    customerPendingAttachments.length > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Joindre des fichiers (Images, PDF, documents, max 10 Mo par fichier)"
                >
                  {customerChatMediaUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </button>

                {/* Text Input / Caption */}
                <input
                  type="text"
                  placeholder={
                    customerPendingAttachments.length > 0
                      ? `Ajouter une legende pour ${activeCustomer.name} (optionnel)...`
                      : `Ecrire un message a ${activeCustomer.name}...`
                  }
                  value={customerChatInput}
                  onChange={(e) => setCustomerChatInput(e.target.value)}
                  disabled={customerChatSending || customerChatMediaUploading}
                  className="flex-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-xs font-medium outline-none focus:border-emerald-500 transition-all"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={
                    (!customerChatInput.trim() && customerPendingAttachments.length === 0) ||
                    customerChatSending ||
                    customerChatMediaUploading
                  }
                  className="p-2.5 bg-[#1B4B4A] hover:bg-[#153B3A] text-white rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  title="Envoyer le message"
                >
                  {customerChatSending || customerChatMediaUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal for Deleting Selected Customer Messages */}
      <AnimatePresence>
        {showDeleteMessagesConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl text-slate-800"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Supprimer les messages
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Action irreversible
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                Etes-vous sur de vouloir supprimer definitivement {selectedCustomerMessageIds.length} message{selectedCustomerMessageIds.length > 1 ? 's' : ''} selectionne{selectedCustomerMessageIds.length > 1 ? 's' : ''} ? Cette action ne peut pas etre annulee.
              </p>

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteMessagesConfirmModal(false)}
                  disabled={customerMessageDeleting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSelectedMessages}
                  disabled={customerMessageDeleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {customerMessageDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Suppression...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirmer</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Permanently Deleting a Customer */}
      <AnimatePresence>
        {customerToDeletePermanently && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Supprimer le client
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Action irreversible
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Etes-vous sur de vouloir supprimer definitivement le client{' '}
                <span className="font-bold text-slate-900">{customerToDeletePermanently.name}</span>
                {customerToDeletePermanently.phone ? ` (${customerToDeletePermanently.phone})` : ''} ?
                Cette action est irreversible et supprimera egalement tous les messages associes a ce client.
              </p>

              {deleteCustomerPermanentlyError && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold leading-relaxed">
                  {deleteCustomerPermanentlyError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeletingCustomerPermanently) {
                      setCustomerToDeletePermanently(null);
                      setDeleteCustomerPermanentlyError(null);
                    }
                  }}
                  disabled={isDeletingCustomerPermanently}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCustomerPermanently}
                  disabled={isDeletingCustomerPermanently}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isDeletingCustomerPermanently ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Suppression...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer le client</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Deleting Discussion History */}
      <AnimatePresence>
        {discussionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl text-slate-800"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Supprimer la discussion
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Action irreversible
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Etes-vous sur de vouloir supprimer tout l historique des messages avec{' '}
                <span className="font-bold text-slate-900">{discussionToDelete.name}</span> ?
                Le client sera conserve mais tous ses messages seront definitivement effaces.
              </p>

              {deleteDiscussionError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                  {deleteDiscussionError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isDeletingDiscussion) {
                      setDiscussionToDelete(null);
                      setDeleteDiscussionError(null);
                    }
                  }}
                  disabled={isDeletingDiscussion}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteDiscussion}
                  disabled={isDeletingDiscussion}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isDeletingDiscussion ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Suppression...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Supprimer la discussion</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Creation Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1B4B4A]/10 text-[#1B4B4A] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Ajouter un Client</h3>
                  <p className="text-[11px] text-slate-500">Creation manuelle dans le repertoire</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustomerModalOpen(false);
                  setNewCustomerPhotoUrl('');
                  setCustomerModalError(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs pt-4">
              {/* Photo Upload using shared image cropper */}
              <div className="flex flex-col items-center justify-center pb-2">
                <div className="relative flex flex-col items-center">
                  <input
                    type="file"
                    accept="image/*"
                    id="customer-photo-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setCropImageSrc(reader.result);
                          setCropTarget('customer_create');
                          setCropModalOpen(true);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="customer-photo-input"
                    className="relative cursor-pointer flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-dashed border-emerald-400 bg-white hover:bg-emerald-50/50 transition-all overflow-hidden shadow-xs group"
                  >
                    {newCustomerPhotoUploading ? (
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                    ) : newCustomerPhotoUrl ? (
                      <>
                        <img
                          src={newCustomerPhotoUrl}
                          alt="Apercu photo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-emerald-600">
                        {newCustomerName.trim() ? (
                          <span className="font-extrabold text-emerald-700 text-base uppercase">
                            {newCustomerName.trim().substring(0, 2)}
                          </span>
                        ) : (
                          <User className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 py-0.5 text-[9px] text-white font-bold text-center">
                          Ajouter
                        </div>
                      </div>
                    )}
                  </label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {newCustomerPhotoUrl ? 'Cliquer pour modifier la photo' : 'Photo de profil (optionnel)'}
                    </span>
                    {newCustomerPhotoUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setNewCustomerPhotoUrl('');
                        }}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Nom complet <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Aminata Fall, Moussa Diop..."
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Numero de telephone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="+221 77 000 00 00"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Preference de canal
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCustomerChannel('whatsapp')}
                    className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold transition-all cursor-pointer ${
                      newCustomerChannel === 'whatsapp'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomerChannel('app')}
                    className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold transition-all cursor-pointer ${
                      newCustomerChannel === 'app'
                        ? 'bg-[#1B4B4A]/10 border-[#1B4B4A]/30 text-[#1B4B4A] shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4 text-[#1B4B4A]" />
                    <span>Application</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Notes internes (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={newCustomerNotes}
                  onChange={(e) => setNewCustomerNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="ex: Client VIP, prefere etre livre apres 19h..."
                />
              </div>

              {customerModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                  {customerModalError}
                </div>
              )}

              <div className="pt-2 sticky bottom-0 bg-white pb-1 border-t border-slate-100 mt-2">
                <button
                  type="submit"
                  disabled={customerSaving || !newCustomerName.trim() || !newCustomerPhone.trim()}
                  className={`w-full py-3 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 ${
                    customerSaving || !newCustomerName.trim() || !newCustomerPhone.trim()
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-[#1B4B4A] hover:bg-[#153B3A] cursor-pointer active:scale-98'
                  }`}
                >
                  {customerSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creation du client...</span>
                    </>
                  ) : (
                    <span>Enregistrer le client</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Edit Modal */}
      <AnimatePresence>
        {isEditCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl text-slate-800 flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1B4B4A]/10 text-[#1B4B4A] flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Modifier le Client</h3>
                    <p className="text-[11px] text-slate-500">Mise à jour du profil et des informations</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditCustomerModalOpen(false);
                    setEditingCustomer(null);
                    setEditCustomerModalError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditCustomerSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs pt-4">
                {/* Photo Upload using shared image cropper */}
                <div className="flex flex-col items-center justify-center pb-2">
                  <div className="relative flex flex-col items-center">
                    <input
                      type="file"
                      accept="image/*"
                      id="edit-customer-photo-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setCropImageSrc(reader.result);
                            setCropTarget('customer_create');
                            setCropModalOpen(true);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    <label
                      htmlFor="edit-customer-photo-input"
                      className="relative cursor-pointer flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-dashed border-emerald-400 bg-white hover:bg-emerald-50/50 transition-all overflow-hidden shadow-xs group"
                    >
                      {editCustomerPhotoUrl ? (
                        <>
                          <img
                            src={editCustomerPhotoUrl}
                            alt="Aperçu photo"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-5 h-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-emerald-600">
                          {editCustomerName.trim() ? (
                            <span className="font-extrabold text-emerald-700 text-base uppercase">
                              {editCustomerName.trim().substring(0, 2)}
                            </span>
                          ) : (
                            <User className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-slate-900/60 py-0.5 text-[9px] text-white font-bold text-center">
                            Modifier
                          </div>
                        </div>
                      )}
                    </label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {editCustomerPhotoUrl ? 'Cliquer pour changer la photo' : 'Photo de profil (optionnel)'}
                      </span>
                      {editCustomerPhotoUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setEditCustomerPhotoUrl('');
                          }}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Nom complet <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="ex: Aminata Fall, Moussa Diop..."
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Numéro de téléphone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-mono focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="+221 77 000 00 00"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Préférence de canal
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditCustomerChannel('whatsapp')}
                      className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold transition-all cursor-pointer ${
                        editCustomerChannel === 'whatsapp'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCustomerChannel('app')}
                      className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold transition-all cursor-pointer ${
                        editCustomerChannel === 'app'
                          ? 'bg-[#1B4B4A]/10 border-[#1B4B4A]/30 text-[#1B4B4A] shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-4 h-4 text-[#1B4B4A]" />
                      <span>Application</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Notes internes (optionnel)
                  </label>
                  <textarea
                    rows={2}
                    value={editCustomerNotes}
                    onChange={(e) => setEditCustomerNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="ex: Client VIP, préfère être livré après 19h..."
                  />
                </div>

                {editCustomerModalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                    {editCustomerModalError}
                  </div>
                )}

                <div className="pt-2 sticky bottom-0 bg-white pb-1 border-t border-slate-100 mt-2">
                  <button
                    type="submit"
                    disabled={editCustomerSaving || !editCustomerName.trim() || !editCustomerPhone.trim()}
                    className={`w-full py-3 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 ${
                      editCustomerSaving || !editCustomerName.trim() || !editCustomerPhone.trim()
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-[#1B4B4A] hover:bg-[#153B3A] cursor-pointer active:scale-98'
                    }`}
                  >
                    {editCustomerSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Mise à jour du client...</span>
                      </>
                    ) : (
                      <span>Enregistrer les modifications</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Media Viewer Component */}
      <MediaViewer
        item={activeMediaViewer}
        onClose={() => setActiveMediaViewer(null)}
      />
    </div>
  );
}
