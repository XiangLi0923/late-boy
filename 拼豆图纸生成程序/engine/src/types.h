#ifndef PERLER_TYPES_H
#define PERLER_TYPES_H

#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>

namespace perler {

// ============================================================================
// Color Types
// ============================================================================

/// 8-bit sRGB color (0-255 per channel)
struct RGB {
    uint8_t r = 0, g = 0, b = 0;

    RGB() = default;
    RGB(uint8_t r_, uint8_t g_, uint8_t b_) : r(r_), g(g_), b(b_) {}

    bool operator==(const RGB& other) const {
        return r == other.r && g == other.g && b == other.b;
    }
};

/// Result of box-sampling a single grid cell. Mirrors the JS simulator's
/// CellSample: average RGB of opaque pixels + the opaque coverage fraction.
struct CellSample {
    RGB rgb;          // average RGB of opaque pixels (0,0,0 if fully transparent)
    float coverage;   // opaque pixel fraction in [0, 1]

    CellSample() = default;
    CellSample(RGB rgb_, float coverage_ = 1.0f) : rgb(rgb_), coverage(coverage_) {}
};

/// Linear RGB (0.0–1.0 per channel, unclamped during intermediate calculations)
struct LinearRGB {
    double r = 0.0, g = 0.0, b = 0.0;

    LinearRGB() = default;
    LinearRGB(double r_, double g_, double b_) : r(r_), g(g_), b(b_) {}
};

/// CIE XYZ (D65 reference white, 2° observer)
struct XYZ {
    double x = 0.0, y = 0.0, z = 0.0;

    XYZ() = default;
    XYZ(double x_, double y_, double z_) : x(x_), y(y_), z(z_) {}
};

/// CIE L*a*b* (CIELAB D65)
struct LAB {
    double l = 0.0;  // L*: 0 (black) to 100 (white)
    double a = 0.0;  // a*: green(-) to red(+)
    double b = 0.0;  // b*: blue(-) to yellow(+)

    LAB() = default;
    LAB(double l_, double a_, double b_) : l(l_), a(a_), b(b_) {}
};

// ============================================================================
// Palette Types
// ============================================================================

/// A single color entry in a bead palette
struct BeadColor {
    std::string name;   // e.g. "White", "Cream"
    std::string code;   // manufacturer part number, e.g. "H01"
    std::string hex;    // hex color code, e.g. "#FFFFFF"
    LAB lab;            // precomputed CIELAB value for fast matching
    RGB rgb;            // parsed RGB for rendering

    BeadColor() = default;
    BeadColor(std::string n, std::string c, std::string h)
        : name(std::move(n)), code(std::move(c)), hex(std::move(h)) {}
};

/// A complete bead color palette (brand + color list)
struct Palette {
    std::string brand;          // e.g. "Hama Midi"
    std::string version;        // palette version
    std::vector<BeadColor> colors;

    /// Look up color by index
    const BeadColor& operator[](size_t i) const { return colors[i]; }
    BeadColor& operator[](size_t i) { return colors[i]; }

    size_t size() const { return colors.size(); }
    bool empty() const { return colors.empty(); }
};

// ============================================================================
// Image Types
// ============================================================================

/// Raw RGBA image data (engine-native format)
struct ImageData {
    int width = 0;
    int height = 0;
    int channels = 4;  // always RGBA internally
    std::vector<uint8_t> pixels;  // size = width * height * channels, row-major

    ImageData() = default;
    ImageData(int w, int h) : width(w), height(h), channels(4),
        pixels(static_cast<size_t>(w) * h * 4, 0) {}

    /// Get pixel at (x, y), returns pointer to RGBA
    const uint8_t* at(int x, int y) const {
        size_t idx = (static_cast<size_t>(y) * width + x) * 4;
        return &pixels[idx];
    }

    uint8_t* at(int x, int y) {
        size_t idx = (static_cast<size_t>(y) * width + x) * 4;
        return &pixels[idx];
    }

