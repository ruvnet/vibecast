//! Utility functions and helpers

/// Round up to nearest multiple
pub fn round_up(value: usize, multiple: usize) -> usize {
    ((value + multiple - 1) / multiple) * multiple
}

/// Calculate optimal block size for given problem size
pub fn calculate_block_size(problem_size: usize, max_threads: usize) -> usize {
    // Common block sizes to try
    const BLOCK_SIZES: &[usize] = &[1024, 512, 256, 128, 64, 32];
    
    for &size in BLOCK_SIZES {
        if size <= max_threads && problem_size >= size {
            return size;
        }
    }
    
    // Fallback to warp size
    32
}

/// Calculate grid size for given problem and block size
pub fn calculate_grid_size(problem_size: usize, block_size: usize) -> usize {
    (problem_size + block_size - 1) / block_size
}