use std::fs;

fn main() {
    println!("Testing basic CUDA-Rust-WASM functionality");
    
    // Test file structure
    let files = vec![
        "src/lib.rs",
        "src/error.rs", 
        "src/parser/mod.rs",
        "src/transpiler/mod.rs",
        "src/runtime/mod.rs",
        "src/memory/mod.rs",
        "Cargo.toml"
    ];
    
    for file in files {
        match fs::metadata(file) {
            Ok(_) => println!("✓ {}", file),
            Err(_) => println!("✗ {}", file),
        }
    }
    
    // Test basic CUDA content
    let cuda_content = fs::read_to_string("test_basic.cu").unwrap_or_default();
    if cuda_content.contains("__global__") {
        println!("✓ CUDA test file contains valid kernel");
    } else {
        println!("✗ CUDA test file missing or invalid");
    }
    
    // Test package.json
    let package_json = fs::read_to_string("package.json").unwrap_or_default();
    if package_json.contains("cuda-rust-wasm") {
        println!("✓ NPX package configuration found");
    } else {
        println!("✗ NPX package configuration missing");
    }
    
    println!("\nProject structure verification complete!");
}