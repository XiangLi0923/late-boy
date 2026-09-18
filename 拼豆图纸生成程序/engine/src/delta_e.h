#ifndef PERLER_DELTA_E_H
#define PERLER_DELTA_E_H

#include "types.h"

namespace perler {
namespace delta_e {

/// CIE76 Delta-E: simple Euclidean distance in CIELAB space
/// ΔE*ab = sqrt( (ΔL*)² + (Δa*)² + (Δb*)² )
///
/// This is the 1976 formula. It is perceptually adequate for bead palette
/// matching (30-100 colors) and ~10x faster than CIEDE2000.
///
/// Range: 0.0 (identical) to ~100+ (completely different colors)
/// A ΔE < 2.3 is generally considered a just-noticeable difference (JND).
double cie76(const LAB& lab1, const LAB& lab2);

/// Find the index of the nearest color in a palette using CIE76
/// Returns the index in [0, colors.size()-1]
/// Precondition: colors must have precomputed LAB values
int find_nearest_color(const LAB& target, const std::vector<BeadColor>& palette);

/// Find the index and distance to the nearest color
/// Returns {index, delta_e_value}
struct MatchResult {
    int index = -1;
    double delta_e = 0.0;
};
MatchResult find_nearest_color_with_distance(const LAB& target,
                                              const std::vector<BeadColor>& palette);

} // namespace delta_e
} // namespace perler

#endif // PERLER_DELTA_E_H
