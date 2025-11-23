import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppSettings, PhotoboothSession, AppStep, Placeholder, Photo, Transform, Crop, UiConfig, GuestScreenMode, StickerLayer, TextLayer, AnalyticsData, GuestAction, InterWindowMessage, DrawingPath, Printer, LayoutOption, ProSettings } from './types';
import FrameUploader from './components/FrameUploader';
import TemplateDesigner from './components/TemplateDesigner';
import PhotoSelector from './components/PhotoSelector';
import FinalizeControls from './components/FinalizeControls';
import CanvasEditor from './components/CanvasEditor';
import StepIndicator from './components/StepIndicator';
import SettingsPanel from './components/SettingsPanel';
import UiCustomizationPanel from './components/UiCustomizationPanel';
import { GoogleGenAI, Modality } from '@google/genai';

import { SettingsIcon, PaletteIcon } from './components/icons';
import { useGuestWindow } from './hooks/useGuestWindow';
import { useHotFolder } from './hooks/useHotFolder';

// Initialize Gemini AI Client.
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
if (!apiKey) {
    console.warn("AI features are disabled: Gemini API key not found in environment variables (process.env.API_KEY).");
}

declare const google: any;
declare const gapi: any;

const createPhotoFromPlaceholder = (src: string, placeholder: Placeholder, canvasSize: { width: number, height: number }, imageSize: { width: number, height: number }): Photo => {
    return {
        src,
        originalWidth: imageSize.width,
        originalHeight: imageSize.height,
        transform: {
            x: placeholder.x + placeholder.width / 2,
            y: placeholder.y + placeholder.height / 2,
            width: placeholder.width,
            height: placeholder.height,
            rotation: 0,
        },
        crop: { x: 0, y: 0, scale: 1 },
        fit: placeholder.fit || 'cover',
    };
};

