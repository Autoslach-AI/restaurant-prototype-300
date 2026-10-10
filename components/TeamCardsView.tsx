import React from 'react';
import Image from 'next/image';
import { Business, Staff } from '@/lib/types';
import { TeamMemberRow } from '@/components/TeamSection';

export interface TeamCardsViewProps {
  teamMembers: TeamMemberRow[];
  business: Business;
  activeStaff: Staff;
  getInitials: (name: string) => string;
  onSelectMember: (member: TeamMemberRow) => void;
}

// Génère une couleur de fond déterministe élégante pour les initiales si pas de photo
function getAvatarBgColor(name: string): string {
  const colors = [
    'bg-[#1B4B4A] text-white',
    'bg-emerald-700 text-white',
    'bg-slate-800 text-white',
    'bg-amber-700 text-white',
    'bg-indigo-700 text-white',
    'bg-teal-700 text-white',
    'bg-purple-700 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function TeamCardsView({
  teamMembers,
  business,
  activeStaff,
  getInitials,
  onSelectMember,
}: TeamCardsViewProps) {
  // État vide identique au tableau de la vue Liste
  if (teamMembers.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        Aucun membre de l&apos;équipe ne correspond aux critères.
      </div>
    );
  }

  const currency = business.currency || 'FCFA';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 p-4 sm:p-6 bg-[#FAF7F2]/40 rounded-2xl border border-[#E5DCD0]/70">
      {teamMembers.map((emp) => {
        const photoSrc = emp.photo_url || emp.avatar_url;

        const formattedSalary =
          activeStaff.role === 'owner'
            ? typeof emp.salary === 'number'
              ? `${emp.salary.toLocaleString('fr-FR')} ${currency}`
              : emp.salary || '—'
            : '—';

        return (
          <div
            key={emp.id}
            onClick={() => onSelectMember(emp)}
            className="bg-white rounded-2xl border border-[#E5DCD0] p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all hover:border-[#1B4B4A]/50 gap-3.5 cursor-pointer group"
          >
            {/* Haut de la carte : Avatar rond + Nom, rôle et statut */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                {/* Avatar rond (photo si disponible, sinon initiales sur fond coloré) */}
                <div className="shrink-0">
                  {photoSrc ? (
                    <Image
                      src={photoSrc}
                      alt={emp.name}
                      width={44}
                      height={44}
                      className="w-11 h-11 rounded-full object-cover border border-[#E5DCD0] shadow-2xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`w-11 h-11 rounded-full border border-[#E5DCD0] flex items-center justify-center text-xs font-black shrink-0 shadow-2xs ${getAvatarBgColor(
                        emp.name
                      )}`}
                    >
                      {getInitials(emp.name)}
                    </div>
                  )}
                </div>

                {/* Statut avec le même rendu que la liste */}
                <div className="shrink-0">
                  {emp.status === 'active' && (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Active</span>
                    </span>
                  )}
                  {emp.status === 'inactive' && (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>Inactive</span>
                    </span>
                  )}
                  {(emp.status === 'on_leave' || emp.status === 'on leave') && (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>On leave</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Nom & Rôle */}
              <div className="min-w-0">
                <h4
                  className="text-xs sm:text-sm font-black text-[#241F1B] group-hover:text-[#1B4B4A] transition-colors truncate"
                  title={emp.name}
                >
                  {emp.name}
                </h4>
                <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                  {emp.role || emp.position || 'Membre'}
                </p>
                {emp.position && emp.position !== emp.role && (
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {emp.position}
                  </p>
                )}
              </div>
            </div>

            {/* Bas de la carte : Salaire uniquement */}
            <div className="pt-2 border-t border-[#E5DCD0]/60">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Salaire
                </span>
                <span className="text-xs sm:text-sm font-black text-[#241F1B] tabular-nums whitespace-nowrap">
                  {formattedSalary}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
