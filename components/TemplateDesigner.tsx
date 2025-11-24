
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Placeholder } from '../types';
import {
    AlignLeftIcon, AlignCenterIcon, AlignRightIcon, AlignTopIcon, AlignMiddleIcon, AlignBottomIcon,
    ChevronDownIcon, ChevronUpIcon, CopyIcon, PasteIcon, UndoIcon, RedoIcon,
    DistributeHorizontalIcon, DistributeVerticalIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon,
    SparklesIcon, SaveIcon, TrashIcon, UploadIcon
} from './icons';

interface TemplateDesignerProps {
    frameSrc: string | null;
    onTemplateConfirm: (placeholders: Placeholder[], aspectRatio: string, finalFrameSrc?: string) => void;
    embedded?: boolean; // Flag for embedded mode
    initialPlaceholders?: Placeholder[]; // Starting placeholders for embedded mode
    onPlaceholdersChange?: (placeholders: Placeholder[]) => void; // Callback for live updates
}

type InteractionMode = 'idle' | 'moving' | 'resizing';
type Handle = 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l';
type SnapGuide = { type: 'vertical' | 'horizontal', pos: number };

interface SavedLayout {
    id: string;
    name: string;
    placeholders: Placeholder[];
}

const HANDLE_SIZE = 12;
const MIN_SLOT_SIZE = 0.02; // Minimum 2% of width/height
const SNAP_THRESHOLD_PX = 10; // Snap within 10px

const ASPECT_RATIOS: Record<string, number | null> = {
    'Free': null,
    '1:1 (Square)': 1,
    '3:2 (Landscape)': 3 / 2,
    '2:3 (Portrait)': 2 / 3,
    '4:3 (Standard)': 4 / 3,
    '3:4 (Portrait)': 3 / 4,
    '16:9 (Wide)': 16 / 9,
    '9:16 (Story)': 9 / 16,
    '4:5 (Social Portrait)': 4 / 5,
    '5:4 (Social Landscape)': 5 / 4,
};

