#include "types.h"
#include "colorspace.h"
#include "internal/string_utils.h"
#include "internal/json_utils.h"
#include "json.hpp"
#include <fstream>
#include <sstream>
#include <filesystem>
#include <algorithm>

namespace perler {

// From palette_list.cpp
std::vector<std::string> scan_palette_directory(const std::string& dir);

// Parse a single hex color and convert to RGB + LAB
static bool parse_color(BeadColor& color, std::string& error_msg) {
    // Normalize hex
    std::string normalized = internal::normalize_hex(color.hex);
    if (normalized.empty()) {
        error_msg = "Invalid hex color: '" + color.hex + "' for color '" + color.name + "'";
        return false;
    }
    color.hex = normalized;

    // Parse to RGB
    if (!internal::parse_hex_to_rgb(color.hex, color.rgb.r, color.rgb.g, color.rgb.b)) {
        error_msg = "Failed to parse hex: " + color.hex;
        return false;
    }

    // Precompute LAB
    color.lab = colorspace::rgb_to_lab(color.rgb);
    return true;
}

Palette load_palette_json(const std::string& json_str) {
    Palette palette;
    std::string error_msg;

    // Parse JSON
    nlohmann::json j;
    if (!internal::parse_json_safe(json_str, j, error_msg)) {
        // Try repair
        std::string repaired = internal::repair_json_syntax(json_str);
        if (!repaired.empty() && internal::parse_json_safe(repaired, j, error_msg)) {
            // Repaired successfully
        } else {
            return palette;  // Unrepairable
        }
    }

    // Validate schema
    std::map<std::string, std::string> required = {
        {"brand", "string"},
        {"colors", "array"}
    };

    if (!internal::validate_json_schema(j, required, error_msg)) {
        return palette;
    }

    // Extract brand
    palette.brand = j.value("brand", "Unknown");
    palette.version = j.value("version", "1.0");

    // Extract colors
    const auto& colors_json = j["colors"];
    if (!colors_json.is_array()) {
        return palette;
    }

    for (const auto& cj : colors_json) {
        BeadColor color;
        color.name = cj.value("name", "");
        color.code = cj.value("code", "");
        color.hex = cj.value("hex", "");

        if (color.name.empty() || color.hex.empty()) {
            continue;  // Skip incomplete entries
        }

        // 与 JS 模拟器保持一致：不改名、不去重，保留色卡原始 name/code。
        // （Mard 官方没有颜色名，描述名会重复，重复是正常现象；code 唯一性交给诊断检查。）
        if (!parse_color(color, error_msg)) {
            continue;  // Skip invalid colors
        }

        palette.colors.push_back(std::move(color));
    }

    // Validate minimum color count
    if (palette.colors.size() < 10) {
        // Still return what we have, but diagnostics will flag this
    }

    return palette;
}

std::string get_palettes_in_dir(const std::string& dir) {
    nlohmann::json result = nlohmann::json::array();

    try {
        std::string dir_path = dir;
        if (dir_path.empty()) {
            dir_path = "engine/palettes/";
        }

        auto found = scan_palette_directory(dir_path);
        std::sort(found.begin(), found.end());
        if (found.empty()) {
            found = {"universal_24", "hama_midi", "perler_standard", "mard_all"};
        }
        for (const auto& id : found) result.push_back(id);

    } catch (...) {
        result = {"universal_24", "hama_midi", "perler_standard", "mard_all"};
    }

    return result.dump();
}

} // namespace perler
