#include "engine_context.h"
#include "image_io.h"
#include "colorspace.h"
#include "delta_e.h"
#include "similar_colors.h"
#include "background_removal.h"
#include "internal/string_utils.h"
#include "internal/json_utils.h"

#include <sstream>
#include <fstream>
#include <ctime>
#include <chrono>
#include <iomanip>

// Forward declarations for modules implemented in later phases.
// These functions are defined in their respective .cpp files.
namespace perler {

// From preprocessing.cpp
ImageData preprocess_crop(const ImageData& src, int x, int y, int w, int h);
ImageData preprocess_adjust(const ImageData& src, float brightness, float contrast);
ImageData preprocess_blur(const ImageData& src, float sigma);

// From pixelation.cpp
std::vector<CellSample> pixelate_box_sample(const ImageData& src, int grid_w, int grid_h);

// From quantization.cpp
BeadGrid quantize_grid(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                       const Palette& palette, DitherMode dither_mode);

// From palette.cpp
Palette load_palette_json(const std::string& json_str);
std::string get_palettes_in_dir(const std::string& dir);

// From export_*.cpp
bool do_export_png(const BeadGrid& grid, const std::string& path, int dpi);
bool do_export_png_main(const BeadGrid& grid, const std::string& path, int dpi);
bool do_export_png_sub(const BeadGrid& grid, const std::string& path, int dpi);
bool do_export_pdf(const BeadGrid& grid, const std::string& path);
bool do_export_csv(const BeadGrid& grid, const std::string& path);
std::string do_export_project_json(const BeadGrid& grid);

// From diagnostics.cpp
std::string run_all_diagnostics(const std::string& palettes_dir);
std::string run_named_check(const std::string& name, const std::string& palettes_dir);

// From auto_repair.cpp
std::string repair_json_string(const std::string& damaged);
std::string repair_project_string(const std::string& damaged);

// From plugin_loader.cpp
int scan_plugins_directory(const std::string& dir);
int get_plugin_count();
std::string get_plugin_info_json(int index);
int call_plugin(const std::string& type, const std::string& fn,
                const std::string& args, std::string& result);

} // namespace perler

