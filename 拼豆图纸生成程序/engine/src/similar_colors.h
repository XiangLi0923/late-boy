#pragma once

#include "types.h"

namespace perler {

/// Replace each used color with the most-used nearby color in CIELAB space.
/// Colors closer than `threshold` (CIE76 ΔE) are merged.
void merge_similar_grid_colors(BeadGrid& grid, const Palette& palette,
                               double threshold = 6.0);

} // namespace perler
