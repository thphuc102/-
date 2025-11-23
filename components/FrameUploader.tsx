// Fix: Import `useEffect` from `react`.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadIcon, ZoomInIcon, ZoomOutIcon, ResetIcon, SettingsIcon, GoogleDriveIcon } from './icons';
import { OrganizerSettings } from '../types';

declare const google: any;

// Add type definition for window.showDirectoryPicker to fix TypeScript error.
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }
}

interface FrameUploaderProps {
  onFrameSelect: (frameFile: File) => void;
  organizerSettings: OrganizerSettings;
  onSettingsChange: (settings: OrganizerSettings) => void;
  setDirectoryHandle: React.Dispatch<React.SetStateAction<FileSystemDirectoryHandle | null>>;
  gapiAuthInstance: any;
  isGapiReady: boolean;
  isSignedIn: boolean;
  pickerApiLoaded: boolean;
}

const SetupModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    settings: OrganizerSettings;
    onSave: (settings: OrganizerSettings) => void;
    setDirectoryHandle: React.Dispatch<React.SetStateAction<FileSystemDirectoryHandle | null>>;
    gapiAuthInstance: any;
    isGapiReady: boolean;
    isSignedIn: boolean;
    pickerApiLoaded: boolean;
}> = ({ isOpen, onClose, settings, onSave, setDirectoryHandle, gapiAuthInstance, isGapiReady, isSignedIn, pickerApiLoaded }) => {
    const [localSettings, setLocalSettings] = useState<OrganizerSettings>(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };
    
    const handleSettingChange = (field: keyof OrganizerSettings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSignIn = () => gapiAuthInstance?.signIn();
    const handleSignOut = () => gapiAuthInstance?.signOut();

    const handleSelectDriveFolder = () => {
        const accessToken = gapiAuthInstance.currentUser.get().getAuthResponse().access_token;
        if (pickerApiLoaded && accessToken) {
            const view = new google.picker.View(google.picker.ViewId.FOLDERS);
            view.setMimeTypes("application/vnd.google-apps.folder");
            const picker = new google.picker.PickerBuilder()
                .enableFeature(google.picker.Feature.NAV_HIDDEN)
                .setAppId(gapiAuthInstance.clientId)
                .setOAuthToken(accessToken)
                .addView(view)
                .setCallback((data: any) => {
                    if (data.action === google.picker.Action.PICKED) {
                        const doc = data.docs[0];
                        setLocalSettings(prev => ({...prev, driveFolderId: doc.id, driveFolderName: doc.name }));
                    }
                })
                .build();
            picker.setVisible(true);
        }
    };


    const handleSelectFolder = async () => {
        try {
            if (!('showDirectoryPicker' in window)) {
                alert('Your browser does not support local folder access. Please use a modern browser like Chrome or Edge.');
                return;
            }
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });
            setDirectoryHandle(handle);
            handleSettingChange('localDownloadPath', handle.name);
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              console.error('Error selecting directory:', err);
            }
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true">
            <div className="relative transform overflow-hidden rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg p-6 space-y-4">
                <h3 className="text-lg font-medium leading-6 text-[var(--color-text-primary)]">Organizer Settings</h3>
                <p className="text-sm text-[var(--color-text-primary)] opacity-70">Configure these settings before the event. They will persist for the session.</p>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">Google Drive Integration</label>
                  <div className="mt-1 p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md space-y-2">
                    {!isGapiReady ? (
                      <p className="text-xs text-center text-gray-400">Loading Google Services...</p>
                    ) : !isSignedIn ? (
                      <button onClick={handleSignIn} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                        <GoogleDriveIcon className="w-5 h-5" /> Connect to Google Drive
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-300">Connected as: <span className="font-bold">{gapiAuthInstance?.currentUser.get().getBasicProfile().getEmail()}</span></p>
                            <button onClick={handleSignOut} className="text-xs text-red-400 hover:underline">Disconnect</button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="text" readOnly value={localSettings.driveFolderName || "No folder selected"} className="block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] opacity-70" />
                            <button onClick={handleSelectDriveFolder} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-md filter hover:brightness-110 flex-shrink-0">Select Folder...</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">Local Download Folder (for Auto-Saving)</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="text" readOnly value={localSettings.localDownloadPath || "No folder selected"} className="block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] opacity-70" />
                      <button onClick={handleSelectFolder} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-md filter hover:brightness-110 flex-shrink-0">Select...</button>
                    </div>
                </div>
                
                 <div>
                    <label htmlFor="fileNameTemplate" className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">File Name Template</label>
                    <input type="text" id="fileNameTemplate" value={localSettings.fileNameTemplate} onChange={(e) => handleSettingChange('fileNameTemplate', e.target.value)} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
                    <p className="text-xs text-gray-500 mt-1">Use placeholders: <code className="bg-black/20 px-1 rounded">{`{date}`}</code> <code className="bg-black/20 px-1 rounded">{`{time}`}</code> <code className="bg-black/20 px-1 rounded">{`{timestamp}`}</code> <code className="bg-black/20 px-1 rounded">{`{number}`}</code></p>
                </div>

                <div>
                    <label htmlFor="autoReset" className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">Auto-Reset Timer (Seconds)</label>
                    <input type="number" id="autoReset" min="0" value={localSettings.autoResetTimer} onChange={(e) => handleSettingChange('autoResetTimer', parseInt(e.target.value, 10) || 0)} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
                    <p className="text-xs text-gray-500 mt-1">After a photo is finished, the app will reset to the 'Add Photos' screen after this many seconds of inactivity. Set to 0 to disable.</p>
                </div>

                <div className="flex items-center">
                    <input type="checkbox" id="kioskMode" checked={localSettings.kioskMode} onChange={(e) => handleSettingChange('kioskMode', e.target.checked)} className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                    <label htmlFor="kioskMode" className="ml-2 block text-sm text-[var(--color-text-primary)] opacity-80">Enable Kiosk Mode</label>
                </div>
                 <p className="text-xs text-gray-500 -mt-3 ml-6">Hides the "Start New Session" button to prevent guests from changing the frame.</p>

                <div className="mt-5 sm:mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="inline-flex justify-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] opacity-80 hover:bg-black/20">Cancel</button>
                    <button type="button" onClick={handleSave} className="inline-flex justify-center rounded-md border border-transparent bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white filter hover:brightness-110">Save Settings</button>
                </div>
            </div>
        </div>
    );
}