namespace perler {

// ============================================================================
// Singleton
// ============================================================================

EngineContext& EngineContext::instance() {
    static EngineContext ctx;
    return ctx;
}

void EngineContext::init() {
    initialized_ = true;
}

void EngineContext::shutdown() {
    initialized_ = false;
}

std::string EngineContext::version() const {
    return version_;
}

// ============================================================================
// Image Operations
// ============================================================================

ImageData EngineContext::image_load_from_file(const std::string& path) {
    return image_io::load_from_file(path);
}

ImageData EngineContext::image_load_from_memory(const uint8_t* data, size_t len) {
    return image_io::load_from_memory(data, len);
}

ImageData EngineContext::image_crop(const ImageData& src, int x, int y, int w, int h) {
    if (!src.valid()) {
        set_last_error("Cannot crop invalid image");
        return ImageData();
    }
    return preprocess_crop(src, x, y, w, h);
}

ImageData EngineContext::image_adjust(const ImageData& src, float brightness, float contrast) {
    if (!src.valid()) {
        set_last_error("Cannot adjust invalid image");
        return ImageData();
    }
    return preprocess_adjust(src, brightness, contrast);
}

ImageData EngineContext::image_blur(const ImageData& src, float sigma) {
    if (!src.valid()) {
        set_last_error("Cannot blur invalid image");
        return ImageData();
    }
    return preprocess_blur(src, sigma);
}

// ============================================================================
// Palette Operations
// ============================================================================

Palette EngineContext::palette_load_from_file(const std::string& path) {
    // Read file, then delegate to memory loader
    std::ifstream file(path);
    if (!file.is_open()) {
        set_last_error("Cannot open palette file: " + path);
        return Palette();
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return palette_load_from_memory(buffer.str());
}

Palette EngineContext::palette_load_from_memory(const std::string& json_str) {
    return load_palette_json(json_str);
}

std::string EngineContext::palette_list_available(const std::string& dir) {
    return get_palettes_in_dir(dir);
}

// ============================================================================
// Quantization
// ============================================================================

BeadGrid EngineContext::quantize(const ImageData& img, const Palette& pal,
                                  int grid_w, int grid_h, DitherMode dither) {
    if (!img.valid()) {
        set_last_error("Cannot quantize invalid image");
        return BeadGrid();
    }
    if (pal.empty()) {
        set_last_error("Cannot quantize with empty palette");
        return BeadGrid();
    }
    if (grid_w <= 0 || grid_h <= 0) {
        set_last_error("Invalid grid dimensions");
        return BeadGrid();
    }

    auto cells = pixelate_box_sample(img, grid_w, grid_h);
    return quantize_grid(cells, grid_w, grid_h, pal, dither);
}

// ============================================================================
// Export
// ============================================================================

bool EngineContext::export_png(const BeadGrid& grid, const std::string& path, int dpi) {
    if (!grid.valid()) {
        set_last_error("Cannot export invalid grid");
        return false;
    }
    return do_export_png(grid, path, dpi);
}

bool EngineContext::export_png_main(const BeadGrid& grid, const std::string& path, int dpi) {
    if (!grid.valid()) {
        set_last_error("Cannot export invalid grid");
        return false;
    }
    return do_export_png_main(grid, path, dpi);
}

bool EngineContext::export_png_sub(const BeadGrid& grid, const std::string& path, int dpi) {
    if (!grid.valid()) {
        set_last_error("Cannot export invalid grid");
        return false;
    }
    return do_export_png_sub(grid, path, dpi);
}

bool EngineContext::export_pdf(const BeadGrid& grid, const std::string& path) {
    if (!grid.valid()) {
        set_last_error("Cannot export invalid grid");
        return false;
    }
    return do_export_pdf(grid, path);
}

bool EngineContext::export_csv(const BeadGrid& grid, const std::string& path) {
    if (!grid.valid()) {
        set_last_error("Cannot export invalid grid");
        return false;
    }
    return do_export_csv(grid, path);
}

std::string EngineContext::export_project_json(const BeadGrid& grid) {
    if (!grid.valid()) {
        set_last_error("Cannot export invalid grid");
        return "{}";
    }
    return do_export_project_json(grid);
}

// ============================================================================
// Diagnostics
// ============================================================================

std::string EngineContext::diagnose_full(const std::string& palettes_dir) {
    return run_all_diagnostics(palettes_dir);
}

std::string EngineContext::diagnose_check(const std::string& name, const std::string& palettes_dir) {
    return run_named_check(name, palettes_dir);
}

std::string EngineContext::diagnostics_log_path() const {
    return "diagnostics.log";
}

// ============================================================================
// Auto-Repair
// ============================================================================

std::string EngineContext::repair_palette_json(const std::string& json_str) {
    return repair_json_string(json_str);
}

std::string EngineContext::repair_project_json(const std::string& json_str) {
    return repair_project_string(json_str);
}

// ============================================================================
// Plugin
// ============================================================================

int EngineContext::plugin_scan(const std::string& plugins_dir) {
    return scan_plugins_directory(plugins_dir);
}

int EngineContext::plugin_count() const {
    return get_plugin_count();
}

std::string EngineContext::plugin_info(int index) const {
    return get_plugin_info_json(index);
}

int EngineContext::plugin_call(const std::string& type, const std::string& fn,
                                const std::string& args, std::string& result) {
    return call_plugin(type, fn, args, result);
}

// ============================================================================
// Error Handling
// ============================================================================

void EngineContext::set_last_error(const std::string& err) {
    last_error_ = err;
}

std::string EngineContext::last_error() const {
    return last_error_;
}

} // namespace perler

// ============================================================================
// C API Implementation
// ============================================================================

extern "C" {

void perler_init(void) {
    perler::EngineContext::instance().init();
}

void perler_shutdown(void) {
    perler::EngineContext::instance().shutdown();
}

const char* perler_version(void) {
    static std::string ver;
    ver = perler::EngineContext::instance().version();
    return ver.c_str();
}

// --- Image API ---

PerlerImage* perler_image_load_from_file(const char* path) {
    auto img = perler::EngineContext::instance().image_load_from_file(path);
    if (!img.valid()) return nullptr;
    auto* result = new perler::ImageData(std::move(img));
    return reinterpret_cast<PerlerImage*>(result);
}

PerlerImage* perler_image_load_from_memory(const uint8_t* data, size_t len) {
    auto img = perler::EngineContext::instance().image_load_from_memory(data, len);
    if (!img.valid()) return nullptr;
    auto* result = new perler::ImageData(std::move(img));
    return reinterpret_cast<PerlerImage*>(result);
}

void perler_image_free(PerlerImage* img) {
    delete reinterpret_cast<perler::ImageData*>(img);
}

int perler_image_width(const PerlerImage* img) {
    auto* ptr = reinterpret_cast<const perler::ImageData*>(img);
    return ptr ? ptr->width : 0;
}

int perler_image_height(const PerlerImage* img) {
    auto* ptr = reinterpret_cast<const perler::ImageData*>(img);
    return ptr ? ptr->height : 0;
}

const uint8_t* perler_image_rgba_data(const PerlerImage* img) {
    auto* ptr = reinterpret_cast<const perler::ImageData*>(img);
    return ptr ? ptr->pixels.data() : nullptr;
}

// --- Preprocessing ---

PerlerImage* perler_image_crop(const PerlerImage* img, int x, int y, int w, int h) {
    auto* src = reinterpret_cast<const perler::ImageData*>(img);
    if (!src) return nullptr;
    auto result = perler::EngineContext::instance().image_crop(*src, x, y, w, h);
    if (!result.valid()) return nullptr;
    return reinterpret_cast<PerlerImage*>(new perler::ImageData(std::move(result)));
}

PerlerImage* perler_image_adjust(const PerlerImage* img, float brightness, float contrast) {
    auto* src = reinterpret_cast<const perler::ImageData*>(img);
    if (!src) return nullptr;
    auto result = perler::EngineContext::instance().image_adjust(*src, brightness, contrast);
    if (!result.valid()) return nullptr;
    return reinterpret_cast<PerlerImage*>(new perler::ImageData(std::move(result)));
}

PerlerImage* perler_image_blur(const PerlerImage* img, float sigma) {
    auto* src = reinterpret_cast<const perler::ImageData*>(img);
    if (!src) return nullptr;
    auto result = perler::EngineContext::instance().image_blur(*src, sigma);
    if (!result.valid()) return nullptr;
    return reinterpret_cast<PerlerImage*>(new perler::ImageData(std::move(result)));
}

// --- Palette API ---

PerlerPalette* perler_palette_load_from_file(const char* json_path) {
    auto pal = perler::EngineContext::instance().palette_load_from_file(json_path);
    if (pal.empty()) return nullptr;
    return reinterpret_cast<PerlerPalette*>(new perler::Palette(std::move(pal)));
}

PerlerPalette* perler_palette_load_from_memory(const char* json_str) {
    auto pal = perler::EngineContext::instance().palette_load_from_memory(json_str);
    if (pal.empty()) return nullptr;
    return reinterpret_cast<PerlerPalette*>(new perler::Palette(std::move(pal)));
}

void perler_palette_free(PerlerPalette* pal) {
    delete reinterpret_cast<perler::Palette*>(pal);
}

int perler_palette_color_count(const PerlerPalette* pal) {
    auto* ptr = reinterpret_cast<const perler::Palette*>(pal);
    return ptr ? static_cast<int>(ptr->size()) : 0;
}

const char* perler_palette_brand_name(const PerlerPalette* pal) {
    auto* ptr = reinterpret_cast<const perler::Palette*>(pal);
    if (!ptr) return "";
    static thread_local std::string name;
    name = ptr->brand;
    return name.c_str();
}

const char* perler_palette_color_name(const PerlerPalette* pal, int index) {
    auto* ptr = reinterpret_cast<const perler::Palette*>(pal);
    if (!ptr || index < 0 || index >= static_cast<int>(ptr->size())) return "";
    static thread_local std::string result;
    result = (*ptr)[index].name;
    return result.c_str();
}

const char* perler_palette_color_code(const PerlerPalette* pal, int index) {
    auto* ptr = reinterpret_cast<const perler::Palette*>(pal);
    if (!ptr || index < 0 || index >= static_cast<int>(ptr->size())) return "";
    static thread_local std::string result;
    result = (*ptr)[index].code;
    return result.c_str();
}

const char* perler_palette_color_hex(const PerlerPalette* pal, int index) {
    auto* ptr = reinterpret_cast<const perler::Palette*>(pal);
    if (!ptr || index < 0 || index >= static_cast<int>(ptr->size())) return "";
    static thread_local std::string result;
    result = (*ptr)[index].hex;
    return result.c_str();
}

char* perler_palette_list_available(const char* palettes_dir) {
    auto result = perler::EngineContext::instance().palette_list_available(palettes_dir);
    char* buf = new char[result.size() + 1];
    std::memcpy(buf, result.c_str(), result.size() + 1);
    return buf;
}

// --- Quantization ---

PerlerBeadGrid* perler_quantize(const PerlerImage* img, const PerlerPalette* pal,
                                 int grid_w, int grid_h, int dither_mode) {
    auto* img_ptr = reinterpret_cast<const perler::ImageData*>(img);
    auto* pal_ptr = reinterpret_cast<const perler::Palette*>(pal);
    if (!img_ptr || !pal_ptr) return nullptr;

    auto mode = static_cast<perler::DitherMode>(dither_mode);
    auto grid = perler::EngineContext::instance().quantize(*img_ptr, *pal_ptr, grid_w, grid_h, mode);
    if (!grid.valid()) return nullptr;

    return reinterpret_cast<PerlerBeadGrid*>(new perler::BeadGrid(std::move(grid)));
}

PerlerBeadGrid* perler_process_full_pipeline(
    const PerlerImage* img, const PerlerPalette* pal,
    int grid_w, int grid_h, int dither_mode,
    int crop_x, int crop_y, int crop_w, int crop_h,
    float brightness, float contrast, float blur_sigma) {

    auto* src = reinterpret_cast<const perler::ImageData*>(img);
    auto* pal_ptr = reinterpret_cast<const perler::Palette*>(pal);
    if (!src || !pal_ptr) return nullptr;

    auto& engine = perler::EngineContext::instance();

    // Step 1: Crop (if crop dimensions > 0)
    perler::ImageData working;
    if (crop_w > 0 && crop_h > 0) {
        working = engine.image_crop(*src, crop_x, crop_y, crop_w, crop_h);
    } else {
        working = *src;  // Copy
    }
    if (!working.valid()) return nullptr;

    // Step 2: Adjust brightness/contrast
    if (brightness != 0.0f || contrast != 1.0f) {
        auto adjusted = engine.image_adjust(working, brightness, contrast);
        working = std::move(adjusted);
    }

    // Step 3: Blur
    if (blur_sigma > 0.0f) {
        auto blurred = engine.image_blur(working, blur_sigma);
        working = std::move(blurred);
    }

    // Step 4: Pixelate + Quantize
    auto mode = static_cast<perler::DitherMode>(dither_mode);
    auto grid = engine.quantize(working, *pal_ptr, grid_w, grid_h, mode);
    if (!grid.valid()) return nullptr;

    return reinterpret_cast<PerlerBeadGrid*>(new perler::BeadGrid(std::move(grid)));
}

int perler_merge_similar_colors(PerlerBeadGrid* grid,
                                const PerlerPalette* pal,
                                float threshold) {
    auto* grid_ptr = reinterpret_cast<perler::BeadGrid*>(grid);
    auto* pal_ptr = reinterpret_cast<const perler::Palette*>(pal);
    if (!grid_ptr || !pal_ptr || threshold <= 0.0f) return -1;
    perler::merge_similar_grid_colors(*grid_ptr, *pal_ptr, threshold);
    return 0;
}

int perler_apply_background_removal(PerlerBeadGrid* grid,
                                    const PerlerImage* img,
                                    int threshold) {
    auto* grid_ptr = reinterpret_cast<perler::BeadGrid*>(grid);
    auto* img_ptr = reinterpret_cast<const perler::ImageData*>(img);
    if (!grid_ptr || !img_ptr || threshold < 0) return -1;
    perler::apply_background_mask(*grid_ptr, *img_ptr, threshold);
    return 0;
}

void perler_grid_free(PerlerBeadGrid* grid) {
    delete reinterpret_cast<perler::BeadGrid*>(grid);
}

int perler_grid_width(const PerlerBeadGrid* grid) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    return ptr ? ptr->grid_w : 0;
}

int perler_grid_height(const PerlerBeadGrid* grid) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    return ptr ? ptr->grid_h : 0;
}

