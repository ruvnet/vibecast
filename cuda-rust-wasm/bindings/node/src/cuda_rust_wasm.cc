#include <napi.h>
#include <string>
#include <vector>

// External Rust functions
extern "C" {
    struct TranspileResult {
        char* code;
        uint8_t* wasm_binary;
        size_t wasm_size;
        char* error;
    };
    
    struct AnalysisResult {
        char* memory_pattern;
        int thread_utilization;
        size_t shared_memory_usage;
        int register_usage;
        char** suggestions;
        size_t suggestion_count;
        char* error;
    };
    
    TranspileResult* transpile_cuda(const char* code, const char* target, bool optimize);
    AnalysisResult* analyze_kernel(const char* code);
    void free_transpile_result(TranspileResult* result);
    void free_analysis_result(AnalysisResult* result);
}

class TranspileCuda : public Napi::AsyncWorker {
public:
    TranspileCuda(Napi::Function& callback, std::string code, std::string target, bool optimize)
        : Napi::AsyncWorker(callback), code_(code), target_(target), optimize_(optimize) {}
    
    ~TranspileCuda() {}
    
    void Execute() override {
        result_ = transpile_cuda(code_.c_str(), target_.c_str(), optimize_);
        if (result_->error) {
            SetError(result_->error);
        }
    }
    
    void OnOK() override {
        Napi::HandleScope scope(Env());
        
        Napi::Object obj = Napi::Object::New(Env());
        obj.Set("code", Napi::String::New(Env(), result_->code));
        
        if (result_->wasm_binary && result_->wasm_size > 0) {
            Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(
                Env(), result_->wasm_binary, result_->wasm_size
            );
            obj.Set("wasmBinary", buffer);
        }
        
        free_transpile_result(result_);
        Callback().Call({Env().Null(), obj});
    }
    
private:
    std::string code_;
    std::string target_;
    bool optimize_;
    TranspileResult* result_;
};

class AnalyzeKernel : public Napi::AsyncWorker {
public:
    AnalyzeKernel(Napi::Function& callback, std::string code)
        : Napi::AsyncWorker(callback), code_(code) {}
    
    ~AnalyzeKernel() {}
    
    void Execute() override {
        result_ = analyze_kernel(code_.c_str());
        if (result_->error) {
            SetError(result_->error);
        }
    }
    
    void OnOK() override {
        Napi::HandleScope scope(Env());
        
        Napi::Object obj = Napi::Object::New(Env());
        obj.Set("memoryPattern", Napi::String::New(Env(), result_->memory_pattern));
        obj.Set("threadUtilization", Napi::Number::New(Env(), result_->thread_utilization));
        obj.Set("sharedMemoryUsage", Napi::Number::New(Env(), result_->shared_memory_usage));
        obj.Set("registerUsage", Napi::Number::New(Env(), result_->register_usage));
        
        Napi::Array suggestions = Napi::Array::New(Env(), result_->suggestion_count);
        for (size_t i = 0; i < result_->suggestion_count; i++) {
            suggestions.Set(i, Napi::String::New(Env(), result_->suggestions[i]));
        }
        obj.Set("suggestions", suggestions);
        
        free_analysis_result(result_);
        Callback().Call({Env().Null(), obj});
    }
    
private:
    std::string code_;
    AnalysisResult* result_;
};

Napi::Value TranspileCudaAsync(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected at least 2 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string code = info[0].As<Napi::String>().Utf8Value();
    Napi::Object options = info[1].As<Napi::Object>();
    Napi::Function callback = info[2].As<Napi::Function>();
    
    std::string target = "wasm";
    if (options.Has("target")) {
        target = options.Get("target").As<Napi::String>().Utf8Value();
    }
    
    bool optimize = false;
    if (options.Has("optimize")) {
        optimize = options.Get("optimize").As<Napi::Boolean>().Value();
    }
    
    TranspileCuda* worker = new TranspileCuda(callback, code, target, optimize);
    worker->Queue();
    
    return env.Undefined();
}

Napi::Value AnalyzeKernelAsync(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string code = info[0].As<Napi::String>().Utf8Value();
    Napi::Function callback = info[1].As<Napi::Function>();
    
    AnalyzeKernel* worker = new AnalyzeKernel(callback, code);
    worker->Queue();
    
    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("transpileCuda", Napi::Function::New(env, TranspileCudaAsync));
    exports.Set("analyzeKernel", Napi::Function::New(env, AnalyzeKernelAsync));
    return exports;
}

NODE_API_MODULE(cuda_rust_wasm, Init)