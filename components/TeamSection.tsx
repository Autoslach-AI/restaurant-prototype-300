'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  ListFilter,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Check,
  Settings,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TextRun,
  HeadingLevel,
} from 'docx';
import { Business, Staff, StaffPermissions } from '@/lib/types';

export interface TeamMemberRow {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
  photo_url?: string | null;
  phone: string;
  role: string;
  rawRole: string;
  position: string;
  permissions: string;
  salary: number | string;
  hireDate: string;
  status: string;
  rawStaff: Staff;
}

export interface TeamSectionProps {
  business: Business;
  activeStaff: Staff;
  allTeamRows: TeamMemberRow[];
  setIsInviteModalOpen: (open: boolean) => void;
  setActiveTab: (tab: any) => void;
  getInitials: (name: string) => string;
}

export const TeamSection: React.FC<TeamSectionProps> = ({
  business,
  activeStaff,
  allTeamRows,
  setIsInviteModalOpen,
  setActiveTab,
  getInitials,
}) => {
  const [teamSearch, setTeamSearch] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState<string>('all');
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
  const [teamSortActive, setTeamSortActive] = useState<boolean>(true);
  const [selectedTeamMemberForDetail, setSelectedTeamMemberForDetail] = useState<TeamMemberRow | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  const formatSalary = (salary: number | string): string => {
    if (typeof salary === 'number') {
      return `${salary.toLocaleString('fr-FR')} FCFA`;
    }
    const parsed = Number(salary);
    if (typeof salary === 'string' && salary.trim() !== '' && !isNaN(parsed)) {
      return `${parsed.toLocaleString('fr-FR')} FCFA`;
    }
    return salary ? String(salary) : '—';
  };

  // 1. Export CSV
  const handleExportCsv = () => {
    const escapeCsvField = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csvHeader = ['Employee', 'Téléphone', 'Rôle', 'Position', 'Permissions', 'Hire Date', 'Salaire'].map(escapeCsvField).join(';') + '\n';
    const csvRows = displayTeamRows.map((e) =>
      [e.name, e.phone, e.role, e.position, e.permissions, e.hireDate, formatSalary(e.salary)].map(escapeCsvField).join(';')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "equipe_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Export Excel (.xlsx)
  const handleExportExcel = () => {
    const excelData = displayTeamRows.map((e) => ({
      'Employee': e.name,
      'Téléphone': e.phone,
      'Rôle': e.role,
      'Position': e.position,
      'Permissions': e.permissions,
      'Hire Date': e.hireDate,
      'Salaire': formatSalary(e.salary),
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Équipe');
    XLSX.writeFile(workbook, 'equipe_export.xlsx');
  };

  // 3. Export PDF (.pdf)
  const handleExportPdf = () => {
    const doc = new jsPDF();
    const headers = [['Employee', 'Téléphone', 'Rôle', 'Position', 'Permissions', 'Hire Date', 'Salaire']];
    const data = displayTeamRows.map((e) => [
      e.name,
      e.phone,
      e.role,
      e.position,
      e.permissions,
      e.hireDate,
      formatSalary(e.salary),
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
    });

    doc.save('equipe_export.pdf');
  };

  // 4. Export Word (.docx)
  const handleExportWord = async () => {
    const headers = ['Employee', 'Téléphone', 'Rôle', 'Position', 'Permissions', 'Hire Date', 'Salaire'];
    const columnPercentages = [18, 13, 12, 15, 20, 12, 10];
    const columnWidthsDxa = [1620, 1170, 1080, 1350, 1800, 1080, 900];

    const borderOption = {
      style: BorderStyle.SINGLE,
      size: 1,
      color: "CCCCCC",
    };

    const cellBorders = {
      top: borderOption,
      bottom: borderOption,
      left: borderOption,
      right: borderOption,
    };

    const tableBorders = {
      top: borderOption,
      bottom: borderOption,
      left: borderOption,
      right: borderOption,
      insideHorizontal: borderOption,
      insideVertical: borderOption,
    };

    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(
        (h, index) =>
          new TableCell({
            width: { size: columnPercentages[index], type: WidthType.PERCENTAGE },
            borders: cellBorders,
            shading: { fill: "F1F5F9" },
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true, size: 18 })],
              }),
            ],
          })
      ),
    });

    const dataRows = displayTeamRows.map(
      (e) =>
        new TableRow({
          children: [
            e.name,
            e.phone,
            e.role,
            e.position,
            e.permissions,
            e.hireDate,
            formatSalary(e.salary),
          ].map(
            (val, index) =>
              new TableCell({
                width: { size: columnPercentages[index], type: WidthType.PERCENTAGE },
                borders: cellBorders,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(val ?? ''), size: 18 })],
                  }),
                ],
              })
          ),
        })
    );

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: columnWidthsDxa,
      borders: tableBorders,
      rows: [headerRow, ...dataRows],
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: "Liste de l'équipe",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 200 },
            }),
            table,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "equipe_export.docx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const uniqueTeamRoles = Array.from(new Set(allTeamRows.map((r) => r.role).filter(Boolean)));

  const displayTeamRows = allTeamRows.filter((emp) => {
    if (teamDeptFilter !== 'all' && emp.role !== teamDeptFilter) return false;

    if (teamSearch.trim()) {
      const q = teamSearch.toLowerCase();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.position.toLowerCase().includes(q) ||
        emp.permissions.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center space-x-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un employé, numéro, poste..."
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
            />
          </div>
          {/* Dynamic Role filter */}
          <select
            value={teamDeptFilter}
            onChange={(e) => setTeamDeptFilter(e.target.value)}
            className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-slate-700 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none cursor-pointer shrink-0"
          >
            <option value="all">Tous les rôles</option>
            {uniqueTeamRoles.map((roleTitle) => (
              <option key={roleTitle} value={roleTitle}>
                {roleTitle}
              </option>
            ))}
          </select>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setTeamSortActive(!teamSortActive)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
              teamSortActive
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Trier la liste"
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Sort</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-700 text-white font-bold ml-1">
              1
            </span>
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
              title="Exporter la liste"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in duration-100">
                <button
                  onClick={() => {
                    handleExportCsv();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-medium">CSV</span>
                  <span className="text-[10px] text-slate-400 font-mono">.csv</span>
                </button>
                <button
                  onClick={() => {
                    handleExportExcel();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-medium">Excel</span>
                  <span className="text-[10px] text-emerald-600 font-mono font-medium">.xlsx</span>
                </button>
                <button
                  onClick={() => {
                    handleExportPdf();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-medium">PDF</span>
                  <span className="text-[10px] text-rose-600 font-mono font-medium">.pdf</span>
                </button>
                <button
                  onClick={() => {
                    handleExportWord();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-medium">Word</span>
                  <span className="text-[10px] text-blue-600 font-mono font-medium">.doc</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un membre</span>
          </button>
        </div>
      </div>

      {/* Table Card - Fond Blanc */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 font-medium text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={displayTeamRows.length > 0 && selectedTeamMemberIds.length === displayTeamRows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTeamMemberIds(displayTeamRows.map((r) => r.id));
                      } else {
                        setSelectedTeamMemberIds([]);
                      }
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Avatar</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Employee</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Téléphone</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Rôle</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Position</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Permissions</th>
                <th className="py-3 px-3.5 font-medium text-slate-600 text-right">Salaire</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Hire Date</th>
                <th className="py-3 px-3.5 font-medium text-slate-600">Status</th>
                <th className="py-3 px-3.5 font-medium text-slate-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayTeamRows.map((emp) => {
                const isChecked = selectedTeamMemberIds.includes(emp.id);
                return (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedTeamMemberForDetail(emp)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isChecked ? 'bg-slate-50/90' : ''}`}
                  >
                    <td className="py-3.5 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeamMemberIds([...selectedTeamMemberIds, emp.id]);
                          } else {
                            setSelectedTeamMemberIds(selectedTeamMemberIds.filter((id) => id !== emp.id));
                          }
                        }}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                      />
                    </td>

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

                    <td className="py-3.5 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                      {emp.name}
                    </td>

                    <td
                      className="py-3.5 px-3.5 font-normal text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTeamMemberForDetail(emp);
                      }}
                    >
                      {emp.phone}
                    </td>

                    <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                      {emp.role}
                    </td>

                    <td className="py-3.5 px-3.5 text-slate-700 font-normal whitespace-nowrap">
                      {emp.position}
                    </td>

                    <td className="py-3.5 px-3.5 font-normal text-slate-900 whitespace-nowrap">
                      {emp.permissions}
                    </td>

                    <td className="py-3.5 px-3.5 font-bold text-slate-900 text-right whitespace-nowrap">
                      {activeStaff.role === 'owner'
                        ? typeof emp.salary === 'number'
                          ? `${emp.salary.toLocaleString('fr-FR')} ${business.currency || 'FCFA'}`
                          : emp.salary
                        : '—'}
                    </td>

                    <td className="py-3.5 px-3.5 text-slate-600 font-normal whitespace-nowrap">
                      {emp.hireDate}
                    </td>

                    <td className="py-3.5 px-3.5 whitespace-nowrap">
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
                    </td>

                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap text-slate-300">
                      —
                    </td>
                  </tr>
                );
              })}
              {displayTeamRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                    Aucun membre de l&apos;équipe ne correspond aux critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom bar summary */}
        <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Total : <strong className="font-medium text-slate-700">{displayTeamRows.length}</strong> membre(s)</span>
          {selectedTeamMemberIds.length > 0 && (
            <span className="text-slate-700 font-medium">{selectedTeamMemberIds.length} sélectionné(s)</span>
          )}
        </div>
      </div>

      {/* Slide-over Panel: Détails Membre d'Équipe */}
      <AnimatePresence>
        {selectedTeamMemberForDetail && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Dark Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
              onClick={() => setSelectedTeamMemberForDetail(null)}
            />

            {/* Slide-in Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200/80 flex flex-col h-full overflow-y-auto"
            >
              <div className="p-6 space-y-5">
                {/* En-tête avec bouton Fermer (X) */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                    {(selectedTeamMemberForDetail.photo_url || selectedTeamMemberForDetail.avatar_url || selectedTeamMemberForDetail.rawStaff.photo_url || selectedTeamMemberForDetail.rawStaff.avatar_url) ? (
                      <Image
                        src={selectedTeamMemberForDetail.photo_url || selectedTeamMemberForDetail.avatar_url || selectedTeamMemberForDetail.rawStaff.photo_url || selectedTeamMemberForDetail.rawStaff.avatar_url!}
                        alt={selectedTeamMemberForDetail.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover border border-slate-200/80 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-lg shrink-0">
                        {getInitials(selectedTeamMemberForDetail.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h3 className="font-extrabold text-slate-900 text-lg truncate">
                          {selectedTeamMemberForDetail.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                        {selectedTeamMemberForDetail.role}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTeamMemberForDetail(null)}
                    className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                    title="Fermer le panneau"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mini-statistiques / Infos clés */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Téléphone
                    </span>
                    <span className="text-xs font-bold text-slate-800 font-mono break-all">
                      {selectedTeamMemberForDetail.phone}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Email
                    </span>
                    <span className="text-xs font-bold text-slate-800 break-all">
                      {selectedTeamMemberForDetail.email || selectedTeamMemberForDetail.rawStaff.email || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Salaire
                    </span>
                    <span className="text-xs font-black text-slate-900 tabular-nums">
                      {activeStaff.role === 'owner'
                        ? typeof selectedTeamMemberForDetail.salary === 'number'
                          ? `${selectedTeamMemberForDetail.salary.toLocaleString('fr-FR')} ${business.currency || 'FCFA'}`
                          : selectedTeamMemberForDetail.salary
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Type de compte
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {selectedTeamMemberForDetail.rawRole === 'owner' ? 'Gérant (Owner)' : 'Collaborateur'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Position
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {selectedTeamMemberForDetail.position || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Date d&apos;embauche
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {selectedTeamMemberForDetail.hireDate}
                    </span>
                  </div>
                </div>

                {/* Permissions d'accès */}
                <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Permissions d&apos;accès système
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedTeamMemberForDetail.rawStaff.permissions || {}).map(([key, enabled]) => {
                      const permLabels: Record<string, string> = {
                        orders: 'Commandes',
                        products: 'Produits',
                        customers: 'Clients',
                        agent: 'Agent WA',
                        settings: 'Paramètres',
                        staff: 'Équipe',
                      };
                      return (
                        <div
                          key={key}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
                            enabled
                              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                              : 'bg-white border-slate-200/60 text-slate-400 opacity-60'
                          }`}
                        >
                          <span>{permLabels[key] || key}</span>
                          {enabled ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-slate-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bouton d'action vers Paramètres */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setSelectedTeamMemberForDetail(null);
                      setActiveTab('settings');
                    }}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Gérer ce membre dans les Paramètres</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