const int32_t* perler_grid_indices(const PerlerBeadGrid* grid) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    return ptr ? ptr->indices.data() : nullptr;
}

const char* perler_grid_palette_brand(const PerlerBeadGrid* grid) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr) return "";
    static thread_local std::string brand;
    brand = ptr->palette_brand;
    return brand.c_str();
}

const int32_t* perler_grid_color_counts(const PerlerBeadGrid* grid, int* out_len) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr || !out_len) return nullptr;
    *out_len = static_cast<int>(ptr->color_counts.size());
    return ptr->color_counts.data();
}

// --- Export ---

int perler_export_png(const PerlerBeadGrid* grid, const char* path, int dpi) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr) return -1;
    return perler::EngineContext::instance().export_png(*ptr, path, dpi) ? 0 : -1;
}

int perler_export_png_main(const PerlerBeadGrid* grid, const char* path, int dpi) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr) return -1;
    return perler::EngineContext::instance().export_png_main(*ptr, path, dpi) ? 0 : -1;
}

int perler_export_png_sub(const PerlerBeadGrid* grid, const char* path, int dpi) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr) return -1;
    return perler::EngineContext::instance().export_png_sub(*ptr, path, dpi) ? 0 : -1;
}

int perler_export_pdf(const PerlerBeadGrid* grid, const char* path) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr) return -1;
    return perler::EngineContext::instance().export_pdf(*ptr, path) ? 0 : -1;
}

