'use client';

import React, { useState } from 'react';
import { MessageSquare, X, Send, Phone, CheckCheck, ShieldCheck, Sparkles, User, Store } from 'lucide-react';
import { WhatsAppMessage } from '@/lib/store';
import { Business } from '@/lib/types';

interface WhatsAppSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  messages: WhatsAppMessage[];
  business: Business;
  onSimulatePayment: (orderId: string) => void;
}

export default function WhatsAppSimulator({
  isOpen,
  onClose,
  messages,
  business,
  onSimulatePayment,
}: WhatsAppSimulatorProps) {
  const [activeChannel, setActiveChannel] = useState<'client' | 'merchant'>('client');
  const [userText, setUserText] = useState('');

  if (!isOpen) return null;

  const filteredMessages = messages.filter((m) => {
    if (m.business_id !== business.id) return false;
    return m.channel === activeChannel;
  });

  const handleSendTestMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userText.trim()) return;

    // Simulate customer typing reply
    setUserText('');
  };

  return (
    <>
      {/* Backdrop overlay to close when clicking outside */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/10 cursor-pointer"
        onClick={onClose}
        aria-label="Fermer le simulateur"
      />

      {/* Floating Interactive WhatsApp Simulator Widget */}
      <div
        className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] max-w-[420px] bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col h-[520px] max-h-[78vh] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Smartphone Top Header Bar */}
        <div className="bg-emerald-900/90 backdrop-blur-md p-3.5 border-b border-emerald-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white border border-emerald-400/40 shrink-0">
              {activeChannel === 'client' ? <User className="w-5 h-5" /> : <Store className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm text-white">
                  {activeChannel === 'client' ? 'WhatsApp Client' : `Alerte Groupe - ${business.name}`}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[11px] text-emerald-200">
                {activeChannel === 'client' ? business.whatsapp_number : 'Canal Interne Commerçant'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-emerald-800 text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channel Switcher Tabs */}
        <div className="bg-slate-950 p-2 border-b border-slate-800 flex space-x-2">
          <button
            onClick={() => setActiveChannel('client')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              activeChannel === 'client'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📱 Vue Client
          </button>
          <button
            onClick={() => setActiveChannel('merchant')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              activeChannel === 'merchant'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🚨 Alerte Commerçant
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-slate-500 text-xs p-4">
              <div>
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>Aucun message pour ce commerce dans ce canal pour le moment.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Passez une commande pour voir l&apos;Assistant IA déclencher des notifications en temps réel !
                </p>
              </div>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isAgent = msg.sender === 'agent' || msg.sender === 'system';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                      isAgent
                        ? 'bg-emerald-950 text-emerald-100 border border-emerald-800/60 rounded-tl-xs'
                        : 'bg-emerald-600 text-white rounded-tr-xs'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{msg.text}</pre>

                    {/* Payment link shortcut button inside bubble */}
                    {msg.order_id && msg.text.includes('Lien de paiement') && (
                      <button
                        onClick={() => onSimulatePayment(msg.order_id!)}
                        className="mt-2.5 w-full py-1.5 px-3 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <span>👉 Régler maintenant (Wave / OM)</span>
                      </button>
                    )}

                    <div className="mt-1.5 flex items-center justify-end space-x-1 text-[10px] text-emerald-400/80">
                      <span suppressHydrationWarning>
                        {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Simulated Footer Input */}
        <form
          onSubmit={handleSendTestMessage}
          className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Répondre au message..."
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
}
