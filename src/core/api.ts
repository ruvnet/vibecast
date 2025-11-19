/**
 * Unified API for VibeCast Xenosphere
 *
 * Clean, intuitive interface to the entire platform
 */

import { Xenosphere } from './xenosphere.js';
import { StreamContext, XenosphereState, AdaptiveContent } from './interfaces.js';

/**
 * Create a new Xenosphere instance with fluent API
 */
export function createXenosphere(): XenosphereAPI {
  const sphere = new Xenosphere();

  return {
    // Storage operations
    async store(key: string, data: any, context?: any) {
      await sphere.store(key, data, context);
      return this;
    },

    async retrieve(key: string, options?: any) {
      return sphere.retrieve(key, options);
    },

    // Streaming operations
    createStream(streamId: string, creatorId: string) {
      return sphere.createStream(streamId, creatorId);
    },

    adaptContent(streamId: string, content: any) {
      return sphere.adaptContent(streamId, content);
    },

    // State queries
    getState() {
      return sphere.getState();
    },

    getMetrics() {
      return sphere.getMetrics();
    },

    // Cross-system operations
    predictPhysiology(userId: string, offsetMs: number) {
      return sphere.predictCircadianPhysiology(userId, offsetMs);
    },

    recallLunarCycles() {
      return sphere.recallLunarCycle();
    },

    // Access to raw sphere
    _sphere: sphere
  };
}

/**
 * Fluent API interface
 */
export interface XenosphereAPI {
  store(key: string, data: any, context?: any): Promise<XenosphereAPI>;
  retrieve(key: string, options?: any): Promise<any>;
  createStream(streamId: string, creatorId: string): StreamContext;
  adaptContent(streamId: string, content: any): AdaptiveContent;
  getState(): XenosphereState;
  getMetrics(): any;
  predictPhysiology(userId: string, offsetMs: number): any;
  recallLunarCycles(): Array<{ phase: number; data: any }>;
  _sphere: Xenosphere;
}

/**
 * Quick-start helper for common patterns
 */
export const XenosphereHelpers = {
  /**
   * Start a stream with automatic setup
   */
  async quickStream(streamId: string, creatorId: string, initialContent: any) {
    const api = createXenosphere();
    const stream = api.createStream(streamId, creatorId);

    await api.store(`stream:${streamId}:content`, initialContent);

    return {
      api,
      stream,
      adapt: (content: any) => api.adaptContent(streamId, content)
    };
  },

  /**
   * Query with holistic context
   */
  async holisticQuery(key: string, options?: {
    timeContext?: number;
    useEmergence?: boolean;
  }) {
    const api = createXenosphere();
    const data = await api.retrieve(key, {
      timeContext: options?.timeContext,
      followPheromones: options?.useEmergence
    });

    const state = api.getState();

    return {
      data,
      context: {
        astronomical: state.astronomicalState,
        coherence: state.collectiveCoherence,
        emergence: state.emergentPatterns
      }
    };
  },

  /**
   * Monitor real-time across all dimensions
   */
  createMonitor(intervalMs: number = 1000) {
    const api = createXenosphere();
    const callbacks: Array<(metrics: any) => void> = [];

    const interval = setInterval(() => {
      const metrics = api.getMetrics();
      callbacks.forEach(cb => cb(metrics));
    }, intervalMs);

    return {
      subscribe(callback: (metrics: any) => void) {
        callbacks.push(callback);
      },
      stop() {
        clearInterval(interval);
      },
      getMetrics: () => api.getMetrics()
    };
  }
};

/**
 * Export convenience functions
 */
export { Xenosphere } from './xenosphere.js';
export * from './interfaces.js';
