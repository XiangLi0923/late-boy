#include "internal/string_utils.h"
#include "internal/json_utils.h"
#include <regex>

namespace perler {

std::string repair_json_string(const std::string& damaged) {
    // First, try basic JSON syntax repair
    std::string result = internal::repair_json_syntax(damaged);
    if (result.empty()) {
        result = damaged;  // Use original for further repair attempts
    }

    // Fix common hex color issues in JSON strings
    // Missing # prefix: "hex": "FFFFFF" → "hex": "#FFFFFF"
    result = std::regex_replace(result,
        std::regex("\"hex\"\\s*:\\s*\"([0-9A-Fa-f]{6})\""),
        "\"hex\": \"#$1\"");

    // Expand 3-char hex: "hex": "#FFF" → "hex": "#FFFFFF"
    // Match pattern: "hex": "#XXX" where X is hex digit
    std::string expanded;
    std::regex hex3_regex("\"hex\"\\s*:\\s*\"#([0-9A-Fa-f]{3})\"");
    std::smatch match;
    std::string::const_iterator search_start(result.cbegin());

    auto expanded_result = result;
    while (std::regex_search(search_start, result.cend(), match, hex3_regex)) {
        std::string short_hex = match[1].str();
        std::string long_hex = "#";
        for (char c : short_hex) {
            long_hex += c;
            long_hex += c;
        }
        long_hex = internal::to_upper(long_hex);

        size_t pos = match.position();
        size_t len = match.length();
        expanded_result.replace(pos, len, "\"hex\": \"" + long_hex + "\"");
        search_start = expanded_result.cbegin() + pos + long_hex.length() + 10;
    }
    result = expanded_result;

    // Try to parse the result; if it fails, return empty
    try {
        nlohmann::json::parse(result);
        return result;
    } catch (...) {
        return "";
    }
}

std::string repair_project_string(const std::string& damaged) {
    // Project JSON repair: try both JSON syntax fix and structure validation
    std::string result = internal::repair_json_syntax(damaged);

    if (result.empty()) return "";

    // Validate essential project fields
    try {
        auto j = nlohmann::json::parse(result);

        // Ensure required fields exist
        if (!j.contains("grid_width")) j["grid_width"] = 0;
        if (!j.contains("grid_height")) j["grid_height"] = 0;
        if (!j.contains("grid_indices")) j["grid_indices"] = nlohmann::json::array();
        if (!j.contains("palette_brand")) j["palette_brand"] = "unknown";
        if (!j.contains("version")) j["version"] = "1.0";

        return j.dump();
    } catch (...) {
        return "";
    }
}

} // namespace perler
