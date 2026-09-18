#include "delta_e.h"
#include <cmath>
#include <limits>

namespace perler {
namespace delta_e {

double cie76(const LAB& lab1, const LAB& lab2) {
    double dl = lab1.l - lab2.l;
    double da = lab1.a - lab2.a;
    double db = lab1.b - lab2.b;
    return std::sqrt(dl * dl + da * da + db * db);
}

int find_nearest_color(const LAB& target, const std::vector<BeadColor>& palette) {
    return find_nearest_color_with_distance(target, palette).index;
}

MatchResult find_nearest_color_with_distance(const LAB& target,
                                              const std::vector<BeadColor>& palette) {
    MatchResult best;
    best.delta_e = std::numeric_limits<double>::max();

    for (size_t i = 0; i < palette.size(); ++i) {
        double de = cie76(target, palette[i].lab);
        if (de < best.delta_e) {
            best.delta_e = de;
            best.index = static_cast<int>(i);
        }
    }

    return best;
}

} // namespace delta_e
} // namespace perler
