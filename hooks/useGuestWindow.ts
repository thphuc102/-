import { useState, useRef, useCallback, useEffect } from 'react';
import { InterWindowMessage, GuestScreenState } from '../types';

export const useGuestWindow = () => {
    const [guestWindow, setGuestWindow] = useState<Window | null>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        channelRef.current = new BroadcastChannel('photobooth_channel');
        
        return () => {
            channelRef.current?.close();
        };
    }, []);

    const openGuestWindow = useCallback(() => {
        const newWindow = window.open(
            window.location.origin + window.location.pathname + '#guest', 
            'guestWindow', 
            'popup,width=1920,height=1080'
        );
        setGuestWindow(newWindow);
    }, []);

    const closeGuestWindow = useCallback(() => {
        if (guestWindow) {
            guestWindow.close();
            setGuestWindow(null);
        }
    }, [guestWindow]);

    const sendMessage = useCallback((payload: GuestScreenState) => {
        if (channelRef.current) {
            const message: InterWindowMessage = { type: 'SET_STATE', payload };
            channelRef.current.postMessage(message);
        }
    }, []);

    useEffect(() => {
        const handleBeforeUnload = () => {
            closeGuestWindow();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            closeGuestWindow();
        };
    }, [closeGuestWindow]);

    return { guestWindow, openGuestWindow, closeGuestWindow, sendMessage };
};
