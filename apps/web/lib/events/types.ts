/**
 * Event types for the event system
 */
export enum EventType {
  PHONE_VERIFIED = 'PHONE_VERIFIED',
  USER_CREATED = 'USER_CREATED',
  LOGIN = 'LOGIN'
}

/**
 * Base event interface
 */
export interface BaseEvent {
  type: EventType;
  timestamp: number;
}

/**
 * Event for when a phone number is verified
 */
export interface PhoneVerifiedEvent extends BaseEvent {
  type: EventType.PHONE_VERIFIED;
  phoneNumber: string;
  userId?: string; // Optional user ID if already logged in
}

/**
 * Event for when a user is created
 */
export interface UserCreatedEvent extends BaseEvent {
  type: EventType.USER_CREATED;
  userId: string;
  email: string;
  phoneNumber?: string; // Optional phone number if provided during signup
}

/**
 * Event for when a user logs in
 */
export interface LoginEvent extends BaseEvent {
  type: EventType.LOGIN;
  userId: string;
  phoneNumberPendingClaim?: string; // Phone number waiting to be claimed after verification
  partnerId?: string;
}

/**
 * Union type of all events
 */
export type Event = PhoneVerifiedEvent | UserCreatedEvent | LoginEvent; 