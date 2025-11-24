import React, { useState, useRef } from 'react';
import { FrameConfig, FrameLayout, LayoutOption, Placeholder } from '../../types';
import { UploadIcon, SaveIcon, XIcon } from '../icons';
import TemplateDesigner from '../TemplateDesigner';

interface FrameEditorProps {
    isOpen: boolean;
    onClose: () => void;
    frame: FrameConfig | null;
    layoutOptions: LayoutOption[];
    onSave: (updatedFrame: FrameConfig) => void;
}

const FrameEditor: React.FC<FrameEditorProps> = ({
    isOpen,
    onClose,
    frame,
    layoutOptions,
    onSave
}) => {
    const [editingFrame, setEditingFrame] = useState<FrameConfig | null>(frame);
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(
        frame?.supportedLayouts[0]?.layoutId || null
    );
    const [isEditingPlaceholders, setIsEditingPlaceholders] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setEditingFrame(frame);
        setSelectedLayoutId(frame?.supportedLayouts[0]?.layoutId || null);
        setIsEditingPlaceholders(false); // Reset edit mode when frame changes
    }, [frame]);

    if (!isOpen || !editingFrame) return null;

    const selectedLayout = editingFrame.supportedLayouts.find(l => l.layoutId === selectedLayoutId);
    const layoutOption = layoutOptions.find(l => l.id === selectedLayoutId);

    const handleNameChange = (name: string) => {
        setEditingFrame(prev => prev ? { ...prev, name } : null);
    };

    const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'image/png' && selectedLayoutId) {
            const url = URL.createObjectURL(file);
            setEditingFrame(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    supportedLayouts: prev.supportedLayouts.map(sl =>
                        sl.layoutId === selectedLayoutId
                            ? { ...sl, overlaySrc: url }
                            : sl
                    )
                };
            });
        }
    };

    const handlePlaceholdersChange = (placeholders: Placeholder[]) => {
        if (!selectedLayoutId) return;
        setEditingFrame(prev => {
            if (!prev) return null;
            return {
                ...prev,
                supportedLayouts: prev.supportedLayouts.map(sl =>
                    sl.layoutId === selectedLayoutId
                        ? { ...sl, placeholders }
                        : sl
                )
            };
        });
    };

    const handleSave = () => {
        if (editingFrame) {
            onSave(editingFrame);
            onClose();
        }
    };

    const handleAddLayout = (layoutId: string) => {
        const layoutOpt = layoutOptions.find(l => l.id === layoutId);
        if (!layoutOpt || !editingFrame) return;

        const newLayout: FrameLayout = {
            layoutId: layoutId,
            placeholders: layoutOpt.placeholders,
            overlaySrc: editingFrame.thumbnailSrc // Default to main thumbnail
        };

        setEditingFrame(prev => {
            if (!prev) return null;
            return {
                ...prev,
                supportedLayouts: [...prev.supportedLayouts, newLayout]
            };
        });
        setSelectedLayoutId(layoutId);
    };

    const handleRemoveLayout = (layoutId: string) => {
        if (editingFrame.supportedLayouts.length <= 1) {
            alert('Frame must support at least one layout');
            return;
        }

        setEditingFrame(prev => {
            if (!prev) return null;
            const newLayouts = prev.supportedLayouts.filter(sl => sl.layoutId !== layoutId);
            return {
                ...prev,
                supportedLayouts: newLayouts
            };
        });

        if (selectedLayoutId === layoutId) {
            setSelectedLayoutId(editingFrame.supportedLayouts[0]?.layoutId || null);
        }
    };

    const unsupportedLayouts = layoutOptions.filter(
        lo => !editingFrame.supportedLayouts.some(sl => sl.layoutId === lo.id)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true">
            <div className="relative transform overflow-hidden rounded-lg bg-gray-800 border border-gray-700 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-7xl p-0 h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex items-center justify-between bg-gray-800">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={editingFrame.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className="text-2xl font-bold text-white bg-transparent border-b-2 border-transparent hover:border-gray-600 focus:border-indigo-500 focus:outline-none px-2 py-1"
                            placeholder="Frame Name"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                        >
                            <SaveIcon className="w-4 h-4" />
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar - Layout List */}
                    <div className="w-64 border-r border-gray-700 bg-gray-800 overflow-y-auto custom-scrollbar">
                        <div className="p-4">
                            <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">Supported Layouts</h3>
                            <div className="space-y-2">
                                {editingFrame.supportedLayouts.map((sl) => {
                                    const layoutOpt = layoutOptions.find(l => l.id === sl.layoutId);
                                    return (
                                        <div
                                            key={sl.layoutId}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedLayoutId === sl.layoutId
                                                ? 'bg-indigo-600/20 border-indigo-500'
                                                : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                                                }`}
                                            onClick={() => {
                                                setSelectedLayoutId(sl.layoutId);
                                                setIsEditingPlaceholders(false); // Reset edit mode when switching layouts
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-sm">{layoutOpt?.label || sl.layoutId}</span>
                                                {editingFrame.supportedLayouts.length > 1 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveLayout(sl.layoutId);
                                                        }}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {unsupportedLayouts.length > 0 && (
                                <>
                                    <h3 className="text-sm font-medium text-gray-400 uppercase mb-3 mt-6">Add Layout</h3>
                                    <div className="space-y-2">
                                        {unsupportedLayouts.map((lo) => (
                                            <button
                                                key={lo.id}
                                                onClick={() => handleAddLayout(lo.id)}
                                                className="w-full p-3 rounded-lg border border-dashed border-gray-600 hover:border-indigo-500 hover:bg-indigo-600/10 transition-colors text-left"
                                            >
                                                <span className="text-gray-300 text-sm">{lo.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Main Area - Preview & Controls */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gray-900">
                        {selectedLayout && layoutOption ? (
                            <div className="max-w-full mx-auto h-full flex flex-col">
                                <div className="mb-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-1">{layoutOption.label}</h3>
                                            <p className="text-sm text-gray-400">
                                                {isEditingPlaceholders ? 'Editing placeholder positions' : 'Configure overlay and placeholders'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsEditingPlaceholders(!isEditingPlaceholders)}
                                            className={`px-4 py-2 rounded transition-colors ${isEditingPlaceholders
                                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                }`}
                                        >
                                            {isEditingPlaceholders ? 'Done Editing' : 'Edit Placeholders'}
                                        </button>
                                    </div>
                                </div>

                                {!isEditingPlaceholders && (
                                    /* Overlay Upload */
                                    <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Layout Overlay (PNG)
                                        </label>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                            >
                                                <UploadIcon className="w-4 h-4" />
                                                Upload Overlay
                                            </button>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/png"
                                                onChange={handleOverlayUpload}
                                                className="hidden"
                                            />
                                            {selectedLayout.overlaySrc && (
                                                <span className="text-sm text-gray-400 flex items-center">
                                                    ✓ Overlay set
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Preview or Template Designer */}
                                <div className="flex-1 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                                    {isEditingPlaceholders ? (
                                        <TemplateDesigner
                                            frameSrc={selectedLayout.overlaySrc || editingFrame.thumbnailSrc}
                                            onTemplateConfirm={() => { }} // Not used in embedded mode
                                            embedded={true}
                                            initialPlaceholders={selectedLayout.placeholders}
                                            onPlaceholdersChange={handlePlaceholdersChange}
                                        />
                                    ) : (
                                        <div className="p-6 h-full flex items-center justify-center">
                                            <div className="relative aspect-[2/3] max-w-md bg-gray-900 rounded-lg overflow-hidden">
                                                {selectedLayout.overlaySrc && (
                                                    <img
                                                        src={selectedLayout.overlaySrc}
                                                        alt="Overlay"
                                                        className="absolute inset-0 w-full h-full object-contain"
                                                    />
                                                )}
                                                {/* Placeholder visualization */}
                                                {selectedLayout.placeholders.map((ph, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="absolute border-2 border-dashed border-indigo-400 bg-indigo-500/10"
                                                        style={{
                                                            left: `${ph.x * 100}%`,
                                                            top: `${ph.y * 100}%`,
                                                            width: `${ph.width * 100}%`,
                                                            height: `${ph.height * 100}%`
                                                        }}
                                                    >
                                                        <div className="absolute top-1 left-1 bg-indigo-600 text-white text-xs px-1 rounded">
                                                            {idx + 1}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <p>Select a layout to edit</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FrameEditor;
