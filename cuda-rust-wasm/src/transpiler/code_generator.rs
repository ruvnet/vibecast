//! Rust code generation from CUDA AST

use quote::{quote, format_ident};
use proc_macro2::TokenStream;
use crate::{Result, translation_error};
use crate::parser::ast::*;

/// Code generator for converting CUDA AST to Rust
pub struct CodeGenerator {
    /// Generated Rust code
    code: TokenStream,
}

impl CodeGenerator {
    /// Create a new code generator
    pub fn new() -> Self {
        Self {
            code: TokenStream::new(),
        }
    }
    
    /// Generate Rust code from AST
    pub fn generate(&mut self, ast: Ast) -> Result<String> {
        // Generate module imports
        let imports = self.generate_imports();
        
        // Generate code for each item
        let items: Vec<TokenStream> = ast.items.into_iter()
            .map(|item| self.generate_item(item))
            .collect::<Result<Vec<_>>>()?;
        
        let code = quote! {
            #imports
            
            #(#items)*
        };
        
        Ok(code.to_string())
    }
    
    /// Generate standard imports
    fn generate_imports(&self) -> TokenStream {
        quote! {
            use cuda_rust_wasm::runtime::{Grid, Block, thread, block, grid};
            use cuda_rust_wasm::memory::{DeviceBuffer, SharedMemory};
            use cuda_rust_wasm::kernel::launch_kernel;
        }
    }
    
    /// Generate code for a single AST item
    fn generate_item(&self, item: Item) -> Result<TokenStream> {
        match item {
            Item::Kernel(kernel) => self.generate_kernel(kernel),
            Item::DeviceFunction(func) => self.generate_device_function(func),
            Item::HostFunction(func) => self.generate_host_function(func),
            Item::GlobalVar(var) => self.generate_global_var(var),
            Item::TypeDef(typedef) => self.generate_typedef(typedef),
            Item::Include(_) => Ok(TokenStream::new()), // Includes handled separately
        }
    }
    
