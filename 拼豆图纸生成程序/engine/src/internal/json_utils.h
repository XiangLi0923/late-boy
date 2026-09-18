#ifndef PERLER_JSON_UTILS_H
#define PERLER_JSON_UTILS_H

#include <string>
#include "json.hpp"

namespace perler {
namespace internal {

/// Parse JSON with detailed error reporting.
/// @param json_str Raw JSON string
/// @param out Parsed JSON object (only valid if function returns true)
/// @param error_msg Output error description if parsing fails
/// @return true if parsing succeeded
bool parse_json_safe(const std::string& json_str, nlohmann::json& out, std::string& error_msg);

/// Attempt to repair common JSON syntax errors:
/// - Missing commas between array/object items
/// - Missing closing brackets/braces
/// - Unquoted string values (simple cases)
/// - Trailing commas
/// @return Repaired JSON string, or empty if unrepairable
std::string repair_json_syntax(const std::string& damaged_json);

/// Validate a JSON object against a simple schema (required fields and types).
/// @param obj The JSON object to validate
/// @param required_fields Map of field_name -> expected JSON type (e.g. "string", "array", "number")
/// @param error_msg Output error description
/// @return true if all required fields exist with correct types
bool validate_json_schema(const nlohmann::json& obj,
                           const std::map<std::string, std::string>& required_fields,
                           std::string& error_msg);

} // namespace internal
} // namespace perler

#endif // PERLER_JSON_UTILS_H
