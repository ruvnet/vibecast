//! WebGPU Shading Language (WGSL) generation from CUDA AST

use crate::{Result, translation_error};
use crate::parser::ast::*;
use std::fmt::Write;

/// WGSL code generator for converting CUDA AST to WebGPU shaders
pub struct WgslGenerator {
    /// Generated WGSL code
    code: String,
    /// Current indentation level
    indent_level: usize,
    /// Workgroup size configuration
    workgroup_size: (u32, u32, u32),
}

impl WgslGenerator {
    /// Create a new WGSL generator
    pub fn new() -> Self {
        Self {
            code: String::new(),
            indent_level: 0,
            workgroup_size: (64, 1, 1), // Default workgroup size
        }
    }
    
    /// Set workgroup size for compute shaders
    pub fn with_workgroup_size(mut self, x: u32, y: u32, z: u32) -> Self {
        self.workgroup_size = (x, y, z);
        self
    }
    
    /// Generate WGSL code from AST
    pub fn generate(&mut self, ast: Ast) -> Result<String> {
        // Generate struct definitions for kernel parameters
        self.generate_structs(&ast)?;
        
        // Generate global variables
        for item in &ast.items {
            if let Item::GlobalVar(var) = item {
                self.generate_global_var(var)?;
            }
        }
        
        // Generate device functions
        for item in &ast.items {
            if let Item::DeviceFunction(func) = item {
                self.generate_device_function(func)?;
            }
        }
        
        // Generate compute kernels
        for item in &ast.items {
            if let Item::Kernel(kernel) = item {
                self.generate_kernel(kernel)?;
            }
        }
        
        Ok(self.code.clone())
    }
    
