'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Search,
  CheckCircle2,
  X,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Business, Staff, AttendanceRecord } from '@/lib/types';
import { fetchAttendanceRecords, upsertAttendanceRecord } from '@/lib/supabase';
import { TeamMemberRow } from './TeamSection';

export interface AttendanceCounts {
  all: number;
  present: number;
  absent: number;
  late: number;
  unmarked: number;
}

export interface AttendanceSectionProps {
  business: Business;
  canMarkAttendance: boolean;
  allTeamRows: TeamMemberRow[];
  todayAttendanceMap: Record<string, AttendanceRecord>;
  setTodayAttendanceMap: React.Dispatch<React.SetStateAction<Record<string, AttendanceRecord>>>;
  todayAttendanceCounts: AttendanceCounts;
  getInitials: (name: string) => string;
  todayStr: string;
}

export const AttendanceSection: React.FC<AttendanceSectionProps> = ({
  business,
  canMarkAttendance,
  allTeamRows,
  todayAttendanceMap,
  setTodayAttendanceMap,
  todayAttendanceCounts,
  getInitials,
  todayStr,
}) => {
  const [teamSearch, setTeamSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all');
  const [selectedAttendanceMember, setSelectedAttendanceMember] = useState<TeamMemberRow | null>(null);
  const [attendanceHistoryFilter, setAttendanceHistoryFilter] = useState<string>('all');
  const [attendance30DaysRecords, setAttendance30DaysRecords] = useState<AttendanceRecord[]>([]);

  const [attendanceReasonModal, setAttendanceReasonModal] = useState<{
    isOpen: boolean;
    staff: Staff | null;
    status: 'absent' | 'late';
    reason: string;
  }>({
    isOpen: false,
    staff: null,
    status: 'absent',
    reason: '',
  });
  const [attendanceReasonSaving, setAttendanceReasonSaving] = useState(false);

  // Load 30-day attendance history for selected member
  useEffect(() => {
    let isMounted = true;
    async function load30DaysHistory() {
      if (!business?.id || !selectedAttendanceMember) return;
      const endDateStr = todayStr;
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - 29);
      const startDateStr = startDateObj.toISOString().split('T')[0];

      const records = await fetchAttendanceRecords(business.id, startDateStr, endDateStr);
      if (!isMounted) return;
      setAttendance30DaysRecords(records);
    }
    load30DaysHistory();
    return () => {
      isMounted = false;
    };
  }, [business?.id, selectedAttendanceMember, todayStr]);

  const last30DaysList = useMemo(() => {
    if (!selectedAttendanceMember) return [];
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const rec30 = attendance30DaysRecords.find(
        (r) => r.staff_id === selectedAttendanceMember.id && r.date === dateStr
      );
      const recToday = dateStr === todayStr ? todayAttendanceMap[selectedAttendanceMember.id] : null;
      const effectiveRecord = recToday || rec30;

      days.push({
        dateStr,
        dateObj: d,
        status: (effectiveRecord?.status as 'present' | 'absent' | 'late' | 'unmarked') || 'unmarked',
        reason: effectiveRecord?.reason || null,
      });
    }
    return days;
  }, [selectedAttendanceMember, attendance30DaysRecords, todayAttendanceMap, todayStr]);

  const historySummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let unmarked = 0;

    last30DaysList.forEach((item) => {
      if (item.status === 'present') present++;
      else if (item.status === 'absent') absent++;
      else if (item.status === 'late') late++;
      else unmarked++;
    });

    return { present, absent, late, unmarked };
  }, [last30DaysList]);

  const filtered30DaysList = useMemo(() => {
    if (attendanceHistoryFilter === 'all') return last30DaysList;
    return last30DaysList.filter((item) => item.status === attendanceHistoryFilter);
  }, [last30DaysList, attendanceHistoryFilter]);

  const formatDateFr = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      const formatted = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return dateStr;
    }
  };

  const handleMarkAttendanceStatus = async (
    staffId: string,
    status: 'present' | 'absent' | 'late',
    reason?: string | null
  ) => {
    if (!canMarkAttendance) return;
    const trimmedReason = reason?.trim() || null;

    const optimisticRecord: AttendanceRecord = {
      id: todayAttendanceMap[staffId]?.id || `temp_${staffId}_${todayStr}`,
      business_id: business.id,
      staff_id: staffId,
      date: todayStr,
      status,
      reason: trimmedReason,
      created_at: new Date().toISOString(),
    };
    setTodayAttendanceMap((prev) => ({ ...prev, [staffId]: optimisticRecord }));

    const saved = await upsertAttendanceRecord({
      business_id: business.id,
      staff_id: staffId,
      date: todayStr,
      status,
      reason: trimmedReason,
    });

    if (saved) {
      setTodayAttendanceMap((prev) => ({ ...prev, [staffId]: saved }));
    }
  };

  const handleOpenAttendanceReasonModal = (staff: Staff, status: 'absent' | 'late') => {
    if (!canMarkAttendance) return;
    const existing = todayAttendanceMap[staff.id];
    setAttendanceReasonModal({
      isOpen: true,
      staff,
      status,
      reason: existing?.reason || '',
    });
  };

  const handleSaveAttendanceReasonModal = async () => {
    if (!attendanceReasonModal.staff) return;
    await handleMarkAttendanceStatus(
      attendanceReasonModal.staff.id,
      attendanceReasonModal.status,
      attendanceReasonModal.reason
    );
    setAttendanceReasonModal({ isOpen: false, staff: null, status: 'absent', reason: '' });
  };

  const displayAttendanceRows = allTeamRows.filter((emp) => {
    const attStatus = todayAttendanceMap[emp.id]?.status;
    if (attendanceFilter === 'present' && attStatus !== 'present') return false;
    if (attendanceFilter === 'absent' && attStatus !== 'absent') return false;
    if (attendanceFilter === 'late' && attStatus !== 'late') return false;
    if (attendanceFilter === 'unmarked' && attStatus) return false;

    if (teamSearch.trim()) {
      const q = teamSearch.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Title & Date Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 className="text-base font-black text-slate-900">
              Pointage & Suivi de Présence du Jour
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enregistrement et suivi quotidien du pointage des membres de l&apos;équipe.
            {!canMarkAttendance && (
              <span className="text-amber-700 font-bold ml-1">
                (Mode lecture seule - réservé aux gérants et responsables)
              </span>
            )}
          </p>
        </div>

        {/* Controls: Dropdown Filter + Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Dropdown Menu Statut avec compteurs */}
          <div className="relative">
            <select
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-2xs"
            >
              <option value="all">Statut : Tous ({todayAttendanceCounts.all})</option>
              <option value="present">Statut : Présents ({todayAttendanceCounts.present})</option>
              <option value="absent">Statut : Absents ({todayAttendanceCounts.absent})</option>
              <option value="late">Statut : Retards ({todayAttendanceCounts.late})</option>
              <option value="unmarked">Statut : Non pointés ({todayAttendanceCounts.unmarked})</option>
            </select>
          </div>

          {/* Search Bar for Attendance Page */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, rôle..."
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* Attendance Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 font-medium text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-3.5 font-medium text-slate-600">Avatar</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Membre</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Email</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Téléphone</th>
                <th className="py-3 px-3.5 font-bold text-slate-900 bg-emerald-50/50">Pointage du Jour</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Rôle</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayAttendanceRows.map((emp) => {
                const att = todayAttendanceMap[emp.id];
                const status = att?.status;
                const reason = att?.reason;

                return (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedAttendanceMember(emp)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-3.5">
                      {(() => {
                        const photoSrc = emp.photo_url || emp.avatar_url;
                        return photoSrc ? (
                          <Image
                            src={photoSrc}
                            alt={emp.name}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200/80 shadow-2xs"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                            {getInitials(emp.name)}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-3.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {emp.name}
                    </td>

                    <td className="py-3.5 px-3.5 font-normal text-slate-600 whitespace-nowrap">
                      {emp.email}
                    </td>

                    <td className="py-3.5 px-3.5 font-normal text-slate-700 whitespace-nowrap">
                      {emp.phone}
                    </td>

                    {/* Pointage Cell */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap bg-emerald-50/10" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center space-x-2">
                        {/* Integrated Status Dropdown Select */}
                        {canMarkAttendance ? (
                          <select
                            value={status || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'present') {
                                handleMarkAttendanceStatus(emp.id, 'present');
                              } else if (val === 'late') {
                                handleOpenAttendanceReasonModal(emp.rawStaff, 'late');
                              } else if (val === 'absent') {
                                handleOpenAttendanceReasonModal(emp.rawStaff, 'absent');
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border focus:outline-none transition-all cursor-pointer shadow-2xs ${
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
                              ― Choisir statut (Non pointé)
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
                        ) : (
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs ${
                              status === 'present'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : status === 'late'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : status === 'absent'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {status === 'present' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            {status === 'late' && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            {status === 'absent' && <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
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
                        )}

                        {/* Justification Pill Badge for Late or Absent */}
                        {(status === 'late' || status === 'absent') && (
                          reason && reason.trim() ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs cursor-help"
                              title={`Motif : ${reason}`}
                            >
                              <span>Justifié</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                              <span>Non justifié</span>
                            </span>
                          )
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                      {emp.role}
                    </td>

                    <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                      {emp.position}
                    </td>
                  </tr>
                );
              })}

              {displayAttendanceRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-medium">
                    Aucun membre trouvé dans cette catégorie de pointage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Bar Summary */}
        <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Affichés : <strong className="font-bold text-slate-700">{displayAttendanceRows.length}</strong> membre(s) sur {allTeamRows.length}</span>
          <span className="text-slate-500">Pointage enregistré sur Supabase (table <code className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1 py-0.5 rounded">attendance</code>)</span>
        </div>
      </div>

      {/* Slide-over Panel: Historique de Pointage Membre (30 derniers jours) */}
      <AnimatePresence>
        {selectedAttendanceMember && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Dark Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
              onClick={() => setSelectedAttendanceMember(null)}
            />

            {/* Slide-in Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200/80 flex flex-col h-full overflow-y-auto"
            >
              <div className="p-6 space-y-5 flex-1">
                {/* En-tête avec Avatar, Nom, Rôle et Bouton Fermer */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                    {(selectedAttendanceMember.photo_url || selectedAttendanceMember.avatar_url || selectedAttendanceMember.rawStaff?.photo_url || selectedAttendanceMember.rawStaff?.avatar_url) ? (
                      <Image
                        src={selectedAttendanceMember.photo_url || selectedAttendanceMember.avatar_url || selectedAttendanceMember.rawStaff?.photo_url || selectedAttendanceMember.rawStaff?.avatar_url!}
                        alt={selectedAttendanceMember.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200/80 shrink-0 shadow-2xs"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-lg shrink-0 shadow-2xs">
                        {getInitials(selectedAttendanceMember.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-slate-900 text-lg truncate">
                        {selectedAttendanceMember.name}
                      </h3>
                      <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                        {selectedAttendanceMember.role} • <span className="text-slate-500 font-normal">{selectedAttendanceMember.email}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAttendanceMember(null)}
                    className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                    title="Fermer le panneau"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mini-résumé factuel sur 30 jours */}
                <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Récapitulatif (30 derniers jours)
                    </span>
                    <span className="text-xs font-bold text-slate-600">30 jours glissants</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-center shadow-2xs">
                      <span className="text-emerald-800 text-base font-black block">{historySummary.present}</span>
                      <span className="text-[10px] font-bold text-emerald-700">Présent(s)</span>
                    </div>
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-center shadow-2xs">
                      <span className="text-amber-800 text-base font-black block">{historySummary.late}</span>
                      <span className="text-[10px] font-bold text-amber-700">Retard(s)</span>
                    </div>
                    <div className="p-2.5 bg-rose-50/80 border border-rose-200/80 rounded-xl text-center shadow-2xs">
                      <span className="text-rose-800 text-base font-black block">{historySummary.absent}</span>
                      <span className="text-[10px] font-bold text-rose-700">Absent(s)</span>
                    </div>
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-center shadow-2xs">
                      <span className="text-slate-700 text-base font-black block">{historySummary.unmarked}</span>
                      <span className="text-[10px] font-bold text-slate-600">Non pointé</span>
                    </div>
                  </div>
                </div>

                {/* Section Historique + Filtre interne */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                        Historique de présence — 30 derniers jours
                      </h4>
                    </div>

                    {/* Filtre de statut interne */}
                    <select
                      value={attendanceHistoryFilter}
                      onChange={(e) => setAttendanceHistoryFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                    >
                      <option value="all">Tous les statuts ({last30DaysList.length})</option>
                      <option value="present">Présents ({historySummary.present})</option>
                      <option value="late">Retards ({historySummary.late})</option>
                      <option value="absent">Absents ({historySummary.absent})</option>
                      <option value="unmarked">Non pointés ({historySummary.unmarked})</option>
                    </select>
                  </div>

                  {/* Liste chronologique */}
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {filtered30DaysList.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs">
                        Aucun jour ne correspond au filtre sélectionné.
                      </div>
                    ) : (
                      filtered30DaysList.map((item) => {
                        const isToday = item.dateStr === todayStr;
                        return (
                          <div
                            key={item.dateStr}
                            className={`p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                              isToday
                                ? 'bg-emerald-50/40 border-emerald-200 shadow-2xs'
                                : 'bg-white border-slate-200/70 hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-slate-900">
                                  {formatDateFr(item.dateStr)}
                                </span>
                                {isToday && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                    Aujourd&apos;hui
                                  </span>
                                )}
                              </div>

                              {/* Badge Statut */}
                              {item.status === 'present' && (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Présent</span>
                                </span>
                              )}
                              {item.status === 'late' && (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Retard</span>
                                </span>
                              )}
                              {item.status === 'absent' && (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/80">
                                  <X className="w-3 h-3 text-rose-600" />
                                  <span>Absent</span>
                                </span>
                              )}
                              {item.status === 'unmarked' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200/80">
                                  Non pointé
                                </span>
                              )}
                            </div>

                            {/* Motif si disponible */}
                            {item.reason && item.reason.trim() !== '' && (
                              <div className="mt-0.5 p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px] text-slate-700 italic">
                                <strong className="font-semibold text-slate-900 not-italic">Motif : </strong>
                                &ldquo;{item.reason}&rdquo;
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Footer / Readonly Notice */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 text-[11px] text-slate-500 text-center font-medium">
                🔒 Historique en lecture seule. Pour modifier le pointage d&apos;aujourd&apos;hui, utilisez le tableau principal.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Attendance Reason Modal (Late / Absent) */}
      {attendanceReasonModal.isOpen && attendanceReasonModal.staff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center space-x-2.5">
              <div
                className={`p-2.5 rounded-2xl ${
                  attendanceReasonModal.status === 'late'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                <Clock className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Pointer : {attendanceReasonModal.status === 'late' ? 'En retard' : 'Absent'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {attendanceReasonModal.staff.name || attendanceReasonModal.staff.email}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Motif / Justification <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <textarea
                value={attendanceReasonModal.reason}
                onChange={(e) =>
                  setAttendanceReasonModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder={
                  attendanceReasonModal.status === 'late'
                    ? 'Ex: Embouteillages, problème de transport, retard de 15 minutes...'
                    : 'Ex: Congé maladie, empêchement familial, absence autorisée...'
                }
                rows={3}
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-slate-50 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setAttendanceReasonModal({ isOpen: false, staff: null, status: 'absent', reason: '' })
                }
                disabled={attendanceReasonSaving}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={attendanceReasonSaving}
                onClick={async () => {
                  setAttendanceReasonSaving(true);
                  try {
                    await handleSaveAttendanceReasonModal();
                  } finally {
                    setAttendanceReasonSaving(false);
                  }
                }}
                className={`px-4 py-2 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 ${
                  attendanceReasonModal.status === 'late'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {attendanceReasonSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
