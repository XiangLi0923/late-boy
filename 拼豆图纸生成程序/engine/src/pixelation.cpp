#include "types.h"
#include <cmath>
#include <algorithm>

namespace perler {

/// Box sampling: map each cell of the target grid to the source image,
/// average all pixels within the cell's coverage area.
///
/// For cell (gx, gy):
///   src_x0 = floor(gx * src_w / grid_w)
///   src_y0 = floor(gy * src_h / grid_h)
///   src_x1 = floor((gx+1) * src_w / grid_w) - 1
///   src_y1 = floor((gy+1) * src_h / grid_h) - 1
///
/// Average all RGBA pixels in the rectangle [x0..x1] × [y0..y1].
/// Alpha is treated as premultiplied in the average.
std::vector<CellSample> pixelate_box_sample(const ImageData& src, int grid_w, int grid_h) {
    std::vector<CellSample> result(static_cast<size_t>(grid_w) * grid_h);

    if (!src.valid() || grid_w <= 0 || grid_h <= 0) {
        return result;
    }

    const double src_w = src.width;
    const double src_h = src.height;

    for (int gy = 0; gy < grid_h; ++gy) {
        // Source Y range for this grid row (exclusive upper bound, matching JS)
        int sy0 = static_cast<int>(std::floor(gy * src_h / grid_h));
        int sy1 = static_cast<int>(std::floor((gy + 1) * src_h / grid_h));

        for (int gx = 0; gx < grid_w; ++gx) {
            // Source X range for this grid column (exclusive upper bound, matching JS)
            int sx0 = static_cast<int>(std::floor(gx * src_w / grid_w));
            int sx1 = static_cast<int>(std::floor((gx + 1) * src_w / grid_w));

            // Average opaque pixels only; transparent pixels (alpha < 16) are
            // skipped so a transparent background does not darken the cell.
            double sum_r = 0.0, sum_g = 0.0, sum_b = 0.0;
            int opaque = 0;
            int total = 0;

            for (int sy = sy0; sy < sy1; ++sy) {
                for (int sx = sx0; sx < sx1; ++sx) {
                    const uint8_t* p = src.at(sx, sy);
                    ++total;
                    if (p[3] < 16) continue;
                    sum_r += p[0];
                    sum_g += p[1];
                    sum_b += p[2];
                    ++opaque;
                }
            }

            size_t idx = static_cast<size_t>(gy) * grid_w + gx;
            uint8_t r = opaque > 0 ? static_cast<uint8_t>(std::round(sum_r / opaque)) : 0;
            uint8_t g = opaque > 0 ? static_cast<uint8_t>(std::round(sum_g / opaque)) : 0;
            uint8_t b = opaque > 0 ? static_cast<uint8_t>(std::round(sum_b / opaque)) : 0;
            float coverage = total > 0 ? static_cast<float>(opaque) / static_cast<float>(total) : 0.0f;
            result[idx] = CellSample(RGB(r, g, b), coverage);
        }
    }

    return result;
}

} // namespace perler
