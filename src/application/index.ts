/**
 * Application Layer - Public API
 *
 * Exports all commands, queries, services, and types from the application layer.
 */

// Commands
export {
  UploadDocumentCommand,
  DocumentMetadataDto,
  UploadDocumentCommandFactory,
} from './commands/UploadDocumentCommand';

export {
  UploadDocumentCommandHandler,
  UploadDocumentCommandHandlerDependencies,
  ValidationError,
  ChecksumMismatchError,
  ConflictError,
} from './commands/UploadDocumentCommandHandler';

// Queries
export {
  GetDocumentQuery,
  GetDocumentQueryFactory,
} from './queries/GetDocumentQuery';

export {
  GetDocumentByCaptureRequestQuery,
  GetDocumentByCaptureRequestQueryFactory,
} from './queries/GetDocumentByCaptureRequestQuery';

export {
  GetDocumentQueryHandler,
  GetDocumentQueryHandlerDependencies,
} from './queries/GetDocumentQueryHandler';

export {
  GetDocumentByCaptureRequestQueryHandler,
  GetDocumentByCaptureRequestQueryHandlerDependencies,
} from './queries/GetDocumentByCaptureRequestQueryHandler';

// Services
export {
  DocumentIntakeService,
  DocumentIntakeServiceDependencies,
  DocumentUploadRequest,
} from './services/DocumentIntakeService';

export {
  DocumentValidationService,
  ValidationResult,
  ContentValidationInput,
} from './services/DocumentValidationService';

// Types
export {
  DocumentIntakeResult,
  DocumentStatus,
} from './types/DocumentIntakeResult';

export { DocumentDto } from './types/DocumentDto';
