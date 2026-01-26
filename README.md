# Vibecast - FlowManager Document Intake API

Weekly Vibecast Live coding sessions with rUv. Check branches for each week.

## Current Branch: FlowManager Document Intake API

This branch implements the Domain layer for the FlowManager Document Intake API following Domain-Driven Design (DDD) principles as specified in ADR-001.

### Architecture Overview

The project follows a clean architecture with DDD tactical patterns:

```
src/
├── domain/              # Core business logic (framework-agnostic)
│   ├── value-objects/   # Immutable value objects
│   │   ├── CaptureRequestId.ts
│   │   ├── FilePath.ts
│   │   ├── DocumentMetadata.ts
│   │   ├── FileContent.ts
│   │   ├── Checksum.ts
│   │   └── BlobUri.ts
│   ├── entities/        # Domain entities and aggregates
│   │   ├── Document.ts (Aggregate Root)
│   │   └── DocumentStatus.ts
│   ├── events/          # Domain events
│   │   ├── DocumentReceivedEvent.ts
│   │   ├── DocumentStoredEvent.ts
│   │   └── DocumentIntakeFailedEvent.ts
│   └── repositories/    # Repository interfaces
│       ├── IDocumentRepository.ts
│       └── IBlobStorageRepository.ts
├── application/         # Use cases (to be implemented)
├── infrastructure/      # External concerns (to be implemented)
└── presentation/        # API layer (to be implemented)
```

### Domain Layer Implementation

The domain layer is fully implemented with:

#### Value Objects (Immutable)
- **CaptureRequestId**: UUID v4 idempotency key with validation
- **FilePath**: Parsed file path with hash generation and path traversal protection
- **DocumentMetadata**: Capture metadata with comprehensive validation
- **FileContent**: Binary content with checksum (supports Buffer and Stream)
- **Checksum**: SHA-256 hash for integrity verification
- **BlobUri**: Azure Blob Storage URI with container/path parsing

#### Entities
- **Document** (Aggregate Root): Complete document lifecycle management with status transitions
- **DocumentStatus**: Status enum with validated state machine transitions

#### Domain Events
- **DocumentReceivedEvent**: Published when document arrives from Capture service
- **DocumentStoredEvent**: Published when blob storage succeeds
- **DocumentIntakeFailedEvent**: Published on failure with detailed error information

#### Repository Interfaces
- **IDocumentRepository**: Document persistence operations
- **IBlobStorageRepository**: Blob storage operations with SAS URL generation

### Key Features

- **Strict TypeScript**: Full type safety with strictest compiler options
- **Immutability**: All value objects are immutable by design
- **Validation**: Comprehensive validation in factory methods (fail-fast)
- **Domain Events**: Event-driven architecture with OpenTelemetry trace context
- **Status Transitions**: Validated state machine for document lifecycle
- **Idempotency**: Built-in support via CaptureRequestId
- **Content Deduplication**: Hash-based duplicate detection
- **Security**: Path traversal protection, checksum verification

### Getting Started

#### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

#### Installation

```bash
npm install
```

#### Build

```bash
# Build once
npm run build

# Watch mode
npm run build:watch

# Type checking only
npm run type-check
```

#### Development

```bash
# Format code
npm run format

# Lint
npm run lint
npm run lint:fix
```

#### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Usage Example

```typescript
import {
  Document,
  CaptureRequestId,
  FilePath,
  DocumentMetadata,
  FileContent,
  Checksum,
  BlobUri,
} from '@domain';

// Create value objects with validation
const captureRequestId = CaptureRequestId.create('550e8400-e29b-41d4-a716-446655440000');
const filePath = FilePath.create('/capture/batch-2026-01/invoice-001.pdf');
const metadata = DocumentMetadata.create({
  captureTimestamp: new Date(),
  sourceSystem: 'IIP-CAPTURE-PROD-01',
  documentType: 'INVOICE',
  batchId: 'BATCH-2026-01-26-001',
  customFields: {
    department: 'Finance',
    priority: 'HIGH',
  },
});

const checksum = Checksum.fromBuffer(fileBuffer);
const content = FileContent.createFromBuffer({
  data: fileBuffer,
  mimeType: 'application/pdf',
  checksum,
});

// Create document aggregate
const document = Document.create({
  captureRequestId,
  filePath,
  metadata,
  content,
});

// Update document status with validation
const blobUri = BlobUri.create({
  container: 'document-intake',
  path: '2026/01/26/document.pdf',
  storageAccountName: 'iipflowmanagerprod',
});

document.markAsStored(blobUri); // Validates status transition
```

### Design Patterns

1. **Value Objects**: Immutable, self-validating domain primitives
2. **Aggregate Root**: Document entity enforces consistency boundaries
3. **Domain Events**: Enable event-driven architecture and decoupling
4. **Repository Pattern**: Abstract persistence from domain logic
5. **Factory Methods**: Static `create()` methods for validated construction

### Architecture Documentation

See [ADR-001](/home/user/vibecast/plans/ADR-001-flowmanager-document-intake-api.md) for:
- Complete API specification (OpenAPI 3.1)
- OpenTelemetry implementation details
- Idempotency strategy (multi-layer)
- Blob storage architecture
- Security considerations
- Implementation roadmap

### Contributing

Follow DDD principles:
1. Keep domain layer pure - no infrastructure dependencies
2. Use value objects for all domain primitives
3. Validate at boundaries (factory methods)
4. Publish domain events for state changes
5. Use repository interfaces, not implementations

### License

MIT 
