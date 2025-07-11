//! CUDA code parsing module

pub mod cuda_parser;
pub mod ptx_parser;
pub mod ast;
pub mod kernel_extractor;
pub mod lexer;

pub use cuda_parser::CudaParser;
pub use ast::{Ast, KernelDef, Statement, Expression};

/// Parse CUDA source code and return AST
pub fn parse(source: &str) -> crate::Result<Ast> {
    let parser = CudaParser::new();
    parser.parse(source)
}