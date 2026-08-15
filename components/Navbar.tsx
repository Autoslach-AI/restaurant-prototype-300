'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ShoppingBag, LayoutDashboard, Search, RotateCcw } from 'lucide-react';
import { Business } from '@/lib/types';

interface NavbarProps {
  viewMode: 'client' | 'merchant';
  setViewMode: (mode: 'client' | 'merchant') => void;
  activeBusiness: Business;
  businesses?: Business[];
  onSelectBusiness?: (businessId: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  onResetData: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onToggleWhatsAppSim?: () => void;
  isWhatsAppOpen?: boolean;
}

export default function Navbar({
  viewMode,
  setViewMode,
  activeBusiness,
  businesses,
  onSelectBusiness,
  cartCount,
  onOpenCart,
  onResetData,
  searchQuery,
  onSearchChange,
}: NavbarProps) {
  const [localSearch, setLocalSearch] = useState('');

  const currentSearch = searchQuery !== undefined ? searchQuery : localSearch;

  const handleSearchChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setLocalSearch(val);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E5DCD0] shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo + Name of Connected Business Only */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="relative w-10 h-10 rounded-xl bg-[#241F1B] overflow-hidden flex items-center justify-center text-white font-extrabold text-base shadow-sm border border-[#241F1B] shrink-0">
              {activeBusiness.logo_url ? (
                <Image
                  src={activeBusiness.logo_url}
                  alt={activeBusiness.name}
                  fill
                  sizes="40px"
                  unoptimized
                  referrerPolicy="no-referrer"
                  className="object-cover"
                />
              ) : (
                <span className="text-[#B5451B] font-display font-black">
                  {activeBusiness.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display font-extrabold text-[#241F1B] text-base sm:text-lg tracking-tight">
                  {activeBusiness.name}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F4EFE6] text-[#6B6259] border border-[#E5DCD0] capitalize hidden sm:inline-block">
                  {activeBusiness.type}
                </span>
              </div>
              <span className="text-xs text-[#6B6259] hidden sm:block">
                {viewMode === 'client' ? 'Boutique en ligne officielle' : 'Espace de gestion commerçant'}
              </span>
            </div>
          </div>

          {/* Center: Global Search Bar */}
          <div className="relative flex-1 max-w-md mx-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6259] pointer-events-none" />
            <input
              type="text"
              value={currentSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Rechercher une commande, un client, un produit..."
              className="w-full bg-[#F4EFE6]/80 hover:bg-[#F4EFE6] focus:bg-white text-[#241F1B] text-xs rounded-xl pl-9 pr-3 py-2 border border-[#E5DCD0] focus:border-[#B5451B] shadow-2xs focus:outline-none transition-all placeholder:text-[#6B6259] font-medium"
            />
          </div>

          {/* Right Controls: View Toggle, Cart & Reset */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Mode Toggle Pill */}
            <div className="flex items-center bg-[#F4EFE6] p-1 rounded-2xl border border-[#E5DCD0]">
              <button
                onClick={() => setViewMode('client')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'client'
                    ? 'bg-white text-[#B5451B] shadow-2xs font-extrabold'
                    : 'text-[#6B6259] hover:text-[#241F1B]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#B5451B]" />
                <span className="hidden sm:inline">Site Client</span>
              </button>
              <button
                onClick={() => setViewMode('merchant')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'merchant'
                    ? 'bg-[#1B4B4A] text-white shadow-2xs font-extrabold'
                    : 'text-[#6B6259] hover:text-[#241F1B]'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            </div>

            {/* Cart Button for Client View */}
            {viewMode === 'client' && (
              <button
                onClick={onOpenCart}
                className="relative p-2.5 rounded-xl bg-[#B5451B] hover:bg-[#9E3B16] text-white transition-all shadow-sm focus:outline-none cursor-pointer"
                aria-label="Voir le panier"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#C88A2E] text-[#241F1B] font-black text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs tabular-nums">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Reset Seed Data Icon Button */}
            <button
              onClick={onResetData}
              className="p-2 rounded-xl text-[#6B6259] hover:text-[#241F1B] hover:bg-[#F4EFE6] transition-colors cursor-pointer"
              title="Réinitialiser les données de démo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
