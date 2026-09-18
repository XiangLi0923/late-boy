/// Minimal test utilities — no external test framework needed.
/// Provides basic assertion macros and test registration for the engine test suite.

#ifndef PERLER_TEST_UTILS_H
#define PERLER_TEST_UTILS_H

#include <string>
#include <vector>
#include <functional>
#include <iostream>
#include <cmath>
#include <cstdlib>

struct TestCase {
    std::string name;
    std::function<void()> func;
};

inline std::vector<TestCase>& test_registry() {
    static std::vector<TestCase> registry;
    return registry;
}

struct TestRegistrar {
    TestRegistrar(const std::string& name, std::function<void()> func) {
        test_registry().push_back({name, std::move(func)});
    }
};

#define TEST(name) \
    static void test_##name(); \
    static TestRegistrar reg_##name(#name, test_##name); \
    static void test_##name()

// Assertion macros
#define ASSERT_TRUE(cond) \
    do { if (!(cond)) { \
        std::cerr << "  FAIL at " << __FILE__ << ":" << __LINE__ << ": expected true, got false\n"; \
        std::abort(); \
    }} while(0)

#define ASSERT_FALSE(cond) \
    do { if (cond) { \
        std::cerr << "  FAIL at " << __FILE__ << ":" << __LINE__ << ": expected false, got true\n"; \
        std::abort(); \
    }} while(0)

#define ASSERT_EQ(a, b) \
    do { if (!((a) == (b))) { \
        std::cerr << "  FAIL at " << __FILE__ << ":" << __LINE__ << ": " << #a << " != " << #b << "\n"; \
        std::abort(); \
    }} while(0)

#define ASSERT_NEAR(a, b, eps) \
    do { if (std::abs((a) - (b)) > (eps)) { \
        std::cerr << "  FAIL at " << __FILE__ << ":" << __LINE__ << ": |" << #a << " - " << #b << "| = " \
                  << std::abs((a) - (b)) << " > " << (eps) << "\n"; \
        std::abort(); \
    }} while(0)

inline int run_all_tests() {
    int passed = 0;
    int failed = 0;
    for (const auto& tc : test_registry()) {
        std::cout << "[RUN ] " << tc.name << std::endl;
        try {
            tc.func();
            std::cout << "[PASS] " << tc.name << std::endl;
            passed++;
        } catch (...) {
            std::cout << "[FAIL] " << tc.name << std::endl;
            failed++;
        }
    }
    std::cout << "\n=== Results: " << passed << " passed, " << failed << " failed ===\n";
    return failed;
}

#endif // PERLER_TEST_UTILS_H
