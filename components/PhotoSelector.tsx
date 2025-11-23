
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraIcon, UploadIcon, RedoIcon, UndoIcon, FolderIcon } from './icons';
import { Placeholder, Crop, GuestScreenMode, GuestScreenState, Photo } from '../types';

export const useHistoryState = <T,>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const state = history[currentIndex];

  const setState = (newState: T | ((prevState: T) => T)) => {
    const resolvedState = typeof newState === 'function' ? (newState as (prevState: T) => T)(state) : newState;
    if (JSON.stringify(resolvedState) === JSON.stringify(state)) return;
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(resolvedState);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const replaceState = (newState: T | ((prevState: T) => T)) => {
      const resolvedState = typeof newState === 'function' ? (newState as (prevState: T) => T)(state) : newState;
      if (JSON.stringify(resolvedState) === JSON.stringify(state)) return;
      const newHistory = [...history];
      newHistory[currentIndex] = resolvedState;
      setHistory(newHistory);
  };

  const undo = () => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };
  const redo = () => { if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1); };
  const reset = (newState: T) => { setHistory([newState]); setCurrentIndex(0); }
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { state, setState, replaceState, undo, redo, canUndo, canRedo, reset };
};

type PhotoSlot = { src: string; crop: Crop } | null;

interface PhotoSelectorProps {
  onPhotosSelect: (photoData: { src: string; crop: Crop }[]) => void;
  onUseHotFolder: () => void;
  placeholders: Placeholder[];
  frameSrc: string | null;
  aspectRatio?: string;
  sendMessage: (state: GuestScreenState) => void;
}

