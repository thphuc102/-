
import React, { useState, useRef } from 'react';
import { 
    DownloadIcon, ResetIcon, ZoomInIcon, ZoomOutIcon, UndoIcon, RedoIcon, 
    SparklesIcon, StickerIcon, CameraIcon, PlusIcon, TypeIcon, TrashIcon,
    ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, PrintIcon, PenIcon, FilterIcon, SmartCropIcon
} from './icons';
import { Photo, StickerLayer, TextLayer } from '../types';

interface FinalizeControlsProps {
  onDownload: () => void;
  onPrint: () => void;
  onGetImageForExport: () => Promise<string | undefined>;
  onReset: () => void;
  onCreateNew: () => void;
  frameOpacity: number;
  onOpacityChange: (opacity: number) => void;
  
  photos: Photo[];
  
  selectedLayerType: 'photo' | 'sticker' | 'text' | 'drawing';
  selectedLayerIndex: number;
  onSelectLayer: (type: 'photo' | 'sticker' | 'text', index: number) => void;
  
  onPhotoUpdate: (index: number, updates: Partial<Photo>) => void;
  onResetPhotoAdjustments: (index: number) => void;
  
  // New Props for Decor
  stickers: StickerLayer[];
  textLayers: TextLayer[];
  availableStickers: string[];
  onAddSticker: (src: string) => void;
  onAddText: () => void;
  onUpdateSticker: (index: number, updates: Partial<StickerLayer>) => void;
  onUpdateText: (index: number, updates: Partial<TextLayer>) => void;
  onDeleteLayer: () => void;
  onImportSticker: (file: File) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isKioskMode: boolean;
  globalPhotoScale: number;
  onGlobalPhotoScaleChange: (scale: number) => void;
  
  // AI Props
  aiPrompt: string;
  onAiPromptChange: (prompt: string) => void;
  onAiGenerate: () => void;
  isAiLoading: boolean;
  aiError: string | null;

  // AI Sticker Props
  aiStickerPrompt: string;
  onAiStickerPromptChange: (prompt: string) => void;
  onAiGenerateSticker: () => void;
  isAiStickerLoading: boolean;
  aiStickerError: string | null;

  // Pro Features
  enableSmartCrop: boolean;
  onSmartCrop: (index: number) => void;
}

