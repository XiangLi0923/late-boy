#include "similar_colors.h"

#include <algorithm>
#include <cmath>
#include <unordered_map>
#include <vector>

namespace perler {

void merge_similar_grid_colors(BeadGrid& grid, const Palette& palette,
                               double threshold) {
    if (!grid.valid() || palette.empty() || threshold <= 0.0) return;

    std::vector<int> used;
    for (size_t i = 0; i < grid.color_counts.size(); ++i) {
        if (grid.color_counts[i] > 0) used.push_back(static_cast<int>(i));
    }
    if (used.size() < 2) return;

    std::sort(used.begin(), used.end(),
              [&grid](int a, int b) {
                  return grid.color_counts[a] > grid.color_counts[b];
              });

    std::vector<int> representatives;
    std::unordered_map<int, int> replacement;
    for (int idx : used) {
        int found = -1;
        for (int rep : representatives) {
            const LAB& a = palette[idx].lab;
            const LAB& b = palette[rep].lab;
            double dl = a.l - b.l;
            double da = a.a - b.a;
            double db = a.b - b.b;
            if (std::sqrt(dl * dl + da * da + db * db) < threshold) {
                found = rep;
                break;
            }
        }
        if (found >= 0) {
            replacement[idx] = found;
        } else {
            representatives.push_back(idx);
            replacement[idx] = idx;
        }
    }

    for (int32_t& idx : grid.indices) {
        if (idx >= 0) {
            auto it = replacement.find(idx);
            if (it != replacement.end()) idx = it->second;
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
