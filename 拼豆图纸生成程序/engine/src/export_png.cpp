/// PNG Export — Professional bead blueprint output
///
/// Produces two images matching industry-standard bead blueprint format:
///   Main (主图): beads with color codes, coordinate labels, color legend
///   Sub  (副图): clean effect preview without labels
///
/// Layout (top to bottom):
///   ┌─────────────────────────────┐
///   │  Title / Palette info       │  header area
///   ├─────────────────────────────┤
///   │  ABC...  (col coordinates)  │  col labels
///   │ 1┌──────────────────┐      │
///   │ 2│ ■  ■  ■  ■  ■   │      │  bead grid with codes
///   │ 3│ ■  ■  ■  ■  ■   │      │
///   │  ...                      │
///   │  └──────────────────┘      │
///   ├─────────────────────────────┤
///   │  Color Legend:              │  legend table
///   │  H01 White   ■  120        │
///   └─────────────────────────────┘

#include "types.h"
#include "internal/string_utils.h"
#include <string>
#include <vector>
#include <cstring>
#include <cstdio>
#include <cmath>
#include <algorithm>
#include <map>

// stb_image_write
#ifndef STBI_INCLUDE_STB_IMAGE_WRITE_H
namespace {
    extern "C" {
        extern int stbi_write_png(char const* filename, int w, int h, int comp,
                                   const void* data, int stride_in_bytes);
    }
}
#endif

namespace perler {
namespace {

// ============================================================================
// Pixel buffer helpers
// ============================================================================

struct PixelBuffer {
    int w = 0, h = 0;
    std::vector<uint8_t> data;  // RGBA, row-major

    PixelBuffer() = default;
    PixelBuffer(int w_, int h_) : w(w_), h(h_), data(w_ * h_ * 4ULL, 255) {}

    uint8_t* pixel(int x, int y) {
        return &data[(static_cast<size_t>(y) * w + x) * 4];
    }
    const uint8_t* pixel(int x, int y) const {
        return &data[(static_cast<size_t>(y) * w + x) * 4];
    }

    void fill_rect(int x, int y, int rw, int rh, uint8_t r, uint8_t g, uint8_t b, uint8_t a = 255) {
        int x0 = std::max(0, x), y0 = std::max(0, y);
        int x1 = std::min(w, x + rw), y1 = std::min(h, y + rh);
        for (int py = y0; py < y1; ++py) {
            for (int px = x0; px < x1; ++px) {
                uint8_t* p = pixel(px, py);
                p[0] = r; p[1] = g; p[2] = b; p[3] = a;
            }
        }
    }

