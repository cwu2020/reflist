import { eventEmitter } from './emitter';
import { EventType } from './types';
import { 
  handlePhoneVerified, 
  handleUserCreated,
  handleLogin 
} from './handlers/commission-claim-handlers';

// Flag to track if handlers are already registered
let handlersRegistered = false;

/**
 * Register all event handlers
 */
export function registerEventHandlers() {
  // Avoid duplicate registrations
  if (handlersRegistered) {
    console.log('Event handlers already registered, skipping...');
    return;
  }
  
  // Register commission claim handlers
  eventEmitter.on(EventType.PHONE_VERIFIED, handlePhoneVerified);
  eventEmitter.on(EventType.USER_CREATED, handleUserCreated);
  eventEmitter.on(EventType.LOGIN, handleLogin);
  
  handlersRegistered = true;
  console.log('All event handlers registered');
} 