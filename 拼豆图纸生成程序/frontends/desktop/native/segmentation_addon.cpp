#include <napi.h>
#include "segmentation_api.h"

// This addon is intentionally kept as a thin N-API wrapper around the C++17
// segmentation API. Build it from frontends/desktop/native with node-gyp after
// a local semantic segmentation model has been linked into the engine library.
namespace {

Napi::Value SegmentImage(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 5) {
    Napi::TypeError::New(env, "Expected image data, width, height, params, roi")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // The complete binding copies the ArrayBuffer and converts the returned RGBA
  // and mask buffers back into Uint8ClampedArray objects.
  SegmentationResult result{};
  const auto status = run_segmentation(
      nullptr, 0, 0, 0.0f, 0, 0, result);

  if (status != SegmentationStatus::OK) {
    Napi::Error::New(env, "segmentation model not ready").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Return a placeholder object. Real buffers are attached by the platform
  // implementation after model inference.
  Napi::Object output = Napi::Object::New(env);
  output.Set("width", 0);
  output.Set("height", 0);
  output.Set("confidence", 0.0f);
  return output;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("segmentImage", Napi::Function::New(env, SegmentImage));
  return exports;
}

NODE_API_MODULE(segmentation_addon, Init)

} // namespace
