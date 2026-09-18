#ifndef PERLER_STRING_UTILS_H
#define PERLER_STRING_UTILS_H

#include <string>
#include <vector>
#include <cstdint>

namespace perler {
namespace internal {

/// Check if string ends with a suffix
bool ends_with(const std::string& str, const std::string& suffix);

/// Check if string starts with a prefix
bool starts_with(const std::string& str, const std::string& prefix);

/// Trim whitespace from both ends
std::string trim(const std::string& str);

/// Split string by delimiter
std::vector<std::string> split(const std::string& str, char delimiter);

/// Convert string to lowercase
std::string to_lower(const std::string& str);

/// Convert string to uppercase
std::string to_upper(const std::string& str);

/// Check if a string is a valid 6-digit hex color code (#RRGGBB or RRGGBB)
bool is_valid_hex_color(const std::string& hex);

/// Normalize a hex color string to standard #RRGGBB format
/// Handles: "fff" -> "#FFFFFF", "FFFFFF" -> "#FFFFFF", "#FFF" -> "#FFFFFF"
/// Returns empty string if unrepairable
std::string normalize_hex(const std::string& raw);

/// Parse a hex color string to RGB components
/// Expects normalized #RRGGBB format
bool parse_hex_to_rgb(const std::string& hex, uint8_t& r, uint8_t& g, uint8_t& b);

} // namespace internal
} // namespace perler

#endif // PERLER_STRING_UTILS_H
