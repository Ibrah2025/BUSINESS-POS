import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useWebSocket({ businessId, dataSaverMode = false, onEvent } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);
  const pollingRef = useRef(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const handleEvent = useCallback((eventName, data) => {
    setLastEvent({ event: eventName, data, timestamp: Date.now() });
    if (onEventRef.current) onEventRef.current(eventName, data);
  }, []);

  // WebSocket mode
  useEffect(() => {
    if (dataSaverMode || !businessId) return;

    const socket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
      query: { businessId },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-business', businessId);
    });

    socket.on('disconnect', () => setIsConnected(false));

    const events = ['new-sale', 'stock-update', 'stock-alert', 'credit-update'];
    events.forEach((evt) => {
      socket.on(evt, (data) => handleEvent(evt, data));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [businessId, dataSaverMode, handleEvent]);

  // Polling fallback in data saver mode
  useEffect(() => {
    if (!dataSaverMode || !businessId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/events?businessId=${businessId}&since=${Date.now() - 30000}`);
        if (res.ok) {
          const events = await res.json();
          events.forEach((e) => handleEvent(e.type, e.data));
        }
      } catch {
        // silent fail for polling
      }
    };

    pollingRef.current = setInterval(poll, 30000);
    return () => clearInterval(pollingRef.current);
  }, [businessId, dataSaverMode, handleEvent]);

  return { isConnected, lastEvent, socket: socketRef.current };
}
