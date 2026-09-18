#include "dither.h"
#include "colorspace.h"
#include "delta_e.h"
#include "internal/bayer_matrix.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>

namespace perler {

// Helper: find nearest palette color for an RGB value, return palette index
static int find_nearest(const RGB& rgb, const Palette& palette) {
    LAB target = colorspace::rgb_to_lab(rgb);
    return delta_e::find_nearest_color(target, palette.colors);
}

// ============================================================================
// No Dither — direct nearest-neighbor per cell
// ============================================================================

void apply_no_dither(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                     const Palette& palette, BeadGrid& grid) {
    for (int y = 0; y < grid_h; ++y) {
        for (int x = 0; x < grid_w; ++x) {
            size_t idx = static_cast<size_t>(y) * grid_w + x;
            if (cells[idx].coverage < 0.35f) { grid.at(x, y) = -1; continue; }
            int pal_idx = find_nearest(cells[idx].rgb, palette);
            grid.at(x, y) = pal_idx;
            if (pal_idx >= 0 && pal_idx < static_cast<int>(grid.color_counts.size())) {
                grid.color_counts[pal_idx]++;
            }
        }
    }
}

// ============================================================================
// Floyd-Steinberg Error Diffusion
// ============================================================================

void apply_floyd_steinberg(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                            const Palette& palette, BeadGrid& grid) {
    // Keep error diffusion in an int buffer so values cannot wrap around
    // before clamping, matching the JS simulator.
    std::vector<std::array<int, 3>> buf;
    std::vector<bool> empty;
    buf.reserve(cells.size());
    empty.reserve(cells.size());
    for (const auto& c : cells) {
        buf.push_back({c.rgb.r, c.rgb.g, c.rgb.b});
        empty.push_back(c.coverage < 0.35f);
    }

    // Precompute palette colors as RGB for error computation
    std::vector<RGB> pal_rgb;
    for (const auto& c : palette.colors) {
        pal_rgb.push_back(c.rgb);
    }

    for (int y = 0; y < grid_h; ++y) {
        for (int x = 0; x < grid_w; ++x) {
            size_t idx = static_cast<size_t>(y) * grid_w + x;
            if (empty[idx]) { grid.at(x, y) = -1; continue; }

            auto& p = buf[idx];

            // Clamp current value
            RGB clamped(
                static_cast<uint8_t>(std::max(0, std::min(255, p[0]))),
                static_cast<uint8_t>(std::max(0, std::min(255, p[1]))),
                static_cast<uint8_t>(std::max(0, std::min(255, p[2])))
            );

            // Find nearest palette color
            int pal_idx = find_nearest(clamped, palette);
            grid.at(x, y) = pal_idx;
            if (pal_idx >= 0 && pal_idx < static_cast<int>(grid.color_counts.size())) {
                grid.color_counts[pal_idx]++;
            }

            // Compute quantization error
            const RGB& chosen = pal_rgb[pal_idx];
            int err_r = p[0] - static_cast<int>(chosen.r);
            int err_g = p[1] - static_cast<int>(chosen.g);
            int err_b = p[2] - static_cast<int>(chosen.b);

            // Distribute error to neighbors with Floyd-Steinberg weights,
            // skipping empty (low-coverage) neighbors as the JS simulator does.
            // Right: 7/16
            if (x + 1 < grid_w && !empty[idx + 1]) {
                size_t ridx = static_cast<size_t>(y) * grid_w + (x + 1);
                buf[ridx][0] += err_r * 7 / 16;
                buf[ridx][1] += err_g * 7 / 16;
                buf[ridx][2] += err_b * 7 / 16;
            }
            // Bottom-left: 3/16
            if (y + 1 < grid_h && x - 1 >= 0 && !empty[static_cast<size_t>(y + 1) * grid_w + (x - 1)]) {
                size_t blidx = static_cast<size_t>(y + 1) * grid_w + (x - 1);
                buf[blidx][0] += err_r * 3 / 16;
                buf[blidx][1] += err_g * 3 / 16;
                buf[blidx][2] += err_b * 3 / 16;
            }
            // Bottom: 5/16
            if (y + 1 < grid_h && !empty[static_cast<size_t>(y + 1) * grid_w + x]) {
                size_t bidx = static_cast<size_t>(y + 1) * grid_w + x;
                buf[bidx][0] += err_r * 5 / 16;
                buf[bidx][1] += err_g * 5 / 16;
                buf[bidx][2] += err_b * 5 / 16;
            }
            // Bottom-right: 1/16
            if (y + 1 < grid_h && x + 1 < grid_w && !empty[static_cast<size_t>(y + 1) * grid_w + (x + 1)]) {
                size_t bridx = static_cast<size_t>(y + 1) * grid_w + (x + 1);
                buf[bridx][0] += err_r * 1 / 16;
                buf[bridx][1] += err_g * 1 / 16;
                buf[bridx][2] += err_b * 1 / 16;
            }
        }
    }
}

// ============================================================================
// Bayer 8×8 Ordered Dithering
// ============================================================================

void apply_bayer_8x8(const std::vector<CellSample>& cells, int grid_w, int grid_h,
                      const Palette& palette, BeadGrid& grid) {
    // Precompute palette LAB values for distance measurement
    std::vector<LAB> pal_lab;
    for (const auto& c : palette.colors) {
        pal_lab.push_back(c.lab);
    }

    for (int y = 0; y < grid_h; ++y) {
        for (int x = 0; x < grid_w; ++x) {
            size_t idx = static_cast<size_t>(y) * grid_w + x;
            if (cells[idx].coverage < 0.35f) { grid.at(x, y) = -1; continue; }
            const RGB& cell = cells[idx].rgb;

            // Normalize Bayer threshold to [0, 1)
            double threshold = internal::bayer_threshold(x, y);

            // Convert to LAB for distance-based selection:
            // For each of the two nearest palette colors, compute which is
            // closer based on Bayer threshold-adjusted distance.
            // Simplified approach: find the two nearest colors, then use
            // the threshold to pick between them probabilistically.

            LAB cell_lab = colorspace::rgb_to_lab(cell);

            // Find best and second-best matches
            int best_idx = -1, second_idx = -1;
            double best_de = 1e9, second_de = 1e9;

            for (size_t i = 0; i < pal_lab.size(); ++i) {
                double de = delta_e::cie76(cell_lab, pal_lab[i]);
                if (de < best_de) {
                    second_de = best_de;
                    second_idx = best_idx;
                    best_de = de;
                    best_idx = static_cast<int>(i);
                } else if (de < second_de) {
                    second_de = de;
                    second_idx = static_cast<int>(i);
                }
            }

            // Use Bayer threshold to pick: if threshold is low, pick best;
            // if high and second is close enough, pick second
            int chosen = best_idx;
            if (second_idx >= 0 && second_de - best_de < 20.0) {
                double ratio = best_de / std::max(second_de, 0.001);
                if (ratio > threshold) {
                    chosen = second_idx;
                }
            }

            grid.at(x, y) = chosen;
            if (chosen >= 0 && chosen < static_cast<int>(grid.color_counts.size())) {
                grid.color_counts[chosen]++;
            }
        }
    }
}

} // namespace perler
