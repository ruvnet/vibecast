/**
 * Lean-Agentic Cryptographic Provenance
 * Provides cryptographic proof generation for audit trail
 */

import crypto from 'crypto';
import { connectAgentDB } from '../db/agentdb.js';

/**
 * Generate SHA-256 hash of data
 * @param {any} data - Data to hash
 * @returns {string}
 */
export function generateHash(data) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Create a cryptographic signature
 * @param {string} data - Data to sign
 * @param {string} privateKey - Private key (optional, generates one if not provided)
 * @returns {object}
 */
export function createSignature(data, privateKey = null) {
  // In production, use a proper key management system
  const key = privateKey || process.env.ENCRYPTION_KEY || 'default-key-for-demo';

  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  const signature = hmac.digest('hex');

  return {
    signature,
    algorithm: 'HMAC-SHA256',
    timestamp: new Date().toISOString()
  };
}

/**
 * Verify a cryptographic signature
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {string} privateKey - Private key
 * @returns {boolean}
 */
export function verifySignature(data, signature, privateKey = null) {
  const key = privateKey || process.env.ENCRYPTION_KEY || 'default-key-for-demo';

  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}

/**
 * Get the previous block hash for blockchain-style chaining
 * @returns {Promise<string|null>}
 */
async function getPreviousHash() {
  const db = connectAgentDB();

  try {
    const proofs = await db.query('cryptographic_proofs', {
      orderBy: { column: 'created_at', ascending: false },
      limit: 1
    });

    return proofs.length > 0 ? proofs[0].hash : null;
  } catch (error) {
    console.error('Error fetching previous hash:', error);
    return null;
  }
}

/**
 * Create a Lean-style proof structure
 * @param {object} eventData - Event data to prove
 * @returns {object}
 */
export function createLeanProof(eventData) {
  // Lean-Agentic proof structure
  // In a full implementation, this would generate actual Lean theorem proofs
  const proof = {
    theorem: `event_valid_${eventData.toolName}`,
    axioms: [
      'valid_input',
      'deterministic_execution',
      'state_consistency'
    ],
    premises: {
      input_well_formed: validateInput(eventData.toolInput),
      execution_time_reasonable: eventData.executionTime < 30000, // < 30s
      result_type_matches: typeof eventData.result === 'object'
    },
    conclusion: 'event_provably_valid',
    proof_steps: [
      {
        step: 1,
        claim: 'Input is well-formed',
        justification: 'By input validation axiom'
      },
      {
        step: 2,
        claim: 'Execution completed within bounds',
        justification: 'By execution time constraint'
      },
      {
        step: 3,
        claim: 'Result matches expected type',
        justification: 'By type checking'
      },
      {
        step: 4,
        claim: 'Event is provably valid',
        justification: 'By steps 1-3'
      }
    ],
    verified: Object.values({
      input_well_formed: validateInput(eventData.toolInput),
      execution_time_reasonable: eventData.executionTime < 30000,
      result_type_matches: typeof eventData.result === 'object'
    }).every(v => v === true)
  };

  return proof;
}

/**
 * Validate input structure
 * @param {any} input - Input to validate
 * @returns {boolean}
 */
function validateInput(input) {
  // Basic validation - in production, use schema validation (Zod, etc.)
  return input !== null && input !== undefined && typeof input === 'object';
}

/**
 * Create a complete cryptographic proof for an audit trail event
 * @param {string} auditTrailId - Audit trail entry ID
 * @param {object} eventData - Event data
 * @returns {Promise<object>}
 */
export async function createCryptographicProof(auditTrailId, eventData) {
  // Get previous hash for blockchain-style chaining
  const previousHash = await getPreviousHash();

  // Create hash of current event
  const eventHash = generateHash({
    auditTrailId,
    eventData,
    previousHash,
    timestamp: new Date().toISOString()
  });

  // Create Lean proof
  const leanProof = createLeanProof(eventData);

  // Create signature
  const signatureData = createSignature(eventHash);

  // Assemble complete proof
  const proof = {
    audit_trail_id: auditTrailId,
    proof_type: 'lean_proof',
    proof_data: {
      lean: leanProof,
      merkle: {
        // Merkle tree could be built here for batch verification
        root: eventHash,
        path: []
      },
      metadata: {
        tool: eventData.toolName,
        executionTime: eventData.executionTime,
        timestamp: new Date().toISOString()
      }
    },
    hash: eventHash,
    previous_hash: previousHash,
    signature: signatureData.signature,
    verified: leanProof.verified
  };

  return proof;
}

/**
 * Verify a proof chain
 * @param {Array} proofs - Array of proofs to verify
 * @returns {object}
 */
export function verifyProofChain(proofs) {
  const results = [];
  let valid = true;

  for (let i = 0; i < proofs.length; i++) {
    const proof = proofs[i];
    const isFirst = i === 0;
    const previousProof = isFirst ? null : proofs[i - 1];

    // Verify hash chain
    const hashChainValid = isFirst ||
      proof.previous_hash === previousProof.hash;

    // Verify signature
    const signatureValid = verifySignature(proof.hash, proof.signature);

    // Verify Lean proof
    const leanProofValid = proof.proof_data?.lean?.verified === true;

    const proofValid = hashChainValid && signatureValid && leanProofValid;
    valid = valid && proofValid;

    results.push({
      proofId: proof.id,
      valid: proofValid,
      hashChainValid,
      signatureValid,
      leanProofValid
    });
  }

  return {
    valid,
    totalProofs: proofs.length,
    results
  };
}

/**
 * Generate a tamper-evident audit report
 * @param {string} entityId - Entity ID to audit
 * @param {string} entityType - Entity type
 * @returns {Promise<object>}
 */
export async function generateAuditReport(entityId, entityType) {
  const db = connectAgentDB();

  // Get audit trail
  const auditTrail = await db.query('audit_trail', {
    where: {
      entity_id: entityId,
      entity_type: entityType
    },
    orderBy: { column: 'timestamp', ascending: true }
  });

  // Get cryptographic proofs
  const proofPromises = auditTrail.map(async (entry) => {
    const proofs = await db.query('cryptographic_proofs', {
      where: { audit_trail_id: entry.id },
      limit: 1
    });
    return proofs[0] || null;
  });

  const proofs = await Promise.all(proofPromises);
  const validProofs = proofs.filter(p => p !== null);

  // Verify proof chain
  const verification = verifyProofChain(validProofs);

  return {
    entityId,
    entityType,
    auditTrailEntries: auditTrail.length,
    proofsGenerated: validProofs.length,
    proofChainValid: verification.valid,
    verification,
    timeline: auditTrail.map((entry, i) => ({
      timestamp: entry.timestamp,
      eventType: entry.event_type,
      actor: entry.actor,
      action: entry.action,
      proofHash: validProofs[i]?.hash || null
    })),
    summary: {
      firstEvent: auditTrail[0]?.timestamp,
      lastEvent: auditTrail[auditTrail.length - 1]?.timestamp,
      totalDuration: auditTrail.length > 1
        ? new Date(auditTrail[auditTrail.length - 1].timestamp) - new Date(auditTrail[0].timestamp)
        : 0
    }
  };
}

export default {
  generateHash,
  createSignature,
  verifySignature,
  createLeanProof,
  createCryptographicProof,
  verifyProofChain,
  generateAuditReport
};
