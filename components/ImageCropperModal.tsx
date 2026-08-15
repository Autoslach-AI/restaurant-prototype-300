'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Loader2, Crop, Move } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  title?: string;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => Promise<void> | void;
  isSaving?: boolean;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  title = 'Recadrer la photo',
  onCancel,
  onConfirm,
  isSaving = false,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState<number>(220); // Dynamic square crop box size in px
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; initialSize: number }>({
    x: 0,
    y: 0,
    initialSize: 220,
  });

  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const MIN_CROP_SIZE = 100;
  const MAX_CROP_SIZE = 280;

  // Reset states when opening a new image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCropSize(220);
      setIsDragging(false);
      setIsResizing(false);
    }
  }, [isOpen, imageSrc]);

  // Handle image load to get original dimensions
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setNaturalDimensions({ width: naturalWidth, height: naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Image Dragging handlers (Mouse + Touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isResizing) {
      handleResizeMove(e.clientX, e.clientY);
      return;
    }
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeCorner(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isResizing) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isResizing && e.touches.length === 1) {
      const touch = e.touches[0];
      handleResizeMove(touch.clientX, touch.clientY);
      return;
    }
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeCorner(null);
  };

  // Corner Resize Handlers
  const startResize = (corner: 'nw' | 'ne' | 'se' | 'sw', clientX: number, clientY: number) => {
    setIsResizing(true);
    setResizeCorner(corner);
    setResizeStart({
      x: clientX,
      y: clientY,
      initialSize: cropSize,
    });
  };

  const handleResizeMove = (clientX: number, clientY: number) => {
    if (!isResizing || !resizeCorner) return;

    const deltaX = clientX - resizeStart.x;
    const deltaY = clientY - resizeStart.y;

    let delta = 0;
    // Symmetrical 1:1 proportional scaling based on corner direction
    if (resizeCorner === 'se') {
      delta = (deltaX + deltaY) / 2 * 2;
    } else if (resizeCorner === 'nw') {
      delta = (-deltaX - deltaY) / 2 * 2;
    } else if (resizeCorner === 'ne') {
      delta = (deltaX - deltaY) / 2 * 2;
    } else if (resizeCorner === 'sw') {
      delta = (-deltaX + deltaY) / 2 * 2;
    }

    const newSize = Math.min(
      MAX_CROP_SIZE,
      Math.max(MIN_CROP_SIZE, Math.round(resizeStart.initialSize + delta))
    );
    setCropSize(newSize);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(Math.max(1, +(prev + delta).toFixed(2)), 3));
  };

  // Reset zoom, pan & crop size
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setCropSize(220);
  };

  // Export cropped area to a square high-res Blob
  const handleValidateCrop = useCallback(async () => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const CROP_BOX_SIZE = cropSize; // Dynamic size of crop box on screen

    const canvas = document.createElement('canvas');
    const OUTPUT_SIZE = 512; // Export high-resolution avatar (512x512)
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Displayed dimensions of the image inside the crop window
    const imgRect = img.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Center coordinates relative to image
    const cropCenterX = containerRect.left + containerRect.width / 2;
    const cropCenterY = containerRect.top + containerRect.height / 2;

    const imgLeft = imgRect.left;
    const imgTop = imgRect.top;

    // Relative crop window origin on the displayed image
    const relativeCropX = cropCenterX - CROP_BOX_SIZE / 2 - imgLeft;
    const relativeCropY = cropCenterY - CROP_BOX_SIZE / 2 - imgTop;

    // Scale factors between natural size and rendered size
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    const sourceX = Math.max(0, relativeCropX * scaleX);
    const sourceY = Math.max(0, relativeCropY * scaleY);
    const sourceWidth = Math.min(img.naturalWidth - sourceX, CROP_BOX_SIZE * scaleX);
    const sourceHeight = Math.min(img.naturalHeight - sourceY, CROP_BOX_SIZE * scaleY);

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onConfirm(blob);
        }
      },
      'image/jpeg',
      0.92
    );
  }, [cropSize, onConfirm]);

  if (!isOpen || !imageSrc) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
          onClick={!isSaving ? onCancel : undefined}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 max-w-md w-full flex flex-col items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-[#FAF7F2] text-[#1B4B4A] border border-[#1B4B4A]/10">
                <Crop className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
                <span className="text-[10px] text-slate-500 font-medium">Zone carrée : {cropSize} × {cropSize}px</span>
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={onCancel}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Crop Viewport */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            className="relative w-[280px] h-[280px] sm:w-[300px] sm:h-[300px] mt-4 rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center select-none cursor-grab active:cursor-grabbing border border-slate-200"
          >
            {/* Image Layer */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Source de cadrage"
              onLoad={onImageLoad}
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging || isResizing ? 'none' : 'transform 0.05s ease-out',
                maxWidth: 'none',
              }}
              className="max-h-full w-auto object-contain pointer-events-none select-none"
            />

            {/* Square Vignette Mask & Overlay Grid with Move Handle & Resizable Corners */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Dynamic Square Box */}
              <div
                style={{ width: `${cropSize}px`, height: `${cropSize}px` }}
                className="rounded-lg border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.70)] relative flex items-center justify-center transition-all duration-75"
              >
                {/* 1/3 Alignment Grid lines */}
                <div className="absolute top-1/3 left-0 right-0 h-[1px] bg-white/25" />
                <div className="absolute top-2/3 left-0 right-0 h-[1px] bg-white/25" />
                <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-white/25" />
                <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-white/25" />

                {/* 4 Interactive Corner Resize Handles */}
                {/* Top-Left (NW) */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startResize('nw', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startResize('nw', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  className="absolute -top-2.5 -left-2.5 w-6 h-6 flex items-start justify-start cursor-nwse-resize pointer-events-auto group z-20"
                  title="Redimensionner depuis le coin haut-gauche"
                >
                  <div className="w-3.5 h-3.5 border-t-3 border-l-3 border-white group-hover:border-emerald-400 group-hover:scale-110 transition-transform bg-white/20 rounded-tl-xs shadow-xs" />
                </div>

                {/* Top-Right (NE) */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startResize('ne', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startResize('ne', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  className="absolute -top-2.5 -right-2.5 w-6 h-6 flex items-start justify-end cursor-nesw-resize pointer-events-auto group z-20"
                  title="Redimensionner depuis le coin haut-droit"
                >
                  <div className="w-3.5 h-3.5 border-t-3 border-r-3 border-white group-hover:border-emerald-400 group-hover:scale-110 transition-transform bg-white/20 rounded-tr-xs shadow-xs" />
                </div>

                {/* Bottom-Left (SW) */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startResize('sw', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startResize('sw', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  className="absolute -bottom-2.5 -left-2.5 w-6 h-6 flex items-end justify-start cursor-nesw-resize pointer-events-auto group z-20"
                  title="Redimensionner depuis le coin bas-gauche"
                >
                  <div className="w-3.5 h-3.5 border-b-3 border-l-3 border-white group-hover:border-emerald-400 group-hover:scale-110 transition-transform bg-white/20 rounded-bl-xs shadow-xs" />
                </div>

                {/* Bottom-Right (SE) */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    startResize('se', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length === 1) startResize('se', e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  className="absolute -bottom-2.5 -right-2.5 w-6 h-6 flex items-end justify-end cursor-nwse-resize pointer-events-auto group z-20"
                  title="Redimensionner depuis le coin bas-droit"
                >
                  <div className="w-3.5 h-3.5 border-b-3 border-r-3 border-white group-hover:border-emerald-400 group-hover:scale-110 transition-transform bg-white/20 rounded-br-xs shadow-xs" />
                </div>

                {/* Center Move Handle badge (fades subtly during active drag or resize) */}
                <div
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs border border-white/40 text-white transition-opacity duration-150 ${
                    isDragging || isResizing ? 'opacity-20' : 'opacity-90'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold tracking-wide">Déplacer</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-2 text-center">
            Glissez les 4 coins pour redimensionner le carré • Déplacez et zoomez l&apos;image
          </p>

          {/* Zoom Controls & Slider */}
          <div className="w-full mt-4 p-3 bg-[#FAF7F2] rounded-2xl border border-slate-200/80 flex items-center space-x-3">
            <button
              type="button"
              disabled={zoom <= 1 || isSaving}
              onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.2).toFixed(2)))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 transition-all cursor-pointer"
              title="Dézoomer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              disabled={isSaving}
              className="flex-1 accent-[#1B4B4A] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />

            <button
              type="button"
              disabled={zoom >= 3 || isSaving}
              onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.2).toFixed(2)))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 transition-all cursor-pointer"
              title="Zoomer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="border-l border-slate-300 h-4 mx-1" />

            <button
              type="button"
              disabled={isSaving}
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-all cursor-pointer"
              title="Réinitialiser le cadrage"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Actions Bar */}
          <div className="w-full flex items-center justify-end space-x-3 mt-5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleValidateCrop}
              className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-[#1B4B4A] hover:bg-[#153a39] active:scale-95 transition-all flex items-center space-x-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Valider le cadrage</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

