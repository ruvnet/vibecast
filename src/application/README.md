# Application Layer - FlowManager Document Intake API

This directory contains the **Application Layer** of the FlowManager Document Intake API, following Domain-Driven Design (DDD) principles.

## Overview

The Application Layer orchestrates the flow of data between the Presentation (API) layer and the Domain layer. It contains:

- **Commands** - Write operations (CQRS pattern)
- **Queries** - Read operations (CQRS pattern)
- **Services** - Application-level orchestration logic
- **Types** - DTOs and result types

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Commands/                  Queries/                         │
│  ├─ UploadDocumentCommand   ├─ GetDocumentQuery             │
│  └─ CommandHandlers         └─ QueryHandlers                │
│                                                              │
│  Services/                                                   │
│  ├─ DocumentIntakeService                                    │
│  └─ DocumentValidationService                               │
│                                                              │
│  Types/                                                      │
│  ├─ DocumentIntakeResult                                     │
│  └─ DocumentDto                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
        ↓ depends on                    ↑ used by
┌─────────────────────┐        ┌─────────────────────┐
│   Domain Layer      │        │  Presentation Layer │
│  (entities, VOs)    │        │   (REST API)        │
└─────────────────────┘        └─────────────────────┘
```

## Command/Query Responsibility Segregation (CQRS)

### Commands (Write Operations)

Commands represent **write operations** that change system state:

- **UploadDocumentCommand** - Upload a document from the Capture service
  - Handler: `UploadDocumentCommandHandler`
  - Flow: Validation → Storage → Persistence → Event Publishing

### Queries (Read Operations)

Queries represent **read operations** that retrieve data:

- **GetDocumentQuery** - Retrieve document by document ID
  - Handler: `GetDocumentQueryHandler`

- **GetDocumentByCaptureRequestQuery** - Retrieve document by capture request ID
  - Handler: `GetDocumentByCaptureRequestQueryHandler`

## Services

### DocumentIntakeService

Main orchestration service for document intake process.

**Responsibilities:**
- Coordinate document upload flow
- Store documents in blob storage
- Persist document metadata
- Publish domain events

**Dependencies:**
- `blobStorageRepository` - For storing document content
- `documentRepository` - For persisting document records
- `eventPublisher` - For publishing domain events
- `telemetryService` - For OpenTelemetry tracing
- `logger` - For logging

### DocumentValidationService

Validates document content and metadata according to business rules.

**Responsibilities:**
- Validate file size and MIME type
- Validate metadata structure and format
- Verify file checksums (SHA-256)
- Sanitize inputs

**Validation Rules:**
- Max file size: 100MB
- Allowed MIME types: PDF, TIFF, PNG, JPEG, DOCX
- Required metadata fields: captureTimestamp, sourceSystem, documentType
- Checksum format: SHA-256 (64 hex characters)

## Usage Examples

### Upload Document

```typescript
import {
  UploadDocumentCommandHandler,
  UploadDocumentCommandFactory,
} from './application';

// Create command
const command = UploadDocumentCommandFactory.create({
  captureRequestId: '550e8400-e29b-41d4-a716-446655440000',
  file: fileBuffer,
  filePath: '/capture/batch-2026-01/invoice-001.pdf',
  metadata: {
    captureTimestamp: '2026-01-26T10:30:00Z',
    sourceSystem: 'IIP-CAPTURE-PROD-01',
    documentType: 'INVOICE',
    batchId: 'BATCH-2026-01-26-001',
  },
  checksum: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
  mimeType: 'application/pdf',
  sizeBytes: 1024000,
});

// Execute command
const handler = new UploadDocumentCommandHandler(dependencies);
const result = await handler.execute(command);

console.log('Document uploaded:', result.documentId);
```

### Query Document

```typescript
import {
  GetDocumentQueryHandler,
  GetDocumentQueryFactory,
} from './application';

// Create query
const query = GetDocumentQueryFactory.create({
  documentId: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90',
});

// Execute query
const handler = new GetDocumentQueryHandler(dependencies);
const document = await handler.execute(query);

if (document) {
  console.log('Document found:', document.status);
} else {
  console.log('Document not found');
}
```

## Dependency Injection

All handlers and services use **constructor injection** for dependencies. This promotes:

- **Testability** - Easy to mock dependencies in unit tests
- **Loose Coupling** - Application layer doesn't depend on concrete implementations
- **Flexibility** - Easy to swap implementations (e.g., different storage providers)

Example dependency structure:

```typescript
const dependencies: UploadDocumentCommandHandlerDependencies = {
  documentIntakeService: new DocumentIntakeService(...),
  documentValidationService: new DocumentValidationService(),
  idempotencyService: new RedisIdempotencyService(...),
  blobStorageRepository: new AzureBlobStorageRepository(...),
  documentRepository: new PostgresDocumentRepository(...),
  eventPublisher: new EventBusPublisher(...),
  telemetryService: new OpenTelemetryService(...),
  logger: new WinstonLogger(...),
};

const handler = new UploadDocumentCommandHandler(dependencies);
```

## Error Handling

The application layer defines custom error types:

- **ValidationError** - Validation failures (content or metadata)
- **ChecksumMismatchError** - File integrity check failed
- **ConflictError** - Content duplicate with different captureRequestId

These errors are caught and translated to appropriate HTTP responses in the Presentation layer.

## OpenTelemetry Integration

All operations are instrumented with OpenTelemetry for distributed tracing:

```typescript
await telemetryService.startSpan('document.intake', async (span) => {
  span.setAttributes({
    'document.capture_request_id': command.captureRequestId,
    'document.type': command.metadata.documentType,
  });

  // ... operation logic
});
```

## Testing

Each component should have corresponding unit tests:

```
tests/
├─ commands/
│  ├─ UploadDocumentCommandHandler.test.ts
├─ queries/
│  ├─ GetDocumentQueryHandler.test.ts
├─ services/
│  ├─ DocumentIntakeService.test.ts
│  └─ DocumentValidationService.test.ts
```

Example test:

```typescript
describe('DocumentValidationService', () => {
  it('should reject files larger than 100MB', () => {
    const service = new DocumentValidationService();

    const result = service.validateContent({
      data: Buffer.alloc(1024),
      mimeType: 'application/pdf',
      sizeBytes: 101 * 1024 * 1024, // 101MB
      checksum: 'abc123...',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('File size exceeds maximum');
  });
});
```

## Next Steps

1. Implement Domain Layer with:
   - Document aggregate root
   - Value objects (DocumentId, FilePath, etc.)
   - Domain events
   - Repository interfaces

2. Implement Infrastructure Layer with:
   - Repository implementations (PostgreSQL)
   - Blob storage implementation (Azure Blob Storage)
   - Event publisher implementation
   - Idempotency service (Redis)

3. Implement Presentation Layer with:
   - REST API controllers
   - Request/response mapping
   - Error handling middleware
   - OpenAPI documentation

## References

- [ADR-001: FlowManager Document Intake API](../../plans/ADR-001-flowmanager-document-intake-api.md)
- [Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
