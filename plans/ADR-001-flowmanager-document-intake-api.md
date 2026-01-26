# ADR-001: FlowManager Document Intake API from IIP Capture Service

**Status:** Proposed
**Date:** 2026-01-26
**Deciders:** System Architecture Team
**Technical Story:** As a system integrator, I want the FlowManager to receive documents via API from the IIP Capture service, so that documents can be automatically processed in IIP without manual intervention.

---

## Table of Contents

1. [Context and Problem Statement](#context-and-problem-statement)
2. [Decision Drivers](#decision-drivers)
3. [Considered Options](#considered-options)
4. [Decision Outcome](#decision-outcome)
5. [Domain-Driven Design](#domain-driven-design)
6. [API Specification](#api-specification)
7. [OpenTelemetry Implementation](#opentelemetry-implementation)
8. [Idempotency Strategy](#idempotency-strategy)
9. [Blob Storage Integration](#blob-storage-integration)
10. [Security Considerations](#security-considerations)
11. [Consequences](#consequences)
12. [Implementation Plan](#implementation-plan)

---

## Context and Problem Statement

The FlowManager service is the central orchestration component within the IIP (Intelligent Information Processing) ecosystem. Currently, documents from the on-premise Capture service require manual intervention to be processed. This creates bottlenecks, introduces human error, and limits throughput.

We need to design and implement a REST API endpoint that:
- Accepts document uploads from the on-premise IIP Capture service
- Handles documents with their associated JSON metadata
- Manages initial intake processing
- Persists files to blob storage
- Ensures idempotent operations to prevent duplicate processing
- Provides full observability through OpenTelemetry

### Key Constraints

- **On-premise to Cloud:** The Capture service runs on-premise and must communicate with cloud-based FlowManager
- **Network Reliability:** Intermittent connectivity requires robust retry and idempotency handling
- **Compliance:** Document handling must meet audit and traceability requirements
- **Scale:** System must handle burst uploads from multiple Capture service instances

---

## Decision Drivers

1. **Reliability:** Documents must never be lost or duplicated in the processing pipeline
2. **Traceability:** End-to-end visibility of document lifecycle via OpenTelemetry
3. **Performance:** Support for high-throughput document ingestion
4. **Idempotency:** Same request executed multiple times must produce identical results
5. **Maintainability:** Clean separation of concerns following DDD principles
6. **Security:** Secure transmission and storage of potentially sensitive documents

---

## Considered Options

### Option 1: Synchronous REST API with Immediate Processing
- Single endpoint that accepts, validates, stores, and initiates processing
- Simple architecture but tightly coupled
- **Risk:** Long response times, timeout issues

### Option 2: Asynchronous REST API with Event-Driven Processing (Recommended)
- REST endpoint handles intake and storage
- Domain events trigger downstream processing
- Decoupled, scalable, resilient
- **Benefits:** Better fault tolerance, horizontal scaling

### Option 3: Message Queue Direct Integration
- Capture service publishes directly to message queue
- **Risk:** Requires on-premise queue infrastructure, complex error handling

---

## Decision Outcome

**Chosen Option:** Option 2 - Asynchronous REST API with Event-Driven Processing

This approach provides the best balance of reliability, scalability, and maintainability while supporting the idempotency requirements and OpenTelemetry integration.

---

## Domain-Driven Design

### Bounded Context: Document Intake

The Document Intake bounded context is responsible for receiving, validating, and persisting documents from external capture services.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT INTAKE BOUNDED CONTEXT                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Application    │    │     Domain       │    │ Infrastructure   │  │
│  │     Layer        │    │     Layer        │    │     Layer        │  │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────────┤  │
│  │ DocumentIntake   │───▶│ Document (AR)    │    │ BlobStorage      │  │
│  │ CommandHandler   │    │ DocumentMetadata │    │ Repository       │  │
│  │                  │    │ UploadRequest    │    │                  │  │
│  │ DocumentIntake   │    │ FileContent      │    │ DocumentStore    │  │
│  │ QueryHandler     │    │                  │    │ Repository       │  │
│  │                  │    │ Domain Events:   │    │                  │  │
│  │                  │    │ - DocumentReceived│   │ EventPublisher   │  │
│  │                  │    │ - DocumentStored │    │                  │  │
│  │                  │    │ - IntakeFailed   │    │ Telemetry        │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Aggregate Root: Document

```typescript
// Domain/Aggregates/Document.ts

interface DocumentId {
  value: string;  // UUID v4 or deterministic hash
}

interface Document {
  id: DocumentId;
  captureRequestId: CaptureRequestId;  // Idempotency key from Capture service
  filePath: FilePath;
  metadata: DocumentMetadata;
  content: FileContent;
  status: DocumentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Domain methods
  markAsReceived(): void;
  markAsStored(blobUri: BlobUri): void;
  markAsFailed(reason: FailureReason): void;
}
```

### Value Objects

```typescript
// Domain/ValueObjects/

interface CaptureRequestId {
  value: string;  // Unique identifier from Capture service (idempotency key)
  validate(): boolean;
}

interface FilePath {
  directory: string;
  filename: string;
  extension: string;
  fullPath: string;

  // Deterministic hash for deduplication
  toHash(): string;
}

interface DocumentMetadata {
  captureTimestamp: Timestamp;
  sourceSystem: string;
  documentType: DocumentType;
  batchId?: BatchId;
  customFields: Map<string, MetadataValue>;

  validate(): ValidationResult;
}

interface FileContent {
  data: Buffer | ReadableStream;
  mimeType: MimeType;
  sizeBytes: number;
  checksum: Checksum;  // SHA-256 for integrity verification
}

interface BlobUri {
  container: string;
  path: string;
  fullUri: string;
}

interface Checksum {
  algorithm: 'SHA-256';
  value: string;

  verify(content: Buffer): boolean;
}
```

### Domain Events

```typescript
// Domain/Events/

interface DocumentReceivedEvent {
  eventId: EventId;
  occurredAt: Timestamp;
  documentId: DocumentId;
  captureRequestId: CaptureRequestId;
  filePath: FilePath;
  metadata: DocumentMetadata;
  checksum: Checksum;
  traceContext: TraceContext;  // OpenTelemetry context propagation
}

interface DocumentStoredEvent {
  eventId: EventId;
  occurredAt: Timestamp;
  documentId: DocumentId;
  blobUri: BlobUri;
  storageDurationMs: number;
  traceContext: TraceContext;
}

interface DocumentIntakeFailedEvent {
  eventId: EventId;
  occurredAt: Timestamp;
  documentId?: DocumentId;
  captureRequestId: CaptureRequestId;
  failureReason: FailureReason;
  errorCode: ErrorCode;
  traceContext: TraceContext;
}
```

### Domain Services

```typescript
// Domain/Services/

interface DocumentIntakeService {
  /**
   * Process incoming document from Capture service
   * Ensures idempotency via captureRequestId
   */
  processIncomingDocument(
    request: DocumentUploadRequest,
    traceContext: TraceContext
  ): Promise<DocumentIntakeResult>;

  /**
   * Check if document was already processed (idempotency check)
   */
  checkDuplicateRequest(
    captureRequestId: CaptureRequestId
  ): Promise<DuplicateCheckResult>;
}

interface DocumentValidationService {
  /**
   * Validate document content and metadata
   */
  validate(
    content: FileContent,
    metadata: DocumentMetadata
  ): ValidationResult;
}
```

### Repository Interfaces

```typescript
// Domain/Repositories/

interface DocumentRepository {
  findById(id: DocumentId): Promise<Document | null>;
  findByCaptureRequestId(id: CaptureRequestId): Promise<Document | null>;
  save(document: Document): Promise<void>;
  exists(captureRequestId: CaptureRequestId): Promise<boolean>;
}

interface BlobStorageRepository {
  store(
    content: FileContent,
    path: BlobPath
  ): Promise<BlobUri>;

  exists(uri: BlobUri): Promise<boolean>;
  delete(uri: BlobUri): Promise<void>;
}
```

---

## API Specification

### Endpoint: POST /api/v1/documents/intake

```yaml
openapi: 3.1.0
info:
  title: FlowManager Document Intake API
  version: 1.0.0
  description: API for receiving documents from IIP Capture service

paths:
  /api/v1/documents/intake:
    post:
      operationId: uploadDocument
      summary: Upload document from Capture service
      description: |
        Receives a document with metadata from the on-premise Capture service.
        This endpoint is idempotent - repeated calls with the same captureRequestId
        will return the existing document without re-processing.
      tags:
        - Document Intake

      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required:
                - captureRequestId
                - file
                - metadata
              properties:
                captureRequestId:
                  type: string
                  format: uuid
                  description: |
                    Unique identifier for this upload request from Capture service.
                    Used for idempotency - same ID will return cached response.
                  example: "550e8400-e29b-41d4-a716-446655440000"

                file:
                  type: string
                  format: binary
                  description: The document file content

                filePath:
                  type: string
                  description: Original file path from source system
                  example: "/capture/batch-2026-01/invoice-001.pdf"

                metadata:
                  type: string
                  format: json
                  description: JSON-encoded document metadata
                  example: |
                    {
                      "captureTimestamp": "2026-01-26T10:30:00Z",
                      "sourceSystem": "IIP-CAPTURE-PROD-01",
                      "documentType": "INVOICE",
                      "batchId": "BATCH-2026-01-26-001",
                      "customFields": {
                        "department": "Finance",
                        "priority": "HIGH"
                      }
                    }

                checksum:
                  type: string
                  description: SHA-256 checksum of file content for integrity verification
                  example: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"

      parameters:
        - name: X-Request-ID
          in: header
          required: false
          schema:
            type: string
            format: uuid
          description: Optional request correlation ID for tracing

        - name: X-Idempotency-Key
          in: header
          required: false
          schema:
            type: string
          description: |
            Alternative idempotency key (if captureRequestId not sufficient).
            Recommended format: {captureRequestId}:{filePathHash}

      responses:
        '201':
          description: Document successfully received and stored
          headers:
            X-Request-ID:
              schema:
                type: string
              description: Request correlation ID for tracing
            X-Trace-ID:
              schema:
                type: string
              description: OpenTelemetry trace ID
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DocumentIntakeResponse'

        '200':
          description: |
            Document already processed (idempotent response).
            Returns the existing document details.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DocumentIntakeResponse'

        '400':
          description: Invalid request (validation error)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

        '409':
          description: |
            Conflict - Document with same content but different captureRequestId exists.
            Indicates potential duplicate upload with inconsistent identifiers.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConflictErrorResponse'

        '413':
          description: File too large
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

        '422':
          description: Checksum mismatch - file corrupted during transfer
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChecksumErrorResponse'

        '503':
          description: Service temporarily unavailable (storage backend issue)
          headers:
            Retry-After:
              schema:
                type: integer
              description: Seconds to wait before retrying
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  schemas:
    DocumentIntakeResponse:
      type: object
      required:
        - documentId
        - captureRequestId
        - status
        - blobUri
        - receivedAt
      properties:
        documentId:
          type: string
          format: uuid
          description: Internal document identifier
        captureRequestId:
          type: string
          format: uuid
          description: Original request ID from Capture service
        status:
          type: string
          enum: [RECEIVED, STORED, PROCESSING, COMPLETED, FAILED]
        blobUri:
          type: string
          format: uri
          description: URI where document is stored in blob storage
        receivedAt:
          type: string
          format: date-time
        storedAt:
          type: string
          format: date-time
        metadata:
          $ref: '#/components/schemas/DocumentMetadata'
        traceId:
          type: string
          description: OpenTelemetry trace ID for end-to-end tracing

    DocumentMetadata:
      type: object
      properties:
        captureTimestamp:
          type: string
          format: date-time
        sourceSystem:
          type: string
        documentType:
          type: string
        batchId:
          type: string
        customFields:
          type: object
          additionalProperties: true

    ErrorResponse:
      type: object
      required:
        - error
        - code
        - message
      properties:
        error:
          type: string
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
        traceId:
          type: string

    ConflictErrorResponse:
      allOf:
        - $ref: '#/components/schemas/ErrorResponse'
        - type: object
          properties:
            existingDocumentId:
              type: string
              format: uuid
            existingCaptureRequestId:
              type: string
              format: uuid

    ChecksumErrorResponse:
      allOf:
        - $ref: '#/components/schemas/ErrorResponse'
        - type: object
          properties:
            expectedChecksum:
              type: string
            actualChecksum:
              type: string
```

### Query Endpoint: GET /api/v1/documents/{documentId}

```yaml
paths:
  /api/v1/documents/{documentId}:
    get:
      operationId: getDocument
      summary: Get document status and details
      parameters:
        - name: documentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Document details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DocumentIntakeResponse'
        '404':
          description: Document not found

  /api/v1/documents/by-capture-request/{captureRequestId}:
    get:
      operationId: getDocumentByCaptureRequest
      summary: Get document by Capture service request ID
      description: Useful for checking idempotency status
      parameters:
        - name: captureRequestId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Document details
        '404':
          description: No document found for this capture request
```

---

## OpenTelemetry Implementation

### Trace Context Propagation

```
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│  IIP Capture    │        │  FlowManager    │        │  Blob Storage   │
│    Service      │        │     API         │        │    Service      │
└────────┬────────┘        └────────┬────────┘        └────────┬────────┘
         │                          │                          │
         │  POST /documents/intake  │                          │
         │  traceparent: 00-{trace} │                          │
         │─────────────────────────▶│                          │
         │                          │                          │
         │                          │ ┌──────────────────────┐ │
         │                          │ │ Span: document.intake │ │
         │                          │ │  - captureRequestId  │ │
         │                          │ │  - documentType      │ │
         │                          │ │  - fileSizeBytes     │ │
         │                          │ └──────────────────────┘ │
         │                          │                          │
         │                          │     ┌────────────────┐   │
         │                          │     │Span: validation│   │
         │                          │     └────────────────┘   │
         │                          │                          │
         │                          │     ┌────────────────┐   │
         │                          │     │Span: idempotent│   │
         │                          │     │     check      │   │
         │                          │     └────────────────┘   │
         │                          │                          │
         │                          │  Store Document          │
         │                          │─────────────────────────▶│
         │                          │     ┌────────────────┐   │
         │                          │     │ Span: blob.    │   │
         │                          │     │   upload       │   │
         │                          │     └────────────────┘   │
         │                          │◀─────────────────────────│
         │                          │                          │
         │                          │     ┌────────────────┐   │
         │                          │     │Span: event.    │   │
         │                          │     │  publish       │   │
         │                          │     └────────────────┘   │
         │                          │                          │
         │  201 Created             │                          │
         │  X-Trace-ID: {traceId}   │                          │
         │◀─────────────────────────│                          │
         │                          │                          │
```

### Telemetry Configuration

```typescript
// Infrastructure/Telemetry/OpenTelemetryConfig.ts

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

interface TelemetryConfig {
  serviceName: 'flowmanager-document-intake';
  serviceVersion: string;
  environment: 'development' | 'staging' | 'production';
  otlpEndpoint: string;

  // Sampling configuration
  samplingRatio: number;  // 1.0 = 100% sampling in production for documents

  // Custom attributes for all spans
  defaultAttributes: {
    'service.namespace': 'iip';
    'service.tier': 'intake';
  };
}

// Span naming conventions
const SPAN_NAMES = {
  DOCUMENT_INTAKE: 'document.intake',
  DOCUMENT_VALIDATION: 'document.validation',
  IDEMPOTENCY_CHECK: 'document.idempotency.check',
  BLOB_UPLOAD: 'blob.storage.upload',
  METADATA_PERSIST: 'document.metadata.persist',
  EVENT_PUBLISH: 'event.document.received.publish',
} as const;

// Custom metric definitions
interface DocumentIntakeMetrics {
  // Counter: Total documents received
  'document.intake.total': Counter;

  // Counter: Documents by status (received, stored, failed)
  'document.intake.by_status': Counter;

  // Histogram: Document size distribution
  'document.size.bytes': Histogram;

  // Histogram: Intake processing duration
  'document.intake.duration_ms': Histogram;

  // Counter: Idempotent request hits
  'document.idempotency.cache_hits': Counter;

  // Gauge: Active uploads
  'document.uploads.active': Gauge;
}
```

### Trace Attributes Schema

```typescript
// Semantic attributes for document intake spans
interface DocumentIntakeSpanAttributes {
  // Required attributes
  'document.id': string;
  'document.capture_request_id': string;
  'document.source_system': string;
  'document.type': string;
  'document.size_bytes': number;
  'document.mime_type': string;

  // Idempotency attributes
  'idempotency.key': string;
  'idempotency.cache_hit': boolean;

  // Storage attributes
  'blob.container': string;
  'blob.path': string;
  'blob.uri': string;

  // Processing attributes
  'processing.validation_passed': boolean;
  'processing.checksum_verified': boolean;

  // Error attributes (when applicable)
  'error.type'?: string;
  'error.code'?: string;
  'error.message'?: string;
}
```

---

## Idempotency Strategy

### Multi-Layer Idempotency

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IDEMPOTENCY LAYERS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Request Idempotency Key                                           │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  captureRequestId (UUID from Capture service)                       │     │
│  │  - Primary idempotency key                                          │     │
│  │  - Stored in Redis with TTL (24 hours)                              │     │
│  │  - Returns cached response for duplicate requests                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  Layer 2: Content-Based Deduplication                                       │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  SHA-256(filePath + checksum)                                        │     │
│  │  - Prevents same document with different captureRequestIds          │     │
│  │  - Detects re-uploads of identical content                          │     │
│  │  - Returns 409 Conflict if mismatch detected                        │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  Layer 3: Database Constraints                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  UNIQUE constraint on capture_request_id                            │     │
│  │  - Final safety net at database level                               │     │
│  │  - Handles race conditions                                          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Idempotency Implementation

```typescript
// Infrastructure/Idempotency/IdempotencyService.ts

interface IdempotencyRecord {
  captureRequestId: string;
  contentHash: string;
  documentId: string;
  response: DocumentIntakeResponse;
  createdAt: Date;
  expiresAt: Date;
}

interface IdempotencyService {
  /**
   * Check if request was already processed
   * Returns cached response if found
   */
  checkAndGet(
    captureRequestId: CaptureRequestId
  ): Promise<IdempotencyCheckResult>;

  /**
   * Store response for future idempotent requests
   */
  store(
    captureRequestId: CaptureRequestId,
    contentHash: string,
    response: DocumentIntakeResponse,
    ttl: Duration
  ): Promise<void>;

  /**
   * Check for content-based duplicates
   */
  checkContentDuplicate(
    filePath: FilePath,
    checksum: Checksum
  ): Promise<ContentDuplicateResult>;
}

type IdempotencyCheckResult =
  | { found: false }
  | { found: true; cached: true; response: DocumentIntakeResponse }
  | { found: true; inProgress: true };

type ContentDuplicateResult =
  | { isDuplicate: false }
  | { isDuplicate: true; existingDocumentId: DocumentId; existingCaptureRequestId: CaptureRequestId };
```

### Request Processing Flow with Idempotency

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IDEMPOTENT REQUEST PROCESSING FLOW                        │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐
  │   Request   │
  │   Arrives   │
  └──────┬──────┘
         │
         ▼
  ┌──────────────────┐     Yes    ┌────────────────┐
  │ Check Redis for  │───────────▶│ Return cached  │
  │ captureRequestId │            │   response     │
  └────────┬─────────┘            │   (200 OK)     │
           │ No                   └────────────────┘
           ▼
  ┌──────────────────┐
  │  Acquire Redis   │
  │  distributed     │
  │  lock            │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐     Yes    ┌────────────────┐
  │ Double-check     │───────────▶│ Return cached  │
  │ Redis (DCCP)     │            │   response     │
  └────────┬─────────┘            └────────────────┘
           │ No
           ▼
  ┌──────────────────┐
  │ Mark as          │
  │ "in_progress"    │
  │ in Redis         │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐     Duplicate    ┌────────────────┐
  │ Check content    │─────────────────▶│ Return 409     │
  │ hash             │                  │ Conflict       │
  └────────┬─────────┘                  └────────────────┘
           │ Unique
           ▼
  ┌──────────────────┐
  │ Process document │
  │ (validate,       │
  │  store, etc.)    │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Store response   │
  │ in Redis         │
  │ (TTL: 24h)       │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Release lock     │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Return 201       │
  │ Created          │
  └──────────────────┘
```

---

## Blob Storage Integration

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLOB STORAGE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Storage Account: iipflowmanager{env}                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Container: document-intake                                          │    │
│  │                                                                      │    │
│  │  Path Structure:                                                     │    │
│  │  /{year}/{month}/{day}/{source-system}/{batch-id}/{document-id}/    │    │
│  │                                                                      │    │
│  │  Example:                                                            │    │
│  │  /2026/01/26/IIP-CAPTURE-PROD-01/BATCH-001/550e8400.../             │    │
│  │    ├── content.bin          (original file)                          │    │
│  │    ├── metadata.json        (document metadata)                      │    │
│  │    └── manifest.json        (integrity manifest)                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Container: document-intake-quarantine                               │    │
│  │                                                                      │    │
│  │  For documents that fail validation but need manual review           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Access Tier: Hot (frequently accessed during processing)                   │
│  Replication: GRS (Geo-Redundant Storage)                                   │
│  Encryption: Microsoft-managed keys (or CMK for sensitive data)             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Storage Service Interface

```typescript
// Infrastructure/Storage/BlobStorageService.ts

interface BlobStorageService {
  /**
   * Upload document to blob storage
   * Returns URI for stored blob
   */
  uploadDocument(
    content: FileContent,
    documentId: DocumentId,
    metadata: DocumentMetadata,
    options: UploadOptions
  ): Promise<BlobUploadResult>;

  /**
   * Generate deterministic blob path
   */
  generateBlobPath(
    documentId: DocumentId,
    metadata: DocumentMetadata
  ): BlobPath;

  /**
   * Check if blob already exists
   */
  exists(path: BlobPath): Promise<boolean>;

  /**
   * Create signed URL for downstream services
   */
  generateSasUrl(
    uri: BlobUri,
    permissions: BlobPermissions,
    expiry: Duration
  ): Promise<SasUrl>;
}

interface UploadOptions {
  // Upload behavior
  overwrite: boolean;

  // Blob metadata (stored with blob)
  blobMetadata: {
    captureRequestId: string;
    sourceSystem: string;
    documentType: string;
    uploadTimestamp: string;
  };

  // HTTP headers
  contentType: string;
  contentDisposition?: string;

  // Integrity
  contentMD5?: string;  // For Azure integrity check
}

interface BlobUploadResult {
  uri: BlobUri;
  etag: string;
  versionId?: string;
  contentMD5: string;
  uploadDurationMs: number;
}
```

---

## Security Considerations

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Transport Security                                                       │
│     - TLS 1.3 required for all connections                                   │
│     - Certificate pinning for on-premise Capture service                     │
│     - mTLS optional for additional security                                  │
│                                                                              │
│  2. Authentication                                                           │
│     - OAuth 2.0 Client Credentials flow                                      │
│     - JWT tokens with short expiry (15 minutes)                              │
│     - Capture service uses service principal                                 │
│                                                                              │
│  3. Authorization                                                            │
│     - RBAC with Azure AD / Entra ID                                          │
│     - Required scope: documents:write                                        │
│     - Rate limiting per client ID                                            │
│                                                                              │
│  4. Input Validation                                                         │
│     - File type whitelist (PDF, TIFF, PNG, JPEG, etc.)                       │
│     - Maximum file size: 100MB                                               │
│     - Metadata schema validation                                             │
│     - Sanitization of file paths                                             │
│                                                                              │
│  5. Data Protection                                                          │
│     - Encryption at rest (AES-256)                                           │
│     - Encryption in transit (TLS 1.3)                                        │
│     - No PII in logs (log sanitization)                                      │
│     - Checksum verification for integrity                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Man-in-the-middle | TLS 1.3 + certificate pinning |
| Replay attacks | Idempotency key + timestamp validation |
| File injection | Content type validation, extension whitelist |
| DoS via large files | File size limits, rate limiting |
| Unauthorized access | OAuth 2.0, JWT validation, RBAC |
| Data tampering | SHA-256 checksum verification |
| Information disclosure | Log sanitization, minimal error details |

---

## Consequences

### Positive

1. **Reliability:** Idempotent design ensures no duplicate processing
2. **Observability:** Full OpenTelemetry integration provides end-to-end tracing
3. **Scalability:** Asynchronous processing supports horizontal scaling
4. **Maintainability:** Clean DDD boundaries enable independent evolution
5. **Auditability:** Complete trace history for compliance requirements

### Negative

1. **Complexity:** Multiple idempotency layers add implementation complexity
2. **Dependencies:** Requires Redis for distributed locking and caching
3. **Storage Costs:** Blob storage costs scale with document volume
4. **Latency:** Additional idempotency checks add slight latency

### Neutral

1. **Learning Curve:** Team needs to understand DDD patterns and OpenTelemetry
2. **Infrastructure:** Requires proper setup of telemetry collectors and dashboards

---

## Implementation Plan

### Phase 1: Foundation (Sprint 1-2)

- [ ] Set up project structure following DDD layers
- [ ] Implement core domain entities and value objects
- [ ] Configure OpenTelemetry SDK and exporters
- [ ] Set up Azure Blob Storage with containers

### Phase 2: Core Functionality (Sprint 3-4)

- [ ] Implement DocumentIntakeService with validation
- [ ] Build idempotency service with Redis integration
- [ ] Create REST API endpoint with multipart handling
- [ ] Implement blob storage upload service

### Phase 3: Resilience & Observability (Sprint 5)

- [ ] Add distributed locking for concurrent requests
- [ ] Implement retry policies with exponential backoff
- [ ] Create telemetry dashboards and alerts
- [ ] Add health check endpoints

### Phase 4: Testing & Hardening (Sprint 6)

- [ ] Unit tests for domain logic
- [ ] Integration tests for storage and idempotency
- [ ] Load testing for throughput validation
- [ ] Security review and penetration testing

### Phase 5: Deployment & Monitoring (Sprint 7)

- [ ] Deploy to staging environment
- [ ] End-to-end testing with Capture service
- [ ] Production deployment with feature flags
- [ ] Establish SLOs and monitoring baselines

---

## References

- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/)
- [Azure Blob Storage Documentation](https://docs.microsoft.com/azure/storage/blobs/)
- [Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [RFC 7231 - HTTP/1.1 Semantics](https://tools.ietf.org/html/rfc7231)
- [Idempotency Keys](https://stripe.com/docs/api/idempotent_requests)

---

## Appendix A: Example Request/Response

### Successful Upload

**Request:**
```http
POST /api/v1/documents/intake HTTP/1.1
Host: flowmanager.iip.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
X-Request-ID: 7f8e9d0c-1b2a-3c4d-5e6f-7a8b9c0d1e2f
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="captureRequestId"

550e8400-e29b-41d4-a716-446655440000
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="filePath"

/capture/batch-2026-01/invoice-001.pdf
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="invoice-001.pdf"
Content-Type: application/pdf

<binary content>
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="metadata"

{"captureTimestamp":"2026-01-26T10:30:00Z","sourceSystem":"IIP-CAPTURE-PROD-01","documentType":"INVOICE","batchId":"BATCH-2026-01-26-001","customFields":{"department":"Finance","priority":"HIGH"}}
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="checksum"

a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

**Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json
X-Request-ID: 7f8e9d0c-1b2a-3c4d-5e6f-7a8b9c0d1e2f
X-Trace-ID: 0af7651916cd43dd8448eb211c80319c
Location: /api/v1/documents/d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90

{
  "documentId": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90",
  "captureRequestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "STORED",
  "blobUri": "https://iipflowmanagerprod.blob.core.windows.net/document-intake/2026/01/26/IIP-CAPTURE-PROD-01/BATCH-2026-01-26-001/d4e5f6a7.../content.bin",
  "receivedAt": "2026-01-26T10:30:15.123Z",
  "storedAt": "2026-01-26T10:30:15.456Z",
  "metadata": {
    "captureTimestamp": "2026-01-26T10:30:00Z",
    "sourceSystem": "IIP-CAPTURE-PROD-01",
    "documentType": "INVOICE",
    "batchId": "BATCH-2026-01-26-001",
    "customFields": {
      "department": "Finance",
      "priority": "HIGH"
    }
  },
  "traceId": "0af7651916cd43dd8448eb211c80319c"
}
```

### Idempotent Retry Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Idempotency-Cache-Hit: true

{
  "documentId": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90",
  "captureRequestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "STORED",
  ...
}
```

---

## Appendix B: Database Schema

```sql
-- PostgreSQL schema for document intake records

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capture_request_id UUID NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    blob_uri TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_status CHECK (status IN ('RECEIVED', 'STORED', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX idx_documents_capture_request_id ON documents(capture_request_id);
CREATE INDEX idx_documents_content_hash ON documents(content_hash);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- For content-based deduplication lookups
CREATE INDEX idx_documents_path_hash ON documents(file_path, content_hash);

-- Domain events outbox table (for reliable event publishing)
CREATE TABLE document_events_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    event_type VARCHAR(50) NOT NULL,
    event_payload JSONB NOT NULL,
    trace_context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    CONSTRAINT chk_event_type CHECK (event_type IN ('DocumentReceived', 'DocumentStored', 'DocumentIntakeFailed'))
);

CREATE INDEX idx_outbox_unpublished ON document_events_outbox(created_at) WHERE published_at IS NULL;
```

---

*Document Version: 1.0*
*Last Updated: 2026-01-26*
*Author: System Architecture Team*