const FrameUploader: React.FC<FrameUploaderProps> = ({ onFrameSelect, organizerSettings, onSettingsChange, setDirectoryHandle, ...gapiProps }) => {
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [isSetupModalOpen, setSetupModalOpen] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPanning = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'image/png') {
        setError('Please select a valid PNG file.');
        setFramePreview(null);
        setSelectedFile(null);
        return;
      }
      resetZoom();
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setFramePreview(result);
        setSelectedFile(file);
        setError(null);
      };
      reader.onerror = () => {
        setError('Failed to read the file.');
        setFramePreview(null);
        setSelectedFile(null);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleConfirm = useCallback(() => {
    if (selectedFile) {
      onFrameSelect(selectedFile);
    } else {
      setError('Please select a frame image first.');
    }
  }, [selectedFile, onFrameSelect]);

  const triggerFileSelect = () => fileInputRef.current?.click();

  const resetZoom = () => setZoom({ scale: 1, x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom.scale > 1) {
      isPanning.current = true;
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePosition.current.x;
      const dy = e.clientY - lastMousePosition.current.y;
      setZoom(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLImageElement>) => {
    isPanning.current = false;
    e.currentTarget.style.cursor = zoom.scale > 1 ? 'grab' : 'pointer';
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6 p-8 bg-[var(--color-panel)] rounded-2xl shadow-lg relative">
        <SetupModal isOpen={isSetupModalOpen} onClose={() => setSetupModalOpen(false)} settings={organizerSettings} onSave={onSettingsChange} setDirectoryHandle={setDirectoryHandle} {...gapiProps} />
        <button onClick={() => setSetupModalOpen(true)} className="absolute top-4 right-4 text-[var(--color-text-primary)] opacity-70 hover:opacity-100 transition-colors" title="Organizer Settings">
            <SettingsIcon className="w-6 h-6" />
        </button>

      <h2 className="text-2xl font-bold text-[var(--color-primary)]">Step 1: Upload Your Frame</h2>
      <p className="opacity-70 text-center">Upload a transparent PNG to use as an overlay for your photos.</p>
      
      {/* Orientation Switcher */}
      <div className="flex items-center gap-3 bg-[var(--color-background)] p-1.5 rounded-lg border border-[var(--color-border)]">
          <button 
            onClick={() => setOrientation('landscape')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${orientation === 'landscape' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-primary)] opacity-70 hover:bg-white/10 hover:opacity-100'}`}
          >
            Landscape
          </button>
          <div className="w-px h-4 bg-[var(--color-border)]"></div>
           <button 
            onClick={() => setOrientation('portrait')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${orientation === 'portrait' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-primary)] opacity-70 hover:bg-white/10 hover:opacity-100'}`}
          >
            Portrait
          </button>
      </div>

      <div className="w-full flex flex-col gap-4 items-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png"
          className="hidden"
        />

        <div 
          onClick={!framePreview ? triggerFileSelect : undefined} 
          className={`
            border-2 border-dashed border-[var(--color-border)] rounded-lg flex items-center justify-center cursor-pointer hover:border-[var(--color-primary)] bg-[var(--color-background)]/50 transition-all duration-500 ease-in-out overflow-hidden relative w-full max-h-[60vh]
            ${orientation === 'landscape' ? 'max-w-lg aspect-[3/2]' : 'max-w-xs aspect-[2/3]'}
          `}
        >
          {framePreview ? (
            <img 
              src={framePreview} 
              alt="Frame Preview" 
              className="max-h-full max-w-full object-contain transition-transform duration-100"
              style={{
                transform: `scale(${zoom.scale}) translate(${zoom.x}px, ${zoom.y}px)`,
                cursor: zoom.scale > 1 ? 'grab' : 'default'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              draggable="false"
            />
          ) : (
            <div onClick={triggerFileSelect} className="text-center text-gray-500 hover:text-[var(--color-primary)]">
              <UploadIcon className="mx-auto h-12 w-12" />
              <p>Click to browse for a PNG</p>
            </div>
          )}
        </div>
        {framePreview && (
            <div className="bg-[var(--color-background)]/50 p-2 rounded-lg border border-[var(--color-border)] flex items-center gap-3 w-full max-w-md">
              <ZoomOutIcon className="w-5 h-5 opacity-70" />
              <input 
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  value={zoom.scale}
                  onChange={(e) => setZoom(z => ({...z, scale: parseFloat(e.target.value)}))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <ZoomInIcon className="w-5 h-5 opacity-70" />
              <button onClick={resetZoom} className="p-1 opacity-70 hover:opacity-100" title="Reset Zoom">
                  <ResetIcon className="w-5 h-5" />
              </button>
            </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={!framePreview}
        className="w-full max-w-xs mt-4 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-75 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
      >
        Confirm Frame & Continue
      </button>
    </div>
  );
};

export default FrameUploader;