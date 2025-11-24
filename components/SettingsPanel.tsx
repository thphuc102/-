import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, AnalyticsData, Printer } from '../types';
import { GoogleDriveIcon, UploadIcon, FolderIcon, ServerIcon, ChipIcon, SwatchIcon } from './icons';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSettingsChange: (newSettings: AppSettings) => void;
    analytics?: AnalyticsData;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSettingsChange, analytics }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'layouts' | 'pro'>('general');
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
        const files = event.target.files;
        if (files && files.length > 0) {
            const newFrames: string[] = [];
            Array.from(files).forEach((file: File) => {
                if (file.type === 'image/png') {
                    newFrames.push(URL.createObjectURL(file));
                }
            });

            if (newFrames.length > 0) {
                const currentFrames = localSettings.availableFrames || [];
                // If no frames existed, set the first new one as default
                if (currentFrames.length === 0 && !localSettings.frameSrc) {
                    handleSettingChange('frameSrc', newFrames[0]);
                }
                handleSettingChange('availableFrames', [...currentFrames, ...newFrames]);
            }
        }
    };

    const handleRemoveFrame = (index: number) => {
        const currentFrames = localSettings.availableFrames || [];
        const newFrames = currentFrames.filter((_, i) => i !== index);
        handleSettingChange('availableFrames', newFrames);

        // If we deleted the active frame, pick another one or null
        if (currentFrames[index] === localSettings.frameSrc) {
            handleSettingChange('frameSrc', newFrames.length > 0 ? newFrames[0] : null);
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

    const handleAddCustomLayout = () => {
        const newLayout: import('../types').LayoutOption = {
            id: Date.now().toString(),
            label: 'New Layout',
            type: 'custom',
            placeholders: settings.placeholders,
            isActive: true,
            iconType: 'custom'
        };
        handleSettingChange('layoutOptions', [...(localSettings.layoutOptions || []), newLayout]);
    };

    const handleRemoveLayout = (id: string) => {
        if (confirm('Are you sure you want to delete this layout?')) {
            handleSettingChange('layoutOptions', localSettings.layoutOptions.filter(l => l.id !== id));
        }
    };

    const renderGeneralSettings = () => (
        <div className="space-y-6">
            {/* Frame Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Frame Overlays (PNG)</label>
                <input type="file" ref={frameInputRef} onChange={handleFrameFileChange} accept="image/png" multiple className="hidden" />

                <div className="grid grid-cols-3 gap-4">
                    {/* Add Button */}
                    <button onClick={() => frameInputRef.current?.click()} className="aspect-[2/3] border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center bg-gray-900/50 hover:bg-gray-800 hover:border-gray-500 transition-colors">
                        <UploadIcon className="h-8 w-8 text-gray-400" />
                        <span className="text-xs text-gray-400 mt-2">Add Frames</span>
                    </button>

                    {/* Frame List */}
                    {(localSettings.availableFrames || []).map((frame, index) => (
                        <div key={index} className="relative group aspect-[2/3] bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                            <img src={frame} alt={`Frame ${index + 1}`} className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                <button
                                    onClick={() => handleSettingChange('frameSrc', frame)}
                                    className={`px-3 py-1 rounded text-xs font-bold ${localSettings.frameSrc === frame ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                                >
                                    {localSettings.frameSrc === frame ? 'Default' : 'Set Default'}
                                </button>
                                <button
                                    onClick={() => handleRemoveFrame(index)}
                                    className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                            {localSettings.frameSrc === frame && (
                                <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border border-white shadow-sm"></div>
                            )}
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Upload multiple frames. Guests can choose their favorite if more than one is available.</p>
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

    const renderLayoutSettings = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-start">
                <p className="text-sm text-gray-400 flex-1">Manage the layouts available to guests. Design your grid in "Template Design", then save it here.</p>
                <button
                    onClick={handleAddCustomLayout}
                    className="ml-4 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded flex items-center gap-2"
                >
                    <span className="text-lg">+</span> Save Current Design
                </button>
            </div>

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-200 sm:pl-6">Icon</th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Label</th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Type</th>
                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-200">Active</th>
                            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 bg-gray-900">
                        {localSettings.layoutOptions?.map((layout) => (
                            <tr key={layout.id}>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                    <div className={`w-10 h-10 rounded flex items-center justify-center bg-gray-800 border border-gray-600 flex-shrink-0`}>
                                        {layout.iconType === 'single' && <div className="w-6 h-6 border-2 border-gray-400 rounded-sm"></div>}
                                        {layout.iconType === 'grid' && <div className="w-6 h-6 grid grid-cols-2 gap-0.5"><div className="bg-gray-400"></div><div className="bg-gray-400"></div><div className="bg-gray-400"></div><div className="bg-gray-400"></div></div>}
                                        {layout.iconType === 'strip' && <div className="w-4 h-6 flex flex-col gap-0.5"><div className="h-1.5 bg-gray-400 w-full"></div><div className="h-1.5 bg-gray-400 w-full"></div><div className="h-1.5 bg-gray-400 w-full"></div></div>}
                                        {layout.iconType === 'custom' && <span className="text-yellow-500 font-bold text-lg">?</span>}
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                                    <input
                                        type="text"
                                        value={layout.label}
                                        onChange={(e) => {
                                            const updatedLayouts = localSettings.layoutOptions.map(l =>
                                                l.id === layout.id ? { ...l, label: e.target.value } : l
                                            );
                                            handleSettingChange('layoutOptions', updatedLayouts);
                                        }}
                                        className="bg-transparent border-b border-gray-600 focus:border-indigo-500 text-sm text-gray-200 focus:ring-0 p-1 w-full"
                                    />
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                    {layout.type}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={layout.isActive}
                                            onChange={(e) => {
                                                const updatedLayouts = localSettings.layoutOptions.map(l =>
                                                    l.id === layout.id ? { ...l, isActive: e.target.checked } : l
                                                );
                                                handleSettingChange('layoutOptions', updatedLayouts);
                                            }}
                                        />
                                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </td>
                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                const updatedLayouts = localSettings.layoutOptions.map(l =>
                                                    l.id === layout.id ? { ...l, placeholders: settings.placeholders } : l
                                                );
                                                handleSettingChange('layoutOptions', updatedLayouts);
                                            }}
                                            className="text-indigo-400 hover:text-indigo-300"
                                            title="Update with current canvas design"
                                        >
                                            Update
                                        </button>
                                        {layout.type === 'custom' && (
                                            <button
                                                onClick={() => handleRemoveLayout(layout.id)}
                                                className="text-red-400 hover:text-red-300"
                                                title="Delete Layout"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderProSettings = () => (
        <div className="space-y-6">
            {/* Vending / MDB */}
            <div className="p-4 bg-black/20 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-yellow-400">
                        <ChipIcon className="w-5 h-5" /> Vending & Payment (MDB)
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
                    <ServerIcon className="w-5 h-5" /> Printer Pooling (Node.js Queue)
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
                        <SwatchIcon className="w-5 h-5" /> Color & AI
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
                        <button onClick={() => setActiveTab('layouts')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === 'layouts' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>Layouts</button>
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

                {activeTab === 'general' && renderGeneralSettings()}
                {activeTab === 'layouts' && renderLayoutSettings()}
                {activeTab === 'pro' && renderProSettings()}

                {/* Buttons */}
                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-700">
                    <button type="button" onClick={onClose} className="inline-flex justify-center rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700">Cancel</button>
                    <button type="button" onClick={handleSave} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
