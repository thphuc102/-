
import { useRef, useCallback, useEffect } from 'react';

export const useHotFolder = (
    directoryHandle: FileSystemDirectoryHandle | null,
    onNewPhotos: (newPhotos: Map<string, string>) => void
) => {
    const pollingIntervalRef = useRef<number | null>(null);
    const knownFilesRef = useRef<Set<string>>(new Set());
    const onNewPhotosRef = useRef(onNewPhotos);

    useEffect(() => {
        onNewPhotosRef.current = onNewPhotos;
    }, [onNewPhotos]);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    const pollFolder = useCallback(async () => {
        if (!directoryHandle) return;

        try {
            const newPhotos = new Map<string, string>();
            // @ts-ignore - TS might not know about values() iterator fully depending on config
            for await (const entry of directoryHandle.values()) {
                if (entry.kind === 'file' && !knownFilesRef.current.has(entry.name)) {
                    // Check for common image types
                    if (entry.name.match(/\.(jpg|jpeg|png|gif)$/i)) {
                        // The 'entry.kind === "file"' check makes this a safe cast.
                        const file = await (entry as FileSystemFileHandle).getFile();
                        const url = URL.createObjectURL(file);
                        newPhotos.set(entry.name, url);
                        knownFilesRef.current.add(entry.name);
                    }
                }
            }
            if (newPhotos.size > 0) {
                onNewPhotosRef.current(newPhotos);
            }
        } catch (error) {
            console.error('Error polling hot folder:', error);
            // If we get a NotAllowedError, it might mean permissions were revoked. Stop polling.
            if ((error as DOMException).name === 'NotAllowedError') {
                stopPolling();
                alert('Permission to access the folder was denied. Please re-select the folder in settings.');
            }
        }
    }, [directoryHandle, stopPolling]);

    const startPolling = useCallback(() => {
        stopPolling();
        knownFilesRef.current.clear(); // Reset known files when starting a new session
        // Initial poll
        pollFolder();
        // Set up interval
        pollingIntervalRef.current = window.setInterval(pollFolder, 2000); // Poll every 2 seconds
    }, [pollFolder, stopPolling]);

    // Cleanup on unmount or when directory handle changes
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling, directoryHandle]);

    return { startPolling, stopPolling };
};