const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)} ` : '255, 255, 255';
};

const generateDefaultLayouts = (): LayoutOption[] => {
    const baseId = Date.now();
    const margin = 0.05;
    const gap = 0.03;
    const availW = 1 - (margin * 2);
    const availH = 1 - (margin * 2);

    // 1x1
    const single: Placeholder[] = [{ id: baseId, x: margin, y: margin, width: availW, height: availH, aspectRatio: null, fit: 'cover' }];

    // Grid
    const grid: Placeholder[] = [];
    const w = (availW - gap) / 2;
    const h = (availH - gap) / 2;
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            grid.push({ id: baseId + r * 2 + c, x: margin + c * (w + gap), y: margin + r * (h + gap), width: w, height: h, aspectRatio: null, fit: 'cover' });
        }
    }

    // Strip
    const strip: Placeholder[] = [];
    const sh = (availH - (gap * 2)) / 3;
    for (let i = 0; i < 3; i++) {
        strip.push({ id: baseId + i, x: margin, y: margin + i * (sh + gap), width: availW, height: sh, aspectRatio: null, fit: 'cover' });
    }

    return [
        { id: '1x1', label: 'Single Shot', type: 'preset', placeholders: single, isActive: true, iconType: 'single' },
        { id: 'grid', label: '2x2 Grid', type: 'preset', placeholders: grid, isActive: true, iconType: 'grid' },
        { id: 'strip', label: 'Photo Strip', type: 'preset', placeholders: strip, isActive: true, iconType: 'strip' },
        { id: 'custom', label: 'Event Special', type: 'custom', placeholders: [], isActive: true, iconType: 'custom' }
    ];
};

const App: React.FC = () => {
    const [appStep, setAppStep] = useState<AppStep>(AppStep.FRAME_UPLOAD);
    const [settings, setSettings] = useState<AppSettings>({
        frameSrc: null,
        hotFolderHandle: null,
        outputDirectoryHandle: null,
        placeholders: [],
        hotFolderName: '',
        driveFolderId: null,
        driveFolderName: '',
        fileNameTemplate: 'photobooth-{timestamp}-{number}',
        aspectRatio: '2 / 3',
        kioskMode: false,
        pro: {
            enableVending: false,
            pricePerPrint: 5.00,
            currency: '$',
            printerPool: [],
            iccProfileName: null,
            enableSmartCrop: false,
            liveViewLut: ''
        },
        layoutOptions: generateDefaultLayouts()
    });
    const [session, setSession] = useState<PhotoboothSession>({
        isActive: false,
        photos: [],
        stickers: [],
        textLayers: [],
        drawings: [],
        filter: '',
        isPaid: false
    });

    // Analytics State
    const [analytics, setAnalytics] = useState<AnalyticsData>({
        totalSessions: 0,
        totalPhotosTaken: 0,
        totalPrints: 0,
        emailsCollected: [],
        totalRevenue: 0
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isUiPanelOpen, setIsUiPanelOpen] = useState(false);

    const [selectedLayerType, setSelectedLayerType] = useState<'photo' | 'sticker' | 'text' | 'drawing'>('photo');
    const [selectedLayerIndex, setSelectedLayerIndex] = useState(-1);

    const [frameOpacity, setFrameOpacity] = useState(1);
    const [globalPhotoScale, setGlobalPhotoScale] = useState(1);
    const history = useRef<PhotoboothSession[]>([]);
    const historyIndex = useRef(0);
    const fileCounter = useRef(1);

    // AI Edit State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiPreviewImage, setAiPreviewImage] = useState<string | null>(null);
    const [finalCompositeImage, setFinalCompositeImage] = useState<string | null>(null);

    // AI Sticker State
    const [aiStickerPrompt, setAiStickerPrompt] = useState('');
    const [isAiStickerLoading, setIsAiStickerLoading] = useState(false);
    const [aiStickerError, setAiStickerError] = useState<string | null>(null);

    const [availableStickers, setAvailableStickers] = useState<string[]>([
        'https://cdn-icons-png.flaticon.com/512/763/763019.png',
        'https://cdn-icons-png.flaticon.com/512/1216/1216575.png',
        'https://cdn-icons-png.flaticon.com/512/7481/7481377.png',
        'https://cdn-icons-png.flaticon.com/512/2462/2462719.png',
    ]);

    const [gapiAuthInstance, setGapiAuthInstance] = useState<any>(null);
    const [isGapiReady, setIsGapiReady] = useState(false);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
    const tokenClientRef = useRef<any>(null);

    const { guestWindow, openGuestWindow, closeGuestWindow, sendMessage } = useGuestWindow();
    const finalCanvasRef = useRef<HTMLCanvasElement>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);

    const [uiConfig, setUiConfig] = useState<UiConfig>({
        title: 'UIT Media FrameFusion Photobooth',
        description: 'An elegant photobooth experience for your special event.',
        footer: 'Powered by FrameFusion',
        logoSrc: null,
        backgroundSrc: null,
        fontFamily: "'Roboto', sans-serif",
        primaryColor: '#8b5cf6',
        textColor: '#e5e7eb',
        backgroundColor: '#111827',
        panelColor: '#1f2937',
        borderColor: '#374151',
    });

    // Guest Communication Listener
    useEffect(() => {
        const channel = new BroadcastChannel('photobooth_channel');
        channelRef.current = channel;

        const handleGuestAction = (event: MessageEvent<InterWindowMessage>) => {
            if (event.data.type === 'GUEST_ACTION') {
                const action = event.data.payload;
                handleGuestActionDispatch(action);
            }
        };
        channel.addEventListener('message', handleGuestAction);

        return () => {
            channel.removeEventListener('message', handleGuestAction);
            channel.close();
        };
    }, [settings.placeholders, session, settings.layoutOptions]); // Dependency on settings/session for callbacks

    const handleGuestActionDispatch = (action: GuestAction) => {
        switch (action.type) {
            case 'GUEST_START':
                // Reset session and move to Config
                setSession({ isActive: true, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false });
                setAnalytics(prev => ({ ...prev, totalSessions: prev.totalSessions + 1 }));
                sendMessage({ mode: GuestScreenMode.CONFIG_SELECTION, layoutOptions: settings.layoutOptions });
                break;
            case 'GUEST_SELECT_LAYOUT':
                if (action.layout !== 'custom') {
                    applyPresetLayout(action.layout);
                }
                // Move to Photo Upload / Camera
                setAppStep(AppStep.PHOTO_UPLOAD);
                sendMessage({
                    mode: GuestScreenMode.LIVE_PREVIEW,
                    frameSrc: settings.frameSrc,
                    placeholders: settings.placeholders,
                    aspectRatio: settings.aspectRatio,
                    proSettings: settings.pro
                });
                break;
            case 'GUEST_EMAIL':
                if (action.email && !analytics.emailsCollected.includes(action.email)) {
                    setAnalytics(prev => ({ ...prev, emailsCollected: [...prev.emailsCollected, action.email] }));
                }
                break;
            case 'GUEST_PRINT':
                handlePrint();
                break;
            case 'GUEST_ADD_DRAWING':
                const newDrawings = [...session.drawings, action.drawing];
                updateSessionWithHistory({ ...session, drawings: newDrawings });
                break;
            case 'GUEST_SET_FILTER':
                updateSessionWithHistory({ ...session, filter: action.filter });
                break;
            case 'GUEST_PAYMENT_COMPLETE':
                setSession(prev => ({ ...prev, isPaid: true }));
                setAnalytics(prev => ({ ...prev, totalRevenue: prev.totalRevenue + settings.pro.pricePerPrint }));
                handlePrintInternal(); // Proceed to print after payment
                break;
        }
    };

    const applyPresetLayout = (type: string) => {
        if (type === 'custom') return;

        const layout = settings.layoutOptions.find(l => l.id === type);
        if (layout) {
            setSettings(prev => ({ ...prev, placeholders: layout.placeholders }));
        }
    };

    useEffect(() => {
        const gapiScript = document.querySelector<HTMLScriptElement>('script[src="https://apis.google.com/js/api.js"]');
        const gisScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');

        const gapiLoaded = () => {
            gapi.load('client:picker', () => {
                setPickerApiLoaded(true);
            });
        };

        const gisLoaded = () => {
            tokenClientRef.current = google.accounts.oauth2.initTokenClient({
                client_id: process.env.GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.readonly',
                callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        gapi.client.setToken(tokenResponse);
                        setIsSignedIn(true);
                        updateAuthInstance(tokenResponse.access_token);
                    }
                },
            });

            setGapiAuthInstance({
                signIn: () => tokenClientRef.current?.requestAccessToken({ prompt: '' }),
                signOut: () => { },
                currentUser: null,
                clientId: process.env.GOOGLE_CLIENT_ID,
            });

            setIsGapiReady(true);
        };

        const updateAuthInstance = async (accessToken: string) => {
            try {
                await gapi.client.load('drive', 'v3');
                const response = await gapi.client.drive.about.get({ fields: 'user' });
                const userEmail = response.result.user.emailAddress;

                setGapiAuthInstance((prev: any) => ({
                    ...prev,
                    signOut: () => {
                        google.accounts.oauth2.revoke(accessToken, () => {
                            gapi.client.setToken(null);
                            setIsSignedIn(false);
                            setGapiAuthInstance((p: any) => ({ ...p, currentUser: null }));
                        });
                    },
                    currentUser: {
                        get: () => ({
                            getBasicProfile: () => ({ getEmail: () => userEmail }),
                            getAuthResponse: () => ({ access_token: accessToken }),
                        }),
                    },
                }));

            } catch (e) {
                console.error("Error updating auth instance:", e);
            }
        };

        if (gapiScript) gapiScript.onload = gapiLoaded;
        if (gisScript) gisScript.onload = gisLoaded;

    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', uiConfig.primaryColor);
        root.style.setProperty('--color-primary-rgb', hexToRgb(uiConfig.primaryColor));
        root.style.setProperty('--color-text-primary', uiConfig.textColor);
        root.style.setProperty('--color-background', uiConfig.backgroundColor);
        root.style.setProperty('--color-panel', uiConfig.panelColor);
        root.style.setProperty('--color-border', uiConfig.borderColor);
        root.style.fontFamily = uiConfig.fontFamily;
        if (uiConfig.backgroundSrc) {
            root.style.setProperty('--background-image', `url(${uiConfig.backgroundSrc})`);
        } else {
            root.style.setProperty('--background-image', 'none');
        }
    }, [uiConfig]);

    const invalidateAiImage = () => {
        if (finalCompositeImage) {
            setFinalCompositeImage(null);
        }
    };

    const handleNewPhotosFromHotFolder = useCallback(async (newPhotos: Map<string, string>) => {
        if (settings.placeholders.length === 0) return;

        const canvas = finalCanvasRef.current ?? document.createElement('canvas');
        const canvasSize = { width: canvas.width, height: canvas.height };

        const sortedFiles = Array.from(newPhotos.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        const newPhotoObjects: Photo[] = [];
        const existingPhotoCount = session.photos.length;
        let placeholderIndex = existingPhotoCount;

        for (const [_, url] of sortedFiles) {
            if (placeholderIndex >= settings.placeholders.length) break;

            const image = new Image();
            image.src = url;
            await new Promise(resolve => image.onload = resolve);

            const placeholder = settings.placeholders[placeholderIndex];
            const newPhoto = createPhotoFromPlaceholder(url, placeholder, canvasSize, { width: image.width, height: image.height });
            newPhotoObjects.push(newPhoto);
            placeholderIndex++;
        }

        if (newPhotoObjects.length > 0) {
            setSession(prev => {
                const updatedPhotos = [...prev.photos, ...newPhotoObjects];

                const newSessionState = { ...prev, photos: updatedPhotos };
                const newHistory = history.current.slice(0, historyIndex.current + 1);
                newHistory.push(newSessionState);
                history.current = newHistory;
                historyIndex.current = newHistory.length - 1;

                setAnalytics(prev => ({ ...prev, totalPhotosTaken: prev.totalPhotosTaken + newPhotoObjects.length }));

                sendMessage({
                    mode: GuestScreenMode.REVIEW,
                    photos: updatedPhotos,
                    frameSrc: settings.frameSrc,
                    aspectRatio: settings.aspectRatio,
                    stickers: prev.stickers,
                    textLayers: prev.textLayers,
                    drawings: prev.drawings,
                    filter: prev.filter
                });
                return newSessionState;
            });
        }
    }, [session.photos.length, settings.frameSrc, settings.placeholders, settings.aspectRatio, sendMessage]);

    const { startPolling, stopPolling } = useHotFolder(settings.hotFolderHandle, handleNewPhotosFromHotFolder);

    const handleFrameSelect = (frameFile: File) => {
        const url = URL.createObjectURL(frameFile);
        setSettings(s => ({ ...s, frameSrc: url }));
        setAppStep(AppStep.TEMPLATE_DESIGN);
    };

    const handleTemplateConfirm = (placeholders: Placeholder[], aspectRatio: string, finalFrameSrc?: string) => {
        setSettings(s => ({
            ...s,
            placeholders,
            aspectRatio,
            frameSrc: finalFrameSrc || s.frameSrc
        }));
        setAppStep(AppStep.PHOTO_UPLOAD);
    };

    const handlePhotosSelected = async (photoData: { src: string; crop: Crop }[]) => {
        const canvas = finalCanvasRef.current ?? document.createElement('canvas');
        const canvasSize = { width: canvas.width, height: canvas.height };

        const newPhotoObjects: Photo[] = [];
        for (let i = 0; i < photoData.length; i++) {
            const data = photoData[i];
            const placeholder = settings.placeholders[i];
            if (!placeholder) continue;

            const image = new Image();
            image.src = data.src;
            await new Promise(resolve => { image.onload = resolve; });

            const newPhoto = createPhotoFromPlaceholder(data.src, placeholder, canvasSize, { width: image.width, height: image.height });
            newPhoto.crop = data.crop;
            newPhotoObjects.push(newPhoto);
        }

        const newSession: PhotoboothSession = { isActive: true, photos: newPhotoObjects, stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false };
        setSession(newSession);
        history.current = [newSession];
        historyIndex.current = 0;
        setAppStep(AppStep.FINALIZE_AND_EXPORT);
        setAnalytics(prev => ({ ...prev, totalPhotosTaken: prev.totalPhotosTaken + newPhotoObjects.length }));

        // Explicitly send initial state to guest window
        sendMessage({
            mode: GuestScreenMode.REVIEW,
            photos: newPhotoObjects,
            frameSrc: settings.frameSrc,
            aspectRatio: settings.aspectRatio,
            stickers: [],
            textLayers: [],
            drawings: [],
            filter: ''
        });
    };

    const handleUseHotFolder = () => {
        if (!settings.hotFolderHandle) {
            alert("Please select a hot folder in the settings first.");
            setIsSettingsOpen(true);
            return;
        }
        const newSession: PhotoboothSession = { isActive: true, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false };
        setSession(newSession);
        history.current = [newSession];
        historyIndex.current = 0;
        startPolling();
        setAppStep(AppStep.FINALIZE_AND_EXPORT);
        sendMessage({ mode: GuestScreenMode.TETHER_PREVIEW, frameSrc: settings.frameSrc, placeholders: settings.placeholders, aspectRatio: settings.aspectRatio });
    };

    const handleCreateNew = () => {
        stopPolling();
        setSession({ isActive: false, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false });
        setSelectedLayerIndex(-1);
        setFinalCompositeImage(null);
        setAiPreviewImage(null);
        setAiError(null);
        setAiPrompt('');
        setAppStep(AppStep.PHOTO_UPLOAD);
        sendMessage({ mode: GuestScreenMode.ATTRACT, frameSrc: settings.frameSrc });
    };

    const handleResetApp = () => {
        stopPolling();
        setAppStep(AppStep.FRAME_UPLOAD);
        setSettings(s => ({
            ...s,
            frameSrc: null,
            hotFolderHandle: null,
            outputDirectoryHandle: null,
            placeholders: [],
            hotFolderName: '',
            driveFolderId: null,
            driveFolderName: '',
            aspectRatio: '2 / 3',
        }));
        setSession({ isActive: false, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false });
        setSelectedLayerIndex(-1);
        setFinalCompositeImage(null);
    };

    const handleGenerateQRCode = async () => {
        const image = await getImageForExport();
        if (!image) {
            alert("Could not generate final image.");
            return;
        }
        sendMessage({ mode: GuestScreenMode.DELIVERY, qrCodeValue: image, frameSrc: settings.frameSrc });
    };

    const getImageForExport = useCallback(async (): Promise<string | undefined> => {
        if (finalCompositeImage) {
            return finalCompositeImage;
        }
        const canvas = finalCanvasRef.current;
        if (!canvas) return;
        return canvas.toDataURL('image/png');
    }, [finalCompositeImage]);

    const generateFilename = useCallback(() => {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const timestamp = now.getTime();
        const number = String(fileCounter.current).padStart(4, '0');

        const filename = settings.fileNameTemplate
            .replace('{date}', date)
            .replace('{time}', time)
            .replace('{timestamp}', String(timestamp))
            .replace('{number}', number);

        return `${filename}.png`;
    }, [settings.fileNameTemplate]);

    const handleDownload = useCallback(async () => {
        const image = await getImageForExport();
        if (!image) {
            alert("Could not generate final image for download.");
            return;
        }
        const filename = generateFilename();
        if (settings.outputDirectoryHandle) {
            try {
                const res = await fetch(image);
                const blob = await res.blob();
                // @ts-ignore
                const fileHandle = await settings.outputDirectoryHandle.getFileHandle(filename, { create: true });
                // @ts-ignore
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log(`Saved ${filename} to selected folder.`);
            } catch (error) {
                console.error("Error saving to directory handle:", error);
                alert("Failed to save to the selected folder. Downloading via browser instead.");
                const link = document.createElement('a');
                link.href = image;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } else {
            const link = document.createElement('a');
            link.href = image;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        fileCounter.current += 1;
    }, [getImageForExport, generateFilename, settings.outputDirectoryHandle]);

    // Handle Print Logic (Pooling + Vending)
    const handlePrint = useCallback(() => {
        if (settings.pro.enableVending && !session.isPaid) {
            // Trigger payment flow on guest screen
            sendMessage({ mode: GuestScreenMode.PAYMENT, proSettings: settings.pro });
        } else {
            handlePrintInternal();
        }
    }, [settings.pro, session.isPaid, sendMessage]);

    const handlePrintInternal = useCallback(async () => {
        const image = await getImageForExport();
        if (!image) return;
        setAnalytics(prev => ({ ...prev, totalPrints: prev.totalPrints + 1 }));

        // Printer Pooling Logic (Round Robin Mock)
        let printerName = "Default Printer";
        if (settings.pro.printerPool.length > 0) {
            // Pick a printer (simplified round robin simulation)
            const printer = settings.pro.printerPool[analytics.totalPrints % settings.pro.printerPool.length];
            printerName = printer.name;
            // Update printer job count in settings just for display (in real app, this would be backend)
            setSettings(prev => {
                const pool = [...prev.pro.printerPool];
                const pIndex = pool.findIndex(p => p.id === printer.id);
                if (pIndex > -1) pool[pIndex].jobs++;
                return { ...prev, pro: { ...prev.pro, printerPool: pool } };
            });
            console.log(`Printing to Pool: ${printerName} `);
        }

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
    < html >
                    <head><title>Print Job - ${printerName}</title></head>
                    <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh; background-color: #f0f0f0;">
                        <div style="text-align:center;">
                            <img src="${image}" style="max-width:80vw; max-height:80vh; object-fit: contain; box-shadow: 0 0 20px rgba(0,0,0,0.2);" onload="window.print(); window.close();" />
                            <p style="margin-top:20px; font-family:sans-serif; color:#555;">Sent to: <b>${printerName}</b></p>
                        </div>
                    </body>
                </html >
    `);
            printWindow.document.close();
        }

        // If kiosk mode, allow printing then maybe reset? For now just print.
        if (settings.pro.enableVending) {
            // Generate QR code for delivery after print
            handleGenerateQRCode();
        }

    }, [getImageForExport, settings.pro.printerPool, analytics.totalPrints, settings.pro.enableVending]);

    const handleSmartCrop = (index: number) => {
        // Heuristic Smart Crop (Center Weighted with mild zoom)
        // Since we can't reliably load face-api models without external assets, we use a robust heuristic.
        const photo = session.photos[index];
        if (!photo) return;

        invalidateAiImage();

        const newPhotos = [...session.photos];
        // Heuristic: Reset to center (0.5, 0.5) but zoom in slightly (1.2x) to frame "head and shoulders"
        // This assumes typical photobooth usage where subjects are central.
        newPhotos[index] = {
            ...photo,
            crop: {
                x: 0,
                y: 0,
                scale: 1.25 // "Smart" Zoom
            }
        };
        updateSessionWithHistory({ ...session, photos: newPhotos });
    };

    const updateSessionWithHistory = (newSession: PhotoboothSession) => {
        const newHistory = history.current.slice(0, historyIndex.current + 1);
        newHistory.push(newSession);
        history.current = newHistory;
        historyIndex.current = newHistory.length - 1;
        setSession(newSession);
        // Broadcast full state to guest window including stickers and text
        sendMessage({
            mode: GuestScreenMode.REVIEW,
            photos: newSession.photos,
            frameSrc: settings.frameSrc,
            aspectRatio: settings.aspectRatio,
            stickers: newSession.stickers,
            textLayers: newSession.textLayers,
            drawings: newSession.drawings,
            filter: newSession.filter
        });
    };

    const undo = () => {
        if (historyIndex.current > 0) {
            invalidateAiImage();
            historyIndex.current--;
            const prevSession = history.current[historyIndex.current];
            setSession(prevSession);
            sendMessage({
                mode: GuestScreenMode.REVIEW,
                photos: prevSession.photos,
                frameSrc: settings.frameSrc,
                aspectRatio: settings.aspectRatio,
                stickers: prevSession.stickers,
                textLayers: prevSession.textLayers,
                drawings: prevSession.drawings,
                filter: prevSession.filter
            });
        }
    };

    const redo = () => {
        if (historyIndex.current < history.current.length - 1) {
            invalidateAiImage();
            historyIndex.current++;
            const nextSession = history.current[historyIndex.current];
            setSession(nextSession);
            sendMessage({
                mode: GuestScreenMode.REVIEW,
                photos: nextSession.photos,
                frameSrc: settings.frameSrc,
                aspectRatio: settings.aspectRatio,
                stickers: nextSession.stickers,
                textLayers: nextSession.textLayers,
                drawings: nextSession.drawings,
                filter: nextSession.filter
            });
        }
    };

    const handleSelectLayer = (type: 'photo' | 'sticker' | 'text', index: number) => {
        setSelectedLayerType(type);
        setSelectedLayerIndex(index);
    };

    const onPhotoUpdate = (index: number, updates: Partial<Photo>) => {
        invalidateAiImage();
        const newPhotos = [...session.photos];
        newPhotos[index] = { ...newPhotos[index], ...updates };
        updateSessionWithHistory({ ...session, photos: newPhotos });
    };

    const onReorderPhoto = (index: number, direction: 'forward' | 'backward') => {
        invalidateAiImage();
        const newPhotos = [...session.photos];
        const photoToMove = newPhotos[index];
        newPhotos.splice(index, 1);
        const newIndex = direction === 'forward' ? index + 1 : index - 1;
        newPhotos.splice(newIndex, 0, photoToMove);
        if (selectedLayerType === 'photo' && selectedLayerIndex === index) {
            setSelectedLayerIndex(newIndex);
        }
        updateSessionWithHistory({ ...session, photos: newPhotos });
    };

    const handleAddSticker = (src: string) => {
        invalidateAiImage();
        const newSticker: StickerLayer = {
            id: Date.now().toString(),
            src,
            x: 0.5 + (Math.random() - 0.5) * 0.1,
            y: 0.5 + (Math.random() - 0.5) * 0.1,
            width: 0.2,
            height: 0.2,
            rotation: 0,
        };
        const newSession = { ...session, stickers: [...session.stickers, newSticker] };
        updateSessionWithHistory(newSession);
        handleSelectLayer('sticker', newSession.stickers.length - 1);
    };

    const handleUpdateSticker = (index: number, updates: Partial<StickerLayer>) => {
        invalidateAiImage();
        const newStickers = [...session.stickers];
        newStickers[index] = { ...newStickers[index], ...updates };
        updateSessionWithHistory({ ...session, stickers: newStickers });
    };

    const handleAddText = () => {
        invalidateAiImage();
        const newText: TextLayer = {
            id: Date.now().toString(),
            text: "Double Click to Edit",
            x: 0.5,
            y: 0.5,
            fontSize: 0.05,
            fontFamily: uiConfig.fontFamily || "Arial",
            color: uiConfig.primaryColor,
            rotation: 0,
            fontWeight: 'bold',
        };
        const newSession = { ...session, textLayers: [...session.textLayers, newText] };
        updateSessionWithHistory(newSession);
        handleSelectLayer('text', newSession.textLayers.length - 1);
    };

    const handleUpdateText = (index: number, updates: Partial<TextLayer>) => {
        invalidateAiImage();
        const newTexts = [...session.textLayers];
        newTexts[index] = { ...newTexts[index], ...updates };
        updateSessionWithHistory({ ...session, textLayers: newTexts });
    };

    const handleDeleteLayer = () => {
        invalidateAiImage();
        if (selectedLayerType === 'sticker') {
            const newStickers = session.stickers.filter((_, i) => i !== selectedLayerIndex);
            updateSessionWithHistory({ ...session, stickers: newStickers });
        } else if (selectedLayerType === 'text') {
            const newTexts = session.textLayers.filter((_, i) => i !== selectedLayerIndex);
            updateSessionWithHistory({ ...session, textLayers: newTexts });
        }
        setSelectedLayerIndex(-1);
    };

    const handleOperatorImportSticker = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                setAvailableStickers(prev => [...prev, e.target!.result as string]);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleOpacityChange = (opacity: number) => {
        invalidateAiImage();
        setFrameOpacity(opacity);
    };

    const handleGlobalScaleChange = (scale: number) => {
        invalidateAiImage();
        setGlobalPhotoScale(scale);
    };

    // AI Editing Generation
    const handleAiGenerate = async () => {
        if (!ai) {
            setAiError("AI features are disabled.");
            return;
        }
        if (!aiPrompt.trim()) {
            setAiError("Please enter a prompt to describe your edit.");
            return;
        }
        setAiError(null);
        setIsAiLoading(true);
        setAiPreviewImage(null);

        try {
            const imageForEdit = await getImageForExport();
            if (!imageForEdit) {
                throw new Error("Could not get the current image to edit.");
            }
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                data: imageForEdit.split(',')[1],
                                mimeType: 'image/png',
                            },
                        },
                        { text: aiPrompt },
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            });

            const firstPart = response.candidates?.[0]?.content?.parts?.[0];
            if (firstPart && firstPart.inlineData) {
                const resultBase64 = firstPart.inlineData.data;
                const resultUrl = `data: image / png; base64, ${resultBase64} `;
                setAiPreviewImage(resultUrl);
            } else {
                throw new Error("AI did not return an image. Please try again.");
            }
        } catch (err) {
            console.error("AI Generation Error:", err);
            setAiError((err as Error).message);
        } finally {
            setIsAiLoading(false);
        }
    };

    // AI Sticker Generation
    const handleAiGenerateSticker = async () => {
        if (!ai) {
            setAiStickerError("AI features are disabled.");
            return;
        }
        if (!aiStickerPrompt.trim()) {
            setAiStickerError("Please enter a prompt for your sticker.");
            return;
        }
        setAiStickerError(null);
        setIsAiStickerLoading(true);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: aiStickerPrompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });

            // Iterate parts to find the image part per instructions
            let stickerUrl: string | null = null;
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const base64EncodeString = part.inlineData.data;
                        stickerUrl = `data: image / png; base64, ${base64EncodeString} `;
                        break;
                    }
                }
            }

            if (stickerUrl) {
                handleAddSticker(stickerUrl);
                setAiStickerPrompt('');
            } else {
                throw new Error("AI did not return a valid image.");
            }

        } catch (err) {
            console.error("AI Sticker Generation Error:", err);
            setAiStickerError((err as Error).message);
        } finally {
            setIsAiStickerLoading(false);
        }
    };


    const handleAiAccept = () => {
        if (aiPreviewImage) {
            setFinalCompositeImage(aiPreviewImage);
            setAiPreviewImage(null);
        }
    };

    const handleAiDiscard = () => {
        setAiPreviewImage(null);
    };

    const renderFinalizeStep = () => {
        return (
            <div className="min-h-screen p-8 flex flex-col items-center">
                <UiCustomizationPanel isOpen={isUiPanelOpen} onClose={() => setIsUiPanelOpen(false)} config={uiConfig} onConfigChange={setUiConfig} />
                <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSettingsChange={setSettings} analytics={analytics} />

                <header className="w-full max-w-7xl flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-[var(--color-primary)]">{uiConfig.title}</h1>
                        <p className="opacity-70">{uiConfig.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsUiPanelOpen(true)} className="p-2 bg-[var(--color-panel)] rounded-lg hover:bg-black/20" title="Customize UI">
                            <PaletteIcon className="w-6 h-6" />
                        </button>
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-[var(--color-panel)] rounded-lg hover:bg-black/20" title="Settings"><SettingsIcon /></button>
                        {guestWindow ? (<button onClick={closeGuestWindow} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Close Guest Window</button>) : (<button onClick={openGuestWindow} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Open Guest Window</button>)}
                    </div>
                </header>

                <main className="w-full max-w-7xl flex-grow flex flex-col lg:flex-row gap-8">
                    <div className="w-full lg:w-2/3 relative">
                        <CanvasEditor
                            canvasRef={finalCanvasRef}
                            frameSrc={settings.frameSrc}
                            photos={session.photos}
                            stickers={session.stickers}
                            textLayers={session.textLayers}
                            drawings={session.drawings}
                            filter={session.filter}
                            selectedLayerType={selectedLayerType}
                            selectedLayerIndex={selectedLayerIndex}
                            onSelectLayer={handleSelectLayer}
                            onPhotoUpdate={onPhotoUpdate}
                            onStickerUpdate={handleUpdateSticker}
                            onTextUpdate={handleUpdateText}
                            frameOpacity={frameOpacity}
                            onReorderPhoto={onReorderPhoto}
                            globalPhotoScale={globalPhotoScale}
                            aspectRatio={settings.aspectRatio}
                        />
                        {finalCompositeImage && (
                            <div className="absolute inset-0 pointer-events-none">
                                <img src={finalCompositeImage} alt="Final Composite" className="w-full h-full object-contain" />
                            </div>
                        )}
                        {aiPreviewImage && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 p-4 z-20">
                                <img src={aiPreviewImage} alt="AI Preview" className="max-w-full max-h-[70%] object-contain rounded-lg border-2 border-[var(--color-primary)]" />
                                <div className="flex gap-4">
                                    <button onClick={handleAiAccept} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">Accept</button>
                                    <button onClick={handleAiDiscard} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Discard</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="w-full lg:w-1/3">
                        <div className="flex flex-col gap-4">
                            <FinalizeControls
                                onDownload={handleDownload}
                                onPrint={handlePrint}
                                onGetImageForExport={getImageForExport}
                                onReset={handleResetApp}
                                onCreateNew={handleCreateNew}
                                frameOpacity={frameOpacity}
                                onOpacityChange={handleOpacityChange}
                                photos={session.photos}
                                selectedLayerType={selectedLayerType}
                                selectedLayerIndex={selectedLayerIndex}
                                onSelectLayer={handleSelectLayer}
                                onPhotoUpdate={onPhotoUpdate}

                                stickers={session.stickers}
                                textLayers={session.textLayers}
                                availableStickers={availableStickers}
                                onAddSticker={handleAddSticker}
                                onAddText={handleAddText}
                                onUpdateSticker={handleUpdateSticker}
                                onUpdateText={handleUpdateText}
                                onDeleteLayer={handleDeleteLayer}
                                onImportSticker={handleOperatorImportSticker}

                                onResetPhotoAdjustments={() => { }}
                                undo={undo} redo={redo}
                                canUndo={historyIndex.current > 0} canRedo={historyIndex.current < history.current.length - 1}
                                isKioskMode={false}
                                globalPhotoScale={globalPhotoScale}
                                onGlobalPhotoScaleChange={handleGlobalScaleChange}

                                // AI Edit Props
                                aiPrompt={aiPrompt}
                                onAiPromptChange={setAiPrompt}
                                onAiGenerate={handleAiGenerate}
                                isAiLoading={isAiLoading}
                                aiError={aiError}

                                // AI Sticker Props
                                aiStickerPrompt={aiStickerPrompt}
                                onAiStickerPromptChange={setAiStickerPrompt}
                                onAiGenerateSticker={handleAiGenerateSticker}
                                isAiStickerLoading={isAiStickerLoading}
                                aiStickerError={aiStickerError}

                                // Pro Features
                                enableSmartCrop={settings.pro.enableSmartCrop}
                                onSmartCrop={handleSmartCrop}
                            />
                            <button onClick={handleGenerateQRCode} disabled={session.photos.length === 0} className="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 disabled:bg-gray-600">
                                Show QR Code on Guest Screen
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const renderSetup = () => {
        const CurrentStepComponent = {
            [AppStep.FRAME_UPLOAD]: <FrameUploader
                onFrameSelect={handleFrameSelect}
                organizerSettings={settings}
                onSettingsChange={(newSettings) => setSettings(s => ({ ...s, ...newSettings }))}
                setDirectoryHandle={(action) => setSettings(s => {
                    const handle = typeof action === 'function'
                        ? (action as (prev: FileSystemDirectoryHandle | null) => FileSystemDirectoryHandle | null)(s.outputDirectoryHandle)
                        : action;
                    return {
                        ...s,
                        outputDirectoryHandle: handle,
                        localDownloadPath: handle?.name || ''
                    };
                })}
                gapiAuthInstance={gapiAuthInstance}
                isGapiReady={isGapiReady}
                isSignedIn={isSignedIn}
                pickerApiLoaded={pickerApiLoaded}
            />,
            [AppStep.TEMPLATE_DESIGN]: <TemplateDesigner frameSrc={settings.frameSrc} onTemplateConfirm={handleTemplateConfirm} />,
            [AppStep.PHOTO_UPLOAD]: <PhotoSelector
                onPhotosSelect={handlePhotosSelected}
                onUseHotFolder={handleUseHotFolder}
                placeholders={settings.placeholders}
                frameSrc={settings.frameSrc}
                aspectRatio={settings.aspectRatio}
                sendMessage={sendMessage}
            />,
        }[appStep];

        return (
            <div className="min-h-screen flex flex-col items-center p-4">
                <UiCustomizationPanel isOpen={isUiPanelOpen} onClose={() => setIsUiPanelOpen(false)} config={uiConfig} onConfigChange={setUiConfig} />
                <header className="w-full flex justify-center items-center absolute top-8 px-8">
                    <div className="flex-1"></div>
                    <div className="flex-1 flex justify-center">
                        <StepIndicator currentStep={appStep} />
                    </div>
                    <div className="flex-1 flex justify-end">
                        <button onClick={() => setIsUiPanelOpen(true)} className="p-2 bg-[var(--color-panel)] rounded-lg hover:bg-black/20" title="Customize UI">
                            <PaletteIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                <div className="flex-grow flex items-center justify-center w-full">
                    {CurrentStepComponent}
                </div>
            </div>
        )
    };

    return (
        <div className="min-h-screen antialiased relative bg-[var(--color-background)] text-[var(--color-text-primary)]">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: uiConfig.backgroundSrc ? `url(${uiConfig.backgroundSrc})` : 'none', opacity: 0.1 }}></div>
            <div className="relative z-10">
                {appStep === AppStep.FINALIZE_AND_EXPORT ? renderFinalizeStep() : renderSetup()}
            </div>
        </div>
    );
};

export default App;