    /// Generate struct definitions for kernel parameters
    fn generate_structs(&mut self, ast: &Ast) -> Result<()> {
        // For each kernel, generate binding structs
        let mut binding_index = 0;
        
        for item in &ast.items {
            if let Item::Kernel(kernel) = item {
                // Generate buffer bindings for pointer parameters
                for param in &kernel.params {
                    if matches!(param.ty, Type::Pointer(_)) {
                        self.writeln(&format!(
                            "@group(0) @binding({})",
                            binding_index
                        ))?;
                        
                        let buffer_type = match &param.ty {
                            Type::Pointer(inner) => {
                                let wgsl_type = self.type_to_wgsl(inner)?;
                                if param.is_const {
                                    format!("var<storage, read> {}: array<{}>;", param.name, wgsl_type)
                                } else {
                                    format!("var<storage, read_write> {}: array<{}>;", param.name, wgsl_type)
                                }
                            },
                            _ => unreachable!(),
                        };
                        
                        self.writeln(&buffer_type)?;
                        self.writeln("")?;
                        binding_index += 1;
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Generate WGSL code for a kernel
    fn generate_kernel(&mut self, kernel: &KernelDef) -> Result<()> {
        // Generate workgroup size attribute
        self.writeln(&format!(
            "@compute @workgroup_size({}, {}, {})",
            self.workgroup_size.0, self.workgroup_size.1, self.workgroup_size.2
        ))?;
        
        // Generate function signature
        self.write(&format!("fn {}(", kernel.name))?;
        
        // Add built-in parameters
        self.write("@builtin(global_invocation_id) global_id: vec3<u32>")?;
        self.write(", @builtin(local_invocation_id) local_id: vec3<u32>")?;
        self.write(", @builtin(workgroup_id) workgroup_id: vec3<u32>")?;
        
        self.writeln(") {")?;
        self.indent();
        
        // Map CUDA built-ins to WGSL
        self.writeln("// Map CUDA thread/block indices to WGSL")?;
        self.writeln("let threadIdx = local_id;")?;
        self.writeln("let blockIdx = workgroup_id;")?;
        self.writeln("let blockDim = vec3<u32>(64u, 1u, 1u);")?; // Match workgroup size
        self.writeln("let gridDim = vec3<u32>(1u, 1u, 1u);")?; // Would need to be computed
        self.writeln("")?;
        
        // Generate kernel body
        self.generate_block(&kernel.body)?;
        
        self.dedent();
        self.writeln("}")?;
        self.writeln("")?;
        
        Ok(())
    }
    
    /// Generate WGSL code for a device function
    fn generate_device_function(&mut self, func: &FunctionDef) -> Result<()> {
        self.write(&format!("fn {}(", func.name))?;
        
        // Generate parameters
        for (i, param) in func.params.iter().enumerate() {
            if i > 0 {
                self.write(", ")?;
            }
            self.write(&format!("{}: {}", param.name, self.type_to_wgsl(&param.ty)?))?;
        }
        
        self.write(") -> ")?;
        self.write(&self.type_to_wgsl(&func.return_type)?)?;
        self.writeln(" {")?;
        
        self.indent();
        self.generate_block(&func.body)?;
        self.dedent();
        
        self.writeln("}")?;
        self.writeln("")?;
        
        Ok(())
    }
    
    /// Generate global variable
    fn generate_global_var(&mut self, var: &GlobalVar) -> Result<()> {
        match var.storage {
            StorageClass::Constant => {
                self.write("const ")?;
            },
            StorageClass::Shared => {
                self.write("var<workgroup> ")?;
            },
            _ => {
                self.write("var<private> ")?;
            },
        }
        
        self.write(&format!("{}: {}", var.name, self.type_to_wgsl(&var.ty)?))?;
        
        if let Some(init) = &var.init {
            self.write(" = ")?;
            self.generate_expression(init)?;
        }
        
        self.writeln(";")?;
        self.writeln("")?;
        
        Ok(())
    }
    
    /// Generate code for a block
    fn generate_block(&mut self, block: &Block) -> Result<()> {
        for stmt in &block.statements {
            self.generate_statement(stmt)?;
        }
        Ok(())
    }
    
    /// Generate code for a statement
    fn generate_statement(&mut self, stmt: &Statement) -> Result<()> {
        match stmt {
            Statement::VarDecl { name, ty, init, storage } => {
                match storage {
                    StorageClass::Shared => self.write("var<workgroup> ")?,
                    _ => self.write("var ")?,
                }
                
                self.write(&format!("{}: {}", name, self.type_to_wgsl(ty)?))?;
                
                if let Some(init_expr) = init {
                    self.write(" = ")?;
                    self.generate_expression(init_expr)?;
                }
                
                self.writeln(";")?;
            },
            Statement::Expr(expr) => {
                self.generate_expression(expr)?;
                self.writeln(";")?;
            },
            Statement::Block(block) => {
                self.writeln("{")?;
                self.indent();
                self.generate_block(block)?;
                self.dedent();
                self.writeln("}")?;
            },
            Statement::If { condition, then_branch, else_branch } => {
                self.write("if (")?;
                self.generate_expression(condition)?;
                self.writeln(") {")?;
                
                self.indent();
                self.generate_statement(then_branch)?;
                self.dedent();
                
                if let Some(else_stmt) = else_branch {
                    self.writeln("} else {")?;
                    self.indent();
                    self.generate_statement(else_stmt)?;
                    self.dedent();
                }
                
                self.writeln("}")?;
            },
            Statement::For { init, condition, update, body } => {
                // WGSL doesn't have traditional for loops, convert to while
                self.writeln("{")?;
                self.indent();
                
                // Initialize
                if let Some(init) = init {
                    match init.as_ref() {
                        ForInit::VarDecl { name, ty, init } => {
                            self.write(&format!("var {}: {}", name, self.type_to_wgsl(ty)?))?;
                            if let Some(init_expr) = init {
                                self.write(" = ")?;
                                self.generate_expression(init_expr)?;
                            }
                            self.writeln(";")?;
                        },
                        ForInit::Expr(expr) => {
                            self.generate_expression(expr)?;
                            self.writeln(";")?;
                        },
                    }
                }
                
                // While loop
                self.write("while (")?;
                if let Some(cond) = condition {
                    self.generate_expression(cond)?;
                } else {
                    self.write("true")?;
                }
                self.writeln(") {")?;
                
                self.indent();
                self.generate_statement(body)?;
                
                // Update
                if let Some(update_expr) = update {
                    self.generate_expression(update_expr)?;
                    self.writeln(";")?;
                }
                
                self.dedent();
                self.writeln("}")?;
                
                self.dedent();
                self.writeln("}")?;
            },
            Statement::While { condition, body } => {
                self.write("while (")?;
                self.generate_expression(condition)?;
                self.writeln(") {")?;
                
                self.indent();
                self.generate_statement(body)?;
                self.dedent();
                
                self.writeln("}")?;
            },
            Statement::Return(expr) => {
                self.write("return")?;
                if let Some(e) = expr {
                    self.write(" ")?;
                    self.generate_expression(e)?;
                }
                self.writeln(";")?;
            },
            Statement::Break => self.writeln("break;")?,
            Statement::Continue => self.writeln("continue;")?,
            Statement::SyncThreads => self.writeln("workgroupBarrier();")?,
        }
        
        Ok(())
    }
    
    /// Generate code for an expression
    fn generate_expression(&mut self, expr: &Expression) -> Result<()> {
        match expr {
            Expression::Literal(lit) => self.generate_literal(lit)?,
            Expression::Var(name) => self.write(name)?,
            Expression::Binary { op, left, right } => {
                self.write("(")?;
                self.generate_expression(left)?;
                self.write(" ")?;
                self.write(&self.binary_op_to_wgsl(op)?)?;
                self.write(" ")?;
                self.generate_expression(right)?;
                self.write(")")?;
            },
            Expression::Unary { op, expr } => {
                self.write("(")?;
                self.write(&self.unary_op_to_wgsl(op)?)?;
                self.generate_expression(expr)?;
                self.write(")")?;
            },
            Expression::Call { name, args } => {
                self.write(&format!("{}(", name))?;
                for (i, arg) in args.iter().enumerate() {
                    if i > 0 {
                        self.write(", ")?;
                    }
                    self.generate_expression(arg)?;
                }
                self.write(")")?;
            },
            Expression::Index { array, index } => {
                self.generate_expression(array)?;
                self.write("[")?;
                self.generate_expression(index)?;
                self.write("]")?;
            },
            Expression::Member { object, field } => {
                self.generate_expression(object)?;
                self.write(&format!(".{}", field))?;
            },
            Expression::Cast { ty, expr } => {
                let wgsl_type = self.type_to_wgsl(ty)?;
                self.write(&format!("{}(", wgsl_type))?;
                self.generate_expression(expr)?;
                self.write(")")?;
            },
            Expression::ThreadIdx(dim) => {
                self.write(&format!("threadIdx.{}", self.dimension_to_wgsl(dim)))?;
            },
            Expression::BlockIdx(dim) => {
                self.write(&format!("blockIdx.{}", self.dimension_to_wgsl(dim)))?;
            },
            Expression::BlockDim(dim) => {
                self.write(&format!("blockDim.{}", self.dimension_to_wgsl(dim)))?;
            },
            Expression::GridDim(dim) => {
                self.write(&format!("gridDim.{}", self.dimension_to_wgsl(dim)))?;
            },
            Expression::WarpPrimitive { op, args } => {
                // WGSL doesn't have direct warp primitives, emit a comment
                self.write(&format!("/* warp_{:?}(", op))?;
                for (i, arg) in args.iter().enumerate() {
                    if i > 0 {
                        self.write(", ")?;
                    }
                    self.generate_expression(arg)?;
                }
                self.write(") */")?;
                // Emit a placeholder value
                self.write("0")?;
            },
        }
        
        Ok(())
    }
    
    /// Generate literal
    fn generate_literal(&mut self, lit: &Literal) -> Result<()> {
        match lit {
            Literal::Bool(b) => self.write(&format!("{}", b))?,
            Literal::Int(i) => self.write(&format!("{}i", i))?,
            Literal::UInt(u) => self.write(&format!("{}u", u))?,
            Literal::Float(f) => self.write(&format!("{}f", f))?,
            Literal::String(s) => self.write(&format!("\"{}\"", s))?,
        }
        Ok(())
    }
    
    /// Convert CUDA type to WGSL type
    fn type_to_wgsl(&self, ty: &Type) -> Result<String> {
        Ok(match ty {
            Type::Void => return Err(translation_error!("void type not supported in WGSL")),
            Type::Bool => "bool".to_string(),
            Type::Int(int_ty) => match int_ty {
                IntType::I8 | IntType::I16 | IntType::I32 => "i32".to_string(),
                IntType::I64 => return Err(translation_error!("i64 not supported in WGSL")),
                IntType::U8 | IntType::U16 | IntType::U32 => "u32".to_string(),
                IntType::U64 => return Err(translation_error!("u64 not supported in WGSL")),
            },
            Type::Float(float_ty) => match float_ty {
                FloatType::F16 => "f16".to_string(),
                FloatType::F32 => "f32".to_string(),
                FloatType::F64 => return Err(translation_error!("f64 not supported in WGSL")),
            },
            Type::Pointer(inner) => {
                // Pointers are handled as array references in bindings
                format!("ptr<storage, {}>", self.type_to_wgsl(inner)?)
            },
            Type::Array(inner, size) => {
                match size {
                    Some(n) => format!("array<{}, {}>", self.type_to_wgsl(inner)?, n),
                    None => format!("array<{}>", self.type_to_wgsl(inner)?),
                }
            },
            Type::Vector(vec_ty) => {
                let elem_type = self.type_to_wgsl(&vec_ty.element)?;
                format!("vec{}<{}>", vec_ty.size, elem_type)
            },
            Type::Named(name) => name.clone(),
            Type::Texture(_) => return Err(translation_error!("Texture types not yet supported")),
        })
    }
    
    /// Convert binary operator to WGSL
    fn binary_op_to_wgsl(&self, op: &BinaryOp) -> Result<&'static str> {
        Ok(match op {
            BinaryOp::Add => "+",
            BinaryOp::Sub => "-",
            BinaryOp::Mul => "*",
            BinaryOp::Div => "/",
            BinaryOp::Mod => "%",
            BinaryOp::And => "&",
            BinaryOp::Or => "|",
            BinaryOp::Xor => "^",
            BinaryOp::Shl => "<<",
            BinaryOp::Shr => ">>",
            BinaryOp::Eq => "==",
            BinaryOp::Ne => "!=",
            BinaryOp::Lt => "<",
            BinaryOp::Le => "<=",
            BinaryOp::Gt => ">",
            BinaryOp::Ge => ">=",
            BinaryOp::LogicalAnd => "&&",
            BinaryOp::LogicalOr => "||",
            BinaryOp::Assign => "=",
        })
    }
    
    /// Convert unary operator to WGSL
    fn unary_op_to_wgsl(&self, op: &UnaryOp) -> Result<&'static str> {
        Ok(match op {
            UnaryOp::Not => "!",
            UnaryOp::Neg => "-",
            UnaryOp::BitNot => "~",
            UnaryOp::PreInc => return Err(translation_error!("Pre-increment not supported in WGSL")),
            UnaryOp::PreDec => return Err(translation_error!("Pre-decrement not supported in WGSL")),
            UnaryOp::PostInc => return Err(translation_error!("Post-increment not supported in WGSL")),
            UnaryOp::PostDec => return Err(translation_error!("Post-decrement not supported in WGSL")),
            UnaryOp::Deref => "*",
            UnaryOp::AddrOf => "&",
        })
    }
    
    /// Convert dimension to WGSL component
    fn dimension_to_wgsl(&self, dim: &Dimension) -> &'static str {
        match dim {
            Dimension::X => "x",
            Dimension::Y => "y",
            Dimension::Z => "z",
        }
    }
    
    /// Helper: Write with indentation
    fn write(&mut self, s: &str) -> Result<()> {
        self.code.push_str(s);
        Ok(())
    }
    
    /// Helper: Write line with indentation
    fn writeln(&mut self, s: &str) -> Result<()> {
        if !s.is_empty() {
            for _ in 0..self.indent_level {
                self.code.push_str("    ");
            }
            self.code.push_str(s);
        }
        self.code.push('\n');
        Ok(())
    }
    
    /// Helper: Increase indentation
    fn indent(&mut self) {
        self.indent_level += 1;
    }
    
    /// Helper: Decrease indentation
    fn dedent(&mut self) {
        if self.indent_level > 0 {
            self.indent_level -= 1;
        }
    }
}

impl Default for WgslGenerator {
    fn default() -> Self {
        Self::new()
    }
}