'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, Lock, Smartphone } from 'lucide-react';
import { Order, Business, PaymentMethod } from '@/lib/types';

interface PaymentModalProps {
  order: Order;
  business: Business;
  onClose: () => void;
  onConfirmPayment: (orderId: string, reference: string, method: PaymentMethod) => void;
}

export default function PaymentModal({
  order,
  business,
  onClose,
  onConfirmPayment,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    (order.payment_method as PaymentMethod) || 'wave'
  );
  const [phone, setPhone] = useState(order.customer_phone || '+221 77 123 45 67');
  const [pinCode, setPinCode] = useState('1234');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);

      const generatedRef = `${selectedMethod.toUpperCase()}_REF_${Math.floor(
        100000 + Math.random() * 900000
      )}`;

      setTimeout(() => {
        onConfirmPayment(order.id, generatedRef, selectedMethod);
        onClose();
      }, 1200);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#241F1B]/70 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E5DCD0]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5DCD0]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#F8EFEA] text-[#B5451B] flex items-center justify-center font-bold text-xs">
              <Lock className="w-4 h-4" />
            </div>
            <span className="font-display font-extrabold text-[#241F1B] text-sm">
              Guichet Agrégateur (Wave / OM)
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-[#6B6259] hover:text-[#241F1B] rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#F8EFEA] text-[#B5451B] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-display font-extrabold text-[#241F1B] text-base">Paiement Validé !</h3>
            <p className="text-xs text-[#6B6259]">
              Notification webhook envoyée à {business.name}. L&apos;Assistant IA a confirmé votre règlement.
            </p>
          </div>
        ) : (
          <form onSubmit={handlePay} className="mt-4 space-y-4">
            {/* Merchant Details */}
            <div className="bg-[#F4EFE6] p-3 rounded-2xl border border-[#E5DCD0] text-xs flex justify-between items-center">
              <div>
                <span className="text-[#6B6259] block font-medium">Marchand</span>
                <span className="font-display font-extrabold text-[#241F1B]">{business.name}</span>
              </div>
              <div className="text-right">
                <span className="text-[#6B6259] block font-medium">Montant</span>
                <span className="font-extrabold text-[#B5451B] text-sm tabular-nums">
                  {order.total_amount.toLocaleString()} {business.currency}
                </span>
              </div>
            </div>

            {/* Payment Method selector */}
            <div>
              <label className="block text-xs font-bold text-[#241F1B] mb-1.5">
                Choisir le moyen de paiement
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('wave')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                    selectedMethod === 'wave'
                      ? 'bg-[#1B4B4A] text-white border-[#1B4B4A] shadow-2xs'
                      : 'bg-[#F4EFE6] text-[#6B6259] border-[#E5DCD0]'
                  }`}
                >
                  Wave
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('orange_money')}
                  className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                    selectedMethod === 'orange_money'
                      ? 'bg-[#C88A2E] text-white border-[#C88A2E] shadow-2xs'
                      : 'bg-[#F4EFE6] text-[#6B6259] border-[#E5DCD0]'
                  }`}
                >
                  Orange Money
                </button>
              </div>
            </div>

            {/* Phone input */}
            <div>
              <label className="block text-xs font-bold text-[#241F1B] mb-1">
                Numéro de téléphone
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#F4EFE6] border border-[#E5DCD0] focus:border-[#B5451B] outline-none rounded-xl text-xs font-medium text-[#241F1B]"
              />
            </div>

            {/* PIN simulation */}
            <div>
              <label className="block text-xs font-bold text-[#241F1B] mb-1">
                Code PIN Secret (Simulé)
              </label>
              <input
                type="password"
                required
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                maxLength={4}
                className="w-full px-3 py-2 bg-[#F4EFE6] border border-[#E5DCD0] focus:border-[#B5451B] outline-none rounded-xl text-xs font-medium tracking-widest text-center font-mono text-[#241F1B]"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 bg-[#B5451B] hover:bg-[#9E3B16] text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isProcessing ? (
                <span>Validation en cours...</span>
              ) : (
                <span className="tabular-nums">
                  Payer {order.total_amount.toLocaleString()} {business.currency}
                </span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
