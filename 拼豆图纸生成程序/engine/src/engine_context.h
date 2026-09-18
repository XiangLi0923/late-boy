#ifndef PERLER_ENGINE_CONTEXT_H
#define PERLER_ENGINE_CONTEXT_H

#include "types.h"
#include "perler_engine.h"
#include <string>
#include <vector>
#include <memory>

namespace perler {

/// Internal implementation of the engine (wraps all modules).
/// This is the C++ counterpart behind the opaque C API handles.
class EngineContext {
public:
    static EngineContext& instance();

    // Lifecycle
    void init();
    void shutdown();
    std::string version() const;

    // Image operations
    ImageData image_load_from_file(const std::string& path);
    ImageData image_load_from_memory(const uint8_t* data, size_t len);
    ImageData image_crop(const ImageData& src, int x, int y, int w, int h);
    ImageData image_adjust(const ImageData& src, float brightness, float contrast);
    ImageData image_blur(const ImageData& src, float sigma);

    // Palette operations
    Palette palette_load_from_file(const std::string& path);
    Palette palette_load_from_memory(const std::string& json_str);
    std::string palette_list_available(const std::string& dir);

    // Quantization
    BeadGrid quantize(const ImageData& img, const Palette& pal,
                      int grid_w, int grid_h, DitherMode dither);

    // Export
    bool export_png(const BeadGrid& grid, const std::string& path, int dpi);
    bool export_png_main(const BeadGrid& grid, const std::string& path, int dpi);
    bool export_png_sub(const BeadGrid& grid, const std::string& path, int dpi);
    bool export_pdf(const BeadGrid& grid, const std::string& path);
    bool export_csv(const BeadGrid& grid, const std::string& path);
    std::string export_project_json(const BeadGrid& grid);

    // Diagnostics
    std::string diagnose_full(const std::string& palettes_dir);
    std::string diagnose_check(const std::string& name, const std::string& palettes_dir);
    std::string diagnostics_log_path() const;

    // Auto-repair
    std::string repair_palette_json(const std::string& json_str);
    std::string repair_project_json(const std::string& json_str);

    // Plugin
    int plugin_scan(const std::string& plugins_dir);
    int plugin_count() const;
    std::string plugin_info(int index) const;
    int plugin_call(const std::string& type, const std::string& fn,
                    const std::string& args, std::string& result);

    // Error handling
    void set_last_error(const std::string& err);
    std::string last_error() const;

private:
    EngineContext() = default;
    ~EngineContext() = default;
    EngineContext(const EngineContext&) = delete;
    EngineContext& operator=(const EngineContext&) = delete;

    bool initialized_ = false;
    std::string last_error_;
    std::string version_ = "1.2.2";
};

} // namespace perler

#endif // PERLER_ENGINE_CONTEXT_H
