//! CUDA kernel pattern translation

use crate::{Result, translation_error};
use crate::parser::ast::*;
use quote::{quote, format_ident};
use proc_macro2::TokenStream;

/// Translator for common CUDA kernel patterns
pub struct KernelTranslator {
    /// Thread block dimensions for optimization
    block_dims: Option<(u32, u32, u32)>,
    /// Grid dimensions for optimization
    grid_dims: Option<(u32, u32, u32)>,
}

impl KernelTranslator {
    /// Create a new kernel translator
    pub fn new() -> Self {
        Self {
            block_dims: None,
            grid_dims: None,
        }
    }
    
    /// Set block dimensions for optimization
    pub fn with_block_dims(mut self, x: u32, y: u32, z: u32) -> Self {
        self.block_dims = Some((x, y, z));
        self
    }
    
    /// Set grid dimensions for optimization
    pub fn with_grid_dims(mut self, x: u32, y: u32, z: u32) -> Self {
        self.grid_dims = Some((x, y, z));
        self
    }
    
    /// Translate a vector addition kernel pattern
    pub fn translate_vector_add(&self, kernel: &KernelDef) -> Result<TokenStream> {
        // Verify kernel signature matches vector addition pattern
        if kernel.params.len() != 3 {
            return Err(translation_error!("Vector addition requires 3 parameters"));
        }
        
        let kernel_name = format_ident!("{}", kernel.name);
        
        Ok(quote! {
            #[kernel]
            pub fn #kernel_name(
                a: &[f32],
                b: &[f32],
                c: &mut [f32],
            ) {
                let idx = thread::index().x + block::index().x * block::dim().x;
                if idx < c.len() as u32 {
                    c[idx as usize] = a[idx as usize] + b[idx as usize];
                }
            }
        })
    }
    
    /// Translate a matrix multiplication kernel pattern
    pub fn translate_matrix_mul(&self, kernel: &KernelDef) -> Result<TokenStream> {
        // Verify kernel signature matches matrix multiplication pattern
        if kernel.params.len() < 5 {
            return Err(translation_error!("Matrix multiplication requires at least 5 parameters"));
        }
        
        let kernel_name = format_ident!("{}", kernel.name);
        
        Ok(quote! {
            #[kernel]
            pub fn #kernel_name(
                a: &[f32],
                b: &[f32],
                c: &mut [f32],
                m: u32,
                n: u32,
                k: u32,
            ) {
                let row = thread::index().y + block::index().y * block::dim().y;
                let col = thread::index().x + block::index().x * block::dim().x;
                
                if row < m && col < n {
                    let mut sum = 0.0f32;
                    for i in 0..k {
                        sum += a[(row * k + i) as usize] * b[(i * n + col) as usize];
                    }
                    c[(row * n + col) as usize] = sum;
                }
            }
        })
    }
    
    /// Translate a reduction kernel pattern
    pub fn translate_reduction(&self, kernel: &KernelDef) -> Result<TokenStream> {
        let kernel_name = format_ident!("{}", kernel.name);
        
        Ok(quote! {
            #[kernel]
            pub fn #kernel_name(
                input: &[f32],
                output: &mut [f32],
                n: u32,
            ) {
                // Shared memory for partial sums
                #[shared]
                static mut PARTIAL_SUMS: [f32; 256] = [0.0; 256];
                
                let tid = thread::index().x;
                let gid = block::index().x * block::dim().x + tid;
                let block_size = block::dim().x;
                
                // Load data and perform first reduction
                let mut sum = 0.0f32;
                let mut i = gid;
                while i < n {
                    sum += input[i as usize];
                    i += grid::dim().x * block_size;
                }
                
                // Store to shared memory
                unsafe {
                    PARTIAL_SUMS[tid as usize] = sum;
                }
                
                // Synchronize threads
                cuda_rust_wasm::runtime::sync_threads();
                
                // Perform reduction in shared memory
                let mut stride = block_size / 2;
                while stride > 0 {
                    if tid < stride {
                        unsafe {
                            PARTIAL_SUMS[tid as usize] += PARTIAL_SUMS[(tid + stride) as usize];
                        }
                    }
                    cuda_rust_wasm::runtime::sync_threads();
                    stride /= 2;
                }
                
                // Write result
                if tid == 0 {
                    output[block::index().x as usize] = unsafe { PARTIAL_SUMS[0] };
                }
            }
        })
    }
    
    /// Translate a stencil computation kernel pattern
    pub fn translate_stencil(&self, kernel: &KernelDef) -> Result<TokenStream> {
        let kernel_name = format_ident!("{}", kernel.name);
        
        Ok(quote! {
            #[kernel]
            pub fn #kernel_name(
                input: &[f32],
                output: &mut [f32],
                width: u32,
                height: u32,
            ) {
                let x = thread::index().x + block::index().x * block::dim().x;
                let y = thread::index().y + block::index().y * block::dim().y;
                
                if x > 0 && x < width - 1 && y > 0 && y < height - 1 {
                    let idx = (y * width + x) as usize;
                    let idx_n = ((y - 1) * width + x) as usize;
                    let idx_s = ((y + 1) * width + x) as usize;
                    let idx_e = (y * width + (x + 1)) as usize;
                    let idx_w = (y * width + (x - 1)) as usize;
                    
                    // 5-point stencil
                    output[idx] = 0.2 * (
                        input[idx] +
                        input[idx_n] +
                        input[idx_s] +
                        input[idx_e] +
                        input[idx_w]
                    );
                }
            }
        })
    }
    
    /// Detect kernel pattern from AST
    pub fn detect_pattern(&self, kernel: &KernelDef) -> KernelPattern {
        // Analyze kernel body to detect pattern
        if self.is_vector_pattern(kernel) {
            KernelPattern::VectorAdd
        } else if self.is_matrix_pattern(kernel) {
            KernelPattern::MatrixMul
        } else if self.is_reduction_pattern(kernel) {
            KernelPattern::Reduction
        } else if self.is_stencil_pattern(kernel) {
            KernelPattern::Stencil
        } else {
            KernelPattern::Generic
        }
    }
    
    /// Check if kernel matches vector operation pattern
    fn is_vector_pattern(&self, kernel: &KernelDef) -> bool {
        // Look for simple element-wise operations
        kernel.params.len() >= 3 && 
        self.has_linear_indexing(&kernel.body)
    }
    
    /// Check if kernel matches matrix operation pattern
    fn is_matrix_pattern(&self, kernel: &KernelDef) -> bool {
        // Look for 2D indexing patterns
        kernel.params.len() >= 5 &&
        self.has_2d_indexing(&kernel.body)
    }
    
    /// Check if kernel matches reduction pattern
    fn is_reduction_pattern(&self, kernel: &KernelDef) -> bool {
        // Look for shared memory usage and tree reduction
        self.has_shared_memory(&kernel.body) &&
        self.has_sync_threads(&kernel.body)
    }
    
    /// Check if kernel matches stencil pattern
    fn is_stencil_pattern(&self, kernel: &KernelDef) -> bool {
        // Look for neighbor access patterns
        self.has_neighbor_access(&kernel.body)
    }
    
    /// Check for linear indexing pattern
    fn has_linear_indexing(&self, block: &Block) -> bool {
        // Simplified check - look for threadIdx.x + blockIdx.x * blockDim.x
        block.statements.iter().any(|stmt| {
            match stmt {
                Statement::VarDecl { init: Some(expr), .. } => {
                    self.is_linear_index_expr(expr)
                },
                Statement::Expr(expr) => self.contains_linear_index(expr),
                _ => false,
            }
        })
    }
    
    /// Check for 2D indexing pattern
    fn has_2d_indexing(&self, block: &Block) -> bool {
        // Look for both x and y dimension usage
        let has_x = block.statements.iter().any(|stmt| self.uses_dimension(stmt, &Dimension::X));
        let has_y = block.statements.iter().any(|stmt| self.uses_dimension(stmt, &Dimension::Y));
        has_x && has_y
    }
    
    /// Check for shared memory usage
    fn has_shared_memory(&self, block: &Block) -> bool {
        block.statements.iter().any(|stmt| {
            match stmt {
                Statement::VarDecl { storage, .. } => matches!(storage, StorageClass::Shared),
                _ => false,
            }
        })
    }
    
    /// Check for sync_threads calls
    fn has_sync_threads(&self, block: &Block) -> bool {
        block.statements.iter().any(|stmt| {
            matches!(stmt, Statement::SyncThreads)
        })
    }
    
    /// Check for neighbor access patterns
    fn has_neighbor_access(&self, block: &Block) -> bool {
        // Look for array accesses with +1/-1 offsets
        block.statements.iter().any(|stmt| {
            self.has_offset_access(stmt)
        })
    }
    
    /// Helper: Check if expression is linear index
    fn is_linear_index_expr(&self, expr: &Expression) -> bool {
        match expr {
            Expression::Binary { op: BinaryOp::Add, left, right } => {
                // Check for threadIdx.x + blockIdx.x * blockDim.x pattern
                matches!(left.as_ref(), Expression::ThreadIdx(Dimension::X)) ||
                self.is_block_offset(right)
            },
            _ => false,
        }
    }
    
    /// Helper: Check if expression contains linear indexing
    fn contains_linear_index(&self, expr: &Expression) -> bool {
        match expr {
            Expression::Binary { left, right, .. } => {
                self.contains_linear_index(left) || self.contains_linear_index(right)
            },
            Expression::Index { index, .. } => self.is_linear_index_expr(index),
            _ => false,
        }
    }
    
    /// Helper: Check if expression is block offset
    fn is_block_offset(&self, expr: &Expression) -> bool {
        match expr {
            Expression::Binary { op: BinaryOp::Mul, left, right } => {
                matches!(left.as_ref(), Expression::BlockIdx(Dimension::X)) &&
                matches!(right.as_ref(), Expression::BlockDim(Dimension::X))
            },
            _ => false,
        }
    }
    
    /// Helper: Check if statement uses dimension
    fn uses_dimension(&self, stmt: &Statement, dim: &Dimension) -> bool {
        match stmt {
            Statement::VarDecl { init: Some(expr), .. } => self.expr_uses_dimension(expr, dim),
            Statement::Expr(expr) => self.expr_uses_dimension(expr, dim),
            _ => false,
        }
    }
    
    /// Helper: Check if expression uses dimension
    fn expr_uses_dimension(&self, expr: &Expression, dim: &Dimension) -> bool {
        match expr {
            Expression::ThreadIdx(d) | Expression::BlockIdx(d) | 
            Expression::BlockDim(d) | Expression::GridDim(d) => d == dim,
            Expression::Binary { left, right, .. } => {
                self.expr_uses_dimension(left, dim) || self.expr_uses_dimension(right, dim)
            },
            _ => false,
        }
    }
    
    /// Helper: Check for offset array access
    fn has_offset_access(&self, stmt: &Statement) -> bool {
        match stmt {
            Statement::Expr(expr) => self.expr_has_offset_access(expr),
            Statement::VarDecl { init: Some(expr), .. } => self.expr_has_offset_access(expr),
            _ => false,
        }
    }
    
    /// Helper: Check expression for offset access
    fn expr_has_offset_access(&self, expr: &Expression) -> bool {
        match expr {
            Expression::Index { index, .. } => {
                // Check if index contains +1 or -1
                self.has_unit_offset(index)
            },
            Expression::Binary { left, right, .. } => {
                self.expr_has_offset_access(left) || self.expr_has_offset_access(right)
            },
            _ => false,
        }
    }
    
    /// Helper: Check for unit offset in expression
    fn has_unit_offset(&self, expr: &Expression) -> bool {
        match expr {
            Expression::Binary { op: BinaryOp::Add | BinaryOp::Sub, left: _, right } => {
                matches!(right.as_ref(), Expression::Literal(Literal::Int(1)))
            },
            _ => false,
        }
    }
}

/// Common CUDA kernel patterns
#[derive(Debug, Clone, PartialEq)]
pub enum KernelPattern {
    VectorAdd,
    MatrixMul,
    Reduction,
    Stencil,
    Generic,
}

impl Default for KernelTranslator {
    fn default() -> Self {
        Self::new()
    }
}