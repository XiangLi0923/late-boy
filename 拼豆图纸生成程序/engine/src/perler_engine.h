#ifndef PERLER_ENGINE_H
#define PERLER_ENGINE_H

/// Perler Bead Engine — Public C API
///
/// This is the single public header for the perler_engine library.
/// All functions use `extern "C"` linkage and opaque pointer types
/// for ABI stability across compilers and FFI boundaries (Emscripten,
/// Node.js N-API, static linking, etc.).
///
/// Memory management: Objects returned with a `perler_*` prefix must
/// be freed with the corresponding `perler_*_free()` function.
/// Strings returned by the engine must be freed with `perler_string_free()`.

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// ============================================================================
// Opaque handle types
// ============================================================================

typedef struct PerlerImage PerlerImage;
typedef struct PerlerPalette PerlerPalette;
typedef struct PerlerBeadGrid PerlerBeadGrid;

// ============================================================================
// Engine Lifecycle
// ============================================================================

/// Initialize the engine (must be called once at startup)
void perler_init(void);

/// Shutdown the engine (free all global resources)
void perler_shutdown(void);

/// Get engine version string. Caller must free with perler_string_free().
const char* perler_version(void);

// ============================================================================
// Image API
// ============================================================================

/// Load an image from a file path. Returns NULL on failure.
PerlerImage* perler_image_load_from_file(const char* path);

/// Load an image from an in-memory buffer.
/// @param data Raw image file bytes (PNG, JPEG, etc.)
/// @param len Length of data in bytes
/// @return Image handle or NULL on failure
PerlerImage* perler_image_load_from_memory(const uint8_t* data, size_t len);

/// Free an image handle
void perler_image_free(PerlerImage* img);

/// Get image dimensions
int perler_image_width(const PerlerImage* img);
int perler_image_height(const PerlerImage* img);

/// Get raw RGBA pixel data (read-only, row-major, tightly packed)
const uint8_t* perler_image_rgba_data(const PerlerImage* img);

// ============================================================================
// Image Preprocessing (each returns a NEW image; source is untouched)
// ============================================================================

/// Crop image to the given rectangle.
/// Out-of-bounds coordinates are clamped to image edges with a warning.
PerlerImage* perler_image_crop(const PerlerImage* img, int x, int y, int w, int h);

/// Adjust brightness and contrast in-place on a COPY of the image.
/// @param brightness Range [-1.0, 1.0], 0.0 = no change
/// @param contrast Range [0.0, 3.0], 1.0 = no change
/// @return New adjusted image
PerlerImage* perler_image_adjust(const PerlerImage* img, float brightness, float contrast);

/// Apply Gaussian blur with given sigma (radius = ceil(3*sigma)).
/// @param sigma Standard deviation of the Gaussian kernel (0.5–10.0)
/// @return New blurred image
PerlerImage* perler_image_blur(const PerlerImage* img, float sigma);

// ============================================================================
// Palette API
// ============================================================================

/// Load a palette from a JSON file
PerlerPalette* perler_palette_load_from_file(const char* json_path);

/// Load a palette from a JSON string in memory
PerlerPalette* perler_palette_load_from_memory(const char* json_str);

/// Free a palette handle
void perler_palette_free(PerlerPalette* pal);

/// Get the number of colors in the palette
int perler_palette_color_count(const PerlerPalette* pal);

/// Get the brand name string (caller must NOT free)
const char* perler_palette_brand_name(const PerlerPalette* pal);

/// Get color info by index. Caller must NOT free returned strings.
const char* perler_palette_color_name(const PerlerPalette* pal, int index);
const char* perler_palette_color_code(const PerlerPalette* pal, int index);
const char* perler_palette_color_hex(const PerlerPalette* pal, int index);

/// List available palettes in a directory as a JSON array string.
/// Caller must free with perler_string_free().
char* perler_palette_list_available(const char* palettes_dir);

// ============================================================================
// Quantization API
// ============================================================================

/// Quantize an image using a palette into a bead grid.
/// @param img Source image
/// @param pal Palette to match against
/// @param grid_w Target grid width (bead columns)
/// @param grid_h Target grid height (bead rows)
/// @param dither_mode 0=None, 1=Floyd-Steinberg, 2=Bayer 8x8
/// @return BeadGrid handle or NULL on failure
PerlerBeadGrid* perler_quantize(const PerlerImage* img, const PerlerPalette* pal,
                                 int grid_w, int grid_h, int dither_mode);

