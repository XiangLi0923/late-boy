#include "test_utils.h"
#include "types.h"

namespace perler {
std::string do_export_project_json(const BeadGrid& grid);
}

TEST(export_project_json_has_spec_fields) {
    perler::BeadGrid grid(4, 3);
    grid.palette_brand = "Test Palette";
    grid.palette_hex = {"#FF0000", "#00FF00"};
    grid.palette_names = {"Red", "Green"};
    grid.palette_codes = {"R01", "G01"};
    grid.color_counts.assign(2, 0);
    for (auto& v : grid.indices) {
        v = (v + 1) % 2;
        grid.color_counts[v]++;
    }
    grid.dither_mode = perler::DitherMode::FloydSteinberg;

    const std::string json = perler::do_export_project_json(grid);
    ASSERT_TRUE(json.find("\"width\":4") != std::string::npos);
    ASSERT_TRUE(json.find("\"height\":3") != std::string::npos);
    ASSERT_TRUE(json.find("\"grid\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"color_table\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"dither_mode\":1") != std::string::npos);
    ASSERT_TRUE(json.find("\"idx\":1") != std::string::npos);
}
