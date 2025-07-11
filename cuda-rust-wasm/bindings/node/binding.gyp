{
  "targets": [
    {
      "target_name": "cuda_rust_wasm",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [ 
        "src/cuda_rust_wasm.cc",
        "src/transpiler.cc",
        "src/runtime.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "../../target/release"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "libraries": [
        "-L../../target/release",
        "-lcuda_rust_wasm"
      ],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-lws2_32",
            "-luserenv"
          ]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.7"
          }
        }]
      ]
    }
  ]
}