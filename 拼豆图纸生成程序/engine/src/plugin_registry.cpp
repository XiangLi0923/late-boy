#include "types.h"
#include <map>
#include <vector>
#include <string>
#include <algorithm>
#include <functional>

namespace perler {

// Plugin registry — maps plugin type → registered plugins
// This is the central registry that the engine queries at pipeline stages.

namespace {

struct PluginEntry {
    std::string name;
    std::string version;
    PluginType type;
    std::string config_json;
};

static std::map<PluginType, std::vector<PluginEntry>> g_registry;

} // anonymous namespace

void register_plugin(PluginType type, const std::string& name,
                     const std::string& version, const std::string& config) {
    PluginEntry entry{name, version, type, config};
    g_registry[type].push_back(std::move(entry));
}

void unregister_plugin(PluginType type, const std::string& name) {
    auto it = g_registry.find(type);
    if (it != g_registry.end()) {
        auto& vec = it->second;
        vec.erase(
            std::remove_if(vec.begin(), vec.end(),
                [&name](const PluginEntry& e) { return e.name == name; }),
            vec.end()
        );
    }
}

std::vector<std::string> get_registered_plugins(PluginType type) {
    std::vector<std::string> names;
    auto it = g_registry.find(type);
    if (it != g_registry.end()) {
        for (const auto& e : it->second) {
            names.push_back(e.name);
        }
    }
    return names;
}

void clear_plugin_registry() {
    g_registry.clear();
}

} // namespace perler
