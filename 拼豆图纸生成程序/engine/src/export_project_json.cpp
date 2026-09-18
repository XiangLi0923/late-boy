#include "types.h"
#include "json.hpp"
#include "internal/string_utils.h"
#include <sstream>
#include <ctime>
#include <cstring>
#include <algorithm>

namespace perler {

std::string do_export_project_json(const BeadGrid& grid) {
    nlohmann::json j;

    j["version"] = "1.2.2";
    j["engine_version"] = "1.2.2";
    j["width"] = grid.grid_w;
    j["height"] = grid.grid_h;
    j["palette_brand"] = grid.palette_brand;
    j["dither_mode"] = static_cast<int>(grid.dither_mode);

    // Spec format: 2D grid of palette indices.
    nlohmann::json grid_2d = nlohmann::json::array();
    for (int y = 0; y < grid.grid_h; ++y) {
        nlohmann::json row = nlohmann::json::array();
        for (int x = 0; x < grid.grid_w; ++x) {
            row.push_back(grid.at(x, y));
        }
        grid_2d.push_back(std::move(row));
    }
    j["grid"] = std::move(grid_2d);

    // Spec format: complete color table used by this grid.
    nlohmann::json color_table = nlohmann::json::array();
    size_t n = std::min({grid.palette_hex.size(), grid.palette_names.size(),
                         grid.palette_codes.size()});
    for (size_t i = 0; i < n; ++i) {
        uint8_t r = 0, g = 0, b = 0;
        internal::parse_hex_to_rgb(grid.palette_hex[i], r, g, b);
        color_table.push_back({
            {"idx", i},
            {"code", grid.palette_codes[i]},
            {"name", grid.palette_names[i]},
            {"rgb", {r, g, b}}
        });
    }
    j["color_table"] = std::move(color_table);

    // Legacy fields kept for backward compatibility.
    j["grid_width"] = grid.grid_w;
    j["grid_height"] = grid.grid_h;
    j["grid_indices"] = grid.indices;
    j["color_counts"] = grid.color_counts;

    // Metadata
    auto now = std::time(nullptr);
    char time_buf[64];
    std::strftime(time_buf, sizeof(time_buf), "%Y-%m-%dT%H:%M:%SZ",
                  std::gmtime(&now));
    j["created_at"] = time_buf;

    return j.dump();
}

} // namespace perler
