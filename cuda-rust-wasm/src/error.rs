//! Error types for CUDA-Rust transpiler

use thiserror::Error;

/// Main error type for CUDA-Rust operations
#[derive(Error, Debug)]
pub enum CudaRustError {
    /// Parser encountered an error
    #[error("Parser error: {0}")]
    ParseError(String),
    
    /// Translation/transpilation error
    #[error("Translation error: {0}")]
    TranslationError(String),
    
    /// Runtime execution error
    #[error("Runtime error: {0}")]
    RuntimeError(String),
    
    /// Memory allocation or management error
    #[error("Memory error: {0}")]
    MemoryError(String),
    
    /// Backend-specific error
    #[error("Backend error: {0}")]
    BackendError(String),
    
    /// Kernel compilation error
    #[error("Kernel compilation error: {0}")]
    KernelError(String),
    
    /// Device not found or not supported
    #[error("Device error: {0}")]
    DeviceError(String),
    
    /// Invalid argument provided
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    
    /// Feature not yet implemented
    #[error("Not implemented: {0}")]
    NotImplemented(String),
    
    /// WebGPU-specific error
    #[cfg(feature = "webgpu-only")]
    #[error("WebGPU error: {0}")]
    WebGPUError(String),
    
    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Convenient Result type alias
pub type Result<T> = std::result::Result<T, CudaRustError>;

/// Helper macro for creating parse errors
#[macro_export]
macro_rules! parse_error {
    ($msg:expr) => {
        $crate::error::CudaRustError::ParseError($msg.to_string())
    };
    ($fmt:expr, $($arg:tt)*) => {
        $crate::error::CudaRustError::ParseError(format!($fmt, $($arg)*))
    };
}

/// Helper macro for creating translation errors
#[macro_export]
macro_rules! translation_error {
    ($msg:expr) => {
        $crate::error::CudaRustError::TranslationError($msg.to_string())
    };
    ($fmt:expr, $($arg:tt)*) => {
        $crate::error::CudaRustError::TranslationError(format!($fmt, $($arg)*))
    };
}

/// Helper macro for creating runtime errors
#[macro_export]
macro_rules! runtime_error {
    ($msg:expr) => {
        $crate::error::CudaRustError::RuntimeError($msg.to_string())
    };
    ($fmt:expr, $($arg:tt)*) => {
        $crate::error::CudaRustError::RuntimeError(format!($fmt, $($arg)*))
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = CudaRustError::ParseError("Invalid syntax".to_string());
        assert_eq!(err.to_string(), "Parser error: Invalid syntax");
    }
    
    #[test]
    fn test_error_macros() {
        let err = parse_error!("test error");
        assert!(matches!(err, CudaRustError::ParseError(_)));
        
        let err = parse_error!("error: {}", 42);
        assert_eq!(err.to_string(), "Parser error: error: 42");
    }
}