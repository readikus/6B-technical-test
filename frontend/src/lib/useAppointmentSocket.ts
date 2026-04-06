import { useEffect, useRef, useState } from 'react';
import type { Appointment } from './types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws/appointments';
const RECONNECT_DELAY = 3000;

export interface SocketCallbacks {
  onCreated: (appointment: Appointment) => void;
  onUpdated: (appointment: Appointment) => void;
  onDeleted: (id: string) => void;
}

interface SocketMessage {
  event: string;
  data: unknown;
}

export function useAppointmentSocket(callbacks: SocketCallbacks) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef(callbacks);
  const unmountedRef = useRef(false);

  // Keep callbacks ref up to date in an effect (not during render)
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmountedRef.current) setConnected(true);
      };

      ws.onclose = () => {
        if (!unmountedRef.current) {
          setConnected(false);
          setTimeout(() => {
            if (!unmountedRef.current) connect();
          }, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror, triggering reconnect
      };

      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg: SocketMessage = JSON.parse(e.data as string);
          const { event, data } = msg;

          switch (event) {
            case 'appointment:created':
              callbacksRef.current.onCreated(data as Appointment);
              break;
            case 'appointment:updated':
              callbacksRef.current.onUpdated(data as Appointment);
              break;
            case 'appointment:deleted':
              callbacksRef.current.onDeleted((data as { id: string }).id);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
    };
  }, []);

  return { connected };
}