const PhotoSelector: React.FC<PhotoSelectorProps> = ({ onPhotosSelect, onUseHotFolder, placeholders, frameSrc, aspectRatio = '2 / 3', sendMessage }) => {
  const maxPhotos = placeholders.length;
  const { state: photos, setState: setPhotos, replaceState: updatePhotos, undo, redo, canUndo, canRedo, reset } = useHistoryState<PhotoSlot[]>([]);
  const [importedPhotos, setImportedPhotos] = useState<string[]>([]);
  const [selectedTrayPhotoIndex, setSelectedTrayPhotoIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [loadedPhotoImages, setLoadedPhotoImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedPhoto, setDraggedPhoto] = useState<{ src: string; index: number } | null>(null);
  const [draggedOverSlotIndex, setDraggedOverSlotIndex] = useState<number | null>(null);
  
  // Fix: Track drop time to prevent ghost clicks
  const lastDropTime = useRef(0);

  // Interaction State for Panning/Zooming
  const interactionRef = useRef({
      isMouseDown: false,
      isPanning: false,
      startX: 0,
      startY: 0,
      targetIndex: -1,
      initialCrop: null as Crop | null,
  });

  useEffect(() => {
    reset(Array(maxPhotos).fill(null));
  }, [maxPhotos]);

  // --- Live Mirroring to Guest Window ---
  useEffect(() => {
      // Convert current slot state to "Photo" objects for the Guest Window's ReviewMode
      const mappedPhotos: Photo[] = [];
      
      photos.forEach((slot, index) => {
          if (!slot || !placeholders[index]) return;
          
          const p = placeholders[index];
          const photoObj: Photo = {
              src: slot.src,
              crop: slot.crop,
              originalWidth: 1000, // Mock, will be loaded by GuestWindow
              originalHeight: 1000,
              transform: {
                  x: p.x + p.width / 2,
                  y: p.y + p.height / 2,
                  width: p.width,
                  height: p.height,
                  rotation: 0
              },
              fit: p.fit
          };
          mappedPhotos.push(photoObj);
      });

      sendMessage({
          mode: GuestScreenMode.REVIEW,
          photos: mappedPhotos,
          frameSrc: frameSrc,
          aspectRatio: aspectRatio,
          stickers: [],
          textLayers: []
      });

  }, [photos, placeholders, frameSrc, aspectRatio, sendMessage]);


  useEffect(() => {
    if (frameSrc) {
        const img = new Image();
        img.onload = () => setFrameImage(img);
        img.src = frameSrc;
    }
  }, [frameSrc]);
  
  useEffect(() => {
    const allPhotoSrcs = [...photos.map(p => p?.src), ...importedPhotos].filter((p): p is string => !!p);
    allPhotoSrcs.forEach(src => {
        if (src && !loadedPhotoImages.has(src)) {
            const img = new Image();
            img.onload = () => setLoadedPhotoImages(prev => new Map(prev).set(src, img));
            img.src = src;
        }
    });
  }, [photos, importedPhotos, loadedPhotoImages]);

  useEffect(() => {
    const canvasWrapper = containerRef.current;
    const column = leftColumnRef.current;
    if (!canvasWrapper || !column) return;
    
    const updateHeight = () => {
        if (window.matchMedia('(min-width: 1024px)').matches) {
            const height = canvasWrapper.offsetHeight;
            if (height > 0) column.style.height = `${height}px`;
        } else {
            column.style.height = 'auto';
        }
    };

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(canvasWrapper);
    window.addEventListener('resize', updateHeight);
    updateHeight();

    return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateHeight);
    };
  }, []);


  const filledSlots = photos.filter(Boolean).length;

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError('Camera permission was denied. Please allow camera access.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => stopCamera, [stopCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const tempCanvas = document.createElement('canvas');
    if (video && tempCanvas) {
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;
        ctx.translate(video.videoWidth, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = tempCanvas.toDataURL('image/jpeg');
        setImportedPhotos(current => [...current, dataUrl]);
        setError(null);
    }
  };
  
  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const promises = imageFiles.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    }));
    Promise.all(promises).then(dataUrls => setImportedPhotos(current => [...current, ...dataUrls]));
  };
  
  const handleRemoveFromTray = (indexToRemove: number) => {
    setImportedPhotos(current => current.filter((_, index) => index !== indexToRemove));
    if (selectedTrayPhotoIndex === indexToRemove) setSelectedTrayPhotoIndex(null);
    else if (selectedTrayPhotoIndex && selectedTrayPhotoIndex > indexToRemove) setSelectedTrayPhotoIndex(prev => prev! - 1);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    event.target.value = '';
  };

  const handleConfirm = () => {
    const filledPhotos = photos.filter((p): p is PhotoSlot => p !== null);
    if (filledPhotos.length < maxPhotos) {
      setError(`Please fill all ${maxPhotos} photo slots.`);
      return;
    }
    stopCamera();
    onPhotosSelect(photos as { src: string; crop: Crop }[]);
  };
  
  const getHitSlotIndex = (e: React.MouseEvent | React.WheelEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return -1;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      
      return placeholders.findIndex(p => {
          const pX = p.x * canvas.width;
          const pY = p.y * canvas.height;
          const pW = p.width * canvas.width;
          const pH = p.height * canvas.height;
          return x >= pX && x <= pX + pW && y >= pY && y <= pY + pH;
      });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Fix: Prevent ghost clicks immediately after a drop operation
      if (Date.now() - lastDropTime.current < 500) return;

      const index = getHitSlotIndex(e);
      if (index === -1) return;

      interactionRef.current = {
          isMouseDown: true,
          isPanning: false,
          startX: e.clientX,
          startY: e.clientY,
          targetIndex: index,
          initialCrop: photos[index] ? { ...photos[index]!.crop } : null,
      };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { isMouseDown, startX, startY, targetIndex, initialCrop } = interactionRef.current;
      
      if (!isMouseDown || targetIndex === -1) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      if (!interactionRef.current.isPanning) {
          if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
              interactionRef.current.isPanning = true;
          } else {
              return;
          }
      }

      if (photos[targetIndex] && initialCrop) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;

          updatePhotos(prev => {
              const newPhotos = [...prev];
              const currentPhoto = newPhotos[targetIndex];
              if (currentPhoto) {
                   newPhotos[targetIndex] = {
                       ...currentPhoto,
                       crop: {
                           ...currentPhoto.crop,
                           x: initialCrop.x + (deltaX * scaleX),
                           y: initialCrop.y + (deltaY * scaleY)
                       }
                   };
              }
              return newPhotos;
          });
      }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { isPanning, targetIndex } = interactionRef.current;
      interactionRef.current.isMouseDown = false;
      
      if (targetIndex === -1) return;

      interactionRef.current.targetIndex = -1;
      interactionRef.current.initialCrop = null;
      interactionRef.current.isPanning = false;

      if (isPanning) {
           const currentPhotos = photos;
           setPhotos(currentPhotos);
      } else {
          if (selectedTrayPhotoIndex !== null && !photos[targetIndex]) {
              const photoToPlaceSrc = importedPhotos[selectedTrayPhotoIndex];
              setPhotos(currentSlots => {
                  const newSlots = [...currentSlots];
                  newSlots[targetIndex] = { src: photoToPlaceSrc, crop: { x: 0, y: 0, scale: 1 } };
                  return newSlots;
              });
              setSelectedTrayPhotoIndex(null);
              return;
          }
          
          const photoInSlot = photos[targetIndex];
          if (photoInSlot) {
              setPhotos(current => {
                  const newPhotos = [...current];
                  newPhotos[targetIndex] = null;
                  return newPhotos;
              });
              if(selectedTrayPhotoIndex !== null) setSelectedTrayPhotoIndex(p => p! + 1);
          }
      }
  };
  
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
      const index = getHitSlotIndex(e);
      if (index === -1 || !photos[index]) return;
      
      e.preventDefault();
      const scaleDelta = -e.deltaY * 0.001;
      
      setPhotos(prev => {
          const newPhotos = [...prev];
          const p = newPhotos[index];
          if (p) {
              const newScale = Math.max(0.1, Math.min(5, p.crop.scale + scaleDelta * p.crop.scale));
              newPhotos[index] = { ...p, crop: { ...p.crop, scale: newScale }};
          }
          return newPhotos;
      });
  };
  
  const getDropTargetIndex = (e: React.DragEvent): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      
      return placeholders.findIndex(p => {
          const pX = p.x * canvas.width;
          const pY = p.y * canvas.height;
          const pW = p.width * canvas.width;
          const pH = p.height * canvas.height;
          return x >= pX && x <= pX + pW && y >= pY && y <= pY + pH;
      });
  };

  const handleComponentDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !draggedPhoto) {
          processFiles(e.dataTransfer.files);
      }
  };
  
  const handleDragStartOnTrayPhoto = (e: React.DragEvent, src: string, index: number) => {
    setDraggedPhoto({ src, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnCanvas = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Fix: Record timestamp to block immediate mouse events
    lastDropTime.current = Date.now();
    
    setDraggedOverSlotIndex(null);
    if (!draggedPhoto) return;
    const targetIndex = getDropTargetIndex(e);
    if (targetIndex === null) { setDraggedPhoto(null); return; };
    
    const occupantPhoto = photos[targetIndex];
    setPhotos(currentSlots => {
        const newSlots = [...currentSlots];
        newSlots[targetIndex] = { src: draggedPhoto.src, crop: { x: 0, y: 0, scale: 1 } };
        return newSlots;
    });
    if (selectedTrayPhotoIndex === draggedPhoto.index) setSelectedTrayPhotoIndex(null);
    setDraggedPhoto(null);
    
    // Fix: Explicitly reset interaction state to prevent accidental removal
    interactionRef.current.isMouseDown = false;
    interactionRef.current.targetIndex = -1;
  };

  const handleDragOverCanvas = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (draggedPhoto) {
          const targetIndex = getDropTargetIndex(e);
          if (targetIndex !== draggedOverSlotIndex) setDraggedOverSlotIndex(targetIndex);
      }
  };
  const handleDragLeaveCanvas = () => setDraggedOverSlotIndex(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const primaryRgb = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    placeholders.forEach((p, i) => {
        const pX = p.x * canvas.width;
        const pY = p.y * canvas.height;
        const pW = p.width * canvas.width;
        const pH = p.height * canvas.height;
        const photoData = photos[i];
        const photoImg = photoData ? loadedPhotoImages.get(photoData.src) : null;
        
        ctx.save();
        const centerX = pX + pW / 2;
        const centerY = pY + pH / 2;
        ctx.translate(centerX, centerY);
        
        ctx.beginPath();
        ctx.rect(-pW / 2, -pH / 2, pW, pH);
        
        if (photoImg && photoData) {
            ctx.clip();
            const crop = photoData.crop;
            
            const imgAR = photoImg.width / photoImg.height;
            const placeholderAR = pW / pH;
            let baseW, baseH;
            const fitMode = p.fit || 'cover';

            if (fitMode === 'cover') {
                if (imgAR > placeholderAR) { baseH = pH; baseW = baseH * imgAR; } 
                else { baseW = pW; baseH = baseW / imgAR; }
            } else { 
                 if (imgAR > placeholderAR) { baseW = pW; baseH = baseW / imgAR; } 
                 else { baseH = pH; baseW = baseH * imgAR; }
            }
            
            const drawW = baseW * crop.scale;
            const drawH = baseH * crop.scale;
            ctx.drawImage(photoImg, -drawW/2 + crop.x, -drawH/2 + crop.y, drawW, drawH);
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            ctx.fill();
            
            if (draggedOverSlotIndex === i) { ctx.fillStyle = `rgba(${primaryRgb}, 0.4)`; ctx.fill(); } 
            else if (selectedTrayPhotoIndex !== null) { ctx.fillStyle = `rgba(${primaryRgb}, 0.3)`; ctx.fill(); }
            
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.stroke();
            
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            const fontSize = Math.min(pW, pH) * 0.15;
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`Slot ${i + 1}`, 0, 0);
        }
        ctx.restore();
    });

    if (frameImage) ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  }, [placeholders, photos, frameImage, loadedPhotoImages, selectedTrayPhotoIndex, draggedOverSlotIndex]);

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderLoop = () => {
        const dpr = window.devicePixelRatio || 1;
        const { width, height } = container.getBoundingClientRect();
        const newWidth = Math.round(width * dpr);
        const newHeight = Math.round(height * dpr);
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
        }
        draw();
        animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 p-4 bg-[var(--color-panel)] rounded-2xl shadow-lg">
      <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--color-primary)]">Step 3: Add Your Photos</h2>
          <p className="opacity-70">Import photos, then drag or click to place them. ({filledSlots}/{maxPhotos} filled)</p>
      </div>
      
      <div className="w-full flex flex-col lg:flex-row items-start gap-8">
        <div ref={leftColumnRef} className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
             <div className="flex flex-col items-stretch justify-center gap-4 flex-shrink-0">
                <div className="flex flex-wrap items-center justify-center gap-4">
                    {!stream && <button onClick={startCamera} className="px-4 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110">Start Camera</button>}
                    {stream && (
                        <div className="w-40 h-30 bg-black rounded-lg overflow-hidden relative group">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={handleCapture} className="p-2 bg-green-600 rounded-full text-white mb-2"><CameraIcon /></button>
                                <button onClick={stopCamera} className="text-xs px-2 py-1 bg-red-600 text-white rounded">Stop</button>
                            </div>
                        </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                        <UploadIcon className="w-6 h-6" /> Import
                    </button>
                </div>
                <div className="text-center text-xs opacity-50">or</div>
                <button onClick={onUseHotFolder} className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700">
                    <FolderIcon className="w-6 h-6" /> Use Hot Folder (Tethered)
                </button>
            </div>
            
            <div className="w-full p-2 bg-[var(--color-background)]/50 rounded-lg border border-[var(--color-border)] flex-grow min-h-0 flex flex-col">
                <div className="flex justify-between items-center mb-3 flex-shrink-0">
                    <h3 className="text-sm font-medium opacity-80">Your Photos ({importedPhotos.length})</h3>
                    {importedPhotos.length > 0 && <button onClick={() => setImportedPhotos([])} className="text-xs text-gray-400 hover:text-red-400">Clear All</button>}
                </div>
                {importedPhotos.length === 0 && <p className="text-xs text-gray-500 text-center py-4">Import photos to begin.</p>}
                <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-2">
                    {importedPhotos.map((src, index) => (
                    <div key={`${src.substring(0,30)}-${index}`} className={`relative group aspect-square rounded-md overflow-hidden bg-gray-700 cursor-pointer ${selectedTrayPhotoIndex === index ? 'ring-4 ring-[var(--color-primary)]' : ''}`} onClick={() => setSelectedTrayPhotoIndex(index)}>
                        <img src={src} alt={`Imported ${index}`} className="w-full h-full object-cover" draggable onDragStart={(e) => handleDragStartOnTrayPhoto(e, src, index)} onDragEnd={() => setDraggedPhoto(null)} />
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveFromTray(index); }} className="absolute top-1 right-1 z-10 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-opacity" aria-label="Remove photo">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                    ))}
                </div>
            </div>
             <div className="flex justify-center items-center gap-4 flex-shrink-0">
                <button onClick={undo} disabled={!canUndo} className="flex items-center gap-2 px-4 py-2 bg-black/20 text-white rounded-lg disabled:opacity-50 hover:bg-black/30"> <UndoIcon /> Undo</button>
                <button onClick={redo} disabled={!canRedo} className="flex items-center gap-2 px-4 py-2 bg-black/20 text-white rounded-lg disabled:opacity-50 hover:bg-black/30">Redo <RedoIcon /></button>
            </div>
        </div>
        
        <div className="flex-grow w-full">
            <div
                ref={containerRef}
                className="w-full max-w-md mx-auto relative"
                style={{ aspectRatio }}
                onDragEnter={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files') && !draggedPhoto) setIsDraggingOver(true); }}
                onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files') && !draggedPhoto) e.dataTransfer.dropEffect = 'copy'; }}
                onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDraggingOver(false); }}
                onDrop={handleComponentDrop}
            >
                <canvas 
                    ref={canvasRef} 
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    onDrop={handleDropOnCanvas} 
                    onDragOver={handleDragOverCanvas} 
                    onDragLeave={handleDragLeaveCanvas} 
                    className="w-full h-full cursor-pointer" 
                    title="Click empty to place, Click filled to remove. Scroll to zoom, Drag filled to pan."
                />
                {isDraggingOver && <div className="absolute inset-0 bg-[var(--color-primary)]/30 border-4 border-dashed border-[var(--color-primary)] rounded-lg flex items-center justify-center pointer-events-none"><p className="text-white font-bold text-xl">Drop Photos Here</p></div>}
            </div>
            <p className="text-center text-xs opacity-50 mt-2">Scroll to zoom • Drag to pan • Click to place/remove</p>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
      <div className="w-full flex justify-center mt-4">
          <button onClick={handleConfirm} disabled={filledSlots < maxPhotos} className="px-8 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            Finalize Photos
          </button>
      </div>
    </div>
  );
};

export default PhotoSelector;
