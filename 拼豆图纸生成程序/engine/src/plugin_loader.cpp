#include "types.h"
#include "diagnostics_logger.h"
#include "json.hpp"
#include "internal/json_utils.h"
#include <vector>
#include <string>
#include <filesystem>
#include <fstream>
#include <sstream>

namespace perler {

namespace {

struct LoadedPlugin {
    PluginManifest manifest;
    std::string directory;
};

static std::vector<LoadedPlugin> g_plugins;

PluginType parse_plugin_type(const std::string& type_str) {
    if (type_str == "palette_source") return PluginType::PaletteSource;
    if (type_str == "board_shape") return PluginType::BoardShape;
    if (type_str == "dither_algo") return PluginType::DitherAlgorithm;
    if (type_str == "export_format") return PluginType::ExportFormat;
    if (type_str == "image_filter") return PluginType::ImageFilter;
    // Default
    return PluginType::PaletteSource;
}

std::string plugin_type_to_string(PluginType t) {
    switch (t) {
        case PluginType::PaletteSource: return "palette_source";
        case PluginType::BoardShape: return "board_shape";
        case PluginType::DitherAlgorithm: return "dither_algo";
        case PluginType::ExportFormat: return "export_format";
        case PluginType::ImageFilter: return "image_filter";
    }
    return "unknown";
}

} // anonymous namespace

int scan_plugins_directory(const std::string& dir) {
    g_plugins.clear();

    if (dir.empty()) return 0;

    try {
        for (const auto& entry : std::filesystem::directory_iterator(dir)) {
            if (!entry.is_directory()) continue;

            std::string manifest_path = entry.path().string() + "/manifest.json";
            if (!std::filesystem::exists(manifest_path)) continue;

            std::ifstream file(manifest_path);
            if (!file.is_open()) continue;

            std::stringstream buffer;
            buffer << file.rdbuf();
            std::string content = buffer.str();

            nlohmann::json j;
            std::string error_msg;
            if (!internal::parse_json_safe(content, j, error_msg)) {
                // Try repair
                std::string repaired = internal::repair_json_syntax(content);
                if (repaired.empty() || !internal::parse_json_safe(repaired, j, error_msg)) {
                    continue;  // Skip unrepairable manifests
                }
            }

            // Validate manifest schema
            std::map<std::string, std::string> required = {
                {"name", "string"},
                {"version", "string"},
                {"type", "string"}
            };
            if (!internal::validate_json_schema(j, required, error_msg)) {
                continue;
            }

            LoadedPlugin plugin;
            plugin.manifest.name = j.value("name", "unknown");
            plugin.manifest.version = j.value("version", "0.0.0");
            plugin.manifest.description = j.value("description", "");
            plugin.manifest.author = j.value("author", "");
            plugin.manifest.type = parse_plugin_type(j.value("type", ""));
            plugin.manifest.script_path = j.value("script", "");
            plugin.manifest.config_json = j.value("config", nlohmann::json::object()).dump();
            plugin.directory = entry.path().string();

            g_plugins.push_back(std::move(plugin));

            diagnostics_log("PLUGIN", "LOADED",
                plugin.manifest.name + " v" + plugin.manifest.version +
                " (" + plugin_type_to_string(plugin.manifest.type) + ")");
        }
    } catch (...) {
        // Filesystem error — return what we have
    }

    return static_cast<int>(g_plugins.size());
}

int get_plugin_count() {
    return static_cast<int>(g_plugins.size());
}

std::string get_plugin_info_json(int index) {
    if (index < 0 || index >= static_cast<int>(g_plugins.size())) {
        return "{}";
    }

    const auto& p = g_plugins[index];
    nlohmann::json j;
    j["name"] = p.manifest.name;
    j["version"] = p.manifest.version;
    j["type"] = plugin_type_to_string(p.manifest.type);
    j["description"] = p.manifest.description;
    j["author"] = p.manifest.author;
    j["directory"] = p.directory;

    return j.dump();
}

int call_plugin(const std::string& type, const std::string& fn,
                const std::string& args, std::string& result) {
    // Find matching plugin
    for (const auto& p : g_plugins) {
        if (plugin_type_to_string(p.manifest.type) == type) {
            // In full builds, this would execute Lua script
            // For now, return placeholder result
            nlohmann::json r;
            r["status"] = "ok";
            r["plugin"] = p.manifest.name;
            r["function"] = fn;
            r["args"] = args;
            result = r.dump();
            return 0;
        }
    }

    result = "{\"status\": \"error\", \"detail\": \"plugin not found\"}";
    return -1;
}

} // namespace perler
