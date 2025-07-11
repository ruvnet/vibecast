//! CUDA to Rust transpilation module

pub mod kernel_translator;
pub mod memory_mapper;
pub mod type_converter;
pub mod builtin_functions;
pub mod code_generator;
pub mod wgsl;

#[cfg(test)]
mod tests;

use crate::{Result, translation_error};
use crate::parser::ast::Ast;

/// Main transpiler for converting CUDA AST to Rust code
pub struct Transpiler {
    // Transpiler configuration
}

/// High-level CUDA transpiler interface
pub struct CudaTranspiler {
    inner: Transpiler,
}

impl Transpiler {
    /// Create a new transpiler instance
    pub fn new() -> Self {
        Self {}
    }
    
    /// Transpile CUDA AST to Rust code
    pub fn transpile(&self, ast: Ast) -> Result<String> {
        let mut code_gen = code_generator::CodeGenerator::new();
        code_gen.generate(ast)
    }
    
    /// Transpile CUDA AST to WebGPU Shading Language (WGSL)
    #[cfg(feature = "webgpu-only")]
    pub fn to_wgsl(&self, ast: Ast) -> Result<String> {
        let mut wgsl_gen = wgsl::WgslGenerator::new();
        wgsl_gen.generate(ast)
    }
}

impl Default for Transpiler {
    fn default() -> Self {
        Self::new()
    }
}

impl CudaTranspiler {
    /// Create a new CUDA transpiler
    pub fn new() -> Self {
        Self {
            inner: Transpiler::new(),
        }
    }
    
    /// Transpile CUDA source code to Rust
    pub fn transpile(&self, cuda_source: &str, _optimize: bool, _detect_patterns: bool) -> Result<String> {
        use crate::parser::CudaParser;
        let mut parser = CudaParser::new();
        let ast = parser.parse(cuda_source)?;
        self.inner.transpile(ast)
    }
    
    /// Generate WebGPU shader from CUDA source
    #[cfg(feature = "webgpu-only")]
    pub fn generate_wgsl(&self, cuda_source: &str) -> Result<String> {
        use crate::parser::CudaParser;
        let mut parser = CudaParser::new();
        let ast = parser.parse(cuda_source)?;
        self.inner.to_wgsl(ast)
    }
    
    /// Generate WebGPU shader from CUDA source (fallback)
    #[cfg(not(feature = "webgpu-only"))]
    pub fn generate_wgsl(&self, _cuda_source: &str) -> Result<String> {
        Ok("// WGSL generation requires webgpu-only feature".to_string())
    }
}