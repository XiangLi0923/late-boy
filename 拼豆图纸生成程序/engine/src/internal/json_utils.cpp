#include "json_utils.h"
#include "string_utils.h"
#include <regex>
#include <stack>

namespace perler {
namespace internal {

bool parse_json_safe(const std::string& json_str, nlohmann::json& out, std::string& error_msg) {
    try {
        out = nlohmann::json::parse(json_str);
        return true;
    } catch (const nlohmann::json::parse_error& e) {
        error_msg = std::string("JSON parse error at byte ") +
                    std::to_string(e.byte) + ": " + e.what();
        return false;
    } catch (const nlohmann::json::exception& e) {
        error_msg = std::string("JSON error: ") + e.what();
        return false;
    }
}

std::string repair_json_syntax(const std::string& damaged_json) {
    std::string result = damaged_json;

    // --- Fix 1: Remove trailing commas before } or ] ---
    // Pattern: ,\s*} or ,\s*]
    result = std::regex_replace(result, std::regex(",\\s*}"), "}");
    result = std::regex_replace(result, std::regex(",\\s*]"), "]");

    // --- Fix 2: Missing # prefix on hex color values ---
    // Pattern: "hex": "([0-9A-Fa-f]{6})" -> "hex": "#$1"
    result = std::regex_replace(result,
        std::regex("\"hex\"\\s*:\\s*\"([0-9A-Fa-f]{6})\""),
        "\"hex\": \"#$1\"");

    // --- Fix 3: Expand 3-char hex to 6-char ---
    // "hex": "#FFF" -> "hex": "#FFFFFF"
    // This is complex to do with general regex, handled in normalizer

    // --- Fix 4: Try to parse; if it fails with "unexpected end", add closing brace ---
    try {
        nlohmann::json::parse(result);
        return result;  // Already valid
    } catch (const nlohmann::json::parse_error& e) {
        // Try adding missing closing brackets
        std::string message = e.what();

        // Count open/close braces and brackets
        int brace_count = 0;
        int bracket_count = 0;
        bool in_string = false;
        for (size_t i = 0; i < result.size(); ++i) {
            char c = result[i];
            if (c == '"' && (i == 0 || result[i - 1] != '\\')) {
                in_string = !in_string;
            }
            if (!in_string) {
                if (c == '{') brace_count++;
                if (c == '}') brace_count--;
                if (c == '[') bracket_count++;
                if (c == ']') bracket_count--;
            }
        }

        // Add missing closing brackets/braces
        for (int i = 0; i < bracket_count; ++i) result += ']';
        for (int i = 0; i < brace_count; ++i) result += '}';

        // Try parsing again
        try {
            nlohmann::json::parse(result);
            return result;
        } catch (...) {
            return "";  // Unrepairable
        }
    }
}

bool validate_json_schema(const nlohmann::json& obj,
                           const std::map<std::string, std::string>& required_fields,
                           std::string& error_msg) {
    for (const auto& [field, expected_type] : required_fields) {
        if (!obj.contains(field)) {
            error_msg = "Missing required field: '" + field + "'";
            return false;
        }

        const auto& value = obj[field];
        bool type_ok = false;

        if (expected_type == "string") type_ok = value.is_string();
        else if (expected_type == "number") type_ok = value.is_number();
        else if (expected_type == "array") type_ok = value.is_array();
        else if (expected_type == "object") type_ok = value.is_object();
        else if (expected_type == "boolean") type_ok = value.is_boolean();
        else type_ok = true;  // unknown type, skip check

        if (!type_ok) {
            error_msg = "Field '" + field + "' must be of type '" +
                        expected_type + "', got '" + std::string(value.type_name()) + "'";
            return false;
        }
    }

    return true;
}

} // namespace internal
} // namespace perler
