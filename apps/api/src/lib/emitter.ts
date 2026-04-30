import { EventEmitter } from 'node:events';

export const emitter = new EventEmitter();

export type EventPayload = {
  eventId: string;
  userId: string;
};

export function emit(event: 'event:created' | 'event:updated', payload: EventPayload): void {
  emitter.emit(event, payload);
}
