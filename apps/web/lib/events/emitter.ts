import { Event, EventType } from './types';

/**
 * A simple in-memory event bus
 */
class EventEmitter {
  private listeners: Map<EventType, Array<(event: Event) => void>> = new Map();

  /**
   * Subscribe to an event
   */
  on(eventType: EventType, listener: (event: Event) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)!.push(listener);
    
    // Return an unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType) || [];
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event
   */
  emit(event: Event) {
    const { type } = event;
    const eventWithTimestamp = {
      ...event,
      timestamp: Date.now()
    };
    
    console.log(`Emitting event: ${type}`, eventWithTimestamp);
    
    // Get listeners for this event type
    const listeners = this.listeners.get(type) || [];
    
    // Execute all listeners
    for (const listener of listeners) {
      try {
        listener(eventWithTimestamp);
      } catch (error) {
        console.error(`Error in event listener for ${type}:`, error);
      }
    }
  }
}

// Create a singleton instance
export const eventEmitter = new EventEmitter();

/**
 * Helper function to emit events
 */
export function emitEvent(type: EventType, data: Omit<Event, 'type' | 'timestamp'>) {
  const event = {
    type,
    ...data
  } as Event;
  
  eventEmitter.emit(event);
} 