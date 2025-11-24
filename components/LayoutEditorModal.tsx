import React from 'react';
import { LayoutOption, Placeholder } from '../types';
import TemplateDesigner from './TemplateDesigner';
import { XIcon } from './icons';

interface LayoutEditorModalProps {
    layout: LayoutOption | undefined;
    onClose: () => void;
    onSave: (placeholders: Placeholder[]) => void;
}

const LayoutEditorModal: React.FC<LayoutEditorModalProps> = ({
    layout,
    onClose,
    onSave
}) => {
    if (!layout) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" aria-modal="true">
            <div className="relative w-full h-full bg-gray-900 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Edit Layout Placeholders</h2>
                        <p className="text-sm text-gray-400 mt-1">{layout.label}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Close"
                    >
                        <XIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Template Designer */}
                <div className="flex-1 overflow-hidden">
                    <TemplateDesigner
                        frameSrc={null} // No frame for layout editing
                        onTemplateConfirm={() => { }} // Not used in embedded mode
                        embedded={true}
                        initialPlaceholders={layout.placeholders}
                        onPlaceholdersChange={onSave}
                    />
                </div>

                {/* Footer with instructions */}
                <div className="p-4 border-t border-gray-700 bg-gray-800">
                    <p className="text-sm text-gray-400 text-center">
                        💡 Drag and resize placeholders to customize this layout. Changes are saved automatically.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LayoutEditorModal;
