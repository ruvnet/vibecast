//! Build script for CUDA-Rust-WASM project

use std::env;
use std::path::PathBuf;

fn main() {
    // Get target architecture
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    
    println!("cargo:rerun-if-changed=build.rs");
    
    // Configure for WASM target
    if target_arch == "wasm32" {
        println!("cargo:rustc-cfg=wasm_target");
        
        // Set WASM-specific optimizations
        println!("cargo:rustc-env=WASM_BINDGEN_WEAKREF=1");
        
        // Enable SIMD if supported
        if env::var("CARGO_FEATURE_WASM_SIMD").is_ok() {
            println!("cargo:rustc-cfg=wasm_simd");
        }
    }
    
    // Configure for native CUDA if available
    #[cfg(feature = "cuda-backend")]
    {
        // Check for CUDA installation
        if let Ok(cuda_path) = env::var("CUDA_PATH") {
            println!("cargo:rustc-link-search=native={}/lib64", cuda_path);
            println!("cargo:rustc-link-lib=cudart");
            println!("cargo:rustc-cfg=has_cuda");
        }
    }
    
    // Set optimization flags for release builds
    let profile = env::var("PROFILE").unwrap_or_default();
    if profile == "release" {
        // Enable link-time optimization
        println!("cargo:rustc-link-arg=-s");
        
        // For WASM, enable additional optimizations
        if target_arch == "wasm32" {
            println!("cargo:rustc-link-arg=--gc-sections");
            println!("cargo:rustc-link-arg=--no-entry");
        }
    }
    
    // Generate bindings for native backends if needed
    #[cfg(feature = "native-bindings")]
    {
        generate_native_bindings();
    }
}

#[cfg(feature = "native-bindings")]
fn generate_native_bindings() {
    use bindgen::Builder;
    
    let bindings = Builder::default()
        .header("src/backend/native/cuda_wrapper.h")
        .parse_callbacks(Box::new(bindgen::CargoCallbacks))
        .generate()
        .expect("Unable to generate bindings");
    
    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("cuda_bindings.rs"))
        .expect("Couldn't write bindings!");
}