    void draw_text_simple(int x, int y, const std::string& text,
                          uint8_t r, uint8_t g, uint8_t b);
};

// ============================================================================
// Tiny bitmap font (5x7, ASCII 32-126)
// ============================================================================

// Each character is 5 columns wide × 7 rows tall, stored as 5 bytes (one per column, LSB=top)
static const uint8_t FONT_DATA[][5] = {
    {0x00,0x00,0x00,0x00,0x00}, // 32 space
    {0x00,0x00,0x5F,0x00,0x00}, // 33 !
    {0x00,0x07,0x00,0x07,0x00}, // 34 "
    {0x14,0x7F,0x14,0x7F,0x14}, // 35 #
    {0x24,0x2A,0x7F,0x2A,0x12}, // 36 $
    {0x23,0x13,0x08,0x64,0x62}, // 37 %
    {0x36,0x49,0x55,0x22,0x50}, // 38 &
    {0x00,0x05,0x03,0x00,0x00}, // 39 '
    {0x00,0x1C,0x22,0x41,0x00}, // 40 (
    {0x00,0x41,0x22,0x1C,0x00}, // 41 )
    {0x14,0x08,0x3E,0x08,0x14}, // 42 *
    {0x08,0x08,0x3E,0x08,0x08}, // 43 +
    {0x00,0x50,0x30,0x00,0x00}, // 44 ,
    {0x08,0x08,0x08,0x08,0x08}, // 45 -
    {0x00,0x60,0x60,0x00,0x00}, // 46 .
    {0x20,0x10,0x08,0x04,0x02}, // 47 /
    {0x3E,0x51,0x49,0x45,0x3E}, // 48 0
    {0x00,0x42,0x7F,0x40,0x00}, // 49 1
    {0x42,0x61,0x51,0x49,0x46}, // 50 2
    {0x21,0x41,0x45,0x4B,0x31}, // 51 3
    {0x18,0x14,0x12,0x7F,0x10}, // 52 4
    {0x27,0x45,0x45,0x45,0x39}, // 53 5
    {0x3C,0x4A,0x49,0x49,0x30}, // 54 6
    {0x01,0x71,0x09,0x05,0x03}, // 55 7
    {0x36,0x49,0x49,0x49,0x36}, // 56 8
    {0x06,0x49,0x49,0x29,0x1E}, // 57 9
    {0x00,0x36,0x36,0x00,0x00}, // 58 :
    {0x00,0x56,0x36,0x00,0x00}, // 59 ;
    {0x08,0x14,0x22,0x41,0x00}, // 60 <
    {0x14,0x14,0x14,0x14,0x14}, // 61 =
    {0x00,0x41,0x22,0x14,0x08}, // 62 >
    {0x02,0x01,0x51,0x09,0x06}, // 63 ?
    {0x32,0x49,0x79,0x41,0x3E}, // 64 @
    {0x7E,0x11,0x11,0x11,0x7E}, // 65 A
    {0x7F,0x49,0x49,0x49,0x36}, // 66 B
    {0x3E,0x41,0x41,0x41,0x22}, // 67 C
    {0x7F,0x41,0x41,0x22,0x1C}, // 68 D
    {0x7F,0x49,0x49,0x49,0x41}, // 69 E
    {0x7F,0x09,0x09,0x09,0x01}, // 70 F
    {0x3E,0x41,0x49,0x49,0x7A}, // 71 G
    {0x7F,0x08,0x08,0x08,0x7F}, // 72 H
    {0x00,0x41,0x7F,0x41,0x00}, // 73 I
    {0x20,0x40,0x41,0x3F,0x01}, // 74 J
    {0x7F,0x08,0x14,0x22,0x41}, // 75 K
    {0x7F,0x40,0x40,0x40,0x40}, // 76 L
    {0x7F,0x02,0x0C,0x02,0x7F}, // 77 M
    {0x7F,0x04,0x08,0x10,0x7F}, // 78 N
    {0x3E,0x41,0x41,0x41,0x3E}, // 79 O
    {0x7F,0x09,0x09,0x09,0x06}, // 80 P
    {0x3E,0x41,0x51,0x21,0x5E}, // 81 Q
    {0x7F,0x09,0x19,0x29,0x46}, // 82 R
    {0x46,0x49,0x49,0x49,0x31}, // 83 S
    {0x01,0x01,0x7F,0x01,0x01}, // 84 T
    {0x3F,0x40,0x40,0x40,0x3F}, // 85 U
    {0x1F,0x20,0x40,0x20,0x1F}, // 86 V
    {0x3F,0x40,0x38,0x40,0x3F}, // 87 W
    {0x63,0x14,0x08,0x14,0x63}, // 88 X
    {0x07,0x08,0x70,0x08,0x07}, // 89 Y
    {0x61,0x51,0x49,0x45,0x43}, // 90 Z
    {0x00,0x7F,0x41,0x41,0x00}, // 91 [
    {0x02,0x04,0x08,0x10,0x20}, // 92 backslash
    {0x00,0x41,0x41,0x7F,0x00}, // 93 ]
    {0x04,0x02,0x01,0x02,0x04}, // 94 ^
    {0x40,0x40,0x40,0x40,0x40}, // 95 _
    {0x00,0x01,0x02,0x04,0x00}, // 96 `
    {0x20,0x54,0x54,0x54,0x78}, // 97 a
    {0x7F,0x48,0x44,0x44,0x38}, // 98 b
    {0x38,0x44,0x44,0x44,0x20}, // 99 c
    {0x38,0x44,0x44,0x48,0x7F}, // 100 d
    {0x38,0x54,0x54,0x54,0x18}, // 101 e
    {0x08,0x7E,0x09,0x01,0x02}, // 102 f
    {0x0C,0x52,0x52,0x52,0x3E}, // 103 g
    {0x7F,0x08,0x04,0x04,0x78}, // 104 h
    {0x00,0x44,0x7D,0x40,0x00}, // 105 i
    {0x20,0x40,0x44,0x3D,0x00}, // 106 j
    {0x7F,0x10,0x28,0x44,0x00}, // 107 k
    {0x00,0x41,0x7F,0x40,0x00}, // 108 l
    {0x7C,0x04,0x18,0x04,0x78}, // 109 m
    {0x7C,0x08,0x04,0x04,0x78}, // 110 n
    {0x38,0x44,0x44,0x44,0x38}, // 111 o
    {0x7C,0x14,0x14,0x14,0x08}, // 112 p
    {0x08,0x14,0x14,0x18,0x7C}, // 113 q
    {0x7C,0x08,0x04,0x04,0x08}, // 114 r
    {0x48,0x54,0x54,0x54,0x20}, // 115 s
    {0x04,0x3F,0x44,0x40,0x20}, // 116 t
    {0x3C,0x40,0x40,0x20,0x7C}, // 117 u
    {0x1C,0x20,0x40,0x20,0x1C}, // 118 v
    {0x3C,0x40,0x30,0x40,0x3C}, // 119 w
    {0x44,0x28,0x10,0x28,0x44}, // 120 x
    {0x0C,0x50,0x50,0x50,0x3C}, // 121 y
    {0x44,0x64,0x54,0x4C,0x44}, // 122 z
    {0x00,0x08,0x36,0x41,0x00}, // 123 {
    {0x00,0x00,0x7F,0x00,0x00}, // 124 |
    {0x00,0x41,0x36,0x08,0x00}, // 125 }
    {0x10,0x08,0x10,0x08,0x00}, // 126 ~
};

static constexpr int FONT_CHAR_W = 6;  // 5 data columns + 1 spacing
static constexpr int FONT_CHAR_H = 8;  // 7 rows + 1 spacing

void PixelBuffer::draw_text_simple(int x, int y, const std::string& text,
                                    uint8_t r, uint8_t g, uint8_t b) {
    int cur_x = x;
    for (char ch : text) {
        int idx = static_cast<int>(static_cast<unsigned char>(ch)) - 32;
        if (idx < 0 || idx > 94) idx = 0;

        const uint8_t* col_data = FONT_DATA[idx];
        for (int cx = 0; cx < 5; ++cx) {
            uint8_t bits = col_data[cx];
            for (int cy = 0; cy < 7; ++cy) {
                if (bits & (1 << cy)) {
                    int px = cur_x + cx, py = y + (6 - cy);  // flip Y
                    if (px >= 0 && px < w && py >= 0 && py < h) {
                        uint8_t* p = pixel(px, py);
                        p[0] = r; p[1] = g; p[2] = b; p[3] = 255;
                    }
                }
            }
        }
        cur_x += FONT_CHAR_W;
    }
}

// ============================================================================
// Helper functions
// ============================================================================

RGB hex_to_rgb(const std::string& hex) {
    uint8_t r = 0, g = 0, b = 0;
    if (internal::parse_hex_to_rgb(hex, r, g, b)) return RGB(r, g, b);
    return RGB(0, 0, 0);
}

/// Choose contrasting text color (black or white) based on luminance
bool should_use_white_text(const RGB& bg) {
    double lum = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
    return lum < 140;  // Dark background → white text
}

// ============================================================================
// Legend Builder
// ============================================================================

struct LegendEntry {
    std::string code;
    std::string name;
    std::string hex;
    int count = 0;
};

static std::vector<LegendEntry> build_legend(const BeadGrid& grid) {
    std::vector<LegendEntry> entries;
    size_t n = std::min({grid.palette_hex.size(), grid.palette_names.size(),
                         grid.color_counts.size()});
    for (size_t i = 0; i < n; ++i) {
        if (grid.color_counts[i] > 0) {
            LegendEntry e;
            e.hex = grid.palette_hex[i];
            e.count = grid.color_counts[i];
            e.name = (i < grid.palette_names.size()) ? grid.palette_names[i] : "";
            e.code = (i < grid.palette_codes.size()) ? grid.palette_codes[i] : ("#" + std::to_string(i + 1));
            entries.push_back(e);
        }
    }
    // Sort by code number (standard bead blueprint convention)
    std::sort(entries.begin(), entries.end(),
              [](const LegendEntry& a, const LegendEntry& b) {
                  // Extract numeric part from code (e.g. "H01" → 1, "P105" → 105)
                  auto extract_num = [](const std::string& code) -> int {
                      std::string num;
                      for (char c : code) { if (c >= '0' && c <= '9') num += c; }
                      return num.empty() ? 0 : std::stoi(num);
                  };
                  int na = extract_num(a.code), nb = extract_num(b.code);
                  if (na != nb) return na < nb;
                  return a.code < b.code;
              });
    return entries;
}

/// Draw color legend table in bottom area. Returns the Y position right after the legend.
static int draw_legend(PixelBuffer& buf, int lx, int ly, int max_w,
                       const std::vector<LegendEntry>& entries) {
    const int swatch_sz = 14;
    const int row_h = 18;
    const int entries_per_row = std::max(1, (max_w - lx) / 180);  // ~180px per entry

    // Legend header
    buf.draw_text_simple(lx, ly, "Color Legend:", 0, 0, 0);
    int ry = ly + 14;

    int col = 0;
    int cx = lx;
    for (size_t i = 0; i < entries.size(); ++i) {
        const auto& e = entries[i];

        // Color swatch
        RGB c = hex_to_rgb(e.hex);
        buf.fill_rect(cx, ry + 1, swatch_sz, swatch_sz, c.r, c.g, c.b);

        // Black border around swatch
        for (int s = 0; s < swatch_sz; ++s) {
            buf.pixel(cx + s, ry)[0] = 0; buf.pixel(cx + s, ry)[1] = 0; buf.pixel(cx + s, ry)[2] = 0;
            buf.pixel(cx + s, ry + swatch_sz - 1)[0] = 0;
            buf.pixel(cx + s, ry + swatch_sz - 1)[1] = 0;
            buf.pixel(cx + s, ry + swatch_sz - 1)[2] = 0;
        }
        for (int s = 0; s < swatch_sz; ++s) {
            buf.pixel(cx, ry + s)[0] = 0; buf.pixel(cx, ry + s)[1] = 0; buf.pixel(cx, ry + s)[2] = 0;
            buf.pixel(cx + swatch_sz - 1, ry + s)[0] = 0;
            buf.pixel(cx + swatch_sz - 1, ry + s)[1] = 0;
            buf.pixel(cx + swatch_sz - 1, ry + s)[2] = 0;
        }

        // Code + count
        std::string label = e.code + " x" + std::to_string(e.count);
        buf.draw_text_simple(cx + swatch_sz + 4, ry + 2, label, 0, 0, 0);

        col++;
        if (col >= entries_per_row) {
            col = 0;
            cx = lx;
            ry += row_h;
        } else {
            cx += 180;
        }
    }

    return ry + row_h + 8;
}

} // anonymous namespace

// ============================================================================
// Forward declarations for render functions
// ============================================================================

static void render_bead_grid(PixelBuffer& buf, const BeadGrid& grid,
                             int bx, int by, int bead_sz,
                             bool show_labels);

static void render_coordinates(PixelBuffer& buf, const BeadGrid& grid,
                               int bx, int by, int bead_sz);

static void render_header(PixelBuffer& buf, const BeadGrid& grid,
                          int x, int y, int w);

// ============================================================================
// Main export functions
// ============================================================================

// ============================================================================
// Public entry points
// ============================================================================

bool do_export_png_main(const BeadGrid& grid, const std::string& path, int dpi) {
    if (!grid.valid() || path.empty()) return false;

    // Layout dimensions (portrait orientation, print quality)
    // ~300 DPI → 5mm bead = ~59px. For web/screen we use bigger display.
    const double pixels_per_mm = dpi / 25.4;
    const int bead_sz = std::max(15, static_cast<int>(std::round(pixels_per_mm * 5.0)));

    const int label_w = 30;   // space for row numbers
    const int label_h = 18;   // space for column letters
    const int header_h = 36;  // title + info
    const int margin = 20;

    int grid_px_w = grid.grid_w * bead_sz;
    int grid_px_h = grid.grid_h * bead_sz;
    int canvas_w = grid_px_w + label_w + margin * 2 + 20;

    // Legend height grows with the number of used colors; a fixed height clips
    // the bottom rows (the most-used colors) when many colors are used.
    auto legend = build_legend(grid);
    const int entries_per_row = std::max(1, (canvas_w - margin * 2 - margin) / 180);
    const int legend_rows = static_cast<int>((legend.size() + entries_per_row - 1) / entries_per_row);
    const int legend_h = 14 + legend_rows * 18 + 8;

    int canvas_h = grid_px_h + label_h + header_h + legend_h + margin * 2 + 20;

    PixelBuffer buf(canvas_w, canvas_h);

    // White background
    buf.fill_rect(0, 0, canvas_w, canvas_h, 255, 255, 255);

    // Position of grid top-left corner
    int gx = margin + label_w;
    int gy = margin + header_h + label_h;

    // Draw bead grid background (light gray board)
    buf.fill_rect(gx - 2, gy - 2, grid_px_w + 4, grid_px_h + 4, 220, 220, 220);

    // Header
    render_header(buf, grid, margin, margin, canvas_w - margin * 2);

    // Coordinates
    render_coordinates(buf, grid, gx, gy, bead_sz);

    // Bead grid with color codes
    render_bead_grid(buf, grid, gx, gy, bead_sz, true);

    // Legend
    draw_legend(buf, margin, gy + grid_px_h + 16, canvas_w - margin * 2, legend);

    // Write PNG
    int result = stbi_write_png(path.c_str(), canvas_w, canvas_h, 4,
                                 buf.data.data(), canvas_w * 4);
    return result != 0;
}

bool do_export_png_sub(const BeadGrid& grid, const std::string& path, int dpi) {
    if (!grid.valid() || path.empty()) return false;

    const double pixels_per_mm = dpi / 25.4;
    const int bead_sz = std::max(15, static_cast<int>(std::round(pixels_per_mm * 5.0)));

    const int margin = 20;
    int grid_px_w = grid.grid_w * bead_sz;
    int grid_px_h = grid.grid_h * bead_sz;
    int canvas_w = grid_px_w + margin * 2;
    int canvas_h = grid_px_h + margin * 2;

    PixelBuffer buf(canvas_w, canvas_h);
    buf.fill_rect(0, 0, canvas_w, canvas_h, 255, 255, 255);

    int gx = margin;
    int gy = margin;

    // Light gray board background
    buf.fill_rect(gx - 2, gy - 2, grid_px_w + 4, grid_px_h + 4, 220, 220, 220);

    // Bead grid (no labels)
    render_bead_grid(buf, grid, gx, gy, bead_sz, false);

    int result = stbi_write_png(path.c_str(), canvas_w, canvas_h, 4,
                                 buf.data.data(), canvas_w * 4);
    return result != 0;
}

// ============================================================================
// Rendering helpers
// ============================================================================

static void render_bead_grid(PixelBuffer& buf, const BeadGrid& grid,
                              int bx, int by, int bead_sz, bool show_labels) {
    size_t palette_size = grid.palette_hex.size();

    for (int gy = 0; gy < grid.grid_h; ++gy) {
        for (int gx = 0; gx < grid.grid_w; ++gx) {
            int32_t ci = grid.at(gx, gy);
            if (ci < 0 || static_cast<size_t>(ci) >= palette_size) continue;

            RGB c = hex_to_rgb(grid.palette_hex[ci]);
            int px = bx + gx * bead_sz;
            int py = by + gy * bead_sz;

            // Bead fill (square with 1px gap)
            int gap = std::max(1, bead_sz / 15);
            buf.fill_rect(px + gap, py + gap, bead_sz - gap * 2, bead_sz - gap * 2, c.r, c.g, c.b);

            // Label on bead (official color code, centered)
            if (show_labels && bead_sz >= 14) {
                std::string label =
                    (static_cast<size_t>(ci) < grid.palette_codes.size() &&
                     !grid.palette_codes[ci].empty())
                        ? grid.palette_codes[ci]
                        : "#" + std::to_string(ci + 1);
                int label_px_w = static_cast<int>(label.size()) * FONT_CHAR_W;
                if (label_px_w <= bead_sz - 2) {
                    int lx = px + (bead_sz - label_px_w) / 2;
                    int ly = py + (bead_sz - 7) / 2;

                    uint8_t tr = should_use_white_text(c) ? 255 : 0;
                    uint8_t tg = should_use_white_text(c) ? 255 : 0;
                    uint8_t tb = should_use_white_text(c) ? 255 : 0;
                    buf.draw_text_simple(lx, ly, label, tr, tg, tb);
                }
            }
        }
    }

    // Grid lines between beads
    for (int gy = 0; gy <= grid.grid_h; ++gy) {
        int y = by + gy * bead_sz;
        for (int x = bx; x < bx + grid.grid_w * bead_sz; ++x) {
            buf.pixel(x, y)[0] = 180; buf.pixel(x, y)[1] = 180; buf.pixel(x, y)[2] = 180;
        }
    }
    for (int gx = 0; gx <= grid.grid_w; ++gx) {
        int x = bx + gx * bead_sz;
        for (int y = by; y < by + grid.grid_h * bead_sz; ++y) {
            if (buf.pixel(x, y)[0] == 255 && buf.pixel(x, y)[1] == 255 && buf.pixel(x, y)[2] == 255) {
                buf.pixel(x, y)[0] = 180; buf.pixel(x, y)[1] = 180; buf.pixel(x, y)[2] = 180;
            }
        }
    }
}

static void render_coordinates(PixelBuffer& buf, const BeadGrid& grid,
                                int bx, int by, int bead_sz) {
    // Column labels: A, B, C, ... Z, AA, AB, ... AZ, BA, ...
    for (int gx = 0; gx < grid.grid_w; ++gx) {
        // Convert 0-based index to Excel-style column letter
        std::string label;
        int n = gx;
        do {
            label = static_cast<char>('A' + (n % 26)) + label;
            n = n / 26 - 1;
        } while (n >= 0);
        int cx = bx + gx * bead_sz + bead_sz / 2;
        int cy = by - 14;

        // Center the letter label
        int lw = static_cast<int>(label.size()) * FONT_CHAR_W;
        buf.draw_text_simple(cx - lw / 2, cy, label, 80, 80, 80);
    }

    // Row labels
    for (int gy = 0; gy < grid.grid_h; ++gy) {
        int rx = bx - static_cast<int>(std::to_string(gy + 1).size()) * FONT_CHAR_W - 6;
        int ry = by + gy * bead_sz + bead_sz / 2 - 3;
        buf.draw_text_simple(rx, ry, std::to_string(gy + 1), 80, 80, 80);
    }
}

static void render_header(PixelBuffer& buf, const BeadGrid& grid,
                           int x, int y, int w) {
    std::string title = "Perler Bead Blueprint";
    int tx = x + (w - static_cast<int>(title.size()) * FONT_CHAR_W) / 2;
    buf.draw_text_simple(tx, y, title, 40, 40, 40);

    std::string info = std::to_string(grid.grid_w) + " x " + std::to_string(grid.grid_h) +
                       "  |  " + grid.palette_brand + "  |  " +
                       std::to_string(grid.indices.size()) + " beads";
    int ix = x + (w - static_cast<int>(info.size()) * FONT_CHAR_W) / 2;
    buf.draw_text_simple(ix, y + 16, info, 100, 100, 100);
}

bool do_export_png(const BeadGrid& grid, const std::string& path, int dpi) {
    // Generate both main + sub images
    std::string main_path = path;
    size_t dot = main_path.find_last_of('.');
    if (dot != std::string::npos) {
        main_path = main_path.substr(0, dot) + "_main" + main_path.substr(dot);
    }
    if (!do_export_png_main(grid, main_path, dpi)) return false;

    std::string sub_path = path;
    dot = sub_path.find_last_of('.');
    if (dot != std::string::npos) {
        sub_path = sub_path.substr(0, dot) + "_sub" + sub_path.substr(dot);
    }
    return do_export_png_sub(grid, sub_path, dpi);
}

} // namespace perler