const FinalizeControls: React.FC<FinalizeControlsProps> = ({ 
    onDownload, 
    onPrint,
    onGetImageForExport,
    onReset, 
    onCreateNew,
    frameOpacity, 
    onOpacityChange,
    photos,
    selectedLayerType,
    selectedLayerIndex,
    onSelectLayer,
    onPhotoUpdate,
    onResetPhotoAdjustments,
    
    stickers,
    textLayers,
    availableStickers,
    onAddSticker,
    onAddText,
    onUpdateSticker,
    onUpdateText,
    onDeleteLayer,
    onImportSticker,

    undo,
    redo,
    canUndo,
    canRedo,
    isKioskMode,
    globalPhotoScale,
    onGlobalPhotoScaleChange,
    aiPrompt,
    onAiPromptChange,
    onAiGenerate,
    isAiLoading,
    aiError,

    aiStickerPrompt,
    onAiStickerPromptChange,
    onAiGenerateSticker,
    isAiStickerLoading,
    aiStickerError,

    enableSmartCrop,
    onSmartCrop,
}) => {
  const [activeTab, setActiveTab] = useState<'adjust' | 'decor'>('adjust');
  const stickerInputRef = useRef<HTMLInputElement>(null);

  const selectedPhoto = selectedLayerType === 'photo' && selectedLayerIndex !== -1 ? photos[selectedLayerIndex] : null;
  const selectedText = selectedLayerType === 'text' && selectedLayerIndex !== -1 ? textLayers[selectedLayerIndex] : null;
  const selectedSticker = selectedLayerType === 'sticker' && selectedLayerIndex !== -1 ? stickers[selectedLayerIndex] : null;

  const handleTransformChange = (prop: 'rotation', value: number) => {
    if (selectedPhoto) {
        const newTransform = { ...selectedPhoto.transform, [prop]: value };
        onPhotoUpdate(selectedLayerIndex, { transform: newTransform });
    }
  };

  const handleCropChange = (prop: 'x' | 'y' | 'scale', value: number) => {
    if (selectedPhoto) {
        const newCrop = { ...selectedPhoto.crop, [prop]: value };
        onPhotoUpdate(selectedLayerIndex, { crop: newCrop });
    }
  }

  const fontOptions = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Impact", "Comic Sans MS"];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4 mt-8 lg:mt-0">
      <div className="w-full text-center">
        <h2 className="text-2xl font-bold text-[var(--color-primary)]">Step 4: Finalize & Export</h2>
        <p className="opacity-70">Decorate, adjust, and download.</p>
      </div>
      
      <div className="w-full p-4 bg-[var(--color-panel)] rounded-lg border border-[var(--color-border)] flex justify-center items-center gap-4">
        <button onClick={undo} disabled={!canUndo} className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/30 transition-opacity">
          <UndoIcon /> Undo
        </button>
        <button onClick={redo} disabled={!canRedo} className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/30 transition-opacity">
          Redo <RedoIcon />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex w-full bg-[var(--color-panel)] rounded-lg border border-[var(--color-border)] p-1">
          <button onClick={() => setActiveTab('adjust')} className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'adjust' ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-white/10'}`}>
              <CameraIcon className="w-4 h-4"/> Photo Adjust
          </button>
          <button onClick={() => setActiveTab('decor')} className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'decor' ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-white/10'}`}>
              <StickerIcon className="w-4 h-4"/> Decorate
          </button>
      </div>
      
      {activeTab === 'adjust' && (
        <>
            {/* AI Editing Panel */}
            <div className="w-full p-4 bg-[var(--color-panel)] rounded-lg border border-[var(--color-border)] space-y-3">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-[var(--color-primary)]" />
                    <h3 className="text-sm font-medium opacity-80">Edit with AI</h3>
                </div>
                <textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => onAiPromptChange(e.target.value)}
                    placeholder="e.g., Make it black and white..."
                    className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                />
                {aiError && <p className="text-xs text-red-400">{aiError}</p>}
                <button onClick={onAiGenerate} disabled={isAiLoading || photos.length === 0} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110 disabled:bg-gray-500 disabled:cursor-not-allowed">
                    {isAiLoading ? "Generating..." : "Generate"}
                </button>
            </div>

            {/* Photo Selection & Adjust */}
            <div className="w-full p-4 bg-[var(--color-panel)] rounded-lg border border-[var(--color-border)]">
                <h3 className="text-sm font-medium opacity-80 mb-3">Select Photo</h3>
                <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                {photos.map((photo, index) => (
                    <button 
                    key={index} 
                    onClick={() => onSelectLayer('photo', index)}
                    className={`w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all duration-200 ${selectedLayerType === 'photo' && selectedLayerIndex === index ? 'border-[var(--color-primary)] scale-110' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'}`}
                    >
                    <img src={photo.src} alt={`Thumb ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                ))}
                </div>
            </div>

            {selectedPhoto && (
                <div className="w-full p-4 bg-[var(--color-panel)] rounded-lg border border-[var(--color-border)] space-y-4">
                    <h3 className="text-sm font-medium opacity-80">Photo Adjustments</h3>
                    
                    {enableSmartCrop && (
                        <button onClick={() => onSmartCrop(selectedLayerIndex)} className="w-full py-2 bg-pink-600 hover:bg-pink-500 rounded-md text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg">
                            <SmartCropIcon className="w-4 h-4"/> Auto-Center Face (Smart Crop)
                        </button>
                    )}

                    <div>
                        <label className="block text-xs font-medium opacity-70 mb-1">Zoom</label>
                        <div className="flex items-center gap-3">
                        <ZoomOutIcon className="w-5 h-5 opacity-70" />
                        <input type="range" min={0.5} max={5} step="0.01" value={selectedPhoto.crop.scale} onChange={(e) => handleCropChange('scale', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        <ZoomInIcon className="w-5 h-5 opacity-70" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium opacity-70 mb-1">Rotation</label>
                        <input type="range" min={-180} max={180} step="0.1" value={selectedPhoto.transform.rotation} onChange={(e) => handleTransformChange('rotation', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <button onClick={() => onResetPhotoAdjustments(selectedLayerIndex)} className="w-full text-xs py-2 px-3 bg-black/20 hover:bg-black/30 rounded-md flex items-center justify-center gap-2">
                        <ResetIcon className="w-4 h-4" /> Reset Adjustments
                    </button>
                </div>
            )}
        </>
      )}

      {activeTab === 'decor' && (
          <div className="w-full p-4 bg-[var(--color-panel)] rounded-lg border border-[var(--color-border)] space-y-4">
              {/* AI Sticker Generation */}
              <div className="bg-black/20 p-3 rounded-lg space-y-2">
                 <div className="flex items-center gap-2">
                     <SparklesIcon className="w-4 h-4 text-pink-400" />
                     <h4 className="text-xs font-bold uppercase opacity-70">Generate AI Sticker</h4>
                 </div>
                 <div className="flex gap-2">
                     <input 
                         type="text" 
                         value={aiStickerPrompt}
                         onChange={(e) => onAiStickerPromptChange(e.target.value)}
                         placeholder="e.g. A cute robot cat"
                         className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md px-2 py-1 text-sm focus:ring-[var(--color-primary)]"
                     />
                     <button 
                        onClick={onAiGenerateSticker}
                        disabled={isAiStickerLoading || !aiStickerPrompt.trim()}
                        className="px-3 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                         {isAiStickerLoading ? '...' : <ArrowRightIcon className="w-4 h-4" />}
                     </button>
                 </div>
                 {aiStickerError && <p className="text-xs text-red-400">{aiStickerError}</p>}
              </div>

              <div className="flex gap-2">
                  <button onClick={onAddText} className="flex-1 py-2 bg-indigo-600 text-white rounded-md flex items-center justify-center gap-2 hover:bg-indigo-700 text-sm">
                      <TypeIcon className="w-4 h-4" /> Add Text
                  </button>
                  <button onClick={() => stickerInputRef.current?.click()} className="flex-1 py-2 bg-gray-700 text-white rounded-md flex items-center justify-center gap-2 hover:bg-gray-600 text-sm">
                      <PlusIcon className="w-4 h-4" /> Upload Sticker
                  </button>
                  <input type="file" ref={stickerInputRef} accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onImportSticker(e.target.files[0]); e.target.value = ''; }} />
              </div>
              
              {selectedLayerType === 'text' && selectedText ? (
                  <div className="bg-black/20 p-3 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold uppercase opacity-70">Text Properties</h4>
                          <button onClick={onDeleteLayer} className="text-red-400 hover:text-red-300"><TrashIcon className="w-4 h-4"/></button>
                      </div>
                      <input 
                        type="text" 
                        value={selectedText.text} 
                        onChange={(e) => onUpdateText(selectedLayerIndex, { text: e.target.value })}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1 text-sm"
                      />
                      <div className="flex gap-2">
                          <input type="color" value={selectedText.color} onChange={(e) => onUpdateText(selectedLayerIndex, { color: e.target.value })} className="h-8 w-8 bg-transparent border-none cursor-pointer" />
                          <select 
                            value={selectedText.fontFamily} 
                            onChange={(e) => onUpdateText(selectedLayerIndex, { fontFamily: e.target.value })}
                            className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-xs"
                          >
                              {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                      </div>
                       <div>
                          <label className="block text-xs font-medium opacity-70 mb-1">Rotation</label>
                          <input 
                              type="range" 
                              min={-180} 
                              max={180} 
                              step={1} 
                              value={selectedText.rotation} 
                              onChange={(e) => onUpdateText(selectedLayerIndex, { rotation: parseFloat(e.target.value) })}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
                          />
                      </div>
                  </div>
              ) : selectedLayerType === 'sticker' && selectedSticker ? (
                   <div className="bg-black/20 p-3 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold uppercase opacity-70">Sticker Properties</h4>
                          <button onClick={onDeleteLayer} className="text-red-400 hover:text-red-300" title="Delete Sticker"><TrashIcon className="w-4 h-4"/></button>
                      </div>

                      <div>
                           <label className="block text-xs font-medium opacity-70 mb-1">Size</label>
                           <div className="flex items-center gap-3">
                              <ZoomOutIcon className="w-4 h-4 opacity-70" />
                              <input 
                                  type="range" 
                                  min={0.05} 
                                  max={0.8} 
                                  step={0.01} 
                                  value={selectedSticker.width} 
                                  onChange={(e) => {
                                      const width = parseFloat(e.target.value);
                                      const ratio = selectedSticker.width / selectedSticker.height;
                                      onUpdateSticker(selectedLayerIndex, { width, height: width / ratio });
                                  }}
                                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
                              />
                              <ZoomInIcon className="w-4 h-4 opacity-70" />
                           </div>
                      </div>

                      <div>
                          <label className="block text-xs font-medium opacity-70 mb-1">Rotation</label>
                          <input 
                              type="range" 
                              min={-180} 
                              max={180} 
                              step={1} 
                              value={selectedSticker.rotation} 
                              onChange={(e) => onUpdateSticker(selectedLayerIndex, { rotation: parseFloat(e.target.value) })}
                              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
                          />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium opacity-70 mb-1 text-center">Position</label>
                        <div className="grid grid-cols-3 gap-1 w-24 mx-auto">
                             <div></div>
                             <button onClick={() => onUpdateSticker(selectedLayerIndex, { y: selectedSticker.y - 0.01 })} className="p-1 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowUpIcon className="w-3 h-3" /></button>
                             <div></div>
                             <button onClick={() => onUpdateSticker(selectedLayerIndex, { x: selectedSticker.x - 0.01 })} className="p-1 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowLeftIcon className="w-3 h-3" /></button>
                             <div className="flex items-center justify-center"><span className="w-1 h-1 bg-white/50 rounded-full"></span></div>
                             <button onClick={() => onUpdateSticker(selectedLayerIndex, { x: selectedSticker.x + 0.01 })} className="p-1 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowRightIcon className="w-3 h-3" /></button>
                             <div></div>
                             <button onClick={() => onUpdateSticker(selectedLayerIndex, { y: selectedSticker.y + 0.01 })} className="p-1 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowDownIcon className="w-3 h-3" /></button>
                             <div></div>
                        </div>
                      </div>
                   </div>
              ) : (
                  <p className="text-xs text-center opacity-50">Select a layer to edit or add new decorations.</p>
              )}

              <div>
                  <h4 className="text-xs font-bold uppercase opacity-70 mb-2">Stickers</h4>
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                      {availableStickers.map((src, i) => (
                          <button key={i} onClick={() => onAddSticker(src)} className="aspect-square bg-white/5 rounded-md p-1 hover:bg-white/20 border border-transparent hover:border-indigo-500">
                              <img src={src} alt="Sticker" className="w-full h-full object-contain" />
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Global Settings */}
      <div className="w-full p-4 bg-[var(--color-panel)] rounded-lg border border-[var(--color-border)] space-y-4">
        <div>
          <h3 className="text-sm font-medium opacity-80 mb-2">Global Layout</h3>
          <label className="block text-xs font-medium opacity-70 mb-1">
              Overall Photo Scale: <span className="font-bold text-[var(--color-primary)]">{Math.round(globalPhotoScale * 100)}%</span>
          </label>
          <input 
              type="range" min={0.5} max={1.5} step="0.01" 
              value={globalPhotoScale} 
              onChange={(e) => onGlobalPhotoScaleChange(parseFloat(e.target.value))} 
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
           />
        </div>
        <div>
          <label htmlFor="opacity-slider" className="text-sm font-medium opacity-80">Frame Transparency: <span className="font-bold text-[var(--color-primary)]">{Math.round(frameOpacity * 100)}%</span></label>
          <input id="opacity-slider" type="range" min="0" max="1" step="0.01" value={frameOpacity} onChange={(e) => onOpacityChange(parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-2" />
        </div>
      </div>
      
      <div className="w-full mt-3 flex gap-2">
        <button onClick={onDownload} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400">
          <DownloadIcon className="w-5 h-5" /> Download
        </button>
        <button onClick={onPrint} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <PrintIcon className="w-5 h-5" /> Print
        </button>
      </div>
      
      <button onClick={onCreateNew} className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110 mt-3">
        Create New (Keep Frame)
      </button>

      {!isKioskMode && (
        <div className="w-full text-center mt-2">
          <button onClick={onReset} className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1 mx-auto">
              <ResetIcon className="w-3 h-3" /> Start New Session
          </button>
        </div>
      )}
    </div>
  );
};

export default FinalizeControls;
