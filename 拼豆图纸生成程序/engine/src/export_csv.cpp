#include "types.h"
#include <fstream>
#include <sstream>

namespace perler {

static std::string csv_field(const std::string& v) {
    if (v.find_first_of(",\"\n\r") == std::string::npos) return v;
    std::string out = "\"";
    for (char c : v) {
        if (c == '"') out += "\"\"";
        else out += c;
    }
    out += '"';
    return out;
}

bool do_export_csv(const BeadGrid& grid, const std::string& path) {
    if (!grid.valid() || path.empty()) return false;

    std::ofstream file(path);
    if (!file.is_open()) return false;

    // Header
    file << "width,height,palette_brand\n";
    file << grid.grid_w << "," << grid.grid_h << "," << csv_field(grid.palette_brand) << "\n";

    // Column headers for bead data
    file << "row,col,color_index\n";

    // Data rows
    for (int y = 0; y < grid.grid_h; ++y) {
        for (int x = 0; x < grid.grid_w; ++x) {
            file << y << "," << x << "," << grid.at(x, y) << "\n";
        }
    }

    // Color counts summary
    file << "\ncolor_index,count\n";
    for (size_t i = 0; i < grid.color_counts.size(); ++i) {
        if (grid.color_counts[i] > 0) {
            file << i << "," << grid.color_counts[i] << "\n";
        }
    }

    file.close();
    return true;
}

} // namespace perler
