/**
 * Authentication and Authorization
 * Supports OAuth 2.1 Bearer tokens, mTLS, and keypair authentication
 */

import crypto from 'crypto';
import { AuthConfig, AuthType } from '../types/protocol.js';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

export class AuthManager {
  private config?: AuthConfig;
  private validTokens: Set<string> = new Set();
  private validPublicKeys: Map<string, string> = new Map();

  constructor(config?: AuthConfig) {
    this.config = config;
  }

  /**
   * Authenticate a request
   */
  async authenticate(
    headers: Record<string, string> = {},
    challenge?: string,
    signature?: string
  ): Promise<AuthResult> {
    // No auth required
    if (!this.config || this.config.type === AuthType.NONE) {
      return { authenticated: true };
    }

    switch (this.config.type) {
      case AuthType.BEARER:
        return this.authenticateBearer(headers);
      case AuthType.KEYPAIR:
        return this.authenticateKeypair(challenge, signature);
      case AuthType.MTLS:
        return this.authenticateMTLS(headers);
      default:
        return {
          authenticated: false,
          error: `Unsupported auth type: ${this.config.type}`,
        };
    }
  }

  /**
   * Authenticate using Bearer token (OAuth 2.1)
   */
  private authenticateBearer(headers: Record<string, string>): AuthResult {
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (!authHeader) {
      return { authenticated: false, error: 'Missing Authorization header' };
    }

    const match = authHeader.match(/^Bearer\s+(\S+)$/);
    if (!match) {
      return {
        authenticated: false,
        error: 'Invalid Authorization header format',
      };
    }

    const token = match[1];

    // Validate token
    if (this.config?.token && token === this.config.token) {
      return { authenticated: true, userId: 'default' };
    }

    if (this.validTokens.has(token)) {
      return { authenticated: true, userId: token.substring(0, 8) };
    }

    return { authenticated: false, error: 'Invalid token' };
  }

  /**
   * Authenticate using keypair (challenge-response)
   */
  private authenticateKeypair(
    challenge?: string,
    signature?: string
  ): AuthResult {
    if (!challenge || !signature) {
      return {
        authenticated: false,
        error: 'Missing challenge or signature',
      };
    }

    try {
      // For demo purposes - in production, verify against stored public keys
      return { authenticated: true, userId: 'keypair-user' };
    } catch (error) {
      return {
        authenticated: false,
        error: 'Invalid signature',
      };
    }
  }

  /**
   * Authenticate using mutual TLS
   */
  private authenticateMTLS(headers: Record<string, string>): AuthResult {
    // In a real implementation, this would verify the client certificate
    const clientCert = headers['x-client-cert'];
    if (!clientCert) {
      return { authenticated: false, error: 'Missing client certificate' };
    }

    return { authenticated: true, userId: 'mtls-user' };
  }

  /**
   * Add a valid token
   */
  addToken(token: string): void {
    this.validTokens.add(token);
  }

  /**
   * Remove a token
   */
  removeToken(token: string): void {
    this.validTokens.delete(token);
  }

  /**
   * Add a public key for keypair auth
   */
  addPublicKey(userId: string, publicKey: string): void {
    this.validPublicKeys.set(userId, publicKey);
  }

  /**
   * Generate a challenge for keypair auth
   */
  generateChallenge(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify signature for keypair auth
   */
  verifySignature(
    userId: string,
    challenge: string,
    signature: string
  ): boolean {
    const publicKey = this.validPublicKeys.get(userId);
    if (!publicKey) {
      return false;
    }

    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(challenge);
      verify.end();
      return verify.verify(publicKey, signature, 'hex');
    } catch {
      return false;
    }
  }
}
