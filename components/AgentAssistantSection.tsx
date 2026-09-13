'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Plus,
  Trash2,
  Paperclip,
  Check,
  Copy,
  RotateCw,
  FolderOpen,
  FolderPlus,
  Folder,
  ChevronDown,
  Edit2,
  Search,
  MessageSquare,
  RotateCcw,
  ArrowLeft,
  Loader2,
  X,
} from 'lucide-react';
import {
  fetchAgentProjectsForBusiness,
  insertAgentProject,
  updateAgentProject,
  deleteAgentProject,
  restoreAgentProject,
  deleteAgentProjectPermanently,
  fetchAgentConversationsForBusiness,
  insertAgentConversation,
  updateAgentConversation,
  deleteAgentConversationPermanently,
  fetchAgentMessagesForConversation,
  insertAgentMessage,
  supabase,
} from '@/lib/supabase';
import {
  Business,
  AgentProject,
  AgentConversation,
  AgentChatMessage,
  AgentChatMessageAttachment,
} from '@/lib/types';
import { getStore } from '@/lib/store';

interface AgentAssistantSectionProps {
  business: Business;
  hasPermission: (permission: any) => boolean;
  setActiveTab?: (tab: any) => void;
}

export default function AgentAssistantSection({
  business,
  hasPermission,
  setActiveTab,
}: AgentAssistantSectionProps) {
  const store = getStore();
  const activeStaff = store.getActiveStaff();

  // Agent Chat / Claude-style Sidebar UI State (Supabase Persistence)
  const [agentProjectsList, setAgentProjectsList] = useState<AgentProject[]>([]);
  const [agentConversationsList, setAgentConversationsList] = useState<AgentConversation[]>([]);
  const [agentMessagesList, setAgentMessagesList] = useState<AgentChatMessage[]>([]);
  const [isLoadingAgentData, setIsLoadingAgentData] = useState(false);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingConversationTitle, setEditingConversationTitle] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [permanentDeletingProjectId, setPermanentDeletingProjectId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [selectedTrashedConversationIds, setSelectedTrashedConversationIds] = useState<Set<string>>(new Set());
  const [selectedTrashedProjectIds, setSelectedTrashedProjectIds] = useState<Set<string>>(new Set());
  const [bulkDeletingConversations, setBulkDeletingConversations] = useState(false);
  const [bulkDeletingProjects, setBulkDeletingProjects] = useState(false);
  const [isBulkDeletingConversationsLoading, setIsBulkDeletingConversationsLoading] = useState(false);
  const [isBulkDeletingProjectsLoading, setIsBulkDeletingProjectsLoading] = useState(false);
  const [isDeletingConversationLoading, setIsDeletingConversationLoading] = useState(false);
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [isDeletingProjectLoading, setIsDeletingProjectLoading] = useState(false);
  const [newProjectInput, setNewProjectInput] = useState('');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showTrashSection, setShowTrashSection] = useState(false);
  const [isTrashViewOpen, setIsTrashViewOpen] = useState(false);
  const [agentChatInput, setAgentChatInput] = useState('');
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<AgentChatMessageAttachment[]>([]);
  const agentFileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isRegeneratingAgentMessage, setIsRegeneratingAgentMessage] = useState(false);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isNotAtBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) > 50;
    setShowScrollBottomButton(isNotAtBottom);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const timer = setTimeout(() => {
      setShowScrollBottomButton(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [agentMessagesList, selectedConversationId]);

  const [demoQuotaUsed, setDemoQuotaUsed] = useState<number | null>(null);
  const [demoQuotaLimit, setDemoQuotaLimit] = useState<number | null>(null);
  const [demoResetAtIso, setDemoResetAtIso] = useState<string | null>(null);
  const [demoCountdownStr, setDemoCountdownStr] = useState<string>('');

  const isDemoQuotaReached =
    demoQuotaUsed !== null &&
    demoQuotaLimit !== null &&
    demoQuotaUsed >= demoQuotaLimit &&
    Boolean(demoResetAtIso);

  useEffect(() => {
    if (!isDemoQuotaReached || !demoResetAtIso) {
      const timer = setTimeout(() => {
        setDemoCountdownStr('');
      }, 0);
      return () => clearTimeout(timer);
    }

    const updateCountdown = () => {
      const targetTime = new Date(demoResetAtIso).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setDemoQuotaUsed(0);
        setDemoCountdownStr('');
        return false;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n: number) => n.toString().padStart(2, '0');
      setDemoCountdownStr(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      return true;
    };

    const hasTimeRemaining = updateCountdown();
    if (!hasTimeRemaining) {
      return;
    }

    const intervalId = setInterval(() => {
      const running = updateCountdown();
      if (!running) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [selectedConversationId, isDemoQuotaReached, demoResetAtIso]);

  // 1. Charge les projets et conversations au montage ou à l'ouverture de l'onglet 'agent'
  useEffect(() => {
    if (business?.id) {
      let isMounted = true;
      const timer = setTimeout(() => {
        if (isMounted) setIsLoadingAgentData(true);
      }, 0);
      Promise.all([
        fetchAgentProjectsForBusiness(business.id),
        fetchAgentConversationsForBusiness(business.id),
      ])
        .then(([projs, convs]) => {
          if (isMounted) {
            setAgentProjectsList(projs || []);
            setAgentConversationsList(convs || []);
            setIsLoadingAgentData(false);
          }
        })
        .catch((err) => {
          console.error("Erreur lors du chargement des données de l'agent:", err);
          if (isMounted) setIsLoadingAgentData(false);
        });

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [business?.id]);

  // 2. Quand une conversation est sélectionnée, charge ses messages depuis Supabase
  useEffect(() => {
    if (selectedConversationId) {
      let isMounted = true;
      fetchAgentMessagesForConversation(selectedConversationId)
        .then((msgs) => {
          if (isMounted) {
            setAgentMessagesList(msgs || []);
          }
        })
        .catch((err) => {
          console.error("Erreur lors du chargement des messages de l'agent:", err);
        });
      return () => {
        isMounted = false;
      };
    } else {
      const timer = setTimeout(() => {
        setAgentMessagesList([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedConversationId]);

  const activeProjects = agentProjectsList.filter((p) => (p.status || 'active') === 'active');
  const trashedProjects = agentProjectsList.filter((p) => p.status === 'trashed');
  const activeConversations = agentConversationsList.filter((c) => c.status === 'active');
  const trashedConversations = agentConversationsList.filter((c) => c.status === 'trashed');
  const currentConversation = activeConversations.find((c) => c.id === selectedConversationId);
  const currentMessages = selectedConversationId ? agentMessagesList : [];

  const lastAssistantMessageId = useMemo(() => {
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].sender === 'assistant') {
        return currentMessages[i].id;
      }
    }
    return null;
  }, [currentMessages]);

  const handleAgentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newAttachment: AgentChatMessageAttachment = {
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          url: dataUrl,
        };
        setStagedAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    if (agentFileInputRef.current) {
      agentFileInputRef.current.value = '';
    }
  };

  const handleSendAgentMessage = async (promptText?: string) => {
    const textToSend = (promptText || agentChatInput).trim();
    if (!textToSend && stagedAttachments.length === 0) return;

    const currentAttachments = [...stagedAttachments];
    let targetConvId = selectedConversationId;
    const currentConv = activeConversations.find((c) => c.id === targetConvId);

    if (!currentConv) {
      const fallbackTitle = textToSend
        ? (textToSend.length > 30 ? textToSend.substring(0, 30) + '...' : textToSend)
        : (currentAttachments[0]?.name || 'Nouvelle discussion');
      const convRes = await insertAgentConversation({
        business_id: business.id,
        project_id: null,
        title: fallbackTitle,
      });

      if (!convRes.success || !convRes.conversation) {
        alert(convRes.error || "Impossible d'initialiser la discussion.");
        return;
      }

      targetConvId = convRes.conversation.id;
      setAgentConversationsList((prev) => [convRes.conversation!, ...prev]);
      setSelectedConversationId(convRes.conversation.id);
    }

    const displayText = textToSend || (currentAttachments.length === 1 ? `Fichier joint : ${currentAttachments[0].name}` : `${currentAttachments.length} fichiers joints`);

    // 1. Enregistre le message utilisateur dans Supabase
    const userMsgRes = await insertAgentMessage({
      conversation_id: targetConvId!,
      sender: 'user',
      content: displayText,
      attachments: currentAttachments,
    });

    if (!userMsgRes.success || !userMsgRes.message) {
      alert(userMsgRes.error || "Impossible d'enregistrer le message.");
      return;
    }

    setAgentMessagesList((prev) => [...prev, userMsgRes.message!]);
    setAgentChatInput('');
    setStagedAttachments([]);
    setShowPlusMenu(false);

    // Met à jour la conversation dans la liste locale (updated_at et titre si 'Nouvelle discussion')
    setAgentConversationsList((prev) =>
      prev.map((c) => {
        if (c.id === targetConvId) {
          const shouldUpdateTitle = (c.title === 'Nouvelle discussion' || !c.title) && displayText;
          return {
            ...c,
            title: shouldUpdateTitle ? (displayText.length > 30 ? displayText.substring(0, 30) + '...' : displayText) : c.title,
            updated_at: new Date().toISOString(),
          };
        }
        return c;
      })
    );

    // 2. Appel a la vraie route API de l'assistant IA Gemini
    const previousHistory = agentMessagesList
      .filter((m) => m.conversation_id === targetConvId)
      .map((m) => ({
        role: (m.sender === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.text,
      }));

    let responseText = '';
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          message: displayText,
          conversation_history: previousHistory,
        }),
      });

      const data = await res.json();

      if (typeof data.demo_messages_used_today === 'number') {
        setDemoQuotaUsed(data.demo_messages_used_today);
      }
      if (typeof data.demo_messages_limit === 'number') {
        setDemoQuotaLimit(data.demo_messages_limit);
      }
      if (typeof data.reset_at_iso === 'string') {
        setDemoResetAtIso(data.reset_at_iso);
      }

      if (!res.ok || !data.success) {
        responseText = data?.error || 'Erreur de connexion avec le serveur de l assistant IA.';
      } else {
        responseText = data.text || 'Aucune reponse generee par l assistant.';
      }
    } catch {
      responseText = 'Erreur de connexion avec le serveur de l assistant IA.';
    }

    // 3. Enregistre la reponse de l'assistant dans Supabase
    const assistantMsgRes = await insertAgentMessage({
      conversation_id: targetConvId!,
      sender: 'assistant',
      content: responseText,
    });

    if (assistantMsgRes.success && assistantMsgRes.message) {
      setAgentMessagesList((prev) => [...prev, assistantMsgRes.message!]);
    }
  };

  const handleCopyMessageText = async (id: string, text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard non disponible');
      }
      setCopiedMessageId(id);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedMessageId(id);
        setTimeout(() => {
          setCopiedMessageId((prev) => (prev === id ? null : prev));
        }, 2000);
      } catch {
        // Ignorer l erreur silencieusement
      }
    }
  };

  const handleRegenerateLastMessage = async (lastAssistantMsg: AgentChatMessage) => {
    if (isRegeneratingAgentMessage || !selectedConversationId) return;

    const currentConvMessages = agentMessagesList.filter(
      (m) => m.conversation_id === selectedConversationId
    );
    const lastAssistantIdx = currentConvMessages.findIndex((m) => m.id === lastAssistantMsg.id);
    const prevMessages = lastAssistantIdx >= 0 ? currentConvMessages.slice(0, lastAssistantIdx) : currentConvMessages;
    const lastUserMsg = [...prevMessages].reverse().find((m) => m.sender === 'user');

    if (!lastUserMsg) return;

    setIsRegeneratingAgentMessage(true);

    setAgentMessagesList((prev) => prev.filter((m) => m.id !== lastAssistantMsg.id));

    try {
      if (supabase) {
        await (supabase as any)
          .from('platform_agent_messages')
          .delete()
          .eq('id', lastAssistantMsg.id);
      }
    } catch {
      // Ignorer l erreur de suppression
    }

    const historyBefore = prevMessages
      .filter((m) => m.id !== lastUserMsg.id)
      .map((m) => ({
        role: (m.sender === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.text,
      }));

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          message: lastUserMsg.text,
          conversation_history: historyBefore,
        }),
      });

      const data = await res.json();

      if (typeof data.demo_messages_used_today === 'number') {
        setDemoQuotaUsed(data.demo_messages_used_today);
      }
      if (typeof data.demo_messages_limit === 'number') {
        setDemoQuotaLimit(data.demo_messages_limit);
      }
      if (typeof data.reset_at_iso === 'string') {
        setDemoResetAtIso(data.reset_at_iso);
      }

      let responseText = '';
      if (!res.ok || !data.success) {
        responseText = data?.error || 'Erreur de connexion avec le serveur de l assistant IA.';
      } else {
        responseText = data.text || 'Aucune reponse generee par l assistant.';
      }

      const assistantMsgRes = await insertAgentMessage({
        conversation_id: selectedConversationId,
        sender: 'assistant',
        content: responseText,
      });

      if (assistantMsgRes.success && assistantMsgRes.message) {
        setAgentMessagesList((prev) => [...prev.filter((m) => m.id !== lastAssistantMsg.id), assistantMsgRes.message!]);
      } else {
        setAgentMessagesList((prev) => [
          ...prev.filter((m) => m.id !== lastAssistantMsg.id),
          {
            id: 'temp-' + Date.now(),
            conversation_id: selectedConversationId,
            sender: 'assistant',
            text: responseText,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      const errorMsg = 'Erreur de connexion avec le serveur de l assistant IA.';
      setAgentMessagesList((prev) => [
        ...prev.filter((m) => m.id !== lastAssistantMsg.id),
        {
          id: 'temp-' + Date.now(),
          conversation_id: selectedConversationId,
          sender: 'assistant',
          text: errorMsg,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsRegeneratingAgentMessage(false);
    }
  };

  const handleStartNewConversation = async (projectId: string | null = null) => {
    setIsTrashViewOpen(false);
    const res = await insertAgentConversation({
      business_id: business.id,
      project_id: projectId || null,
      title: 'Nouvelle discussion',
    });

    if (!res.success || !res.conversation) {
      alert(res.error || "Impossible de créer la nouvelle discussion.");
      return;
    }

    setAgentConversationsList((prev) => [res.conversation!, ...prev]);
    setSelectedConversationId(res.conversation.id);
  };

  const handleCreateProject = async () => {
    const name = newProjectInput.trim();
    if (!name) return;
    const res = await insertAgentProject({
      business_id: business.id,
      name,
    });

    if (!res.success || !res.project) {
      alert(res.error || "Impossible de créer le projet.");
      return;
    }

    setAgentProjectsList((prev) => [...prev, res.project!]);
    setNewProjectInput('');
    setShowNewProjectForm(false);
  };

  const handleRenameProject = async (projectId: string) => {
    const newName = editingProjectName.trim();
    if (!newName) return;
    const res = await updateAgentProject(projectId, newName);

    if (!res.success) {
      alert(res.error || "Impossible de renommer le projet.");
      return;
    }

    setAgentProjectsList((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: newName } : p))
    );
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleDeleteProject = async (projectId: string) => {
    setIsDeletingProjectLoading(true);
    try {
      const res = await deleteAgentProject(projectId);
      if (!res.success) {
        alert(res.error || "Impossible de mettre le projet en corbeille.");
        return;
      }
      setAgentProjectsList((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: 'trashed' } : p))
      );
      setAgentConversationsList((prev) =>
        prev.map((c) => (c.project_id === projectId ? { ...c, project_id: null } : c))
      );
    } finally {
      setIsDeletingProjectLoading(false);
      setDeletingProjectId(null);
    }
  };

  const handleRestoreProject = async (projectId: string) => {
    const res = await restoreAgentProject(projectId);
    if (!res.success) {
      alert(res.error || "Impossible de restaurer le projet.");
      return;
    }
    setAgentProjectsList((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: 'active' } : p))
    );
  };

  const handleDeleteProjectPermanently = async (projectId: string) => {
    setIsDeletingProjectLoading(true);
    try {
      const res = await deleteAgentProjectPermanently(projectId);
      if (!res.success) {
        alert(res.error || "Impossible de supprimer définitivement le projet.");
        return;
      }
      setAgentProjectsList((prev) => prev.filter((p) => p.id !== projectId));
    } finally {
      setIsDeletingProjectLoading(false);
      setPermanentDeletingProjectId(null);
    }
  };

  const handleRenameConversation = async (conversationId: string) => {
    const newTitle = editingConversationTitle.trim();
    if (!newTitle) {
      setEditingConversationId(null);
      setEditingConversationTitle('');
      return;
    }
    const res = await updateAgentConversation(conversationId, { title: newTitle });
    if (!res.success) {
      alert(res.error || "Impossible de renommer la discussion.");
      return;
    }
    setAgentConversationsList((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, title: newTitle, updated_at: new Date().toISOString() }
          : c
      )
    );
    setEditingConversationId(null);
    setEditingConversationTitle('');
  };

  const handleMoveConversationToTrash = async (conversationId: string) => {
    const res = await updateAgentConversation(conversationId, { status: 'trashed' });
    if (!res.success) {
      alert(res.error || "Impossible de déplacer la discussion dans la corbeille.");
      return;
    }

    setAgentConversationsList((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, status: 'trashed', updated_at: new Date().toISOString() }
          : c
      )
    );

    if (selectedConversationId === conversationId) {
      setSelectedConversationId(null);
    }
  };

  const handleRestoreConversation = async (conversationId: string) => {
    const res = await updateAgentConversation(conversationId, { status: 'active' });
    if (!res.success) {
      alert(res.error || "Impossible de restaurer la discussion.");
      return;
    }

    setAgentConversationsList((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, status: 'active', updated_at: new Date().toISOString() }
          : c
      )
    );
  };

  const handleDeleteConversationPermanently = async (conversationId: string) => {
    setIsDeletingConversationLoading(true);
    try {
      const res = await deleteAgentConversationPermanently(conversationId);
      if (!res.success) {
        alert(res.error || "Impossible de supprimer definitivement la discussion.");
        return;
      }
      setAgentConversationsList((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setAgentMessagesList([]);
      }
    } finally {
      setIsDeletingConversationLoading(false);
      setDeletingConversationId(null);
    }
  };

  const handleAssignConversationToProject = async (conversationId: string, projectId: string | null) => {
    const res = await updateAgentConversation(conversationId, { project_id: projectId });
    if (!res.success) {
      alert(res.error || "Impossible d'affecter le projet à la discussion.");
      return;
    }

    setAgentConversationsList((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, project_id: projectId, updated_at: new Date().toISOString() }
          : c
      )
    );
  };

  if (!hasPermission('agent')) {
    return null;
  }

  return (
    <>
          <div className="bg-[#FAF7F2] text-[#241F1B] min-h-[680px] rounded-3xl p-4 sm:p-6 relative flex flex-col md:flex-row gap-4 overflow-hidden shadow-2xs border border-[#E5DCD0] font-sans">
            
            {/* INNER AGENT SIDEBAR (Claude.ai Style) */}
            <div className="w-full md:w-72 shrink-0 bg-[#F5F0E8] border border-[#E5DCD0] rounded-2xl p-4 flex flex-col justify-between space-y-4 font-sans">
              <div className="space-y-4">
                {/* Top New Conversation Button */}
                <button
                  onClick={() => handleStartNewConversation()}
                  className="w-full flex items-center justify-center space-x-2 bg-[#1B4B4A] hover:bg-[#143938] text-white py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle conversation</span>
                </button>

                {/* Search / Filter input inside sidebar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={agentSearchQuery}
                    onChange={(e) => setAgentSearchQuery(e.target.value)}
                    placeholder="Rechercher une discussion..."
                    className="w-full bg-white/80 border border-[#E5DCD0] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#241F1B] placeholder-slate-400 focus:outline-none focus:border-[#1B4B4A]"
                  />
                </div>

                {/* Discussions Section */}
                <div
                  className={`space-y-1.5 transition-all p-1 rounded-xl ${
                    isDragOverRoot
                      ? 'bg-[#1B4B4A]/10 border-2 border-dashed border-[#1B4B4A]'
                      : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragOverRoot(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setIsDragOverRoot(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOverRoot(false);
                    const conversationId = e.dataTransfer.getData('text/plain');
                    if (conversationId) {
                      handleAssignConversationToProject(conversationId, null);
                    }
                  }}
                >
                  <div className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-bold px-2 py-1 flex items-center justify-between">
                    <span>Discussions</span>
                    {isDragOverRoot && (
                      <span className="text-[9px] text-[#1B4B4A] font-bold lowercase">
                        deposer a la racine
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {(() => {
                      const rootConversations = activeConversations.filter(
                        (c) =>
                          (!c.project_id || !activeProjects.some((p) => p.id === c.project_id)) &&
                          (!agentSearchQuery || c.title.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                      );

                      if (rootConversations.length === 0) {
                        return <p className="text-xs text-slate-400 italic px-2 py-1">Aucune discussion active</p>;
                      }

                      return rootConversations.map((conv) => {
                        const isSelected = selectedConversationId === conv.id;
                        const isEditingThisConv = editingConversationId === conv.id;

                        return (
                          <div
                            key={conv.id}
                            draggable={!isEditingThisConv}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', conv.id);
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedConversationId(conv.id);
                            }}
                            onDragEnd={() => {
                              setDraggedConversationId(null);
                              setDragOverProjectId(null);
                              setIsDragOverRoot(false);
                            }}
                            className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                              draggedConversationId === conv.id ? 'opacity-40 ' : ''
                            }${
                              isSelected && !isTrashViewOpen
                                ? 'bg-white border border-[#E5DCD0] text-[#241F1B] shadow-2xs'
                                : 'hover:bg-white/60 text-slate-600'
                            }`}
                            onClick={() => {
                              if (!isEditingThisConv) {
                                setSelectedConversationId(conv.id);
                                setIsTrashViewOpen(false);
                              }
                            }}
                          >
                            <div className="flex items-center space-x-2 truncate pr-1 flex-1 min-w-0">
                              <MessageSquare className="w-3.5 h-3.5 text-[#1B4B4A] shrink-0" />
                              {isEditingThisConv ? (
                                <input
                                  type="text"
                                  value={editingConversationTitle}
                                  onChange={(e) => setEditingConversationTitle(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameConversation(conv.id);
                                    if (e.key === 'Escape') {
                                      setEditingConversationId(null);
                                      setEditingConversationTitle('');
                                    }
                                  }}
                                  className="text-xs p-0.5 border border-[#E5DCD0] rounded bg-white w-full focus:outline-none focus:border-[#1B4B4A]"
                                  autoFocus
                                />
                              ) : (
                                <span className="truncate">{conv.title}</span>
                              )}
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              {isEditingThisConv ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameConversation(conv.id);
                                    }}
                                    className="p-1 hover:text-emerald-600 text-slate-400 cursor-pointer"
                                    title="Valider"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingConversationId(null);
                                      setEditingConversationTitle('');
                                    }}
                                    className="p-1 hover:text-slate-600 text-slate-400 cursor-pointer"
                                    title="Annuler"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingConversationId(conv.id);
                                      setEditingConversationTitle(conv.title);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-slate-800 text-slate-400 transition-opacity cursor-pointer"
                                    title="Renommer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveConversationToTrash(conv.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#B5451B] text-slate-400 transition-opacity cursor-pointer"
                                    title="Mettre en corbeille"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Projets Section */}
                <div className="space-y-1.5 pt-2 border-t border-[#E5DCD0]">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase font-bold">
                      Projets ({activeProjects.length})
                    </span>
                    <button
                      onClick={() => setShowNewProjectForm(true)}
                      className="p-1 text-slate-500 hover:text-[#1B4B4A] cursor-pointer"
                      title="Créer un projet"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {showNewProjectForm && (
                    <div className="p-2 bg-white rounded-xl border border-[#E5DCD0] space-y-2">
                      <input
                        type="text"
                        value={newProjectInput}
                        onChange={(e) => setNewProjectInput(e.target.value)}
                        placeholder="Nom du projet..."
                        className="w-full text-xs p-1.5 border border-[#E5DCD0] rounded-lg focus:outline-none focus:border-[#1B4B4A]"
                        autoFocus
                      />
                      <div className="flex justify-end space-x-1">
                        <button
                          onClick={() => setShowNewProjectForm(false)}
                          className="p-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCreateProject}
                          className="px-2 py-1 text-xs bg-[#1B4B4A] text-white rounded-lg hover:bg-[#143938] cursor-pointer"
                        >
                          Créer
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {activeProjects.length === 0 ? (
                      <p className="text-xs text-slate-400 italic px-2 py-1">Aucun projet actif</p>
                    ) : (
                      activeProjects.map((proj) => {
                        const projConvs = activeConversations.filter(
                          (c) =>
                            c.project_id === proj.id &&
                            (!agentSearchQuery || c.title.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                        );
                        const isExpanded = expandedProjects[proj.id] ?? true;
                        return (
                          <div key={proj.id} className="space-y-1">
                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                              }}
                              onDragEnter={(e) => {
                                e.preventDefault();
                                setDragOverProjectId(proj.id);
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                if (dragOverProjectId === proj.id) {
                                  setDragOverProjectId(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverProjectId(null);
                                const conversationId = e.dataTransfer.getData('text/plain');
                                if (conversationId) {
                                  handleAssignConversationToProject(conversationId, proj.id);
                                }
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all ${
                                dragOverProjectId === proj.id
                                  ? 'bg-[#1B4B4A]/15 border-2 border-dashed border-[#1B4B4A]'
                                  : 'bg-white/40 hover:bg-white/80'
                              }`}
                            >
                              <div
                                className="flex items-center space-x-1.5 flex-1 cursor-pointer truncate"
                                onClick={() =>
                                  setExpandedProjects(prev => ({ ...prev, [proj.id]: !isExpanded }))
                                }
                              >
                                {isExpanded ? (
                                  <FolderOpen className="w-3.5 h-3.5 text-[#B5451B] shrink-0" />
                                ) : (
                                  <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                {editingProjectId === proj.id ? (
                                  <input
                                    type="text"
                                    value={editingProjectName}
                                    onChange={(e) => setEditingProjectName(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameProject(proj.id);
                                      if (e.key === 'Escape') {
                                        setEditingProjectId(null);
                                        setEditingProjectName('');
                                      }
                                    }}
                                    className="text-xs p-0.5 border border-[#E5DCD0] rounded bg-white w-full"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="truncate">{proj.name}</span>
                                )}
                              </div>

                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleStartNewConversation(proj.id)}
                                  className="p-1 hover:text-[#1B4B4A] text-slate-400 cursor-pointer"
                                  title="Nouvelle discussion dans ce projet"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                {editingProjectId === proj.id ? (
                                  <button
                                    onClick={() => handleRenameProject(proj.id)}
                                    className="p-1 hover:text-emerald-600 text-slate-400 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingProjectId(proj.id);
                                      setEditingProjectName(proj.name);
                                    }}
                                    className="p-1 hover:text-slate-800 text-slate-400 cursor-pointer"
                                    title="Renommer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingProjectId(proj.id);
                                  }}
                                  className="p-1 hover:text-[#B5451B] text-slate-400 cursor-pointer"
                                  title="Mettre en corbeille"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* List of discussions inside project */}
                            {isExpanded && (
                              <div className="pl-4 space-y-1">
                                {projConvs.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic px-2">Aucune discussion</p>
                                ) : (
                                  projConvs.map(conv => {
                                    const isSelected = selectedConversationId === conv.id;
                                    const isEditingThisConv = editingConversationId === conv.id;

                                    return (
                                      <div
                                        key={conv.id}
                                        draggable={!isEditingThisConv}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('text/plain', conv.id);
                                          e.dataTransfer.effectAllowed = 'move';
                                          setDraggedConversationId(conv.id);
                                        }}
                                        onDragEnd={() => {
                                          setDraggedConversationId(null);
                                          setDragOverProjectId(null);
                                          setIsDragOverRoot(false);
                                        }}
                                        onClick={() => {
                                          if (!isEditingThisConv) {
                                            setSelectedConversationId(conv.id);
                                            setIsTrashViewOpen(false);
                                          }
                                        }}
                                        className={`group p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                                          draggedConversationId === conv.id ? 'opacity-40 ' : ''
                                        }${
                                          isSelected && !isTrashViewOpen
                                            ? 'bg-white text-[#241F1B] border border-[#E5DCD0] font-semibold'
                                            : 'text-slate-600 hover:bg-white/50'
                                        }`}
                                      >
                                        <div className="flex items-center space-x-1.5 truncate flex-1 min-w-0 pr-1">
                                          {isEditingThisConv ? (
                                            <input
                                              type="text"
                                              value={editingConversationTitle}
                                              onChange={(e) => setEditingConversationTitle(e.target.value)}
                                              onClick={(e) => e.stopPropagation()}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRenameConversation(conv.id);
                                                if (e.key === 'Escape') {
                                                  setEditingConversationId(null);
                                                  setEditingConversationTitle('');
                                                }
                                              }}
                                              className="text-[11px] p-0.5 border border-[#E5DCD0] rounded bg-white w-full focus:outline-none focus:border-[#1B4B4A]"
                                              autoFocus
                                            />
                                          ) : (
                                            <span className="truncate">{conv.title}</span>
                                          )}
                                        </div>

                                        <div className="flex items-center space-x-0.5 shrink-0">
                                          {isEditingThisConv ? (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRenameConversation(conv.id);
                                                }}
                                                className="p-0.5 hover:text-emerald-600 text-slate-400 cursor-pointer"
                                                title="Valider"
                                              >
                                                <Check className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingConversationId(null);
                                                  setEditingConversationTitle('');
                                                }}
                                                className="p-0.5 hover:text-slate-600 text-slate-400 cursor-pointer"
                                                title="Annuler"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingConversationId(conv.id);
                                                  setEditingConversationTitle(conv.title);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-slate-800 text-slate-400 transition-opacity cursor-pointer"
                                                title="Renommer"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleMoveConversationToTrash(conv.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#B5451B] text-slate-400 transition-opacity cursor-pointer"
                                                title="Mettre en corbeille"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Corbeille Section at Bottom of Sidebar */}
              <div className="pt-2 border-t border-[#E5DCD0]">
                <button
                  onClick={() => setIsTrashViewOpen(true)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isTrashViewOpen
                      ? 'bg-white border border-[#E5DCD0] shadow-2xs text-[#B5451B] font-bold'
                      : 'hover:bg-white/60 text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Trash2 className="w-4 h-4 text-[#B5451B]" />
                    <span className="text-xs">Corbeille ({trashedConversations.length + trashedProjects.length})</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-[#B5451B] font-bold border border-red-100">
                    {trashedConversations.length + trashedProjects.length}
                  </span>
                </button>
              </div>
            </div>

            {/* MAIN CHAT WORKSPACE AREA */}
            <div className="flex-1 flex flex-col justify-between space-y-4 p-2 sm:p-4">
              {isTrashViewOpen ? (
                /* VUE DÉDIÉE CORBEILLE (Conversations & Projets) */
                <div className="flex-1 flex flex-col space-y-4 h-full">
                  {/* Top Bar for Trash View */}
                  <div className="flex items-center justify-between w-full border-b border-[#E5DCD0]/60 pb-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setIsTrashViewOpen(false)}
                        className="w-9 h-9 rounded-full bg-white border border-[#E5DCD0] flex items-center justify-center hover:bg-slate-100 transition-all cursor-pointer text-[#241F1B] shadow-2xs"
                        title="Retour aux discussions"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h3 className="text-base font-bold text-[#241F1B] flex items-center space-x-2">
                          <Trash2 className="w-4 h-4 text-[#B5451B]" />
                          <span>Corbeille de l&apos;assistant</span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          {trashedConversations.length} discussion(s) et {trashedProjects.length} projet(s) en corbeille
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsTrashViewOpen(false)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#E5DCD0] hover:bg-[#FAF7F2] text-[#241F1B] rounded-xl shadow-2xs transition-all cursor-pointer"
                    >
                      Retour aux discussions
                    </button>
                  </div>

                  {/* List of Trashed Items */}
                  <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-6">
                    {trashedConversations.length === 0 && trashedProjects.length === 0 ? (
                      <div className="max-w-md mx-auto my-auto text-center py-16 space-y-3">
                        <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border border-[#E5DCD0] flex items-center justify-center mx-auto text-slate-400">
                          <Trash2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-base font-bold text-[#241F1B]">La corbeille est vide</h4>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Aucune discussion ni aucun projet ne se trouve dans la corbeille pour le moment.
                        </p>
                        <button
                          onClick={() => setIsTrashViewOpen(false)}
                          className="mt-2 px-4 py-2 bg-[#1B4B4A] text-white text-xs font-semibold rounded-xl hover:bg-[#143938] transition-colors cursor-pointer"
                        >
                          Retourner aux discussions
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6 max-w-2xl mx-auto w-full pt-2">
                        {/* Section 1: Discussions en corbeille */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                              Discussions en corbeille ({trashedConversations.length})
                            </div>
                            {trashedConversations.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedTrashedConversationIds.size === trashedConversations.length) {
                                    setSelectedTrashedConversationIds(new Set());
                                  } else {
                                    setSelectedTrashedConversationIds(new Set(trashedConversations.map((c) => c.id)));
                                  }
                                }}
                                className="text-xs font-medium text-[#1B4B4A] hover:underline cursor-pointer"
                              >
                                {selectedTrashedConversationIds.size === trashedConversations.length
                                  ? 'Tout deselectionner'
                                  : 'Tout selectionner'}
                              </button>
                            )}
                          </div>

                          {selectedTrashedConversationIds.size > 0 && (
                            <div className="p-3 bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700">
                                {selectedTrashedConversationIds.size} discussion(s) selectionnee(s)
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ids = Array.from(selectedTrashedConversationIds);
                                    const results = await Promise.all(
                                      ids.map(async (id) => {
                                        const res = await updateAgentConversation(id, { status: 'active' });
                                        return { id, success: res.success, error: res.error };
                                      })
                                    );
                                    const successes = results.filter((r) => r.success).map((r) => r.id);
                                    const failures = results.filter((r) => !r.success);
                                    if (failures.length > 0) {
                                      alert(
                                        failures.length +
                                          ' echec(s) lors de la restauration :\n' +
                                          failures.map((f) => f.error || f.id).join('\n')
                                      );
                                    }
                                    if (successes.length > 0) {
                                      const successSet = new Set(successes);
                                      setAgentConversationsList((prev) =>
                                        prev.map((c) =>
                                          successSet.has(c.id)
                                            ? { ...c, status: 'active', updated_at: new Date().toISOString() }
                                            : c
                                        )
                                      );
                                    }
                                    setSelectedTrashedConversationIds(new Set());
                                  }}
                                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restaurer la selection</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBulkDeletingConversations(true)}
                                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-[#B5451B] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Supprimer definitivement la selection</span>
                                </button>
                              </div>
                            </div>
                          )}
                          {trashedConversations.length === 0 ? (
                            <p className="text-xs text-slate-400 italic px-2 py-1">Aucune discussion en corbeille</p>
                          ) : (
                            <div className="space-y-2">
                              {trashedConversations.map((conv) => {
                                const isChecked = selectedTrashedConversationIds.has(conv.id);
                                const projName = conv.project_id
                                  ? agentProjectsList.find((p) => p.id === conv.project_id)?.name
                                  : null;
                                return (
                                  <div
                                    key={conv.id}
                                    className="p-3.5 rounded-2xl bg-white border border-[#E5DCD0] shadow-2xs flex items-center justify-between space-x-4 hover:border-slate-300 transition-all"
                                  >
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedTrashedConversationIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(conv.id)) {
                                              next.delete(conv.id);
                                            } else {
                                              next.add(conv.id);
                                            }
                                            return next;
                                          });
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-[#1B4B4A] focus:ring-[#1B4B4A] cursor-pointer shrink-0"
                                      />
                                      <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center space-x-2">
                                          <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                                          <h4 className="text-sm font-bold text-[#241F1B] truncate">{conv.title}</h4>
                                          {projName && (
                                            <span className="text-[10px] font-semibold bg-[#FAF7F2] border border-[#E5DCD0] text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                                              {projName}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-400">
                                          {conv.updated_at
                                            ? `Modifie le ${new Date(conv.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                            : 'En corbeille'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2 shrink-0">
                                      <button
                                        onClick={() => {
                                          handleRestoreConversation(conv.id);
                                        }}
                                        className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                                        title="Restaurer la discussion"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Restaurer</span>
                                      </button>
                                      <button
                                        onClick={() => setDeletingConversationId(conv.id)}
                                        className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-[#B5451B] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                                        title="Supprimer definitivement"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Supprimer definitivement</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Section 2: Projets en corbeille */}
                        <div className="space-y-2 pt-2 border-t border-[#E5DCD0]/60">
                          <div className="flex items-center justify-between px-1">
                            <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                              Projets en corbeille ({trashedProjects.length})
                            </div>
                            {trashedProjects.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedTrashedProjectIds.size === trashedProjects.length) {
                                    setSelectedTrashedProjectIds(new Set());
                                  } else {
                                    setSelectedTrashedProjectIds(new Set(trashedProjects.map((p) => p.id)));
                                  }
                                }}
                                className="text-xs font-medium text-[#1B4B4A] hover:underline cursor-pointer"
                              >
                                {selectedTrashedProjectIds.size === trashedProjects.length
                                  ? 'Tout deselectionner'
                                  : 'Tout selectionner'}
                              </button>
                            )}
                          </div>

                          {selectedTrashedProjectIds.size > 0 && (
                            <div className="p-3 bg-[#FAF7F2] border border-[#E5DCD0] rounded-xl flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700">
                                {selectedTrashedProjectIds.size} projet(s) selectionne(s)
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ids = Array.from(selectedTrashedProjectIds);
                                    const results = await Promise.all(
                                      ids.map(async (id) => {
                                        const res = await restoreAgentProject(id);
                                        return { id, success: res.success, error: res.error };
                                      })
                                    );
                                    const successes = results.filter((r) => r.success).map((r) => r.id);
                                    const failures = results.filter((r) => !r.success);
                                    if (failures.length > 0) {
                                      alert(
                                        failures.length +
                                          ' echec(s) lors de la restauration :\n' +
                                          failures.map((f) => f.error || f.id).join('\n')
                                      );
                                    }
                                    if (successes.length > 0) {
                                      const successSet = new Set(successes);
                                      setAgentProjectsList((prev) =>
                                        prev.map((p) => (successSet.has(p.id) ? { ...p, status: 'active' } : p))
                                      );
                                    }
                                    setSelectedTrashedProjectIds(new Set());
                                  }}
                                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restaurer la selection</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBulkDeletingProjects(true)}
                                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-[#B5451B] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Supprimer definitivement la selection</span>
                                </button>
                              </div>
                            </div>
                          )}
                          {trashedProjects.length === 0 ? (
                            <p className="text-xs text-slate-400 italic px-2 py-1">Aucun projet en corbeille</p>
                          ) : (
                            <div className="space-y-2">
                              {trashedProjects.map((proj) => {
                                const isChecked = selectedTrashedProjectIds.has(proj.id);
                                return (
                                <div
                                  key={proj.id}
                                  className="p-3.5 rounded-2xl bg-white border border-[#E5DCD0] shadow-2xs flex items-center justify-between space-x-4 hover:border-slate-300 transition-all"
                                >
                                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedTrashedProjectIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(proj.id)) {
                                            next.delete(proj.id);
                                          } else {
                                            next.add(proj.id);
                                          }
                                          return next;
                                        });
                                      }}
                                      className="w-4 h-4 rounded border-slate-300 text-[#1B4B4A] focus:ring-[#1B4B4A] cursor-pointer shrink-0"
                                    />
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center space-x-2">
                                        <Folder className="w-4 h-4 text-[#B5451B] shrink-0" />
                                        <h4 className="text-sm font-bold text-[#241F1B] truncate">{proj.name}</h4>
                                        <span className="text-[10px] font-semibold bg-rose-50 border border-rose-100 text-rose-700 px-2 py-0.5 rounded-full shrink-0">
                                          Projet corbeille
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-400">
                                        {proj.created_at
                                          ? `Cree le ${new Date(proj.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                          : 'En corbeille'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2 shrink-0">
                                    <button
                                      onClick={() => handleRestoreProject(proj.id)}
                                      className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                                      title="Restaurer le projet"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Restaurer</span>
                                    </button>
                                    <button
                                      onClick={() => setPermanentDeletingProjectId(proj.id)}
                                      className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-[#B5451B] bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                                      title="Supprimer definitivement"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Supprimer definitivement</span>
                                    </button>
                                  </div>
                                </div>
                              );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* CHAT WORKSPACE NORMAL */
                <>
                  {/* Top Bar: Circular Back Arrow & Conversation Context */}
                  <div className="flex items-center justify-between w-full border-b border-[#E5DCD0]/60 pb-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setActiveTab?.('overview')}
                        className="w-9 h-9 rounded-full bg-white border border-[#E5DCD0] flex items-center justify-center hover:bg-slate-100 transition-all cursor-pointer text-[#241F1B] shadow-2xs"
                        title="Retour au Tableau de bord"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      {currentConversation && (
                        <div>
                          <h3 className="text-sm font-bold text-[#241F1B]">{currentConversation.title}</h3>
                          <p className="text-[11px] text-slate-500">
                            {currentConversation.project_id
                              ? `Projet: ${agentProjectsList.find(p => p.id === currentConversation.project_id)?.name || 'Inconnu'}`
                              : 'Discussion non classée'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Project Assignment Dropdown / Quick Actions if active conversation */}
                    {currentConversation && (
                      <div className="flex items-center space-x-2">
                        <select
                          value={currentConversation.project_id || ''}
                          onChange={(e) => handleAssignConversationToProject(currentConversation.id, e.target.value || null)}
                          className="text-xs bg-white border border-[#E5DCD0] rounded-xl px-2.5 py-1.5 text-[#241F1B] focus:outline-none focus:border-[#1B4B4A] cursor-pointer"
                        >
                          <option value="">-- Sans projet --</option>
                          {agentProjectsList.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            handleMoveConversationToTrash(currentConversation.id);
                          }}
                          className="p-2 text-slate-400 hover:text-[#B5451B] hover:bg-white rounded-xl border border-transparent hover:border-[#E5DCD0] transition-all cursor-pointer"
                          title="Mettre en corbeille"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

              {/* MAIN CONTENT WORKSPACE: STATE 1 (WELCOME) vs STATE 2 (ACTIVE CHAT STREAM) */}
              <div className="flex-1 flex flex-col justify-center py-4">
                {!currentConversation || currentMessages.length === 0 ? (
                  /* ÉTAT 1 — Aucune conversation active (écran d'accueil) */
                  <div className="max-w-2xl mx-auto w-full text-center space-y-6 my-auto">
                    <div className="space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-[#241F1B]">
                        Bonjour, {activeStaff?.name ? activeStaff.name.split(' ')[0] : 'Gérant'}
                      </h2>
                      <p className="text-sm sm:text-base text-slate-600 font-medium max-w-lg mx-auto">
                        Comment puis-je vous aider aujourd&apos;hui ? Posez une question sur votre commerce ou lancez une analyse.
                      </p>
                    </div>

                    {/* Suggestion Pills */}
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      <button
                        onClick={() => handleSendAgentMessage("Combien de commandes sont enregistrées ?")}
                        className="bg-white border border-[#E5DCD0] hover:border-[#1B4B4A] hover:bg-[#1B4B4A]/5 text-[#241F1B] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        📊 Synthèse des commandes
                      </button>
                      <button
                        onClick={() => handleSendAgentMessage("Combien de clients compte notre base ?")}
                        className="bg-white border border-[#E5DCD0] hover:border-[#1B4B4A] hover:bg-[#1B4B4A]/5 text-[#241F1B] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        👥 Nombre de clients enregistrés
                      </button>
                      <button
                        onClick={() => handleSendAgentMessage("Lancer mon projet avec l'IA")}
                        className="bg-[#1B4B4A] text-white hover:bg-[#143938] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        🚀 Lancer mon projet avec l&apos;IA
                      </button>
                      <button
                        onClick={() => handleSendAgentMessage("Quel est l'état du catalogue produits ?")}
                        className="bg-white border border-[#E5DCD0] hover:border-[#1B4B4A] hover:bg-[#1B4B4A]/5 text-[#241F1B] rounded-2xl px-4 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer"
                      >
                        📦 État du catalogue produits
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ÉTAT 2 — Conversation active (fil de messages) */
                  <div className="relative flex-1 flex flex-col min-h-0">
                    <div
                      ref={messagesContainerRef}
                      onScroll={handleMessagesScroll}
                      className="space-y-6 max-h-[460px] overflow-y-auto pr-2 flex-1"
                    >
                      {currentMessages.map((msg) => (
                        <div key={msg.id} className="space-y-1.5">
                          {msg.sender === 'user' ? (
                            <div className="flex flex-col items-end space-y-1">
                              <div className="bg-slate-100 border border-slate-200/80 text-slate-700 rounded-2xl sm:rounded-3xl px-5 py-3 text-xs sm:text-sm font-medium shadow-2xs max-w-xl">
                                {msg.text}
                              </div>
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-end max-w-xl">
                                  {msg.attachments.map((att) => (
                                    <div key={att.id} className="bg-white border border-[#E5DCD0] rounded-xl p-2 text-xs text-[#241F1B] shadow-2xs space-y-1">
                                      {att.type.startsWith('image/') ? (
                                        <div>
                                          <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[140px] object-cover rounded-lg" />
                                          <p className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-[180px]">{att.name}</p>
                                        </div>
                                      ) : (
                                        <div className="flex items-center space-x-2">
                                          <Paperclip className="w-4 h-4 text-[#1B4B4A] shrink-0" />
                                          <div className="truncate">
                                            <p className="font-semibold truncate max-w-[140px]">{att.name}</p>
                                            <p className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(0)} Ko</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center space-x-2 text-[10px] font-mono tracking-[0.2em] text-[#1B4B4A] uppercase font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1B4B4A] inline-block" />
                                <span>Assistant IA</span>
                              </div>
                              <div className="max-w-2xl bg-white border border-[#E5DCD0] rounded-2xl shadow-2xs overflow-hidden">
                                <div className="p-4 sm:p-5 text-sm sm:text-base font-medium text-[#241F1B] leading-relaxed">
                                  <ReactMarkdown
                                    components={{
                                      h1: ({ children }) => <h1 className="text-lg sm:text-xl font-bold text-[#241F1B] mt-3 mb-1.5 first:mt-0">{children}</h1>,
                                      h2: ({ children }) => <h2 className="text-base sm:text-lg font-bold text-[#241F1B] mt-2.5 mb-1.5 first:mt-0">{children}</h2>,
                                      h3: ({ children }) => <h3 className="text-sm sm:text-base font-bold text-[#241F1B] mt-2 mb-1 first:mt-0">{children}</h3>,
                                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 pl-1">{children}</ul>,
                                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 pl-1">{children}</ol>,
                                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                      strong: ({ children }) => <strong className="font-bold text-[#241F1B]">{children}</strong>,
                                      em: ({ children }) => <em className="italic">{children}</em>,
                                      code: ({ children }) => <code className="bg-slate-100 text-slate-800 text-xs px-1.5 py-0.5 rounded font-mono">{children}</code>,
                                      blockquote: ({ children }) => <blockquote className="border-l-2 border-[#1B4B4A] pl-3 italic my-2 text-slate-600">{children}</blockquote>,
                                    }}
                                  >
                                    {msg.text}
                                  </ReactMarkdown>
                                </div>

                                <div className="px-4 py-2 border-t border-[#E5DCD0]/60 bg-[#FAF7F2] flex items-center justify-between text-xs text-slate-500">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleCopyMessageText(msg.id, msg.text)}
                                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-slate-600 hover:text-[#1B4B4A] hover:bg-white border border-transparent hover:border-[#E5DCD0] transition-all cursor-pointer font-medium"
                                      title="Copier le texte"
                                    >
                                      {copiedMessageId === msg.id ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-[#1B4B4A]" />
                                          <span className="text-[#1B4B4A]">Copie</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copier</span>
                                        </>
                                      )}
                                    </button>

                                    {msg.id === lastAssistantMessageId && (
                                      <button
                                        disabled={isRegeneratingAgentMessage}
                                        onClick={() => handleRegenerateLastMessage(msg)}
                                        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-slate-600 hover:text-[#1B4B4A] hover:bg-white border border-transparent hover:border-[#E5DCD0] transition-all cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Regenerer la reponse"
                                      >
                                        {isRegeneratingAgentMessage ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B4B4A]" />
                                            <span className="text-[#1B4B4A]">Regeneration...</span>
                                          </>
                                        ) : (
                                          <>
                                            <RotateCw className="w-3.5 h-3.5" />
                                            <span>Regenerer</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {showScrollBottomButton && (
                      <button
                        onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/95 hover:bg-white text-[#1B4B4A] border border-[#E5DCD0] shadow-md p-2 rounded-full transition-all hover:scale-105 cursor-pointer z-10 flex items-center justify-center"
                        title="Defiler vers le bas"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Input Area */}
              <div className="w-full space-y-2 pt-2 border-t border-[#E5DCD0]/60">
                {/* Staged Attachments Preview */}
                {stagedAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-[#F5F0E8] border border-[#E5DCD0] rounded-2xl">
                    {stagedAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center space-x-2 bg-white border border-[#E5DCD0] rounded-xl px-2.5 py-1.5 text-xs text-[#241F1B] shadow-2xs"
                      >
                        {att.type.startsWith('image/') ? (
                          <img src={att.url} alt={att.name} className="w-6 h-6 object-cover rounded-lg shrink-0" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-[#1B4B4A] shrink-0" />
                        )}
                        <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                        <span className="text-[10px] text-slate-400">({(att.size / 1024).toFixed(0)} Ko)</span>
                        <button
                          onClick={() => setStagedAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                          className="p-0.5 text-slate-400 hover:text-[#B5451B] rounded-full hover:bg-slate-100 cursor-pointer"
                          title="Retirer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isDemoQuotaReached && (
                  <div className="mb-2 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between text-xs text-amber-900 font-sans shadow-2xs">
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-semibold">
                        Quota quotidien : {demoQuotaUsed}/{demoQuotaLimit} messages
                      </span>
                    </div>
                    {demoCountdownStr && (
                      <div className="flex items-center space-x-1.5 font-mono text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
                        <span>Reinitialisation dans</span>
                        <span>{demoCountdownStr}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white border border-[#E5DCD0] focus-within:border-slate-400 rounded-full px-4 py-2.5 flex items-center space-x-3 shadow-2xs transition-all relative">
                  {/* Plus Button with Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowPlusMenu((prev) => !prev)}
                      className={`p-1 rounded-full transition-colors cursor-pointer ${
                        showPlusMenu ? 'bg-[#FAF7F2] text-[#241F1B] border border-[#E5DCD0]' : 'text-slate-400 hover:text-[#241F1B]'
                      }`}
                      title="Ajouter un fichier"
                    >
                      <Plus className="w-5 h-5" />
                    </button>

                    {showPlusMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowPlusMenu(false)}
                        />
                        <div className="absolute bottom-full mb-3 left-0 z-50 bg-[#FAF7F2] border border-[#E5DCD0] rounded-2xl shadow-xl p-1.5 min-w-[210px] space-y-1 font-sans">
                          <button
                            onClick={() => {
                              setShowPlusMenu(false);
                              agentFileInputRef.current?.click();
                            }}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#241F1B] hover:bg-[#B5451B]/10 hover:text-[#B5451B] transition-colors cursor-pointer text-left"
                          >
                            <Paperclip className="w-4 h-4 text-[#1B4B4A] shrink-0" />
                            <span>Ajouter des fichiers</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={agentFileInputRef}
                    multiple
                    onChange={handleAgentFileUpload}
                    className="hidden"
                  />

                  <input
                    type="text"
                    disabled={isDemoQuotaReached}
                    value={agentChatInput}
                    onChange={(e) => setAgentChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !isDemoQuotaReached) {
                        e.preventDefault();
                        handleSendAgentMessage();
                      }
                    }}
                    placeholder={isDemoQuotaReached ? "Quota quotidien atteint..." : "Ecrire un message..."}
                    className={`bg-transparent text-xs sm:text-sm text-[#241F1B] placeholder-slate-400 focus:outline-none flex-1 font-medium ${
                      isDemoQuotaReached ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                  />

                  <button
                    disabled={isDemoQuotaReached}
                    onClick={() => !isDemoQuotaReached && handleSendAgentMessage()}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      isDemoQuotaReached
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-2xs'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

          </div>

      {/* Modal Confirmation de Mise en Corbeille de Projet (Agent IA) */}
      <AnimatePresence>
        {deletingProjectId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200/80 space-y-4 font-sans"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Mettre ce projet en corbeille ?
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Cette action détachera les discussions.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Voulez-vous vraiment mettre ce projet en corbeille ? Les discussions qu&apos;il contient ne seront pas supprimées, elles seront simplement détachées du projet et resteront accessibles dans votre liste de discussions.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingProjectLoading}
                  onClick={() => setDeletingProjectId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isDeletingProjectLoading}
                  onClick={() => handleDeleteProject(deletingProjectId)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {isDeletingProjectLoading ? (
                    <span>Mise en corbeille...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Mettre en corbeille</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmation de Suppression Définitive de Projet (Agent IA) */}
      {/* Modal Confirmation Suppression Definitive Discussion (Agent IA) */}
      {/* Modal Confirmation Suppression Definitive Groupée Discussions (Agent IA) */}
      <AnimatePresence>
        {bulkDeletingConversations && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200/80 space-y-4 font-sans"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Supprimer definitivement la selection ?
                  </h3>
                  <p className="text-xs text-rose-500 font-medium">
                    Cette action est irreversible.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Voulez-vous vraiment supprimer definitivement ces {selectedTrashedConversationIds.size} discussions ? Tous les messages associes seront definitivement effaces de la base de donnees.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isBulkDeletingConversationsLoading}
                  onClick={() => setBulkDeletingConversations(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isBulkDeletingConversationsLoading}
                  onClick={async () => {
                    setIsBulkDeletingConversationsLoading(true);
                    try {
                      const ids = Array.from(selectedTrashedConversationIds);
                      const results = await Promise.all(
                        ids.map(async (id) => {
                          const res = await deleteAgentConversationPermanently(id);
                          return { id, success: res.success, error: res.error };
                        })
                      );
                      const successes = results.filter((r) => r.success).map((r) => r.id);
                      const failures = results.filter((r) => !r.success);
                      if (failures.length > 0) {
                        alert(
                          failures.length +
                            ' echec(s) lors de la suppression :\n' +
                            failures.map((f) => f.error || f.id).join('\n')
                        );
                      }
                      if (successes.length > 0) {
                        const successSet = new Set(successes);
                        setAgentConversationsList((prev) => prev.filter((c) => !successSet.has(c.id)));
                      }
                      setSelectedTrashedConversationIds(new Set());
                    } finally {
                      setIsBulkDeletingConversationsLoading(false);
                      setBulkDeletingConversations(false);
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {isBulkDeletingConversationsLoading ? (
                    <span>Suppression...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer ({selectedTrashedConversationIds.size})</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmation Suppression Definitive Groupée Projets (Agent IA) */}
      <AnimatePresence>
        {bulkDeletingProjects && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200/80 space-y-4 font-sans"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Supprimer definitivement la selection ?
                  </h3>
                  <p className="text-xs text-rose-500 font-medium">
                    Cette action est irreversible.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Voulez-vous vraiment supprimer definitivement ces {selectedTrashedProjectIds.size} projets ? Les projets seront definitivement effaces de la base de donnees.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isBulkDeletingProjectsLoading}
                  onClick={() => setBulkDeletingProjects(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isBulkDeletingProjectsLoading}
                  onClick={async () => {
                    setIsBulkDeletingProjectsLoading(true);
                    try {
                      const ids = Array.from(selectedTrashedProjectIds);
                      const results = await Promise.all(
                        ids.map(async (id) => {
                          const res = await deleteAgentProjectPermanently(id);
                          return { id, success: res.success, error: res.error };
                        })
                      );
                      const successes = results.filter((r) => r.success).map((r) => r.id);
                      const failures = results.filter((r) => !r.success);
                      if (failures.length > 0) {
                        alert(
                          failures.length +
                            ' echec(s) lors de la suppression :\n' +
                            failures.map((f) => f.error || f.id).join('\n')
                        );
                      }
                      if (successes.length > 0) {
                        const successSet = new Set(successes);
                        setAgentProjectsList((prev) => prev.filter((p) => !successSet.has(p.id)));
                      }
                      setSelectedTrashedProjectIds(new Set());
                    } finally {
                      setIsBulkDeletingProjectsLoading(false);
                      setBulkDeletingProjects(false);
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {isBulkDeletingProjectsLoading ? (
                    <span>Suppression...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer ({selectedTrashedProjectIds.size})</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmation Suppression Definitive Discussion (Agent IA) */}
      <AnimatePresence>
        {deletingConversationId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200/80 space-y-4 font-sans"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Supprimer definitivement cette discussion ?
                  </h3>
                  <p className="text-xs text-rose-500 font-medium">
                    Cette action est irreversible.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Voulez-vous vraiment supprimer definitivement cette discussion ? Tous les messages associes seront definitivement effaces de la base de donnees.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingConversationLoading}
                  onClick={() => setDeletingConversationId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isDeletingConversationLoading}
                  onClick={() => handleDeleteConversationPermanently(deletingConversationId)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {isDeletingConversationLoading ? (
                    <span>Suppression...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer definitivement</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {permanentDeletingProjectId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200/80 space-y-4 font-sans"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Supprimer définitivement ce projet ?
                  </h3>
                  <p className="text-xs text-rose-500 font-medium">
                    Cette action est irréversible.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Voulez-vous vraiment supprimer définitivement ce projet ? Cette action est irréversible et supprimera le projet de la base de données. Les discussions qui étaient rattachées à ce projet restent conservées dans vos discussions.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDeletingProjectLoading}
                  onClick={() => setPermanentDeletingProjectId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isDeletingProjectLoading}
                  onClick={() => handleDeleteProjectPermanently(permanentDeletingProjectId)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {isDeletingProjectLoading ? (
                    <span>Suppression...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer définitivement</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </>
  );
}
