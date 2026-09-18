#include "string_utils.h"
#include <algorithm>
#include <cctype>
#include <sstream>
#include <regex>

namespace perler {
namespace internal {

bool ends_with(const std::string& str, const std::string& suffix) {
    if (suffix.size() > str.size()) return false;
    return std::equal(suffix.rbegin(), suffix.rend(), str.rbegin());
}

bool starts_with(const std::string& str, const std::string& prefix) {
    if (prefix.size() > str.size()) return false;
    return std::equal(prefix.begin(), prefix.end(), str.begin());
}

std::string trim(const std::string& str) {
    auto start = std::find_if_not(str.begin(), str.end(),
        [](unsigned char c) { return std::isspace(c); });
    auto end = std::find_if_not(str.rbegin(), str.rend(),
        [](unsigned char c) { return std::isspace(c); }).base();
    return (start < end) ? std::string(start, end) : std::string();
}

std::vector<std::string> split(const std::string& str, char delimiter) {
    std::vector<std::string> result;
    std::stringstream ss(str);
    std::string item;
    while (std::getline(ss, item, delimiter)) {
        if (!item.empty()) {
            result.push_back(trim(item));
        }
    }
    return result;
}

std::string to_lower(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(),
        [](unsigned char c) { return std::tolower(c); });
    return result;
}

std::string to_upper(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(),
        [](unsigned char c) { return std::toupper(c); });
    return result;
}

bool is_valid_hex_color(const std::string& hex) {
    // Must be exactly #RRGGBB format
    static const std::regex hex_pattern("^#[0-9A-Fa-f]{6}$");
    return std::regex_match(hex, hex_pattern);
}

std::string normalize_hex(const std::string& raw) {
    std::string cleaned = trim(raw);

    if (cleaned.empty()) return "";

    // Remove leading # if present
    if (cleaned[0] == '#') {
        cleaned = cleaned.substr(1);
    }

    // Must only contain hex digits now
    for (char c : cleaned) {
        if (!std::isxdigit(static_cast<unsigned char>(c))) {
            return "";
        }
    }

    if (cleaned.size() == 3) {
        // Expand 3-char shorthand: "FFF" -> "FFFFFF"
        std::string expanded;
        for (char c : cleaned) {
            expanded += c;
            expanded += c;
        }
        return "#" + to_upper(expanded);
    } else if (cleaned.size() == 6) {
        return "#" + to_upper(cleaned);
    }

    return "";
}

bool parse_hex_to_rgb(const std::string& hex, uint8_t& r, uint8_t& g, uint8_t& b) {
    if (!is_valid_hex_color(hex)) {
        // Try normalization
        std::string normalized = normalize_hex(hex);
        if (normalized.empty() || !is_valid_hex_color(normalized)) {
            return false;
        }
        // Parse the normalized version
        r = static_cast<uint8_t>(std::stoi(normalized.substr(1, 2), nullptr, 16));
        g = static_cast<uint8_t>(std::stoi(normalized.substr(3, 2), nullptr, 16));
        b = static_cast<uint8_t>(std::stoi(normalized.substr(5, 2), nullptr, 16));
        return true;
    }

    r = static_cast<uint8_t>(std::stoi(hex.substr(1, 2), nullptr, 16));
    g = static_cast<uint8_t>(std::stoi(hex.substr(3, 2), nullptr, 16));
    b = static_cast<uint8_t>(std::stoi(hex.substr(5, 2), nullptr, 16));
    return true;
}

} // namespace internal
} // namespace perler