int perler_export_csv(const PerlerBeadGrid* grid, const char* path) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr) return -1;
    return perler::EngineContext::instance().export_csv(*ptr, path) ? 0 : -1;
}

char* perler_export_project_json(const PerlerBeadGrid* grid) {
    auto* ptr = reinterpret_cast<const perler::BeadGrid*>(grid);
    if (!ptr) {
        char* buf = new char[3];
        std::memcpy(buf, "{}", 3);
        return buf;
    }
    auto json = perler::EngineContext::instance().export_project_json(*ptr);
    char* buf = new char[json.size() + 1];
    std::memcpy(buf, json.c_str(), json.size() + 1);
    return buf;
}

// --- Diagnostics ---

char* perler_diagnose_full(const char* palettes_dir) {
    auto json = perler::EngineContext::instance().diagnose_full(palettes_dir ? palettes_dir : "");
    char* buf = new char[json.size() + 1];
    std::memcpy(buf, json.c_str(), json.size() + 1);
    return buf;
}

char* perler_diagnose_check(const char* check_name, const char* palettes_dir) {
    auto json = perler::EngineContext::instance().diagnose_check(
        check_name ? check_name : "", palettes_dir ? palettes_dir : "");
    char* buf = new char[json.size() + 1];
    std::memcpy(buf, json.c_str(), json.size() + 1);
    return buf;
}

