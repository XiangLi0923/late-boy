#ifndef PERLER_DIAGNOSTICS_LOGGER_H
#define PERLER_DIAGNOSTICS_LOGGER_H

#include <string>

namespace perler {

/// Thread-safe log write to diagnostics log file
void diagnostics_log(const std::string& module, const std::string& status,
                     const std::string& detail);

/// Set the log file path (default: "diagnostics.log")
void diagnostics_set_log_path(const std::string& path);

/// Get the current log file path
std::string diagnostics_get_log_path();

} // namespace perler

#endif // PERLER_DIAGNOSTICS_LOGGER_H
