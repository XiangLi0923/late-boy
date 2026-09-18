/// Emscripten bindings — exports the C++ engine API to JavaScript.
///
/// This file is only compiled for WASM targets (standard and mini).
/// It uses EMSCRIPTEN_BINDINGS to generate JS glue code that wraps
/// the perler_engine C API with camelCase naming conventions.

#ifdef __EMSCRIPTEN__

#include <emscripten/bindings.h>
#include <emscripten/val.h>
#include "perler_engine.h"
#include <string>
#include <cstring>
#include <vector>

using namespace emscripten;

// ============================================================================
// Helper: Convert JS Uint8Array → C++ vector
// ============================================================================
static std::vector<uint8_t> js_array_to_vector(const val& js_array) {
    std::vector<uint8_t> result;
    if (js_array.isNull() || js_array.isUndefined()) return result;

    size_t len = js_array["length"].as<size_t>();
    result.resize(len);

    // Copy from WASM heap
    val heap = val::module_property("HEAPU8");
    for (size_t i = 0; i < len; ++i) {
        result[i] = js_array[i].as<uint8_t>();
    }

    return result;
}

// Helper: Convert C++ vector → JS Uint8Array
static val vector_to_js_array(const std::vector<uint8_t>& vec) {
    if (vec.empty()) {
        return val::global("Uint8Array").new_(0);
    }
    return val(typed_memory_view(vec.size(), vec.data()));
}

// ============================================================================
// Wrapper: Full pipeline from JS types
// ============================================================================
static std::string process_image_wrapper(val js_buffer, int w, int h,
                                          const std::string& palette_json,
                                          int grid_w, int grid_h,
                                          int dither_mode) {
    auto data = js_array_to_vector(js_buffer);
    if (data.empty()) return "{}";

    PerlerImage* img = perler_image_load_from_memory(data.data(), data.size());
    if (!img) return "{}";

    PerlerPalette* pal = perler_palette_load_from_memory(palette_json.c_str());
    if (!pal) {
        perler_image_free(img);
        return "{}";
    }

    PerlerBeadGrid* grid = perler_quantize(img, pal, grid_w, grid_h, dither_mode);
    if (!grid) {
        perler_palette_free(pal);
        perler_image_free(img);
        return "{}";
    }

    char* json = perler_export_project_json(grid);
    std::string result(json ? json : "{}");

    perler_string_free(json);
    perler_grid_free(grid);
    perler_palette_free(pal);
    perler_image_free(img);

    return result;
}

