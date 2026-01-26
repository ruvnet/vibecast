import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * JWT payload structure
 */
interface JwtPayload {
  sub: string; // Subject (client ID)
  scope: string; // OAuth scopes
  iss: string; // Issuer
  aud: string; // Audience
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

/**
 * Extended Express Request with authentication context
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    clientId: string;
    scopes: string[];
    token: JwtPayload;
  };
}

/**
 * Authentication middleware for JWT validation
 * Placeholder implementation for OAuth 2.0 Client Credentials flow
 *
 * In production, this should:
 * - Validate JWT signature using public key from OAuth provider
 * - Verify token expiration
 * - Check required scopes (documents:write)
 * - Implement token caching and JWKS rotation
 */
export function authMiddleware(requiredScope?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          code: 'MISSING_TOKEN',
          message: 'Authorization header with Bearer token is required'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // TODO: Replace with actual JWT validation using OAuth provider's public key
      // For now, using placeholder validation
      const decoded = await validateJwtToken(token);

      if (!decoded) {
        return res.status(401).json({
          error: 'Unauthorized',
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        });
      }

      // Check required scope if specified
      if (requiredScope && !hasScope(decoded, requiredScope)) {
        return res.status(403).json({
          error: 'Forbidden',
          code: 'INSUFFICIENT_SCOPE',
          message: `Required scope '${requiredScope}' not present in token`
        });
      }

      // Attach authentication context to request
      req.auth = {
        clientId: decoded.sub,
        scopes: decoded.scope.split(' '),
        token: decoded
      };

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      });
    }
  };
}

/**
 * Validate JWT token
 * PLACEHOLDER: Replace with actual OAuth provider validation
 */
async function validateJwtToken(token: string): Promise<JwtPayload | null> {
  try {
    // In production, this should:
    // 1. Fetch JWKS (JSON Web Key Set) from OAuth provider
    // 2. Verify token signature using public key
    // 3. Validate claims (iss, aud, exp, etc.)
    // 4. Cache public keys with rotation support

    // Placeholder validation - DO NOT USE IN PRODUCTION
    const secret = process.env.JWT_SECRET || 'placeholder-secret-replace-in-production';
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Verify token is not expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('JWT validation error:', error.message);
    }
    return null;
  }
}

/**
 * Check if token has required scope
 */
function hasScope(payload: JwtPayload, requiredScope: string): boolean {
  const scopes = payload.scope.split(' ');
  return scopes.includes(requiredScope);
}

/**
 * Middleware to require specific scope
 */
export function requireScope(scope: string) {
  return authMiddleware(scope);
}

/**
 * Optional authentication middleware
 * Attaches auth context if token is present, but doesn't require it
 */
export function optionalAuth() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = await validateJwtToken(token);

      if (decoded) {
        req.auth = {
          clientId: decoded.sub,
          scopes: decoded.scope.split(' '),
          token: decoded
        };
      }
    }

    next();
  };
}