/// Convenience: Full pipeline (preprocess + quantize) in one call.
/// Pass 0 for crop_w/crop_h to skip crop.
/// Pass 0.0f for blur_sigma to skip blur.
PerlerBeadGrid* perler_process_full_pipeline(
    const PerlerImage* img,
    const PerlerPalette* pal,
    int grid_w, int grid_h,
    int dither_mode,
    int crop_x, int crop_y, int crop_w, int crop_h,
    float brightness, float contrast, float blur_sigma);

/// Merge similar palette colors in an existing grid by CIELAB distance.
/// @param threshold Maximum CIE76 ΔE between colors that should be merged
/// @return 0 on success, -1 on failure
int perler_merge_similar_colors(PerlerBeadGrid* grid,
                                const PerlerPalette* pal,
                                float threshold);

/// Remove edge-connected background cells from a grid.
/// @param threshold Max RGB distance from the border average (default 28)
/// @return 0 on success, -1 on failure
int perler_apply_background_removal(PerlerBeadGrid* grid,
                                    const PerlerImage* img,
                                    int threshold);

/// Free a bead grid handle
void perler_grid_free(PerlerBeadGrid* grid);

/// Get grid dimensions
int perler_grid_width(const PerlerBeadGrid* grid);
int perler_grid_height(const PerlerBeadGrid* grid);

/// Get flat array of palette indices (length = width * height).
/// Caller must NOT free.
const int32_t* perler_grid_indices(const PerlerBeadGrid* grid);

/// Get the palette brand used for this grid. Caller must NOT free.
const char* perler_grid_palette_brand(const PerlerBeadGrid* grid);

/// Get per-color usage counts (length = palette color count).
/// @param out_len Output: length of the returned array
/// @return Array of counts, caller must NOT free
const int32_t* perler_grid_color_counts(const PerlerBeadGrid* grid, int* out_len);

// ============================================================================
// Export API
// ============================================================================

/// Export grid as 300 DPI PNG (generates both main + sub images). Returns 0 on success, -1 on failure.
int perler_export_png(const PerlerBeadGrid* grid, const char* path, int dpi);

/// Export main blueprint (主图): with color codes, coordinates, and legend.
int perler_export_png_main(const PerlerBeadGrid* grid, const char* path, int dpi);

/// Export sub preview (副图): clean bead effect without labels.
int perler_export_png_sub(const PerlerBeadGrid* grid, const char* path, int dpi);

/// Export grid as vector PDF (libharu). Returns 0 on success, -1 on failure.
/// Not available in mini WASM builds.
int perler_export_pdf(const PerlerBeadGrid* grid, const char* path);

/// Export grid as CSV. Returns 0 on success, -1 on failure.
int perler_export_csv(const PerlerBeadGrid* grid, const char* path);

/// Export full project state as compressed JSON string.
/// Caller must free with perler_string_free().
char* perler_export_project_json(const PerlerBeadGrid* grid);

// ============================================================================
// Diagnostics API
// ============================================================================

/// Run all diagnostic checks and return JSON results array.
/// Caller must free with perler_string_free().
char* perler_diagnose_full(const char* palettes_dir);

/// Run a single named diagnostic check.
/// Caller must free with perler_string_free().
char* perler_diagnose_check(const char* check_name, const char* palettes_dir);

/// Get diagnostics log file path
const char* perler_diagnostics_log_path(void);

// ============================================================================
// Auto-Repair API
// ============================================================================

/// Attempt to repair a malformed palette JSON string.
/// Returns repaired JSON or NULL if unrepairable.
/// Caller must free with perler_string_free().
char* perler_repair_palette_json(const char* json_str);

/// Attempt to repair a malformed project JSON string.
/// Caller must free with perler_string_free().
char* perler_repair_project_json(const char* json_str);

// ============================================================================
// Plugin API
// ============================================================================

/// Scan a directory for plugin packages and load valid ones.
/// @return Number of plugins successfully loaded
int perler_plugin_scan(const char* plugins_dir);

/// Get the number of currently loaded plugins
int perler_plugin_count(void);

/// Get plugin info by index as JSON string.
/// Caller must free with perler_string_free().
const char* perler_plugin_info(int index);

/// Call a plugin function by type and name with JSON arguments.
/// @param result_json Output JSON string, caller must free with perler_string_free()
/// @return 0 on success, -1 on failure
int perler_plugin_call(const char* plugin_type, const char* fn_name,
                        const char* args_json, char** result_json);

// ============================================================================
// Utility
// ============================================================================

/// Free a string returned by the engine
void perler_string_free(char* str);

/// Get the last error message (thread-local). Caller must NOT free.
const char* perler_last_error(void);

#ifdef __cplusplus
}
#endif

#endif // PERLER_ENGINE_H
