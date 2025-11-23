
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, AnalyticsData, Printer } from '../types';
import { GoogleDriveIcon, UploadIcon, FolderIcon, ServerIcon, ChipIcon, SwatchIcon } from './icons';

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }
}

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSettingsChange: (settings: AppSettings) => void;
    analytics?: AnalyticsData;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSettingsChange, analytics }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'pro'>('general');
    const frameInputRef = useRef<HTMLInputElement>(null);
    const iccInputRef = useRef<HTMLInputElement>(null);

    // New Printer State
    const [newPrinterName, setNewPrinterName] = useState('');

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSettingsChange(localSettings);
        onClose();
    };
    
    const handleSettingChange = (field: keyof AppSettings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleProSettingChange = (field: keyof AppSettings['pro'], value: any) => {
        setLocalSettings(prev => ({ ...prev, pro: { ...prev.pro, [field]: value } }));
    };

    const handleSelectHotFolder = async () => {
        try {
            if (!('showDirectoryPicker' in window)) {
                alert('Your browser does not support local folder access. Please use a modern browser like Chrome or Edge.');
                return;
            }
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setLocalSettings(prev => ({ ...prev, hotFolderHandle: handle, hotFolderName: handle.name }));
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              console.error('Error selecting directory:', err);
            }
        }
    };

    const handleSelectOutputFolder = async () => {
        try {
            if (!('showDirectoryPicker' in window)) {
                alert('Your browser does not support local folder access. Please use a modern browser like Chrome or Edge.');
                return;
            }
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setLocalSettings(prev => ({ ...prev, outputDirectoryHandle: handle, localDownloadPath: handle.name }));
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Error selecting directory:', err);
            }
        }
    };
    
    const handleFrameFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'image/png') {
            const url = URL.createObjectURL(file);
            handleSettingChange('frameSrc', url);
        } else {
            alert('Please select a valid PNG file.');
        }
    };

    const handleIccFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleProSettingChange('iccProfileName', file.name);
        }
    };

    const addPrinter = () => {
        if (!newPrinterName.trim()) return;
        const newPrinter: Printer = {
            id: Date.now().toString(),
            name: newPrinterName,
            status: 'idle',
            jobs: 0
        };
        handleProSettingChange('printerPool', [...localSettings.pro.printerPool, newPrinter]);
        setNewPrinterName('');
    };

    const removePrinter = (id: string) => {
        handleProSettingChange('printerPool', localSettings.pro.printerPool.filter(p => p.id !== id));
    };

    const handleDownloadEmails = () => {
        if (!analytics?.emailsCollected.length) return;
        const csvContent = "data:text/csv;charset=utf-8," + analytics.emailsCollected.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "emails.csv");
        document.body.appendChild(link);
        link.click();
    };

    const renderGeneralSettings = () => (
        <div className="space-y-6">
             {/* Frame Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Frame Overlay (PNG)</label>
                    <input type="file" ref={frameInputRef} onChange={handleFrameFileChange} accept="image/png" className="hidden" />
                     <div className="w-full h-32 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center bg-gray-900/50">
                        {localSettings.frameSrc ? (
                            <div className="relative group p-2">
                                <img src={localSettings.frameSrc} alt="Frame Preview" className="max-h-28 max-w-full object-contain" />
                                <button onClick={() => frameInputRef.current?.click()} className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    Change
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => frameInputRef.current?.click()} className="text-center text-gray-500 hover:text-indigo-400">
                                <UploadIcon className="mx-auto h-8 w-8" />
                                <p className="text-xs mt-1">Upload Frame</p>
                            </button>
                        )}
                    </div>
                </div>

                {/* Output Folder Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-300">Download/Sync Folder</label>
                    <p className="text-xs text-gray-500 mb-2">Select a local folder to save final photos automatically.</p>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex-grow relative">
                            <FolderIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" />
                            <input type="text" readOnly value={localSettings.localDownloadPath || "Browser Default"} className="block w-full bg-gray-900 border border-gray-700 rounded-md pl-8 p-2 text-sm text-gray-300" />
                        </div>
                        <button onClick={handleSelectOutputFolder} className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 flex-shrink-0">Select...</button>
                    </div>
                </div>

                {/* Hot Folder Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-300">Capture One Hot Folder (Input)</label>
                    <p className="text-xs text-gray-500 mb-2">Select the folder C1 saves images to.</p>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="text" readOnly value={localSettings.hotFolderName || "No folder selected"} className="block w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm text-gray-300" />
                      <button onClick={handleSelectHotFolder} className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-500 flex-shrink-0">Select...</button>
                    </div>
                </div>
                
                {/* File Naming */}
                 <div>
                    <label htmlFor="fileNameTemplate" className="block text-sm font-medium text-gray-300">File Name Template</label>
                    <input type="text" id="fileNameTemplate" value={localSettings.fileNameTemplate} onChange={(e) => handleSettingChange('fileNameTemplate', e.target.value)} className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-sm text-gray-200" />
                    <p className="text-xs text-gray-500 mt-1">Placeholders: <code className="bg-black/20 px-1 rounded">{`{date}`}</code> <code className="bg-black/20 px-1 rounded">{`{time}`}</code> <code className="bg-black/20 px-1 rounded">{`{timestamp}`}</code> <code className="bg-black/20 px-1 rounded">{`{number}`}</code></p>
                </div>
        </div>
    );

    const renderProSettings = () => (
        <div className="space-y-6">
            {/* Vending / MDB */}
            <div className="p-4 bg-black/20 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-yellow-400">
                        <ChipIcon className="w-5 h-5"/> Vending & Payment (MDB)
                    </h4>
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                        <input type="checkbox" className="sr-only" checked={localSettings.pro.enableVending} onChange={(e) => handleProSettingChange('enableVending', e.target.checked)} />
                        <div className={`block w-10 h-6 rounded-full ${localSettings.pro.enableVending ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${localSettings.pro.enableVending ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                    </label>
                </div>
                
                {localSettings.pro.enableVending && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Price per Print</label>
                                <input type="number" value={localSettings.pro.pricePerPrint} onChange={(e) => handleProSettingChange('pricePerPrint', parseFloat(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Currency Symbol</label>
                                <input type="text" value={localSettings.pro.currency} onChange={(e) => handleProSettingChange('currency', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm" />
                            </div>
                        </div>
                        <button className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs flex items-center justify-center gap-2">
                            <ChipIcon className="w-4 h-4" /> Connect Serial Adapter (Web Serial)
                        </button>
                    </div>
                )}
            </div>

            {/* Printer Pooling */}
            <div className="p-4 bg-black/20 rounded-lg border border-gray-700">
                <h4 className="text-sm font-bold flex items-center gap-2 text-blue-400 mb-4">
                    <ServerIcon className="w-5 h-5"/> Printer Pooling (Node.js Queue)
                </h4>
                
                <div className="space-y-2 mb-4">
                    {localSettings.pro.printerPool.map(printer => (
                        <div key={printer.id} className="flex items-center justify-between bg-gray-900 p-2 rounded">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${printer.status === 'idle' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-sm">{printer.name}</span>
                                <span className="text-xs text-gray-500">({printer.jobs} jobs)</span>
                            </div>
                            <button onClick={() => removePrinter(printer.id)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                        </div>
                    ))}
                    {localSettings.pro.printerPool.length === 0 && <p className="text-xs text-gray-500">No printers configured.</p>}
                </div>
                
                <div className="flex gap-2">
                    <input type="text" placeholder="Printer Name / IP" value={newPrinterName} onChange={(e) => setNewPrinterName(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm" />
                    <button onClick={addPrinter} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">Add</button>
                </div>
            </div>

            {/* Smart Crop & Color */}
            <div className="p-4 bg-black/20 rounded-lg border border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                     <h4 className="text-sm font-bold flex items-center gap-2 text-pink-400">
                        <SwatchIcon className="w-5 h-5"/> Color & AI
                    </h4>
                </div>
                
                <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Enable Smart Crop (Face Detection)</label>
                     <input type="checkbox" checked={localSettings.pro.enableSmartCrop} onChange={(e) => handleProSettingChange('enableSmartCrop', e.target.checked)} className="rounded bg-gray-900 border-gray-700 text-pink-500 focus:ring-pink-500" />
                </div>

                <div>
                    <label className="block text-xs text-gray-400 mb-1">Live View Cinematic LUT (CSS Filter)</label>
                     <select value={localSettings.pro.liveViewLut} onChange={(e) => handleProSettingChange('liveViewLut', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm">
                        <option value="">None (Standard)</option>
                        <option value="sepia(0.3) contrast(1.1)">Warm Vintage</option>
                        <option value="contrast(1.2) saturate(1.2)">High Contrast Pop</option>
                        <option value="grayscale(1) contrast(1.2)">Noir B&W</option>
                        <option value="saturate(1.5) hue-rotate(-10deg)">Cyberpunk</option>
                    </select>
                </div>
                
                <div>
                     <label className="block text-xs text-gray-400 mb-1">ICC Profile</label>
                     <div className="flex gap-2">
                         <div className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-400 truncate">
                             {localSettings.pro.iccProfileName || "sRGB (Default)"}
                         </div>
                         <button onClick={() => iccInputRef.current?.click()} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs">Load .ICC</button>
                         <input type="file" ref={iccInputRef} onChange={handleIccFileChange} className="hidden" />
                     </div>
                </div>

            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true">
            <div className="relative transform overflow-hidden rounded-lg bg-gray-800 border border-gray-700 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                    <h3 className="text-lg font-medium leading-6 text-gray-100">Settings</h3>
                    <div className="flex bg-gray-900 rounded-lg p-1">
                        <button onClick={() => setActiveTab('general')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'general' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>General</button>
                        <button onClick={() => setActiveTab('pro')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'pro' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pro Features</button>
                    </div>
                </div>
                
                {/* Analytics Summary */}
                {analytics && (
                    <div className="grid grid-cols-4 gap-2 mb-4 bg-black/20 p-4 rounded-lg">
                        <div className="text-center">
                            <p className="text-xl font-bold text-indigo-400">{analytics.totalSessions}</p>
                            <p className="text-[10px] text-gray-400">Sessions</p>
                        </div>
                         <div className="text-center">
                            <p className="text-xl font-bold text-pink-400">{analytics.totalPrints}</p>
                            <p className="text-[10px] text-gray-400">Prints</p>
                        </div>
                         <div className="text-center">
                            <p className="text-xl font-bold text-green-400">{analytics.emailsCollected.length}</p>
                            <p className="text-[10px] text-gray-400">Emails</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-yellow-400">${analytics.totalRevenue}</p>
                            <p className="text-[10px] text-gray-400">Rev</p>
                        </div>
                        {analytics.emailsCollected.length > 0 && (
                            <button onClick={handleDownloadEmails} className="col-span-4 mt-2 text-xs text-blue-400 hover:text-blue-300 underline text-center">Download CSV</button>
                        )}
                    </div>
                )}

                {activeTab === 'general' ? renderGeneralSettings() : renderProSettings()}

                {/* Buttons */}
                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-700">
                    <button type="button" onClick={onClose} className="inline-flex justify-center rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700">Cancel</button>
                    <button type="button" onClick={handleSave} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600">Save Changes</button>
                </div>
            </div>
        </div>
    );
}

export default SettingsPanel;
