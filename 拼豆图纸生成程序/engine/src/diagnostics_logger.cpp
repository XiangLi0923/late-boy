#include "types.h"
#include "diagnostics_logger.h"
#include <fstream>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <mutex>

namespace perler {

namespace {
    static std::mutex g_log_mutex;
    static std::string g_log_path = "diagnostics.log";

    std::string timestamp_now() {
        auto now = std::chrono::system_clock::now();
        auto t = std::chrono::system_clock::to_time_t(now);
        std::stringstream ss;
        ss << std::put_time(std::gmtime(&t), "%Y-%m-%dT%H:%M:%SZ");
        return ss.str();
    }
}

void diagnostics_log(const std::string& module, const std::string& status,
                     const std::string& detail) {
    std::lock_guard<std::mutex> lock(g_log_mutex);
    std::ofstream log(g_log_path, std::ios::app);
    if (log.is_open()) {
        log << "[" << timestamp_now() << "] " << module << ": "
            << status << " — " << detail << "\n";
    }
}

void diagnostics_set_log_path(const std::string& path) {
    std::lock_guard<std::mutex> lock(g_log_mutex);
    g_log_path = path;
}

std::string diagnostics_get_log_path() {
    return g_log_path;
}

} // namespace perler