// ============================================================================
// EMSCRIPTEN_BINDINGS
// ============================================================================
EMSCRIPTEN_BINDINGS(perler_engine) {

    // --- Engine Lifecycle ---
    function("perlerInit", &perler_init);
    function("perlerShutdown", &perler_shutdown);
    function("perlerVersion", optional_override([]() -> std::string {
        const char* v = perler_version();
        return v ? std::string(v) : "unknown";
    }));

    // --- Image Operations ---
    function("imageLoadFromMemory", optional_override([](val js_buffer) -> int {
        auto data = js_array_to_vector(js_buffer);
        if (data.empty()) return -1;
        PerlerImage* img = perler_image_load_from_memory(data.data(), data.size());
        return img ? reinterpret_cast<int>(img) : -1;
    }), allow_raw_pointers());

    function("imageFree", optional_override([](int handle) {
        if (handle > 0) perler_image_free(reinterpret_cast<PerlerImage*>(handle));
    }), allow_raw_pointers());

    function("imageWidth", optional_override([](int handle) -> int {
        return handle > 0 ? perler_image_width(reinterpret_cast<PerlerImage*>(handle)) : 0;
    }), allow_raw_pointers());

    function("imageHeight", optional_override([](int handle) -> int {
        return handle > 0 ? perler_image_height(reinterpret_cast<PerlerImage*>(handle)) : 0;
    }), allow_raw_pointers());

    // --- Palette Operations ---
    function("paletteLoadFromMemory", optional_override([](const std::string& json) -> int {
        PerlerPalette* pal = perler_palette_load_from_memory(json.c_str());
        return pal ? reinterpret_cast<int>(pal) : -1;
    }), allow_raw_pointers());

    function("paletteFree", optional_override([](int handle) {
        if (handle > 0) perler_palette_free(reinterpret_cast<PerlerPalette*>(handle));
    }), allow_raw_pointers());

    function("paletteColorCount", optional_override([](int handle) -> int {
        return handle > 0 ? perler_palette_color_count(reinterpret_cast<PerlerPalette*>(handle)) : 0;
    }), allow_raw_pointers());

    function("paletteBrandName", optional_override([](int handle) -> std::string {
        if (handle <= 0) return "";
        const char* name = perler_palette_brand_name(reinterpret_cast<PerlerPalette*>(handle));
        return name ? std::string(name) : "";
    }), allow_raw_pointers());

    function("paletteColorHex", optional_override([](int handle, int index) -> std::string {
        if (handle <= 0) return "";
        const char* hex = perler_palette_color_hex(reinterpret_cast<PerlerPalette*>(handle), index);
        return hex ? std::string(hex) : "";
    }), allow_raw_pointers());

    function("paletteColorName", optional_override([](int handle, int index) -> std::string {
        if (handle <= 0) return "";
        const char* name = perler_palette_color_name(reinterpret_cast<PerlerPalette*>(handle), index);
        return name ? std::string(name) : "";
    }), allow_raw_pointers());

    // --- Quantization ---
    function("quantize", optional_override([](int img_handle, int pal_handle,
                                                int grid_w, int grid_h,
                                                int dither_mode) -> int {
        if (img_handle <= 0 || pal_handle <= 0) return -1;
        PerlerBeadGrid* grid = perler_quantize(
            reinterpret_cast<PerlerImage*>(img_handle),
            reinterpret_cast<PerlerPalette*>(pal_handle),
            grid_w, grid_h, dither_mode);
        return grid ? reinterpret_cast<int>(grid) : -1;
    }), allow_raw_pointers());

    function("gridFree", optional_override([](int handle) {
        if (handle > 0) perler_grid_free(reinterpret_cast<PerlerBeadGrid*>(handle));
    }), allow_raw_pointers());

    function("gridWidth", optional_override([](int handle) -> int {
        return handle > 0 ? perler_grid_width(reinterpret_cast<PerlerBeadGrid*>(handle)) : 0;
    }), allow_raw_pointers());

    function("gridHeight", optional_override([](int handle) -> int {
        return handle > 0 ? perler_grid_height(reinterpret_cast<PerlerBeadGrid*>(handle)) : 0;
    }), allow_raw_pointers());

    function("gridIndices", optional_override([](int handle) -> val {
        if (handle <= 0) return val::null();
        auto* grid = reinterpret_cast<PerlerBeadGrid*>(handle);
        const int32_t* indices = perler_grid_indices(grid);
        int count = perler_grid_width(grid) * perler_grid_height(grid);
        return val(typed_memory_view(count, indices));
    }), allow_raw_pointers());

    // --- Export ---
    function("exportProjectJson", optional_override([](int grid_handle) -> std::string {
        if (grid_handle <= 0) return "{}";
        char* json = perler_export_project_json(reinterpret_cast<PerlerBeadGrid*>(grid_handle));
        std::string result(json ? json : "{}");
        perler_string_free(json);
        return result;
    }), allow_raw_pointers());

    // --- Convenience: full pipeline ---
    function("processFullPipeline", &process_image_wrapper);

    // --- Diagnostics ---
    function("diagnoseFull", optional_override([](const std::string& palettes_dir) -> std::string {
        char* json = perler_diagnose_full(palettes_dir.c_str());
        std::string result(json ? json : "[]");
        perler_string_free(json);
        return result;
    }));

    // --- Plugins ---
    function("pluginScan", optional_override([](const std::string& dir) -> int {
        return perler_plugin_scan(dir.c_str());
    }));

    function("pluginCount", &perler_plugin_count);

    function("pluginInfo", optional_override([](int index) -> std::string {
        const char* info = perler_plugin_info(index);
        return info ? std::string(info) : "{}";
    }));

    // --- Utility ---
    function("lastError", optional_override([]() -> std::string {
        const char* err = perler_last_error();
        return err ? std::string(err) : "";
    }));
}

#endif // __EMSCRIPTEN__
