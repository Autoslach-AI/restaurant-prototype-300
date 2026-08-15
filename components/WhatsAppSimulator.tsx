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
        className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[400px] max-w-[420px] bg-black rounded-3xl shadow-2xl border border-neutral-800 overflow-hidden flex flex-col h-[520px] max-h-[78vh] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Smartphone Top Header Bar */}
        <div className="bg-neutral-900 p-3.5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold border border-neutral-300 shrink-0">
              {activeChannel === 'client' ? <User className="w-5 h-5 text-black" /> : <Store className="w-5 h-5 text-black" />}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm text-white">
                  {activeChannel === 'client' ? 'WhatsApp Client' : `Alerte Groupe - ${business.name}`}
                </span>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
              <p className="text-[11px] text-neutral-400">
                {activeChannel === 'client' ? business.whatsapp_number : 'Canal Interne Commerçant'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channel Switcher Tabs */}
        <div className="bg-black p-2 border-b border-neutral-800 flex space-x-2">
          <button
            onClick={() => setActiveChannel('client')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              activeChannel === 'client'
                ? 'bg-white text-black shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            📱 Vue Client
          </button>
          <button
            onClick={() => setActiveChannel('merchant')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              activeChannel === 'merchant'
                ? 'bg-white text-black shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🚨 Alerte Commerçant
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px] bg-neutral-950">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-neutral-500 text-xs p-4">
              <div>
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                <p>Aucun message pour ce commerce dans ce canal pour le moment.</p>
                <p className="text-[11px] text-neutral-600 mt-1">
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
                        ? 'bg-neutral-900 text-neutral-100 border border-neutral-800 rounded-tl-xs'
                        : 'bg-white text-black rounded-tr-xs'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{msg.text}</pre>

                    {/* Payment link shortcut button inside bubble */}
                    {msg.order_id && msg.text.includes('Lien de paiement') && (
                      <button
                        onClick={() => onSimulatePayment(msg.order_id!)}
                        className="mt-2.5 w-full py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center space-x-1 cursor-pointer border border-neutral-700"
                      >
                        <span>👉 Régler maintenant (Wave / OM)</span>
                      </button>
                    )}

                    <div className={`mt-1.5 flex items-center justify-end space-x-1 text-[10px] ${isAgent ? 'text-neutral-400' : 'text-neutral-600'}`}>
                      <span suppressHydrationWarning>
                        {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <CheckCheck className={`w-3.5 h-3.5 ${isAgent ? 'text-neutral-400' : 'text-neutral-700'}`} />
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
          className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Répondre au message..."
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            className="flex-1 bg-black border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-neutral-400 placeholder:text-neutral-500"
          />
          <button
            type="submit"
            className="p-2.5 bg-white hover:bg-neutral-200 text-black rounded-xl shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4 text-black" />
          </button>
        </form>
      </div>
    </>
  );
}
