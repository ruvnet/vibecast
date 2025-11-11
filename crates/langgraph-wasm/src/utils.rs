//! Utility functions for WASM

use wasm_bindgen::prelude::*;

/// Set up panic hook for better error messages in the browser
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Initialize logging to the browser console
pub fn init_logging() {
    #[cfg(feature = "console_log")]
    {
        use tracing_subscriber::fmt::format::Pretty;
        use tracing_subscriber::fmt::time::UtcTime;
        use tracing_subscriber::prelude::*;
        use tracing_web::{MakeConsoleWriter, performance_layer};

        let fmt_layer = tracing_subscriber::fmt::layer()
            .with_ansi(false)
            .with_timer(UtcTime::rfc_3339())
            .with_writer(MakeConsoleWriter);
        let perf_layer = performance_layer().with_details_from_fields(Pretty::default());

        tracing_subscriber::registry()
            .with(fmt_layer)
            .with(perf_layer)
            .init();
    }
}

/// Log a message to the console
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = log)]
    pub fn log_many(a: &str, b: &str);
}

/// Macro for console.log
#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => ($crate::utils::log(&format_args!($($t)*).to_string()))
}
