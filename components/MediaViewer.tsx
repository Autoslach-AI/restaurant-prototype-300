'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  File,
  Video,
  Music,
  ImageIcon,
} from 'lucide-react';
import { getDownloadUrl } from '@/lib/supabase';

export interface MediaViewerItem {
  url: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'other' | string | null;
  name?: string | null;
  size?: number | null;
}

interface MediaViewerProps {
  isOpen?: boolean;
  onClose: () => void;
  media?: MediaViewerItem | null;
  item?: MediaViewerItem | null;
}

export function MediaViewer({ isOpen, onClose, media, item }: MediaViewerProps) {
  const currentMedia = item !== undefined ? item : media;
  const isCurrentlyOpen = isOpen !== undefined ? isOpen : Boolean(currentMedia);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Free resizing state for the modal card
  const [modalSize, setModalSize] = useState<{ width: number; height: number } | null>(null);
  const resizeRef = useRef<{
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const modalCardRef = useRef<HTMLDivElement | null>(null);

  // Reset modal size and zoom when opening or switching media
  useEffect(() => {
    if (isCurrentlyOpen) {
      setModalSize(null);
      setZoomLevel(1);
    }
  }, [isCurrentlyOpen, currentMedia?.url]);

  const handleResizeStart = useCallback(
    (
      corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
      e: React.MouseEvent
    ) => {
      e.preventDefault();
      e.stopPropagation();

      const modalEl = modalCardRef.current;
      if (!modalEl) return;

      const rect = modalEl.getBoundingClientRect();
      resizeRef.current = {
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeRef.current) return;
        const { corner, startX, startY, startWidth, startHeight } = resizeRef.current;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        // Since the modal is kept centered via flex items-center justify-center in the overlay,
        // moving a corner by delta changes the width/height proportionally from center (2 * delta).
        if (corner === 'bottom-right') {
          newWidth = startWidth + deltaX * 2;
          newHeight = startHeight + deltaY * 2;
        } else if (corner === 'bottom-left') {
          newWidth = startWidth - deltaX * 2;
          newHeight = startHeight + deltaY * 2;
        } else if (corner === 'top-right') {
          newWidth = startWidth + deltaX * 2;
          newHeight = startHeight - deltaY * 2;
        } else if (corner === 'top-left') {
          newWidth = startWidth - deltaX * 2;
          newHeight = startHeight - deltaY * 2;
        }

        const minWidth = 320;
        const minHeight = 320;
        const maxWidth = Math.max(window.innerWidth - 32, minWidth);
        const maxHeight = Math.max(window.innerHeight - 32, minHeight);

        setModalSize({
          width: Math.min(Math.max(newWidth, minWidth), maxWidth),
          height: Math.min(Math.max(newHeight, minHeight), maxHeight),
        });
      };

      const handleMouseUp = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    []
  );

  useEffect(() => {
    if (isCurrentlyOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setZoomLevel(1);
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isCurrentlyOpen, onClose]);

  if (!isCurrentlyOpen || !currentMedia) return null;

  const { url, mediaType, name, size } = currentMedia;

  const fileName = name || 'Fichier';
  const lowerFileName = fileName.toLowerCase();
  const normalizedType = (mediaType || '').toLowerCase();

  // Robust format detection
  const isPdf =
    lowerFileName.endsWith('.pdf') ||
    url.toLowerCase().includes('.pdf') ||
    normalizedType === 'pdf' ||
    normalizedType === 'application/pdf' ||
    (normalizedType === 'document' && (lowerFileName.endsWith('.pdf') || url.startsWith('blob:')));

  const isVideo =
    (normalizedType === 'video' ||
      normalizedType.startsWith('video/') ||
      lowerFileName.match(/\.(mp4|webm|mov|ogg|m4v|3gp|avi|mkv)$/i) ||
      url.match(/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i)) &&
    !isPdf;

  const isAudio =
    (normalizedType === 'audio' ||
      normalizedType.startsWith('audio/') ||
      lowerFileName.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) &&
    !isPdf &&
    !isVideo;

  const isImage =
    (normalizedType === 'image' ||
      normalizedType.startsWith('image/') ||
      lowerFileName.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|heic|heif)$/i) ||
      url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) &&
    !isPdf &&
    !isVideo &&
    !isAudio;

  const isOfficeDoc =
    (lowerFileName.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i) ||
      url.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i)) &&
    !isPdf &&
    !isVideo &&
    !isAudio &&
    !isImage;

  const formattedSize = size
    ? size > 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)} Mo`
      : `${Math.max(1, Math.round(size / 1024))} Ko`
    : null;

  const docViewerRef = useRef<HTMLDivElement | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(false);
    };
    const handleBlur = () => setIsCtrlPressed(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleDocWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      if (e.cancelable) e.preventDefault();
      if (e.deltaY < 0) {
        setZoomLevel((prev) => Math.min(Number((prev + 0.1).toFixed(2)), 3));
      } else if (e.deltaY > 0) {
        setZoomLevel((prev) => Math.max(Number((prev - 0.1).toFixed(2)), 0.5));
      }
    }
  };

  useEffect(() => {
    const el = docViewerRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          setZoomLevel((prev) => Math.min(Number((prev + 0.1).toFixed(2)), 3));
        } else if (e.deltaY > 0) {
          setZoomLevel((prev) => Math.max(Number((prev - 0.1).toFixed(2)), 0.5));
        }
      }
    };

    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onNativeWheel);
    };
  }, [isPdf, isOfficeDoc]);

  const handleDocZoomIn = () => setZoomLevel((prev) => Math.min(Number((prev + 0.1).toFixed(2)), 3));
  const handleDocZoomOut = () => setZoomLevel((prev) => Math.max(Number((prev - 0.1).toFixed(2)), 0.5));
  const handleDocResetZoom = () => setZoomLevel(1);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalCardRef}
        style={
          modalSize
            ? {
                width: `${modalSize.width}px`,
                height: `${modalSize.height}px`,
                maxWidth: 'none',
                maxHeight: 'none',
              }
            : undefined
        }
        className={`relative w-full ${
          !modalSize ? 'max-w-4xl max-h-[92vh]' : ''
        } flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-white`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Resize Handles (4 corners) */}
        {/* Top-Left */}
        <div
          onMouseDown={(e) => handleResizeStart('top-left', e)}
          className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50 group flex items-start justify-start p-0.5"
          title="Redimensionner"
        >
          <div className="w-2 h-2 border-t-2 border-l-2 border-slate-500/40 group-hover:border-teal-400 transition-colors rounded-tl-sm" />
        </div>
        {/* Top-Right */}
        <div
          onMouseDown={(e) => handleResizeStart('top-right', e)}
          className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-50 group flex items-start justify-end p-0.5"
          title="Redimensionner"
        >
          <div className="w-2 h-2 border-t-2 border-r-2 border-slate-500/40 group-hover:border-teal-400 transition-colors rounded-tr-sm" />
        </div>
        {/* Bottom-Left */}
        <div
          onMouseDown={(e) => handleResizeStart('bottom-left', e)}
          className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-50 group flex items-end justify-start p-0.5"
          title="Redimensionner"
        >
          <div className="w-2 h-2 border-b-2 border-l-2 border-slate-500/40 group-hover:border-teal-400 transition-colors rounded-bl-sm" />
        </div>
        {/* Bottom-Right */}
        <div
          onMouseDown={(e) => handleResizeStart('bottom-right', e)}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 group flex items-end justify-end p-0.5"
          title="Redimensionner"
        >
          <div className="w-2 h-2 border-b-2 border-r-2 border-slate-500/40 group-hover:border-teal-400 transition-colors rounded-br-sm" />
        </div>

        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300 shrink-0">
              {isImage ? (
                <ImageIcon className="w-4 h-4 text-emerald-400" />
              ) : isVideo ? (
                <Video className="w-4 h-4 text-amber-400" />
              ) : isAudio ? (
                <Music className="w-4 h-4 text-sky-400" />
              ) : (
                <FileText className="w-4 h-4 text-teal-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-100 truncate">{fileName}</h3>
              {formattedSize && (
                <p className="text-[11px] text-slate-400 font-medium">{formattedSize}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {isImage && (
              <div className="hidden sm:flex items-center space-x-1 bg-slate-800/80 rounded-xl p-0.5 border border-slate-700 mr-2">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Dézoomer"
                  type="button"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-1 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Réinitialiser zoom"
                  type="button"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Zoomer"
                  type="button"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                {zoomLevel !== 1 && (
                  <button
                    onClick={handleResetZoom}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Réinitialiser"
                    type="button"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {url && (
              <a
                href={getDownloadUrl(url, fileName)}
                target="_blank"
                rel="noopener noreferrer"
                download={fileName}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                title="Télécharger / Ouvrir dans un nouvel onglet"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Télécharger</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
              title="Fermer (Échap)"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview Area */}
        <div className={`flex-1 min-h-[260px] ${!modalSize ? 'max-h-[78vh]' : ''} overflow-auto ${(isPdf || isOfficeDoc) && zoomLevel > 1 ? 'flex items-start justify-start' : 'flex items-center justify-center'} p-3 sm:p-6 bg-slate-950/60 select-none`}>
          {/* 1. PDF Document Viewer (Inline) */}
          {isPdf ? (
            <div
              ref={docViewerRef}
              onWheel={handleDocWheel}
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
              className={`w-full ${!modalSize ? 'h-[74vh]' : 'h-full min-h-[260px]'} flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl shrink-0`}
            >
              <object
                data={url}
                type="application/pdf"
                className={`w-full h-full rounded-xl bg-white ${isCtrlPressed ? 'pointer-events-none' : ''}`}
              >
                <iframe
                  src={url}
                  className={`w-full h-full border-none bg-white ${isCtrlPressed ? 'pointer-events-none' : ''}`}
                  title={fileName}
                >
                  <div className="p-6 text-center text-slate-300 flex flex-col items-center justify-center h-full space-y-3">
                    <FileText className="w-12 h-12 text-teal-400" />
                    <p className="text-sm font-bold text-slate-100">{fileName}</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      La prévisualisation intégrée dépend du navigateur. Vous pouvez ouvrir ou télécharger le PDF directement.
                    </p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#1B4B4A] hover:bg-[#153B3A] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Ouvrir / Télécharger le PDF</span>
                    </a>
                  </div>
                </iframe>
              </object>
            </div>
          ) : isOfficeDoc ? (
            /* Office Documents Viewer (Word, Excel, PowerPoint) via Office Online */
            <div
              ref={docViewerRef}
              onWheel={handleDocWheel}
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
              className={`w-full ${!modalSize ? 'h-[74vh]' : 'h-full min-h-[260px]'} flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl shrink-0`}
            >
              <iframe
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                className={`w-full h-full border-none bg-white rounded-xl ${isCtrlPressed ? 'pointer-events-none' : ''}`}
                title={fileName}
              />
            </div>
          ) : isVideo ? (
            /* 2. Native Video Player (Supports both local blob URLs & remote storage URLs) */
            <div className="w-full max-w-3xl flex flex-col items-center justify-center">
              <video
                key={url}
                src={url}
                controls
                playsInline
                preload="auto"
                className="max-h-[70vh] max-w-full rounded-xl shadow-2xl border border-slate-800 bg-black"
              >
                Votre navigateur ne prend pas en charge la lecture de cette vidéo.
              </video>
            </div>
          ) : isAudio ? (
            /* 3. Audio Player Card */
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                <Music className="w-8 h-8" />
              </div>
              <div className="text-center w-full">
                <p className="text-sm font-bold text-slate-100 truncate">{fileName}</p>
                {formattedSize && (
                  <p className="text-xs text-slate-400 mt-0.5">{formattedSize}</p>
                )}
              </div>
              <audio key={url} src={url} controls preload="auto" className="w-full mt-2" />
            </div>
          ) : isImage ? (
            /* 4. Image Viewer */
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={url}
                alt={fileName}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl origin-center"
              />
            </div>
          ) : (
            /* 5. Generic Document / Fallback Card */
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                <File className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100 max-w-xs truncate mx-auto">
                  {fileName}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {formattedSize ? `Taille : ${formattedSize}` : 'Document'}
                </p>
                <p className="text-xs text-slate-400 mt-2 max-w-xs">
                  Ce document ne peut pas être prévisualisé directement dans le navigateur. Vous pouvez le télécharger ou l&apos;ouvrir avec une application dédiée.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2 w-full">
                <a
                  href={getDownloadUrl(url, fileName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={fileName}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1B4B4A] hover:bg-[#153B3A] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le fichier</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Document Zoom Controls (PDF & Office Online) */}
        {(isPdf || isOfficeDoc) && (
          <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/80 shadow-xl select-none">
            <button
              type="button"
              onClick={handleDocZoomOut}
              disabled={zoomLevel <= 0.5}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer"
              title="Dézoomer (-10%)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-slate-200 tabular-nums min-w-[42px] text-center px-1">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleDocZoomIn}
              disabled={zoomLevel >= 3}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer"
              title="Zoomer (+10%)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDocResetZoom}
              disabled={zoomLevel === 1}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-colors cursor-pointer ml-0.5 border-l border-slate-700/60 pl-1.5"
              title="Réinitialiser le zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