    /// Generate code for a kernel function
    fn generate_kernel(&self, kernel: KernelDef) -> Result<TokenStream> {
        let name = format_ident!("{}", kernel.name);
        let params = self.generate_parameters(&kernel.params)?;
        let body = self.generate_block(&kernel.body)?;
        
        Ok(quote! {
            #[kernel]
            pub fn #name(#params) {
                #body
            }
        })
    }
    
    /// Generate code for a device function
    fn generate_device_function(&self, func: FunctionDef) -> Result<TokenStream> {
        let name = format_ident!("{}", func.name);
        let params = self.generate_parameters(&func.params)?;
        let return_type = self.generate_type(&func.return_type)?;
        let body = self.generate_block(&func.body)?;
        
        Ok(quote! {
            #[device_function]
            pub fn #name(#params) -> #return_type {
                #body
            }
        })
    }
    
    /// Generate code for a host function
    fn generate_host_function(&self, func: FunctionDef) -> Result<TokenStream> {
        let name = format_ident!("{}", func.name);
        let params = self.generate_parameters(&func.params)?;
        let return_type = self.generate_type(&func.return_type)?;
        let body = self.generate_block(&func.body)?;
        
        Ok(quote! {
            pub fn #name(#params) -> #return_type {
                #body
            }
        })
    }
    
    /// Generate function parameters
    fn generate_parameters(&self, params: &[Parameter]) -> Result<TokenStream> {
        let params: Vec<TokenStream> = params.iter()
            .map(|p| {
                let name = format_ident!("{}", p.name);
                let ty = self.generate_type(&p.ty)?;
                Ok(quote! { #name: #ty })
            })
            .collect::<Result<Vec<_>>>()?;
        
        Ok(quote! { #(#params),* })
    }
    
    /// Generate Rust type from CUDA type
    fn generate_type(&self, ty: &Type) -> Result<TokenStream> {
        match ty {
            Type::Void => Ok(quote! { () }),
            Type::Bool => Ok(quote! { bool }),
            Type::Int(int_ty) => Ok(match int_ty {
                IntType::I8 => quote! { i8 },
                IntType::I16 => quote! { i16 },
                IntType::I32 => quote! { i32 },
                IntType::I64 => quote! { i64 },
                IntType::U8 => quote! { u8 },
                IntType::U16 => quote! { u16 },
                IntType::U32 => quote! { u32 },
                IntType::U64 => quote! { u64 },
            }),
            Type::Float(float_ty) => Ok(match float_ty {
                FloatType::F16 => quote! { f16 },
                FloatType::F32 => quote! { f32 },
                FloatType::F64 => quote! { f64 },
            }),
            Type::Pointer(inner) => {
                let inner_ty = self.generate_type(inner)?;
                Ok(quote! { &mut #inner_ty })
            },
            Type::Array(inner, size) => {
                let inner_ty = self.generate_type(inner)?;
                match size {
                    Some(n) => Ok(quote! { [#inner_ty; #n] }),
                    None => Ok(quote! { &[#inner_ty] }),
                }
            },
            Type::Vector(vec_ty) => {
                let elem_ty = self.generate_type(&vec_ty.element)?;
                let size = vec_ty.size as usize;
                Ok(quote! { [#elem_ty; #size] })
            },
            Type::Named(name) => {
                let name = format_ident!("{}", name);
                Ok(quote! { #name })
            },
            Type::Texture(_) => Err(translation_error!("Texture types not yet supported")),
        }
    }
    
    /// Generate code for a block of statements
    fn generate_block(&self, block: &Block) -> Result<TokenStream> {
        let statements: Vec<TokenStream> = block.statements.iter()
            .map(|stmt| self.generate_statement(stmt))
            .collect::<Result<Vec<_>>>()?;
        
        Ok(quote! {
            #(#statements)*
        })
    }
    
    /// Generate code for a statement
    fn generate_statement(&self, stmt: &Statement) -> Result<TokenStream> {
        match stmt {
            Statement::VarDecl { name, ty, init, storage } => {
                let name = format_ident!("{}", name);
                let ty = self.generate_type(ty)?;
                let storage_attr = self.generate_storage_class(storage)?;
                
                match init {
                    Some(init_expr) => {
                        let expr = self.generate_expression(init_expr)?;
                        Ok(quote! {
                            #storage_attr
                            let #name: #ty = #expr;
                        })
                    },
                    None => Ok(quote! {
                        #storage_attr
                        let #name: #ty;
                    }),
                }
            },
            Statement::Expr(expr) => {
                let expr = self.generate_expression(expr)?;
                Ok(quote! { #expr; })
            },
            Statement::Block(block) => {
                let block = self.generate_block(block)?;
                Ok(quote! { { #block } })
            },
            Statement::If { condition, then_branch, else_branch } => {
                let cond = self.generate_expression(condition)?;
                let then_stmt = self.generate_statement(then_branch)?;
                
                match else_branch {
                    Some(else_stmt) => {
                        let else_stmt = self.generate_statement(else_stmt)?;
                        Ok(quote! {
                            if #cond {
                                #then_stmt
                            } else {
                                #else_stmt
                            }
                        })
                    },
                    None => Ok(quote! {
                        if #cond {
                            #then_stmt
                        }
                    }),
                }
            },
            Statement::For { init, condition, update, body } => {
                // Generate init as variable declaration or expression
                let init_stmt = match init {
                    Some(init) => match init.as_ref() {
                        ForInit::VarDecl { name, ty, init } => {
                            let name = format_ident!("{}", name);
                            let ty = self.generate_type(ty)?;
                            match init {
                                Some(init_expr) => {
                                    let expr = self.generate_expression(init_expr)?;
                                    quote! { let mut #name: #ty = #expr; }
                                },
                                None => quote! { let mut #name: #ty; },
                            }
                        },
                        ForInit::Expr(expr) => {
                            let expr = self.generate_expression(expr)?;
                            quote! { #expr; }
                        },
                    },
                    None => TokenStream::new(),
                };
                
                // Generate condition
                let cond = match condition {
                    Some(c) => {
                        let cond_expr = self.generate_expression(c)?;
                        quote! { #cond_expr }
                    },
                    None => quote! { true },
                };
                
                // Generate update
                let update_stmt = match update {
                    Some(u) => {
                        let update_expr = self.generate_expression(u)?;
                        quote! { #update_expr; }
                    },
                    None => TokenStream::new(),
                };
                
                // Generate body
                let body_stmt = self.generate_statement(body)?;
                
                // Construct the for loop as a while loop with init/update
                Ok(quote! {
                    {
                        #init_stmt
                        while #cond {
                            #body_stmt
                            #update_stmt
                        }
                    }
                })
            },
            Statement::While { condition, body } => {
                let cond = self.generate_expression(condition)?;
                let body_stmt = self.generate_statement(body)?;
                Ok(quote! {
                    while #cond {
                        #body_stmt
                    }
                })
            },
            Statement::Return(expr) => {
                match expr {
                    Some(e) => {
                        let expr = self.generate_expression(e)?;
                        Ok(quote! { return #expr; })
                    },
                    None => Ok(quote! { return; }),
                }
            },
            Statement::Break => Ok(quote! { break; }),
            Statement::Continue => Ok(quote! { continue; }),
            Statement::SyncThreads => Ok(quote! { cuda_rust_wasm::runtime::sync_threads(); }),
        }
    }
    
    /// Generate storage class attributes
    fn generate_storage_class(&self, storage: &StorageClass) -> Result<TokenStream> {
        match storage {
            StorageClass::Shared => Ok(quote! { #[shared] }),
            StorageClass::Constant => Ok(quote! { #[constant] }),
            _ => Ok(TokenStream::new()),
        }
    }
    
    /// Generate code for an expression
    fn generate_expression(&self, expr: &Expression) -> Result<TokenStream> {
        match expr {
            Expression::Literal(lit) => self.generate_literal(lit),
            Expression::Var(name) => {
                let name = format_ident!("{}", name);
                Ok(quote! { #name })
            },
            Expression::Binary { op, left, right } => {
                let left = self.generate_expression(left)?;
                let right = self.generate_expression(right)?;
                let op = self.generate_binary_op(op)?;
                Ok(quote! { (#left #op #right) })
            },
            Expression::Unary { op, expr } => {
                let expr = self.generate_expression(expr)?;
                let op = self.generate_unary_op(op)?;
                Ok(quote! { (#op #expr) })
            },
            Expression::Call { name, args } => {
                let name = format_ident!("{}", name);
                let args: Vec<TokenStream> = args.iter()
                    .map(|arg| self.generate_expression(arg))
                    .collect::<Result<Vec<_>>>()?;
                Ok(quote! { #name(#(#args),*) })
            },
            Expression::Index { array, index } => {
                let array = self.generate_expression(array)?;
                let index = self.generate_expression(index)?;
                Ok(quote! { #array[#index] })
            },
            Expression::Member { object, field } => {
                let object = self.generate_expression(object)?;
                let field = format_ident!("{}", field);
                Ok(quote! { #object.#field })
            },
            Expression::Cast { ty, expr } => {
                let ty = self.generate_type(ty)?;
                let expr = self.generate_expression(expr)?;
                Ok(quote! { #expr as #ty })
            },
            Expression::ThreadIdx(dim) => {
                let dim = self.generate_dimension(dim)?;
                Ok(quote! { thread::index().#dim })
            },
            Expression::BlockIdx(dim) => {
                let dim = self.generate_dimension(dim)?;
                Ok(quote! { block::index().#dim })
            },
            Expression::BlockDim(dim) => {
                let dim = self.generate_dimension(dim)?;
                Ok(quote! { block::dim().#dim })
            },
            Expression::GridDim(dim) => {
                let dim = self.generate_dimension(dim)?;
                Ok(quote! { grid::dim().#dim })
            },
            Expression::WarpPrimitive { op, args } => {
                // Generate warp primitive operations
                match op {
                    WarpOp::Shuffle => {
                        if args.len() != 2 {
                            return Err(translation_error!("Warp shuffle requires 2 arguments"));
                        }
                        let value = self.generate_expression(&args[0])?;
                        let lane = self.generate_expression(&args[1])?;
                        Ok(quote! { cuda_rust_wasm::runtime::warp_shuffle(#value, #lane) })
                    },
                    WarpOp::ShuffleXor => {
                        if args.len() != 2 {
                            return Err(translation_error!("Warp shuffle_xor requires 2 arguments"));
                        }
                        let value = self.generate_expression(&args[0])?;
                        let mask = self.generate_expression(&args[1])?;
                        Ok(quote! { cuda_rust_wasm::runtime::warp_shuffle_xor(#value, #mask) })
                    },
                    WarpOp::ShuffleUp => {
                        if args.len() != 2 {
                            return Err(translation_error!("Warp shuffle_up requires 2 arguments"));
                        }
                        let value = self.generate_expression(&args[0])?;
                        let delta = self.generate_expression(&args[1])?;
                        Ok(quote! { cuda_rust_wasm::runtime::warp_shuffle_up(#value, #delta) })
                    },
                    WarpOp::ShuffleDown => {
                        if args.len() != 2 {
                            return Err(translation_error!("Warp shuffle_down requires 2 arguments"));
                        }
                        let value = self.generate_expression(&args[0])?;
                        let delta = self.generate_expression(&args[1])?;
                        Ok(quote! { cuda_rust_wasm::runtime::warp_shuffle_down(#value, #delta) })
                    },
                    WarpOp::Vote => {
                        if args.len() != 1 {
                            return Err(translation_error!("Warp vote requires 1 argument"));
                        }
                        let predicate = self.generate_expression(&args[0])?;
                        Ok(quote! { cuda_rust_wasm::runtime::warp_vote_all(#predicate) })
                    },
                    WarpOp::Ballot => {
                        if args.len() != 1 {
                            return Err(translation_error!("Warp ballot requires 1 argument"));
                        }
                        let predicate = self.generate_expression(&args[0])?;
                        Ok(quote! { cuda_rust_wasm::runtime::warp_ballot(#predicate) })
                    },
                    WarpOp::ActiveMask => {
                        if !args.is_empty() {
                            return Err(translation_error!("Warp activemask takes no arguments"));
                        }
                        Ok(quote! { cuda_rust_wasm::runtime::warp_activemask() })
                    },
                }
            },
        }
    }
    
    /// Generate literal values
    fn generate_literal(&self, lit: &Literal) -> Result<TokenStream> {
        match lit {
            Literal::Bool(b) => Ok(quote! { #b }),
            Literal::Int(i) => Ok(quote! { #i }),
            Literal::UInt(u) => Ok(quote! { #u }),
            Literal::Float(f) => Ok(quote! { #f }),
            Literal::String(s) => Ok(quote! { #s }),
        }
    }
    
    /// Generate binary operator
    fn generate_binary_op(&self, op: &BinaryOp) -> Result<TokenStream> {
        Ok(match op {
            BinaryOp::Add => quote! { + },
            BinaryOp::Sub => quote! { - },
            BinaryOp::Mul => quote! { * },
            BinaryOp::Div => quote! { / },
            BinaryOp::Mod => quote! { % },
            BinaryOp::And => quote! { & },
            BinaryOp::Or => quote! { | },
            BinaryOp::Xor => quote! { ^ },
            BinaryOp::Shl => quote! { << },
            BinaryOp::Shr => quote! { >> },
            BinaryOp::Eq => quote! { == },
            BinaryOp::Ne => quote! { != },
            BinaryOp::Lt => quote! { < },
            BinaryOp::Le => quote! { <= },
            BinaryOp::Gt => quote! { > },
            BinaryOp::Ge => quote! { >= },
            BinaryOp::LogicalAnd => quote! { && },
            BinaryOp::LogicalOr => quote! { || },
            BinaryOp::Assign => quote! { = },
        })
    }
    
    /// Generate unary operator
    fn generate_unary_op(&self, op: &UnaryOp) -> Result<TokenStream> {
        Ok(match op {
            UnaryOp::Not => quote! { ! },
            UnaryOp::Neg => quote! { - },
            UnaryOp::BitNot => quote! { ! },
            UnaryOp::PreInc => quote! { ++ },
            UnaryOp::PreDec => quote! { -- },
            UnaryOp::PostInc => return Err(translation_error!("Post-increment not supported")),
            UnaryOp::PostDec => return Err(translation_error!("Post-decrement not supported")),
            UnaryOp::Deref => quote! { * },
            UnaryOp::AddrOf => quote! { & },
        })
    }
    
    /// Generate dimension accessor
    fn generate_dimension(&self, dim: &Dimension) -> Result<TokenStream> {
        Ok(match dim {
            Dimension::X => quote! { x },
            Dimension::Y => quote! { y },
            Dimension::Z => quote! { z },
        })
    }
    
    /// Generate global variable
    fn generate_global_var(&self, var: GlobalVar) -> Result<TokenStream> {
        let name = format_ident!("{}", var.name);
        let ty = self.generate_type(&var.ty)?;
        let storage_attr = self.generate_storage_class(&var.storage)?;
        
        match var.init {
            Some(init) => {
                let init_expr = self.generate_expression(&init)?;
                Ok(quote! {
                    #storage_attr
                    static #name: #ty = #init_expr;
                })
            },
            None => Ok(quote! {
                #storage_attr
                static #name: #ty;
            }),
        }
    }
    
    /// Generate type definition
    fn generate_typedef(&self, typedef: TypeDef) -> Result<TokenStream> {
        let name = format_ident!("{}", typedef.name);
        let ty = self.generate_type(&typedef.ty)?;
        Ok(quote! {
            type #name = #ty;
        })
    }
}