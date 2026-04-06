import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppointmentSocket, type SocketCallbacks } from './useAppointmentSocket';
import type { Appointment } from './types';

// ── Mock WebSocket ──────────────────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  readyState = 0; // CONNECTING
  closeCalled = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closeCalled = true;
    this.readyState = 3; // CLOSED
  }

  /** Test helper: simulate the server opening the connection */
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  /** Test helper: simulate receiving a JSON message from the server */
  simulateMessage(event: string, data: unknown) {
    this.onmessage?.({ data: JSON.stringify({ event, data }) });
  }

  /** Test helper: simulate connection close */
  simulateClose() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const sampleAppointment: Appointment = {
  id: 'new-1',
  name: 'New Patient',
  email: 'new@example.com',
  phone: '07700900999',
  description: 'New appointment',
  appointmentDate: '2026-05-01T10:00:00.000Z',
  status: 'pending',
  createdAt: '2026-04-06T12:00:00.000Z',
};

describe('useAppointmentSocket', () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  function renderSocketHook(callbacks: Partial<SocketCallbacks> = {}) {
    const defaults: SocketCallbacks = {
      onCreated: vi.fn(),
      onUpdated: vi.fn(),
      onDeleted: vi.fn(),
    };
    return {
      ...renderHook(() => useAppointmentSocket({ ...defaults, ...callbacks })),
      callbacks: { ...defaults, ...callbacks },
    };
  }

  it('connects to the WebSocket endpoint', () => {
    // Arrange & Act
    renderSocketHook();

    // Assert
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('/ws/appointments');
  });

  it('reports connected status after open', () => {
    // Arrange
    const { result } = renderSocketHook();

    // Act
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    // Assert
    expect(result.current.connected).toBe(true);
  });

  it('reports disconnected initially', () => {
    // Arrange & Act
    const { result } = renderSocketHook();

    // Assert
    expect(result.current.connected).toBe(false);
  });

  it('calls onCreated when appointment:created message received', () => {
    // Arrange
    const onCreated = vi.fn();
    renderSocketHook({ onCreated });
    const ws = MockWebSocket.instances[0];
    act(() => ws.simulateOpen());

    // Act
    act(() => {
      ws.simulateMessage('appointment:created', sampleAppointment);
    });

    // Assert
    expect(onCreated).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledWith(sampleAppointment);
  });

  it('calls onUpdated when appointment:updated message received', () => {
    // Arrange
    const onUpdated = vi.fn();
    renderSocketHook({ onUpdated });
    const ws = MockWebSocket.instances[0];
    act(() => ws.simulateOpen());

    // Act
    act(() => {
      ws.simulateMessage('appointment:updated', { ...sampleAppointment, status: 'approved' });
    });

    // Assert
    expect(onUpdated).toHaveBeenCalledOnce();
    expect(onUpdated.mock.calls[0][0].status).toBe('approved');
  });

  it('calls onDeleted when appointment:deleted message received', () => {
    // Arrange
    const onDeleted = vi.fn();
    renderSocketHook({ onDeleted });
    const ws = MockWebSocket.instances[0];
    act(() => ws.simulateOpen());

    // Act
    act(() => {
      ws.simulateMessage('appointment:deleted', { id: 'del-1' });
    });

    // Assert
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(onDeleted).toHaveBeenCalledWith('del-1');
  });

  it('closes WebSocket on unmount', () => {
    // Arrange
    const { unmount } = renderSocketHook();
    const ws = MockWebSocket.instances[0];
    act(() => ws.simulateOpen());

    // Act
    unmount();

    // Assert
    expect(ws.closeCalled).toBe(true);
  });

  it('reports disconnected after connection closes', () => {
    // Arrange
    const { result } = renderSocketHook();
    const ws = MockWebSocket.instances[0];
    act(() => ws.simulateOpen());
    expect(result.current.connected).toBe(true);

    // Act
    act(() => ws.simulateClose());

    // Assert
    expect(result.current.connected).toBe(false);
  });

  it('attempts to reconnect after unexpected close', () => {
    // Arrange
    renderSocketHook();
    const ws = MockWebSocket.instances[0];
    act(() => ws.simulateOpen());

    // Act — simulate disconnect
    act(() => ws.simulateClose());
    // Advance timer past reconnect delay
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Assert — a second WebSocket should have been created
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('ignores malformed messages without crashing', () => {
    // Arrange
    renderSocketHook();
    const ws = MockWebSocket.instances[0];
    act(() => ws.simulateOpen());

    // Act — send garbage
    act(() => {
      ws.onmessage?.({ data: 'not json at all' });
    });

    // Assert — no crash, still connected
    expect(ws.readyState).toBe(1);
  });
});
