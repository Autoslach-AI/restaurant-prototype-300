import React from 'react';
import Image from 'next/image';
import { CheckCircle2, Clock, X } from 'lucide-react';
import { AttendanceRecord, Staff } from '@/lib/types';
import { TeamMemberRow } from '@/components/TeamSection';

export interface AttendanceCardsViewProps {
  displayRows: TeamMemberRow[];
  todayAttendanceMap: Record<string, AttendanceRecord>;
  attendance30DaysRecords: AttendanceRecord[];
  todayStr: string;
  canMarkAttendance: boolean;
  getInitials: (name: string) => string;
  onSelectMember: (member: TeamMemberRow) => void;
  onMarkStatus: (staffId: string, status: 'present' | 'absent' | 'late') => void;
  onOpenReasonModal: (staff: Staff, status: 'absent' | 'late') => void;
}

// Génère une couleur de fond déterministe pour les initiales si pas de photo
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

export default function AttendanceCardsView({
  displayRows,
  todayAttendanceMap,
  attendance30DaysRecords,
  todayStr,
  canMarkAttendance,
  getInitials,
  onSelectMember,
  onMarkStatus,
  onOpenReasonModal,
}: AttendanceCardsViewProps) {
  // État vide identique au tableau de la vue Liste
  if (displayRows.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        Aucun membre trouvé dans cette catégorie de pointage.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 p-4 sm:p-6 bg-[#FAF7F2]/40 rounded-2xl border border-[#E5DCD0]/70">
      {displayRows.map((emp) => {
        const photoSrc = emp.photo_url || emp.avatar_url;
        const att = todayAttendanceMap[emp.id];
        const status = att?.status;
        const reason = att?.reason;

        // Heure d'arrivée basée sur created_at de l'enregistrement de pointage du jour
        let arrivalTime: string | null = null;
        if (att?.created_at && (status === 'present' || status === 'late')) {
          try {
            const d = new Date(att.created_at);
            arrivalTime = d.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            });
          } catch {
            arrivalTime = null;
          }
        }

        // Calcul réel de la présence sur les 30 derniers jours avec les MÊMES données que l'historique
        const daysWithRecords = new Map<string, 'present' | 'absent' | 'late'>();
        for (const rec of attendance30DaysRecords) {
          if (rec.staff_id === emp.id && rec.status) {
            daysWithRecords.set(rec.date, rec.status as any);
          }
        }
        // Prendre en compte l'état en direct du jour
        if (todayAttendanceMap[emp.id]?.status) {
          daysWithRecords.set(todayStr, todayAttendanceMap[emp.id].status as any);
        }

        let attendedCount = 0; // jours Présent + En retard
        let recordedDaysCount = 0; // jours enregistrés (présent, retard ou absent)

        daysWithRecords.forEach((s) => {
          if (s === 'present' || s === 'late') {
            attendedCount++;
            recordedDaysCount++;
          } else if (s === 'absent') {
            recordedDaysCount++;
          }
        });

        const attendanceRate =
          recordedDaysCount > 0 ? (attendedCount / recordedDaysCount) * 100 : 0;
        const formattedRate =
          attendanceRate < 0.1 && attendanceRate > 0
            ? '< 0,1'
            : attendanceRate.toLocaleString('fr-FR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              });

        return (
          <div
            key={emp.id}
            onClick={() => onSelectMember(emp)}
            className="bg-white rounded-2xl border border-[#E5DCD0] p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all hover:border-[#1B4B4A]/50 gap-3.5 cursor-pointer group"
          >
            {/* Haut de la carte : Avatar + Nom & Rôle + Statut du jour */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                {/* Avatar rond */}
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

                {/* Badge statut du jour avec le même rendu que la liste */}
                <div className="shrink-0">
                  <span
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border shadow-2xs ${
                      status === 'present'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : status === 'late'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : status === 'absent'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {status === 'present' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    {status === 'late' && (
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    {status === 'absent' && (
                      <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {status === 'present'
                        ? 'Présent'
                        : status === 'late'
                        ? 'Retard'
                        : status === 'absent'
                        ? 'Absent'
                        : 'Non pointé'}
                    </span>
                  </span>
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

                {/* Heure d'arrivée si elle existe */}
                {arrivalTime && (
                  <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Arrivée : {arrivalTime}</span>
                  </p>
                )}

                {/* Motif de justification s'il existe (Retard ou Absent) */}
                {(status === 'late' || status === 'absent') && (
                  <div className="mt-1.5">
                    {reason && reason.trim() ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs"
                        title={`Motif : ${reason}`}
                      >
                        Justifié : {reason}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                        Non justifié
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions de pointage (marquer / justifier) + Barre de présence */}
            <div className="pt-2.5 border-t border-[#E5DCD0]/60 space-y-2.5" onClick={(e) => e.stopPropagation()}>
              {/* Sélecteur de pointage rapide (identique à la liste) */}
              {canMarkAttendance && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Pointage
                  </span>
                  <select
                    value={status || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'present') {
                        onMarkStatus(emp.id, 'present');
                      } else if (val === 'late') {
                        onOpenReasonModal(emp.rawStaff, 'late');
                      } else if (val === 'absent') {
                        onOpenReasonModal(emp.rawStaff, 'absent');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-none transition-all cursor-pointer shadow-2xs ${
                      status === 'present'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : status === 'late'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        : status === 'absent'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    <option value="" disabled className="text-slate-400 bg-white">
                      ― Statut
                    </option>
                    <option value="present" className="text-emerald-800 font-bold bg-white">
                      ✓ Présent
                    </option>
                    <option value="late" className="text-amber-800 font-bold bg-white">
                      ⏰ Retard
                    </option>
                    <option value="absent" className="text-rose-800 font-bold bg-white">
                      ✕ Absent
                    </option>
                  </select>
                </div>
              )}

              {/* Barre fine : Présence sur 30 jours (jours Présent + En retard / jours enregistrés) */}
              {recordedDaysCount > 0 && (
                <div className="pt-1 border-t border-[#E5DCD0]/40 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Présence sur 30 jours</span>
                    <span className="font-bold text-[#1B4B4A]">
                      {attendedCount} / {recordedDaysCount} jour{recordedDaysCount > 1 ? 's' : ''} ({formattedRate}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#FAF7F2] border border-[#E5DCD0]/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1B4B4A] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(Math.max(attendanceRate, 0), 100)}%` }}
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
