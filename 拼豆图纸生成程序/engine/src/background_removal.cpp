#include "background_removal.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace perler {

ImageData remove_background(const ImageData& src, int threshold) {
    ImageData out = src;
    if (!src.valid()) return out;

    const size_t pixel_count = src.pixel_count();
    std::vector<uint8_t> visited(pixel_count, 0);
    std::vector<size_t> border;
    border.reserve(static_cast<size_t>(src.width) * 2 + src.height * 2);

    for (int x = 0; x < src.width; ++x) {
        border.push_back(static_cast<size_t>(x));
        border.push_back(static_cast<size_t>((src.height - 1) * src.width + x));
    }
    for (int y = 0; y < src.height; ++y) {
        border.push_back(static_cast<size_t>(y * src.width));
        border.push_back(static_cast<size_t>(y * src.width + src.width - 1));
    }

    double r_sum = 0, g_sum = 0, b_sum = 0;
    int count = 0;
    for (size_t i : border) {
        const uint8_t* p = src.at(static_cast<int>(i % src.width),
                                  static_cast<int>(i / src.width));
        r_sum += p[0]; g_sum += p[1]; b_sum += p[2];
        ++count;
    }
    if (count == 0) return out;
    const double ref_r = r_sum / count;
    const double ref_g = g_sum / count;
    const double ref_b = b_sum / count;

    auto dist = [&](size_t i) {
        const uint8_t* p = src.at(static_cast<int>(i % src.width),
                                  static_cast<int>(i / src.width));
        double dr = p[0] - ref_r, dg = p[1] - ref_g, db = p[2] - ref_b;
        return std::sqrt(dr * dr + dg * dg + db * db);
    };

    std::vector<size_t> queue;
    auto try_remove = [&](size_t i) {
        if (i >= pixel_count || visited[i]) return;
        visited[i] = 1;
        if (dist(i) <= threshold) {
            uint8_t* p = out.at(static_cast<int>(i % src.width),
                                static_cast<int>(i / src.width));
            p[3] = 0;
            queue.push_back(i);
        }
    };

    for (size_t i : border) try_remove(i);
    while (!queue.empty()) {
        size_t i = queue.back();
        queue.pop_back();
        size_t x = i % src.width;
        if (x > 0) try_remove(i - 1);
        if (x + 1 < static_cast<size_t>(src.width)) try_remove(i + 1);
        if (i >= static_cast<size_t>(src.width)) try_remove(i - src.width);
        if (i + src.width < pixel_count) try_remove(i + src.width);
    }

    return out;
}

void apply_background_mask(BeadGrid& grid, const ImageData& src, int threshold) {
    if (!grid.valid() || !src.valid()) return;

    ImageData mask = remove_background(src, threshold);
    const double cell_w = static_cast<double>(src.width) / grid.grid_w;
    const double cell_h = static_cast<double>(src.height) / grid.grid_h;

    for (int gy = 0; gy < grid.grid_h; ++gy) {
        int y0 = std::max(0, static_cast<int>(std::floor(gy * cell_h)));
        int y1 = std::min(src.height, static_cast<int>(std::ceil((gy + 1) * cell_h)));
        for (int gx = 0; gx < grid.grid_w; ++gx) {
            int x0 = std::max(0, static_cast<int>(std::floor(gx * cell_w)));
            int x1 = std::min(src.width, static_cast<int>(std::ceil((gx + 1) * cell_w)));
            int opaque = 0, total = 0;
            for (int y = y0; y < y1; ++y) {
                for (int x = x0; x < x1; ++x) {
                    ++total;
                    if (mask.at(x, y)[3] >= 16) ++opaque;
                }
            }
            if (total > 0 && static_cast<double>(opaque) / total < 0.35) {
                grid.at(gx, gy) = -1;
            }
        }
    }

    std::fill(grid.color_counts.begin(), grid.color_counts.end(), 0);
    for (int32_t idx : grid.indices) {
        if (idx >= 0 && static_cast<size_t>(idx) < grid.color_counts.size()) {
            grid.color_counts[idx]++;
        }
    }
}

} // namespace perler
