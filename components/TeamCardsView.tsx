import React, { useMemo } from 'react';
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
  // Calcul réel de la masse salariale affichée (somme des salaires numériques > 0)
  const totalPayroll = useMemo(() => {
    return teamMembers.reduce((sum, emp) => {
      const salaryNum = typeof emp.salary === 'number' ? emp.salary : parseFloat(String(emp.salary).replace(/[^0-9.-]+/g, ''));
      return sum + (!isNaN(salaryNum) && salaryNum > 0 ? salaryNum : 0);
    }, 0);
  }, [teamMembers]);

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
        const salaryNum = typeof emp.salary === 'number' ? emp.salary : parseFloat(String(emp.salary).replace(/[^0-9.-]+/g, ''));
        const hasValidSalary = !isNaN(salaryNum) && salaryNum > 0;

        // Calcul réel de la part dans la masse salariale
        const percentage = hasValidSalary && totalPayroll > 0 ? (salaryNum / totalPayroll) * 100 : 0;
        const formattedPercentage =
          percentage < 0.1 && percentage > 0
            ? '< 0,1'
            : percentage.toLocaleString('fr-FR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              });

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

            {/* Milieu / Bas de la carte : Salaire + Barre de part de masse salariale */}
            <div className="pt-2 border-t border-[#E5DCD0]/60 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Salaire
                </span>
                <span className="text-xs sm:text-sm font-black text-[#241F1B] tabular-nums whitespace-nowrap">
                  {formattedSalary}
                </span>
              </div>

              {/* Barre fine : part de la masse salariale (uniquement si salaire > 0 et consultation autorisée) */}
              {activeStaff.role === 'owner' && hasValidSalary && totalPayroll > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Part de la masse salariale</span>
                    <span className="font-bold text-[#1B4B4A]">{formattedPercentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#FAF7F2] border border-[#E5DCD0]/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1B4B4A] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