const char* perler_diagnostics_log_path(void) {
    static thread_local std::string path;
    path = perler::EngineContext::instance().diagnostics_log_path();
    return path.c_str();
}

// --- Auto-Repair ---

char* perler_repair_palette_json(const char* json_str) {
    auto result = perler::EngineContext::instance().repair_palette_json(json_str ? json_str : "");
    char* buf = new char[result.size() + 1];
    std::memcpy(buf, result.c_str(), result.size() + 1);
    return buf;
}

char* perler_repair_project_json(const char* json_str) {
    auto result = perler::EngineContext::instance().repair_project_json(json_str ? json_str : "");
    char* buf = new char[result.size() + 1];
    std::memcpy(buf, result.c_str(), result.size() + 1);
    return buf;
}

// --- Plugin ---

int perler_plugin_scan(const char* plugins_dir) {
    return perler::EngineContext::instance().plugin_scan(plugins_dir ? plugins_dir : "");
}

int perler_plugin_count(void) {
    return perler::EngineContext::instance().plugin_count();
}

const char* perler_plugin_info(int index) {
    static thread_local std::string info;
    info = perler::EngineContext::instance().plugin_info(index);
    return info.c_str();
}

int perler_plugin_call(const char* plugin_type, const char* fn_name,
                        const char* args_json, char** result_json) {
    std::string result;
    int ret = perler::EngineContext::instance().plugin_call(
        plugin_type ? plugin_type : "",
        fn_name ? fn_name : "",
        args_json ? args_json : "{}",
        result);
    if (result_json) {
        *result_json = new char[result.size() + 1];
        std::memcpy(*result_json, result.c_str(), result.size() + 1);
    }
    return ret;
}

// --- Utility ---

void perler_string_free(char* str) {
    delete[] str;
}

const char* perler_last_error(void) {
    static thread_local std::string err;
    err = perler::EngineContext::instance().last_error();
    return err.c_str();
}

} // extern "C"
