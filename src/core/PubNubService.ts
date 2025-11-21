import PubNub from 'pubnub';
import { v4 as uuidv4 } from 'uuid';
import {
  PubNubConfig,
  Message,
  MessageType,
  MessageHandler,
  PresenceHandler,
  PresenceData,
} from './types';

/**
 * Core PubNub Service for real-time messaging
 * Integrates with ruv.io patterns for agent orchestration
 */
export class PubNubService {
  private pubnub: PubNub;
  private userId: string;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private presenceHandlers: Map<string, Set<PresenceHandler>> = new Map();
  private subscribedChannels: Set<string> = new Set();

  constructor(config: PubNubConfig) {
    this.userId = config.userId || uuidv4();

    this.pubnub = new PubNub({
      publishKey: config.publishKey,
      subscribeKey: config.subscribeKey,
      userId: this.userId,
      ssl: config.ssl ?? true,
      logVerbosity: config.logVerbosity ?? false,
    });

    this.setupListeners();
  }

  /**
   * Setup PubNub listeners for messages and presence
   */
  private setupListeners(): void {
    this.pubnub.addListener({
      message: (event) => {
        const channel = event.channel;
        const message = event.message as unknown as Message;

        // Call all registered handlers for this channel
        const handlers = this.messageHandlers.get(channel);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error(`Error in message handler for channel ${channel}:`, error);
            }
          });
        }

        // Call wildcard handlers
        const wildcardHandlers = this.messageHandlers.get('*');
        if (wildcardHandlers) {
          wildcardHandlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in wildcard message handler:', error);
            }
          });
        }
      },

      presence: (event) => {
        const channel = event.channel;
        const presenceData: PresenceData = {
          uuid: (event as any).uuid || '',
          state: (event as any).state,
          joined: event.action === 'join',
        };

        const handlers = this.presenceHandlers.get(channel);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(presenceData);
            } catch (error) {
              console.error(`Error in presence handler for channel ${channel}:`, error);
            }
          });
        }
      },

      status: (event) => {
        console.log('PubNub Status:', event.category, event.operation);
      },
    });
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channels: string | string[], withPresence: boolean = true): void {
    const channelList = Array.isArray(channels) ? channels : [channels];

    this.pubnub.subscribe({
      channels: channelList,
      withPresence,
    });

    channelList.forEach(channel => this.subscribedChannels.add(channel));
    console.log(`Subscribed to channels: ${channelList.join(', ')}`);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channels: string | string[]): void {
    const channelList = Array.isArray(channels) ? channels : [channels];

    this.pubnub.unsubscribe({
      channels: channelList,
    });

    channelList.forEach(channel => this.subscribedChannels.delete(channel));
    console.log(`Unsubscribed from channels: ${channelList.join(', ')}`);
  }

  /**
   * Publish a message to a channel
   */
  async publish(
    channel: string,
    messageType: MessageType,
    payload: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const message: Message = {
      id: uuidv4(),
      type: messageType,
      payload,
      timestamp: Date.now(),
      sender: this.userId,
      metadata,
    };

    try {
      await this.pubnub.publish({
        channel,
        message: message as any,
      });
      console.log(`Published ${messageType} to ${channel}`);
    } catch (error) {
      console.error(`Error publishing to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Register a message handler for a channel
   * Use '*' as channel to handle all messages
   */
  onMessage(channel: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
    }

    this.messageHandlers.get(channel)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(channel);
        }
      }
    };
  }

  /**
   * Register a presence handler for a channel
   */
  onPresence(channel: string, handler: PresenceHandler): () => void {
    if (!this.presenceHandlers.has(channel)) {
      this.presenceHandlers.set(channel, new Set());
    }

    this.presenceHandlers.get(channel)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.presenceHandlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.presenceHandlers.delete(channel);
        }
      }
    };
  }

  /**
   * Get message history for a channel
   */
  async getHistory(
    channel: string,
    count: number = 100,
    start?: string,
    end?: string
  ): Promise<Message[]> {
    try {
      const response = await this.pubnub.fetchMessages({
        channels: [channel],
        count,
        start,
        end,
      });

      const messages: Message[] = [];
      if (response.channels[channel]) {
        response.channels[channel].forEach((item: any) => {
          messages.push(item.message as unknown as Message);
        });
      }

      return messages;
    } catch (error) {
      console.error(`Error fetching history for ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Get users present in a channel
   */
  async hereNow(channel: string): Promise<string[]> {
    try {
      const response = await this.pubnub.hereNow({
        channels: [channel],
      });

      const occupants: string[] = [];
      if (response.channels[channel]) {
        response.channels[channel].occupants.forEach((occupant: any) => {
          occupants.push(occupant.uuid);
        });
      }

      return occupants;
    } catch (error) {
      console.error(`Error fetching presence for ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Set user state for a channel
   */
  async setState(channel: string, state: Record<string, any>): Promise<void> {
    try {
      await this.pubnub.setState({
        channels: [channel],
        state,
      });
      console.log(`Set state for ${channel}:`, state);
    } catch (error) {
      console.error(`Error setting state for ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Get user state for a channel
   */
  async getState(channel: string, uuid?: string): Promise<Record<string, any>> {
    try {
      const response = await this.pubnub.getState({
        channels: [channel],
        uuid: uuid || this.userId,
      });
      return (response.channels[channel] as any) || {};
    } catch (error) {
      console.error(`Error getting state for ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Get the current user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get list of subscribed channels
   */
  getSubscribedChannels(): string[] {
    return Array.from(this.subscribedChannels);
  }

  /**
   * Disconnect from PubNub
   */
  disconnect(): void {
    this.pubnub.unsubscribeAll();
    this.subscribedChannels.clear();
    this.messageHandlers.clear();
    this.presenceHandlers.clear();
    console.log('Disconnected from PubNub');
  }
}