    /// Get RGB at (x, y)
    RGB rgb_at(int x, int y) const {
        const uint8_t* p = at(x, y);
        return RGB(p[0], p[1], p[2]);
    }

    bool valid() const { return width > 0 && height > 0 && !pixels.empty(); }

    size_t pixel_count() const { return static_cast<size_t>(width) * height; }
};

// ============================================================================
// Quantization / Grid Types
// ============================================================================

/// Dithering algorithm mode
enum class DitherMode : int {
    None = 0,
    FloydSteinberg = 1,
    Bayer8x8 = 2
};

/// Result of quantizing an image: a grid of palette indices
struct BeadGrid {
    int grid_w = 0;
    int grid_h = 0;
    std::vector<int32_t> indices;  // size = grid_w * grid_h, each is palette index
    std::string palette_brand;     // reference to the palette used
    std::vector<int32_t> color_counts;  // palette-index → usage count
    std::vector<std::string> palette_hex;     // palette-index → hex color (e.g. "#FF5733")
    std::vector<std::string> palette_names;   // palette-index → color name (e.g. "Red")
    std::vector<std::string> palette_codes;   // palette-index → official bead code (e.g. "H01")
    DitherMode dither_mode = DitherMode::None;

    BeadGrid() = default;
    BeadGrid(int w, int h) : grid_w(w), grid_h(h),
        indices(static_cast<size_t>(w) * h, -1) {}

    int32_t at(int x, int y) const {
        return indices[static_cast<size_t>(y) * grid_w + x];
    }

    int32_t& at(int x, int y) {
        return indices[static_cast<size_t>(y) * grid_w + x];
    }

    size_t cell_count() const { return static_cast<size_t>(grid_w) * grid_h; }
    bool valid() const { return grid_w > 0 && grid_h > 0 && !indices.empty(); }
};

// ============================================================================
// Export Types
// ============================================================================

/// Export configuration
struct ExportConfig {
    std::string output_path;
    int dpi = 300;
    bool include_color_legend = true;
    bool compress_json = true;
};

/// Supported export formats
enum class ExportFormat : int {
    PNG = 0,
    PDF = 1,
    CSV = 2,
    ProjectJSON = 3
};

// ============================================================================
// Project State (for save/share)
// ============================================================================

/// Complete project state, serializable to JSON for sharing
struct ProjectState {
    int grid_w = 0;
    int grid_h = 0;
    std::string palette_brand;
    std::string palette_version;
    std::vector<int32_t> grid_indices;  // flat array of palette color indices
    DitherMode dither_mode = DitherMode::None;

    // Source image metadata (not the actual image data, for privacy)
    int source_width = 0;
    int source_height = 0;

    // Preprocessing params that produced this grid
    float brightness = 0.0f;
    float contrast = 1.0f;
    float blur_sigma = 0.0f;

    std::string engine_version;
};

// ============================================================================
// Diagnostic Types
// ============================================================================

/// Result of a single diagnostic check
enum class DiagStatus : int {
    PASS = 0,
    FAIL = 1,
    REPAIRED = 2,
    SKIPPED = 3
};

struct DiagResult {
    std::string check_name;
    std::string module;
    DiagStatus status = DiagStatus::PASS;
    std::string detail;
    std::string timestamp;  // ISO8601
};

// ============================================================================
// Plugin Types
// ============================================================================

/// Plugin category
enum class PluginType : int {
    PaletteSource = 0,
    BoardShape = 1,
    DitherAlgorithm = 2,
    ExportFormat = 3,
    ImageFilter = 4
};

struct PluginManifest {
    std::string name;
    std::string version;
    std::string description;
    std::string author;
    PluginType type;
    std::string script_path;   // relative Lua script path (optional)
    std::string config_json;   // inline JSON config (optional)
};

} // namespace perler

#endif // PERLER_TYPES_H
