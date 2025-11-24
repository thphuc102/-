import React, { useState } from 'react';
import { FrameConfig, LayoutOption } from '../../types';
import { PlusIcon, EditIcon, EyeIcon, EyeOffIcon } from '../icons';

interface FrameManagerProps {
    isOpen: boolean;
    onClose: () => void;
    frames: FrameConfig[];
    layoutOptions: LayoutOption[];
    onFramesChange: (frames: FrameConfig[]) => void;
    onEditFrame: (frameId: string) => void;
}

const FrameManager: React.FC<FrameManagerProps> = ({
    isOpen,
    onClose,
    frames,
    layoutOptions,
    onFramesChange,
    onEditFrame
}) => {
    if (!isOpen) return null;

    const handleToggleVisibility = (frameId: string) => {
        const updatedFrames = frames.map(f =>
            f.id === frameId ? { ...f, isVisible: !f.isVisible } : f
        );
        onFramesChange(updatedFrames);
    };

    const handleDeleteFrame = (frameId: string) => {
        if (confirm('Are you sure you want to delete this frame?')) {
            const updatedFrames = frames.filter(f => f.id !== frameId);
            onFramesChange(updatedFrames);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true">
            <div className="relative transform overflow-hidden rounded-lg bg-gray-800 border border-gray-700 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl p-0 h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex items-center justify-between bg-gray-800">
                    <h2 className="text-2xl font-bold text-white">Frame Manager</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-900">
                    {frames.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <p className="text-lg mb-4">No frames yet</p>
                            <p className="text-sm">Upload a frame from the main setup flow to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {frames.map((frame) => (
                                <div
                                    key={frame.id}
                                    className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-indigo-500 transition-colors"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative aspect-[2/3] bg-gray-900">
                                        <img
                                            src={frame.thumbnailSrc}
                                            alt={frame.name}
                                            className="w-full h-full object-contain"
                                        />
                                        {!frame.isVisible && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <EyeOffIcon className="w-12 h-12 text-gray-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <h3 className="text-white font-medium mb-2 truncate">{frame.name}</h3>
                                        <p className="text-xs text-gray-400 mb-3">
                                            {frame.supportedLayouts.length} layout{frame.supportedLayouts.length !== 1 ? 's' : ''}
                                        </p>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onEditFrame(frame.id)}
                                                className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleToggleVisibility(frame.id)}
                                                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${frame.isVisible
                                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                title={frame.isVisible ? 'Visible to guests' : 'Hidden from guests'}
                                            >
                                                {frame.isVisible ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFrame(frame.id)}
                                                className="px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FrameManager;