const TemplateDesigner: React.FC<TemplateDesignerProps> = ({ frameSrc, onTemplateConfirm, embedded = false, initialPlaceholders, onPlaceholdersChange }) => {
    // State for TWO layouts
    const [layouts, setLayouts] = useState<Placeholder[][]>([[], []]);
    const [activeCanvasIdx, setActiveCanvasIdx] = useState<0 | 1>(0);
    const [exportSelection, setExportSelection] = useState<[boolean, boolean]>([true, false]);

    // State for TWO frames
    const [frames, setFrames] = useState<(string | null)[]>([frameSrc, frameSrc]);
    const frameInputRef = useRef<HTMLInputElement>(null);

    // Saved Layouts State
    const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
    const [layoutName, setLayoutName] = useState('');

    // Derived state for the currently active layout
    const placeholders = layouts[activeCanvasIdx];
    const activeFrameSrc = frames[activeCanvasIdx];

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
    const [activeTab, setActiveTab] = useState<'standard' | 'strips'>('standard');
    const [guides, setGuides] = useState<SnapGuide[]>([]);
    const [clipboard, setClipboard] = useState<Placeholder[]>([]);

    // Undo/Redo History - Now tracks the entire layouts array
    const [history, setHistory] = useState<Placeholder[][][]>([[[], []]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Interaction State
    const interaction = useRef({
        mode: 'idle' as InteractionMode,
        activeHandle: null as Handle | null,
        startNormX: 0,
        startNormY: 0,
        initialPlaceholders: [] as Placeholder[], // Snapshot of placeholders at start of drag
    });

    // Accordion State
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        saved: false,
        add: true,
        properties: true,
        move: true,
    });

    const toggleSection = (key: string) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // --- Load Saved Layouts ---
    useEffect(() => {
        const saved = localStorage.getItem('saved_layouts');
        if (saved) {
            try {
                setSavedLayouts(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved layouts", e);
            }
        }
    }, []);

    // --- History Management ---

    const recordHistory = useCallback((newLayouts: Placeholder[][]) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(newLayouts);
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    // Helper to update the ACTIVE layout and record history
    const updateCurrentPlaceholders = (updater: (prev: Placeholder[]) => Placeholder[], record: boolean = true) => {
        setLayouts(prevLayouts => {
            const currentLayout = prevLayouts[activeCanvasIdx];
            const nextLayout = updater(currentLayout);

            // If no change, return previous state to prevent re-renders
            if (nextLayout === currentLayout) return prevLayouts;

            const newLayouts = [...prevLayouts];
            newLayouts[activeCanvasIdx] = nextLayout;

            if (record) {
                recordHistory(newLayouts);
            }
            return newLayouts;
        });
    };

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setLayouts(history[historyIndex - 1]);
            setSelectedIds([]);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setLayouts(history[historyIndex + 1]);
            setSelectedIds([]);
        }
    };

    const switchCanvas = (idx: 0 | 1) => {
        setActiveCanvasIdx(idx);
        setSelectedIds([]); // Clear selection when switching to avoid confusion
    };

    // Load Frame Image
    useEffect(() => {
        if (activeFrameSrc) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                setFrameImage(img);
                setCanvasDimensions({ width: img.width, height: img.height });
            };
            img.src = activeFrameSrc;
        } else {
            setFrameImage(null);
            setCanvasDimensions({ width: 800, height: 600 }); // Default
        }
    }, [activeFrameSrc]);

    // Initialize from initialPlaceholders in embedded mode
    useEffect(() => {
        if (embedded && initialPlaceholders) {
            setLayouts([[...initialPlaceholders], []]);
        }
    }, [embedded, initialPlaceholders]);

    // Emit placeholder changes in embedded mode
    useEffect(() => {
        if (embedded && onPlaceholdersChange && placeholders.length > 0) {
            onPlaceholdersChange(placeholders);
        }
    }, [embedded, placeholders, onPlaceholdersChange]);

    // Auto-open properties when selecting
    useEffect(() => {
        if (selectedIds.length > 0) {
            setOpenSections(prev => ({ ...prev, properties: true }));
        }
    }, [selectedIds]);

    // --- Save/Load/Delete Actions ---

    const saveLayout = () => {
        if (!layoutName.trim()) return;
        const newLayout: SavedLayout = {
            id: Date.now().toString(),
            name: layoutName.trim(),
            placeholders: layouts[activeCanvasIdx]
        };
        const updated = [...savedLayouts, newLayout];
        setSavedLayouts(updated);
        localStorage.setItem('saved_layouts', JSON.stringify(updated));
        setLayoutName('');
        alert(`Layout "${newLayout.name}" saved!`);
    };

    const loadLayout = (layout: SavedLayout) => {
        // Deep copy to avoid reference issues
        const slots = JSON.parse(JSON.stringify(layout.placeholders));
        updateCurrentPlaceholders(() => slots, true); // Record history
    };

    const deleteLayout = (id: string) => {
        if (window.confirm("Are you sure you want to delete this saved layout?")) {
            const updated = savedLayouts.filter(l => l.id !== id);
            setSavedLayouts(updated);
            localStorage.setItem('saved_layouts', JSON.stringify(updated));
        }
    };

    // --- Actions ---

    const handleFrameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'image/png') {
            const url = URL.createObjectURL(file);
            setFrames(prev => {
                const newFrames = [...prev];
                newFrames[activeCanvasIdx] = url;
                return newFrames;
            });
        }
        e.target.value = '';
    };

    const addPlaceholder = () => {
        const newId = Date.now();
        const w = 0.3;
        const h = 0.3 * (canvasDimensions.width / canvasDimensions.height);

        const newPlaceholder: Placeholder = {
            id: newId,
            x: 0.5 - w / 2,
            y: 0.5 - h / 2,
            width: w,
            height: h,
            aspectRatio: null,
            fit: 'cover',
        };

        updateCurrentPlaceholders(prev => [...prev, newPlaceholder]);
        setSelectedIds([newId]);
    };

    const addPreset = (type: '1x1' | '2x2' | '1over2' | 'strip3' | 'strip4' | 'stripHorizontal') => {
        const margin = 0.05;
        const gap = 0.03;
        const availW = 1 - (margin * 2);
        const availH = 1 - (margin * 2);
        const newSlots: Placeholder[] = [];
        const baseId = Date.now();

        if (type === '1x1') {
            newSlots.push({ id: baseId, x: margin, y: margin, width: availW, height: availH, aspectRatio: null, fit: 'cover' });
        }
        else if (type === '2x2') {
            const w = (availW - gap) / 2;
            const h = (availH - gap) / 2;
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 2; c++) {
                    newSlots.push({ id: baseId + r * 2 + c, x: margin + c * (w + gap), y: margin + r * (h + gap), width: w, height: h, aspectRatio: null, fit: 'cover' });
                }
            }
        }
        else if (type === '1over2') {
            const topH = (availH - gap) * 0.55;
            const botH = (availH - gap) * 0.45;
            const botW = (availW - gap) / 2;
            newSlots.push({ id: baseId, x: margin, y: margin, width: availW, height: topH, aspectRatio: null, fit: 'cover' });
            newSlots.push({ id: baseId + 1, x: margin, y: margin + topH + gap, width: botW, height: botH, aspectRatio: null, fit: 'cover' });
            newSlots.push({ id: baseId + 2, x: margin + botW + gap, y: margin + topH + gap, width: botW, height: botH, aspectRatio: null, fit: 'cover' });
        }
        else if (type === 'strip3') {
            const h = (availH - (gap * 2)) / 3;
            for (let i = 0; i < 3; i++) {
                newSlots.push({ id: baseId + i, x: margin, y: margin + i * (h + gap), width: availW, height: h, aspectRatio: null, fit: 'cover' });
            }
        }
        else if (type === 'strip4') {
            const h = (availH - (gap * 3)) / 4;
            for (let i = 0; i < 4; i++) {
                newSlots.push({ id: baseId + i, x: margin, y: margin + i * (h + gap), width: availW, height: h, aspectRatio: null, fit: 'cover' });
            }
        }
        else if (type === 'stripHorizontal') {
            const w = (availW - (gap * 2)) / 3;
            for (let i = 0; i < 3; i++) {
                newSlots.push({ id: baseId + i, x: margin + i * (w + gap), y: margin, width: w, height: availH, aspectRatio: null, fit: 'cover' });
            }
        }

        updateCurrentPlaceholders(() => newSlots);
        setSelectedIds([]);
    };

    const removeSelected = useCallback(() => {
        if (selectedIds.length > 0) {
            updateCurrentPlaceholders(prev => prev.filter(p => !selectedIds.includes(p.id)));
            setSelectedIds([]);
        }
    }, [selectedIds, activeCanvasIdx]);

    // Copy / Paste
    const copySelected = useCallback(() => {
        // placeholders derived from active layout
        const selected = placeholders.filter(p => selectedIds.includes(p.id));
        if (selected.length > 0) {
            setClipboard(selected);
        }
    }, [placeholders, selectedIds]);

    const paste = useCallback(() => {
        if (clipboard.length === 0) return;
        const offset = 0.02; // small offset
        const newItems = clipboard.map((p, i) => ({
            ...p,
            id: Date.now() + i,
            x: Math.min(1 - p.width, p.x + offset),
            y: Math.min(1 - p.height, p.y + offset),
        }));

        updateCurrentPlaceholders(prev => [...prev, ...newItems]);
        setSelectedIds(newItems.map(p => p.id));
    }, [clipboard, activeCanvasIdx]);


    // Nudge
    const nudgeSelected = useCallback((dxPx: number, dyPx: number) => {
        const dx = dxPx / canvasDimensions.width;
        const dy = dyPx / canvasDimensions.height;

        updateCurrentPlaceholders(prev => prev.map(p => {
            if (selectedIds.includes(p.id)) {
                return {
                    ...p,
                    x: Math.max(0, Math.min(1 - p.width, p.x + dx)),
                    y: Math.max(0, Math.min(1 - p.height, p.y + dy))
                };
            }
            return p;
        }));
    }, [selectedIds, canvasDimensions, activeCanvasIdx]);

    // Keyboard Handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tagName = (e.target as HTMLElement).tagName;
            if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                removeSelected();
            }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                copySelected();
            }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                paste();
            }
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
                e.preventDefault();
                redo();
            }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                setSelectedIds(placeholders.map(p => p.id));
            }
            else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                if (e.key === 'ArrowUp') nudgeSelected(0, -step);
                if (e.key === 'ArrowDown') nudgeSelected(0, step);
                if (e.key === 'ArrowLeft') nudgeSelected(-step, 0);
                if (e.key === 'ArrowRight') nudgeSelected(step, 0);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, removeSelected, copySelected, paste, undo, redo, placeholders, nudgeSelected]);


    // --- Modification Helpers ---

    const updateSelected = (updater: (p: Placeholder) => Placeholder) => {
        updateCurrentPlaceholders(prev => prev.map(p => selectedIds.includes(p.id) ? updater(p) : p));
    };

    const updateAspectRatio = (ratioKey: string) => {
        const ratio = ratioKey === 'Free' ? null : ratioKey;

        if (ratio) {
            const [wStr, hStr] = ratio.split(':');
            const targetVal = parseFloat(wStr) / parseFloat(hStr);

            updateSelected(p => {
                const newHeight = (p.width * canvasDimensions.width) / (targetVal * canvasDimensions.height);
                return { ...p, aspectRatio: ratio, height: newHeight };
            });
        } else {
            updateSelected(p => ({ ...p, aspectRatio: null }));
        }
    }

    const alignSelected = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (selectedIds.length === 0) return;
        const selectedItems = placeholders.filter(p => selectedIds.includes(p.id));
        if (selectedItems.length === 0) return;

        const bounds = {
            minX: Math.min(...selectedItems.map(p => p.x)),
            maxX: Math.max(...selectedItems.map(p => p.x + p.width)),
            minY: Math.min(...selectedItems.map(p => p.y)),
            maxY: Math.max(...selectedItems.map(p => p.y + p.height)),
        };

        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const target = selectedItems.length === 1 ? 'canvas' : 'selection';

        updateCurrentPlaceholders(prev => prev.map(p => {
            if (!selectedIds.includes(p.id)) return p;
            let newX = p.x;
            let newY = p.y;

            if (target === 'canvas') {
                if (alignment === 'left') newX = 0;
                if (alignment === 'center') newX = 0.5 - p.width / 2;
                if (alignment === 'right') newX = 1 - p.width;
                if (alignment === 'top') newY = 0;
                if (alignment === 'middle') newY = 0.5 - p.height / 2;
                if (alignment === 'bottom') newY = 1 - p.height;
            } else {
                if (alignment === 'left') newX = bounds.minX;
                if (alignment === 'center') newX = centerX - p.width / 2;
                if (alignment === 'right') newX = bounds.maxX - p.width;
                if (alignment === 'top') newY = bounds.minY;
                if (alignment === 'middle') newY = centerY - p.height / 2;
                if (alignment === 'bottom') newY = bounds.maxY - p.height;
            }
            return { ...p, x: newX, y: newY };
        }));
    };

    const distributeSelected = (axis: 'horizontal' | 'vertical') => {
        if (selectedIds.length < 3) return;

        const selectedItems = placeholders.filter(p => selectedIds.includes(p.id));
        // Sort items by position
        selectedItems.sort((a, b) => axis === 'horizontal' ? a.x - b.x : a.y - b.y);

        const first = selectedItems[0];
        const last = selectedItems[selectedItems.length - 1];

        if (axis === 'horizontal') {
            const innerItems = selectedItems.slice(1, -1);
            const innerWidths = innerItems.reduce((sum, p) => sum + p.width, 0);

            const startEdge = first.x + first.width;
            const endEdge = last.x;
            const totalGap = endEdge - startEdge - innerWidths;
            const gap = totalGap / (selectedItems.length - 1);

            let currentX = startEdge + gap;

            const updates = new Map<number, number>();
            innerItems.forEach(p => {
                updates.set(p.id, currentX);
                currentX += p.width + gap;
            });

            updateCurrentPlaceholders(prev => prev.map(p => updates.has(p.id) ? { ...p, x: updates.get(p.id)! } : p));

        } else {
            const innerItems = selectedItems.slice(1, -1);
            const innerHeights = innerItems.reduce((sum, p) => sum + p.height, 0);

            const startEdge = first.y + first.height;
            const endEdge = last.y;
            const totalGap = endEdge - startEdge - innerHeights;
            const gap = totalGap / (selectedItems.length - 1);

            let currentY = startEdge + gap;

            const updates = new Map<number, number>();
            innerItems.forEach(p => {
                updates.set(p.id, currentY);
                currentY += p.height + gap;
            });

            updateCurrentPlaceholders(prev => prev.map(p => updates.has(p.id) ? { ...p, y: updates.get(p.id)! } : p));
        }
    };

    const autoArrangeSelected = useCallback(() => {
        if (selectedIds.length < 2) return;

        const selectedItems = placeholders.filter(p => selectedIds.includes(p.id));

        // Determine layout orientation
        const minX = Math.min(...selectedItems.map(p => p.x));
        const maxX = Math.max(...selectedItems.map(p => p.x + p.width));
        const minY = Math.min(...selectedItems.map(p => p.y));
        const maxY = Math.max(...selectedItems.map(p => p.y + p.height));

        const spreadX = maxX - minX;
        const spreadY = maxY - minY;

        const isHorizontal = spreadX > spreadY;

        // Calculate target centers
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;

        // Sort items
        const sortedItems = [...selectedItems].sort((a, b) => isHorizontal ? a.x - b.x : a.y - b.y);

        // Distribute Logic
        const updates = new Map<number, { x: number, y: number }>();

        if (isHorizontal) {
            // Horizontal Distribution + Vertical Alignment (Middle)
            if (selectedItems.length > 2) {
                const first = sortedItems[0];
                const last = sortedItems[sortedItems.length - 1];
                const innerWidths = sortedItems.slice(1, -1).reduce((sum, p) => sum + p.width, 0);
                const totalGap = (last.x) - (first.x + first.width) - innerWidths;
                const gap = totalGap / (selectedItems.length - 1);

                let currentX = first.x + first.width + gap;

                updates.set(first.id, { x: first.x, y: avgY - first.height / 2 });

                for (let i = 1; i < sortedItems.length - 1; i++) {
                    const item = sortedItems[i];
                    updates.set(item.id, { x: currentX, y: avgY - item.height / 2 });
                    currentX += item.width + gap;
                }

                updates.set(last.id, { x: last.x, y: avgY - last.height / 2 });
            } else {
                sortedItems.forEach(p => updates.set(p.id, { x: p.x, y: avgY - p.height / 2 }));
            }
        } else {
            // Vertical Distribution + Horizontal Alignment (Center)
            if (selectedItems.length > 2) {
                const first = sortedItems[0];
                const last = sortedItems[sortedItems.length - 1];
                const innerHeights = sortedItems.slice(1, -1).reduce((sum, p) => sum + p.height, 0);
                const totalGap = (last.y) - (first.y + first.height) - innerHeights;
                const gap = totalGap / (selectedItems.length - 1);

                let currentY = first.y + first.height + gap;

                updates.set(first.id, { x: avgX - first.width / 2, y: first.y });

                for (let i = 1; i < sortedItems.length - 1; i++) {
                    const item = sortedItems[i];
                    updates.set(item.id, { x: avgX - item.width / 2, y: currentY });
                    currentY += item.height + gap;
                }

                updates.set(last.id, { x: avgX - last.width / 2, y: last.y });
            } else {
                sortedItems.forEach(p => updates.set(p.id, { x: avgX - p.width / 2, y: p.y }));
            }
        }

        updateCurrentPlaceholders(prev => prev.map(p => {
            const up = updates.get(p.id);
            return up ? { ...p, x: up.x, y: up.y } : p;
        }));

    }, [selectedIds, placeholders, activeCanvasIdx]);


    // --- Rendering ---

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !frameImage) return;

        const primaryRgb = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim() || '139, 92, 246';

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw placeholders for the ACTIVE Layout
        placeholders.forEach(p => {
            const x = p.x * canvas.width;
            const y = p.y * canvas.height;
            const w = p.width * canvas.width;
            const h = p.height * canvas.height;
            const isSelected = selectedIds.includes(p.id);

            ctx.clearRect(x, y, w, h);
            // Simplified redraw of frame inside slot
            ctx.drawImage(frameImage, x * (frameImage.width / canvas.width), y * (frameImage.height / canvas.height), w * (frameImage.width / canvas.width), h * (frameImage.height / canvas.height), x, y, w, h);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(x, y, w, h);
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeStyle = isSelected ? 'white' : `rgba(${primaryRgb}, 0.8)`;
            ctx.strokeRect(x, y, w, h);

            if (isSelected && selectedIds.length === 1) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const effHandleSize = HANDLE_SIZE * scaleX;

                const handles: Record<Handle, { x: number, y: number }> = {
                    tl: { x: x, y: y }, tr: { x: x + w, y: y },
                    br: { x: x + w, y: y + h }, bl: { x: x, y: y + h },
                    t: { x: x + w / 2, y: y }, r: { x: x + w, y: y + h / 2 },
                    b: { x: x + w / 2, y: y + h }, l: { x: x, y: y + h / 2 },
                };

                ctx.fillStyle = 'white';
                ctx.strokeStyle = `rgba(${primaryRgb}, 1)`;
                ctx.lineWidth = 2;

                (Object.keys(handles) as Handle[]).forEach(key => {
                    const pos = handles[key];
                    ctx.beginPath();
                    if (['tl', 'tr', 'bl', 'br'].includes(key)) {
                        ctx.fillRect(pos.x - effHandleSize / 2, pos.y - effHandleSize / 2, effHandleSize, effHandleSize);
                        ctx.strokeRect(pos.x - effHandleSize / 2, pos.y - effHandleSize / 2, effHandleSize, effHandleSize);
                    } else {
                        ctx.arc(pos.x, pos.y, effHandleSize / 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                });
            }
        });

        // Draw Guides
        if (guides.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            guides.forEach(g => {
                if (g.type === 'vertical') {
                    const x = g.pos * canvas.width;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, canvas.height);
                } else {
                    const y = g.pos * canvas.height;
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                }
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }, [frameImage, placeholders, selectedIds, guides]);

    useEffect(() => {
        let animId: number;
        const render = () => { draw(); animId = requestAnimationFrame(render); };
        render();
        return () => cancelAnimationFrame(animId);
    }, [draw]);


    // --- Mouse Interaction ---

    const getNormPos = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const { x, y } = getNormPos(e);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const tolX = (HANDLE_SIZE / 2) / rect.width * 2;
        const tolY = (HANDLE_SIZE / 2) / rect.height * 2;

        if (selectedIds.length === 1) {
            const p = placeholders.find(item => item.id === selectedIds[0]);
            if (p) {
                const handles: Record<Handle, { x: number, y: number }> = {
                    tl: { x: p.x, y: p.y }, tr: { x: p.x + p.width, y: p.y },
                    br: { x: p.x + p.width, y: p.y + p.height }, bl: { x: p.x, y: p.y + p.height },
                    t: { x: p.x + p.width / 2, y: p.y }, r: { x: p.x + p.width, y: p.y + p.height / 2 },
                    b: { x: p.x + p.width / 2, y: p.y + p.height }, l: { x: p.x, y: p.y + p.height / 2 },
                };

                for (const [key, pos] of Object.entries(handles)) {
                    if (Math.abs(x - pos.x) < tolX && Math.abs(y - pos.y) < tolY) {
                        interaction.current = {
                            mode: 'resizing',
                            activeHandle: key as Handle,
                            startNormX: x,
                            startNormY: y,
                            initialPlaceholders: JSON.parse(JSON.stringify(placeholders)),
                        };
                        return;
                    }
                }
            }
        }

        for (let i = placeholders.length - 1; i >= 0; i--) {
            const p = placeholders[i];
            if (x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height) {
                const isSelected = selectedIds.includes(p.id);
                if (e.shiftKey) {
                    if (isSelected) setSelectedIds(prev => prev.filter(id => id !== p.id));
                    else setSelectedIds(prev => [...prev, p.id]);
                } else {
                    if (!isSelected) setSelectedIds([p.id]);
                }
                interaction.current = {
                    mode: 'moving',
                    activeHandle: null,
                    startNormX: x,
                    startNormY: y,
                    initialPlaceholders: JSON.parse(JSON.stringify(placeholders)),
                };
                return;
            }
        }
        if (!e.shiftKey) setSelectedIds([]);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const { x, y } = getNormPos(e);
        const mode = interaction.current.mode;

        if (mode === 'idle') return;

        let dx = x - interaction.current.startNormX;
        let dy = y - interaction.current.startNormY;

        // Prepare snap lines from other placeholders AND canvas boundaries (0, 0.5, 1)
        const others = interaction.current.initialPlaceholders.filter(p => !selectedIds.includes(p.id));
        const vLines = [0, 0.5, 1, ...others.flatMap(p => [p.x, p.x + p.width, p.x + p.width / 2])];
        const hLines = [0, 0.5, 1, ...others.flatMap(p => [p.y, p.y + p.height, p.y + p.height / 2])];

        const threshX = SNAP_THRESHOLD_PX / canvasDimensions.width;
        const threshY = SNAP_THRESHOLD_PX / canvasDimensions.height;

        const newGuides: SnapGuide[] = [];

        if (mode === 'moving') {
            const selectedInitials = interaction.current.initialPlaceholders.filter(p => selectedIds.includes(p.id));

            if (selectedInitials.length > 0) {
                const minX = Math.min(...selectedInitials.map(p => p.x));
                const maxX = Math.max(...selectedInitials.map(p => p.x + p.width));
                const minY = Math.min(...selectedInitials.map(p => p.y));
                const maxY = Math.max(...selectedInitials.map(p => p.y + p.height));

                // Edges to test: Left, Right, Center
                const testX = [minX + dx, maxX + dx, (minX + maxX) / 2 + dx];
                const testY = [minY + dy, maxY + dy, (minY + maxY) / 2 + dy];

                let bestDx = dx;
                let minDiffX = threshX;
                let snappedLineX: number | null = null;

                // Iterate lines for X snap
                vLines.forEach(line => {
                    // Check L
                    if (Math.abs(testX[0] - line) < minDiffX) { minDiffX = Math.abs(testX[0] - line); bestDx = line - minX; snappedLineX = line; }
                    // Check R
                    if (Math.abs(testX[1] - line) < minDiffX) { minDiffX = Math.abs(testX[1] - line); bestDx = line - maxX; snappedLineX = line; }
                    // Check Center
                    if (Math.abs(testX[2] - line) < minDiffX) { minDiffX = Math.abs(testX[2] - line); bestDx = line - (minX + maxX) / 2; snappedLineX = line; }
                });

                let bestDy = dy;
                let minDiffY = threshY;
                let snappedLineY: number | null = null;

                hLines.forEach(line => {
                    // Check T
                    if (Math.abs(testY[0] - line) < minDiffY) { minDiffY = Math.abs(testY[0] - line); bestDy = line - minY; snappedLineY = line; }
                    // Check B
                    if (Math.abs(testY[1] - line) < minDiffY) { minDiffY = Math.abs(testY[1] - line); bestDy = line - maxY; snappedLineY = line; }
                    // Check Center
                    if (Math.abs(testY[2] - line) < minDiffY) { minDiffY = Math.abs(testY[2] - line); bestDy = line - (minY + maxY) / 2; snappedLineY = line; }
                });

                if (snappedLineX !== null) newGuides.push({ type: 'vertical', pos: snappedLineX });
                if (snappedLineY !== null) newGuides.push({ type: 'horizontal', pos: snappedLineY });

                dx = bestDx;
                dy = bestDy;

                updateCurrentPlaceholders(prev => prev.map(p => {
                    if (!selectedIds.includes(p.id)) return p;
                    const init = interaction.current.initialPlaceholders.find(ip => ip.id === p.id);
                    if (!init) return p;
                    return {
                        ...p,
                        x: init.x + dx,
                        y: init.y + dy
                    };
                }), false);
            }
        }
        else if (mode === 'resizing' && selectedIds.length === 1) {
            const init = interaction.current.initialPlaceholders.find(p => p.id === selectedIds[0]);
            if (!init) return;
            const handle = interaction.current.activeHandle;
            if (!handle) return;

            // --- Snapping for Resizing ---

            let bestDx = dx;
            let bestDy = dy;
            let snappedLineX: number | null = null;
            let snappedLineY: number | null = null;

            const initCenterX = init.x + init.width / 2;
            const initCenterY = init.y + init.height / 2;

            // Snap X
            if (handle.includes('l') || handle.includes('r')) {
                let minDiff = threshX;
                vLines.forEach(line => {
                    // Edge Snapping
                    if (handle.includes('l')) {
                        const currentL = init.x + dx;
                        if (Math.abs(currentL - line) < minDiff) {
                            minDiff = Math.abs(currentL - line);
                            bestDx = line - init.x;
                            snappedLineX = line;
                        }
                    }
                    if (handle.includes('r')) {
                        const currentR = init.x + init.width + dx;
                        if (Math.abs(currentR - line) < minDiff) {
                            minDiff = Math.abs(currentR - line);
                            bestDx = line - (init.x + init.width);
                            snappedLineX = line;
                        }
                    }

                    // Center Snapping
                    const currentCenter = initCenterX + dx / 2;
                    if (Math.abs(currentCenter - line) < minDiff) {
                        minDiff = Math.abs(currentCenter - line);
                        bestDx = 2 * (line - initCenterX);
                        snappedLineX = line;
                    }
                });
            }

            // Snap Y
            if (handle.includes('t') || handle.includes('b')) {
                let minDiff = threshY;
                hLines.forEach(line => {
                    // Edge Snapping
                    if (handle.includes('t')) {
                        const currentT = init.y + dy;
                        if (Math.abs(currentT - line) < minDiff) {
                            minDiff = Math.abs(currentT - line);
                            bestDy = line - init.y;
                            snappedLineY = line;
                        }
                    }
                    if (handle.includes('b')) {
                        const currentB = init.y + init.height + dy;
                        if (Math.abs(currentB - line) < minDiff) {
                            minDiff = Math.abs(currentB - line);
                            bestDy = line - (init.y + init.height);
                            snappedLineY = line;
                        }
                    }

                    // Center Snapping
                    const currentCenter = initCenterY + dy / 2;
                    if (Math.abs(currentCenter - line) < minDiff) {
                        minDiff = Math.abs(currentCenter - line);
                        bestDy = 2 * (line - initCenterY);
                        snappedLineY = line;
                    }
                });
            }

            if (snappedLineX !== null) newGuides.push({ type: 'vertical', pos: snappedLineX });
            if (snappedLineY !== null) newGuides.push({ type: 'horizontal', pos: snappedLineY });

            dx = bestDx;
            dy = bestDy;

            let newX = init.x;
            let newY = init.y;
            let newW = init.width;
            let newH = init.height;

            // Raw Resize Calculation with Snapped Delta
            if (handle.includes('r')) newW = Math.max(MIN_SLOT_SIZE, init.width + dx);
            if (handle.includes('l')) {
                const delta = Math.min(init.width - MIN_SLOT_SIZE, dx);
                newX = init.x + delta;
                newW = init.width - delta;
            }
            if (handle.includes('b')) newH = Math.max(MIN_SLOT_SIZE, init.height + dy);
            if (handle.includes('t')) {
                const delta = Math.min(init.height - MIN_SLOT_SIZE, dy);
                newY = init.y + delta;
                newH = init.height - delta;
            }

            // Apply Aspect Ratio Lock
            if (init.aspectRatio) {
                const [rw, rh] = init.aspectRatio.split(':').map(s => parseFloat(s));
                const targetRatio = rw / rh;

                if (handle === 't' || handle === 'b') {
                    // Vertical dominance (top/bottom handle) -> adjust width
                    newW = (newH * targetRatio * canvasDimensions.height) / canvasDimensions.width;
                } else {
                    // Horizontal dominance (side or corner handle) -> adjust height
                    newH = (newW * canvasDimensions.width) / (targetRatio * canvasDimensions.height);

                    // If pulling top corners, we must adjust Y to keep bottom anchor stationary
                    if (handle.includes('t')) {
                        newY = (init.y + init.height) - newH;
                    }
                }
            }

            updateCurrentPlaceholders(prev => prev.map(p => p.id === init.id ? { ...p, x: newX, y: newY, width: newW, height: newH } : p), false);
        }

        setGuides(newGuides);
    };

    const handleMouseUp = () => {
        if (interaction.current.mode !== 'idle') {
            // Check if actually changed to avoid dup history
            const hasChanged = JSON.stringify(placeholders) !== JSON.stringify(interaction.current.initialPlaceholders);
            if (hasChanged) {
                // Record history manually since we disabled it during drag
                // We need to pass the current state of layouts to history
                const newLayouts = [...layouts]; // layouts already updated by setLayouts in updateCurrentPlaceholders
                recordHistory(newLayouts);
            }
        }
        interaction.current.mode = 'idle';
        setGuides([]);
    };

    const handleConfirm = async () => {
        const useA = exportSelection[0];
        const useB = exportSelection[1];

        if (!useA && !useB) {
            alert("Please select at least one template to use.");
            return;
        }

        if (useA && !useB) {
            const ratio = `${canvasDimensions.width} / ${canvasDimensions.height}`; // Assuming last active matches logic, or we should get frame A dim
            onTemplateConfirm(layouts[0], ratio, frames[0] || undefined);
            return;
        }

        if (!useA && useB) {
            // Need frame B dimensions if active is A. But active canvas swaps dims.
            // We can assume we swap to B to get dims or reload image B.
            // For simplicity, assuming user has previewed B, we load B img
            const img = new Image();
            img.src = frames[1]!;
            await img.decode();
            const ratio = `${img.width} / ${img.height}`;
            onTemplateConfirm(layouts[1], ratio, frames[1]!);
            return;
        }

        if (useA && useB) {
            if (!frames[0] || !frames[1]) {
                alert("Both templates must have frames to merge.");
                return;
            }
            // Merge Strategy
            const imgA = new Image(); imgA.crossOrigin = "anonymous"; imgA.src = frames[0]!;
            const imgB = new Image(); imgB.crossOrigin = "anonymous"; imgB.src = frames[1]!;

            await Promise.all([imgA.decode(), imgB.decode()]);

            const canvas = document.createElement('canvas');
            const width = imgA.width + imgB.width;
            const height = Math.max(imgA.height, imgB.height);
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Draw side by side
            ctx.drawImage(imgA, 0, 0);
            ctx.drawImage(imgB, imgA.width, 0);

            const mergedFrameSrc = canvas.toDataURL('image/png');

            // Map placeholders
            // Template A: x (0..1 relative to A) -> x * A.width / TotalWidth
            // Template B: x (0..1 relative to B) -> (A.width + x * B.width) / TotalWidth

            const finalPlaceholders: Placeholder[] = [];

            // Add A
            layouts[0].forEach(p => {
                finalPlaceholders.push({
                    ...p,
                    x: (p.x * imgA.width) / width,
                    y: (p.y * imgA.height) / height, // y is top aligned in merge
                    width: (p.width * imgA.width) / width,
                    height: (p.height * imgA.height) / height
                });
            });

            // Add B
            layouts[1].forEach(p => {
                finalPlaceholders.push({
                    ...p,
                    id: p.id + 10000, // Avoid ID collision
                    x: (imgA.width + p.x * imgB.width) / width,
                    y: (p.y * imgB.height) / height,
                    width: (p.width * imgB.width) / width,
                    height: (p.height * imgB.height) / height
                });
            });

            const ratio = `${width} / ${height}`;
            onTemplateConfirm(finalPlaceholders, ratio, mergedFrameSrc);
        }
    };

    const hasSelection = selectedIds.length > 0;
    const firstSelected = hasSelection ? placeholders.find(p => p.id === selectedIds[0]) : null;
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 p-4 lg:h-[calc(100vh-8rem)]">

            {/* Canvas Area */}
            <div className="flex-grow flex flex-col bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg overflow-hidden shadow-xl min-h-[500px] lg:min-h-0">

                {/* Canvas Switcher Tabs */}
                <div className="flex bg-[var(--color-background)] border-b border-[var(--color-border)]">
                    <button
                        onClick={() => switchCanvas(0)}
                        className={`px-6 py-3 text-sm font-bold flex-1 border-b-2 transition-colors ${activeCanvasIdx === 0 ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-panel)]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        Template A {layouts[0].length > 0 ? `(${layouts[0].length})` : ''}
                    </button>
                    <div className="w-px bg-[var(--color-border)]"></div>
                    <button
                        onClick={() => switchCanvas(1)}
                        className={`px-6 py-3 text-sm font-bold flex-1 border-b-2 transition-colors ${activeCanvasIdx === 1 ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-panel)]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        Template B {layouts[1].length > 0 ? `(${layouts[1].length})` : ''}
                    </button>
                </div>

                <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/20">
                    <span className="text-xs font-mono opacity-60">Frame: {canvasDimensions.width}x{canvasDimensions.height}px</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => frameInputRef.current?.click()} className="px-2 py-1 rounded bg-gray-700 text-xs hover:bg-gray-600 flex items-center gap-1">
                            <UploadIcon className="w-3 h-3" /> Change Frame
                        </button>
                        <input type="file" ref={frameInputRef} onChange={handleFrameChange} accept="image/png" className="hidden" />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={copySelected} disabled={!hasSelection} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" title="Copy (Ctrl+C)"><CopyIcon className="w-4 h-4" /></button>
                        <button onClick={paste} disabled={clipboard.length === 0} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" title="Paste (Ctrl+V)"><PasteIcon className="w-4 h-4" /></button>
                        <div className="w-px h-4 bg-gray-600 mx-1"></div>
                        <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" title="Undo (Ctrl+Z)"><UndoIcon className="w-4 h-4" /></button>
                        <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" title="Redo (Ctrl+Shift+Z)"><RedoIcon className="w-4 h-4" /></button>
                    </div>
                </div>

                <div
                    className="flex-grow relative bg-[var(--color-background)] flex items-center justify-center overflow-hidden p-8"
                    ref={containerRef}
                >
                    <canvas
                        ref={canvasRef}
                        width={canvasDimensions.width}
                        height={canvasDimensions.height}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                            cursor: interaction.current.mode === 'idle' ? 'default' : 'grabbing'
                        }}
                    />
                </div>

                <div className="h-8 flex items-center justify-center px-4 border-t border-[var(--color-border)] bg-[var(--color-background)]/40 text-[10px] uppercase tracking-wider font-bold opacity-60">
                    Drag to move • Drag Handles to Resize • Shift+Click to Multi-Select • Delete to Remove
                </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4 lg:h-full h-auto">
                <h2 className="text-lg font-bold text-[var(--color-primary)] px-1 flex-shrink-0">Layout Designer</h2>

                {/* Scrollable Content Area */}
                <div className="flex-grow overflow-y-auto space-y-4 pr-1">

                    {/* Saved Layouts Section */}
                    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                        <button onClick={() => toggleSection('saved')} className="w-full px-4 py-3 flex justify-between items-center bg-[var(--color-background)]/10 hover:bg-[var(--color-background)]/30">
                            <span className="font-medium text-sm">Saved Layouts</span>
                            {openSections['saved'] ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </button>
                        {openSections['saved'] && (
                            <div className="p-4 border-t border-[var(--color-border)] space-y-4">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={layoutName}
                                        onChange={(e) => setLayoutName(e.target.value)}
                                        placeholder="Layout Name"
                                        className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                                    />
                                    <button
                                        onClick={saveLayout}
                                        disabled={!layoutName.trim() || placeholders.length === 0}
                                        className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Save Current Layout"
                                    >
                                        <SaveIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {savedLayouts.length === 0 ? (
                                    <p className="text-xs text-gray-500 text-center py-2">No saved layouts yet.</p>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {savedLayouts.map(layout => (
                                            <div key={layout.id} className="flex items-center justify-between bg-[var(--color-background)]/30 p-2 rounded border border-[var(--color-border)] group">
                                                <button onClick={() => loadLayout(layout)} className="text-sm text-left flex-1 truncate hover:text-[var(--color-primary)]" title="Click to Load">
                                                    {layout.name} <span className="text-xs opacity-50 ml-1">({layout.placeholders.length} slots)</span>
                                                </button>
                                                <button onClick={() => deleteLayout(layout.id)} className="p-1 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Add Section */}
                    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                        <button onClick={() => toggleSection('add')} className="w-full px-4 py-3 flex justify-between items-center bg-[var(--color-background)]/10 hover:bg-[var(--color-background)]/30">
                            <span className="font-medium text-sm">Add Slots</span>
                            {openSections['add'] ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </button>
                        {openSections['add'] && (
                            <div className="border-t border-[var(--color-border)]">
                                <div className="flex border-b border-[var(--color-border)]">
                                    <button
                                        onClick={() => setActiveTab('standard')}
                                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'standard' ? 'bg-[var(--color-background)]/50 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                    >
                                        Standard
                                    </button>
                                    <div className="w-px bg-[var(--color-border)]"></div>
                                    <button
                                        onClick={() => setActiveTab('strips')}
                                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === 'strips' ? 'bg-[var(--color-background)]/50 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                    >
                                        Strips
                                    </button>
                                </div>

                                <div className="p-4 space-y-3">
                                    <button onClick={addPlaceholder} className="w-full py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium shadow-sm flex items-center justify-center gap-2 mb-2">
                                        <span>+</span> Add Freeform Slot
                                    </button>

                                    {activeTab === 'standard' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => addPreset('1x1')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs border border-gray-600">1 Full Photo</button>
                                            <button onClick={() => addPreset('2x2')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs border border-gray-600">2x2 Grid</button>
                                            <button onClick={() => addPreset('1over2')} className="col-span-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs border border-gray-600">One over Two (Classic)</button>
                                        </div>
                                    )}

                                    {activeTab === 'strips' && (
                                        <div className="grid grid-cols-1 gap-2">
                                            <button onClick={() => addPreset('strip3')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs border border-gray-600">Vertical Strip (3 Photos)</button>
                                            <button onClick={() => addPreset('strip4')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs border border-gray-600">Vertical Strip (4 Photos)</button>
                                            <button onClick={() => addPreset('stripHorizontal')} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs border border-gray-600">Horizontal Strip (3 Photos)</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Movement/Nudge Section */}
                    <div className={`bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg overflow-hidden transition-all duration-300 ${hasSelection ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                        <button onClick={() => toggleSection('move')} className="w-full px-4 py-3 flex justify-between items-center bg-[var(--color-background)]/10">
                            <span className="font-medium text-sm">Position & Move</span>
                            {openSections['move'] ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </button>
                        {openSections['move'] && (
                            <div className={`p-4 border-t border-[var(--color-border)] flex flex-col items-center ${!hasSelection ? 'pointer-events-none' : ''}`}>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div></div>
                                    <button onClick={() => nudgeSelected(0, -5)} className="p-2 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowUpIcon className="w-4 h-4" /></button>
                                    <div></div>
                                    <button onClick={() => nudgeSelected(-5, 0)} className="p-2 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowLeftIcon className="w-4 h-4" /></button>

                                    <button onClick={autoArrangeSelected} className="p-2 bg-indigo-600 rounded-full hover:bg-indigo-500 flex items-center justify-center shadow-lg text-white" title="Auto Align & Distribute">
                                        <SparklesIcon className="w-4 h-4" />
                                    </button>

                                    <button onClick={() => nudgeSelected(5, 0)} className="p-2 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowRightIcon className="w-4 h-4" /></button>
                                    <div></div>
                                    <button onClick={() => nudgeSelected(0, 5)} className="p-2 bg-gray-700 rounded hover:bg-gray-600 flex items-center justify-center"><ArrowDownIcon className="w-4 h-4" /></button>
                                </div>
                                <div className="flex gap-2 w-full">
                                    <button onClick={() => alignSelected('center')} className="flex-1 text-xs py-1 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700">Center H</button>
                                    <button onClick={() => alignSelected('middle')} className="flex-1 text-xs py-1 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700">Center V</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Properties Section */}
                    <div className={`bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg overflow-hidden transition-all duration-300 ${hasSelection ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                        <button onClick={() => toggleSection('properties')} className="w-full px-4 py-3 flex justify-between items-center bg-[var(--color-background)]/10">
                            <span className="font-medium text-sm">Properties {hasSelection && `(${selectedIds.length})`}</span>
                            {openSections['properties'] ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </button>

                        {openSections['properties'] && (
                            <div className={`p-4 space-y-4 border-t border-[var(--color-border)] ${!hasSelection ? 'pointer-events-none' : ''}`}>
                                {/* Aspect Ratio */}
                                <div>
                                    <label className="block text-xs font-medium opacity-70 mb-2">Aspect Ratio (Lock)</label>
                                    <div className="relative">
                                        <select
                                            value={firstSelected?.aspectRatio || 'Free'}
                                            onChange={(e) => updateAspectRatio(e.target.value)}
                                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-white text-sm rounded-md px-3 py-2 appearance-none focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                                        >
                                            {Object.keys(ASPECT_RATIOS).map(ratio => (
                                                <option key={ratio} value={ratio}>{ratio}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                {/* Alignment */}
                                <div>
                                    <label className="block text-xs font-medium opacity-70 mb-2">Alignment</label>
                                    <div className="flex justify-between gap-1 bg-[var(--color-background)] p-1 rounded-md mb-2">
                                        <button onClick={() => alignSelected('left')} title="Align Left" className="p-1.5 rounded hover:bg-gray-600"><AlignLeftIcon className="w-4 h-4" /></button>
                                        <button onClick={() => alignSelected('center')} title="Align Center" className="p-1.5 rounded hover:bg-gray-600"><AlignCenterIcon className="w-4 h-4" /></button>
                                        <button onClick={() => alignSelected('right')} title="Align Right" className="p-1.5 rounded hover:bg-gray-600"><AlignRightIcon className="w-4 h-4" /></button>
                                        <div className="w-px bg-gray-600 mx-0.5"></div>
                                        <button onClick={() => alignSelected('top')} title="Align Top" className="p-1.5 rounded hover:bg-gray-600"><AlignTopIcon className="w-4 h-4" /></button>
                                        <button onClick={() => alignSelected('middle')} title="Align Middle" className="p-1.5 rounded hover:bg-gray-600"><AlignMiddleIcon className="w-4 h-4" /></button>
                                        <button onClick={() => alignSelected('bottom')} title="Align Bottom" className="p-1.5 rounded hover:bg-gray-600"><AlignBottomIcon className="w-4 h-4" /></button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => distributeSelected('horizontal')} disabled={selectedIds.length < 3} title="Distribute Horizontally" className="flex-1 py-1.5 text-xs bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2">
                                            <DistributeHorizontalIcon className="w-4 h-4" /> Distr. Horiz
                                        </button>
                                        <button onClick={() => distributeSelected('vertical')} disabled={selectedIds.length < 3} title="Distribute Vertically" className="flex-1 py-1.5 text-xs bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center gap-2">
                                            <DistributeVerticalIcon className="w-4 h-4" /> Distr. Vert
                                        </button>
                                    </div>
                                </div>

                                {/* Fit */}
                                <div>
                                    <label className="block text-xs font-medium opacity-70 mb-1">Image Fit</label>
                                    <div className="flex rounded-md overflow-hidden border border-[var(--color-border)]">
                                        <button onClick={() => updateSelected(p => ({ ...p, fit: 'cover' }))} className={`flex-1 py-1.5 text-xs ${firstSelected?.fit !== 'contain' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-background)] hover:bg-gray-700'}`}>Fill (Cover)</button>
                                        <button onClick={() => updateSelected(p => ({ ...p, fit: 'contain' }))} className={`flex-1 py-1.5 text-xs ${firstSelected?.fit === 'contain' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-background)] hover:bg-gray-700'}`}>Fit (Contain)</button>
                                    </div>
                                </div>

                                <button onClick={removeSelected} className="w-full py-2 text-xs text-red-400 border border-red-900/30 bg-red-900/10 hover:bg-red-900/30 rounded-md mt-2 transition-colors">
                                    Remove Selected
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="flex-shrink-0 pt-2">
                    <div className="mb-3 p-3 bg-[var(--color-background)]/30 rounded-lg border border-[var(--color-border)]">
                        <p className="text-xs font-medium mb-2 opacity-80">Use for this session:</p>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" checked={exportSelection[0]} onChange={(e) => setExportSelection([e.target.checked, exportSelection[1]])} className="rounded bg-gray-700 border-gray-600 text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                                Template A
                            </label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" checked={exportSelection[1]} onChange={(e) => setExportSelection([exportSelection[0], e.target.checked])} className="rounded bg-gray-700 border-gray-600 text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                                Template B
                            </label>
                        </div>
                    </div>
                    <button onClick={handleConfirm} disabled={(!exportSelection[0] && !exportSelection[1]) || (exportSelection[0] && layouts[0].length === 0) || (exportSelection[1] && layouts[1].length === 0)} className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-lg shadow-lg filter hover:brightness-110 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform active:scale-95">
                        Confirm Layout
                    </button>
                </div>

            </div>
        </div>
    );
};

export default TemplateDesigner;
