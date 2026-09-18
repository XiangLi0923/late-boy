/// Tests for string_utils — hex parsing, normalization, validation

#include "test_utils.h"
#include "internal/string_utils.h"

using namespace perler::internal;

TEST(hex_normalize_full_6char) {
    std::string result = normalize_hex("#FF8800");
    ASSERT_EQ(result, "#FF8800");
}

TEST(hex_normalize_no_hash) {
    std::string result = normalize_hex("FF8800");
    ASSERT_EQ(result, "#FF8800");
}

TEST(hex_normalize_3char_shorthand) {
    std::string result = normalize_hex("#F80");
    ASSERT_EQ(result, "#FF8800");
}

TEST(hex_normalize_lowercase) {
    std::string result = normalize_hex("#ff8800");
    ASSERT_EQ(result, "#FF8800");
}

TEST(hex_normalize_whitespace) {
    std::string result = normalize_hex("  #FF8800  ");
    ASSERT_EQ(result, "#FF8800");
}

TEST(hex_normalize_invalid_returns_empty) {
    std::string result = normalize_hex("not_a_color");
    ASSERT_TRUE(result.empty());
}

TEST(hex_is_valid_standard) {
    ASSERT_TRUE(is_valid_hex_color("#FF8800"));
    ASSERT_TRUE(is_valid_hex_color("#000000"));
    ASSERT_TRUE(is_valid_hex_color("#FFFFFF"));
}

TEST(hex_is_valid_rejects_3char) {
    ASSERT_FALSE(is_valid_hex_color("#F80"));
    ASSERT_FALSE(is_valid_hex_color("FF8800"));
}

TEST(hex_parse_to_rgb_black) {
    uint8_t r = 0, g = 0, b = 0;
    ASSERT_TRUE(parse_hex_to_rgb("#000000", r, g, b));
    ASSERT_EQ(r, 0);
    ASSERT_EQ(g, 0);
    ASSERT_EQ(b, 0);
}

TEST(hex_parse_to_rgb_white) {
    uint8_t r = 0, g = 0, b = 0;
    ASSERT_TRUE(parse_hex_to_rgb("#FFFFFF", r, g, b));
    ASSERT_EQ(r, 255);
    ASSERT_EQ(g, 255);
    ASSERT_EQ(b, 255);
}

TEST(hex_parse_to_rgb_orange) {
    uint8_t r = 0, g = 0, b = 0;
    ASSERT_TRUE(parse_hex_to_rgb("#FF8800", r, g, b));
    ASSERT_EQ(r, 255);
    ASSERT_EQ(g, 136);
    ASSERT_EQ(b, 0);
}

TEST(hex_parse_auto_normalizes_3char) {
    uint8_t r = 0, g = 0, b = 0;
    ASSERT_TRUE(parse_hex_to_rgb("#F80", r, g, b));
    ASSERT_EQ(r, 255);
    ASSERT_EQ(g, 136);
    ASSERT_EQ(b, 0);
}

TEST(ends_with_true) {
    ASSERT_TRUE(ends_with("hello.json", ".json"));
    ASSERT_TRUE(ends_with("a.b.c", ".c"));
}

TEST(ends_with_false) {
    ASSERT_FALSE(ends_with("hello.txt", ".json"));
    ASSERT_FALSE(ends_with("a", "ab"));
}

TEST(starts_with_true) {
    ASSERT_TRUE(starts_with("#FF8800", "#"));
    ASSERT_TRUE(starts_with("hello world", "hello"));
}

TEST(starts_with_false) {
    ASSERT_FALSE(starts_with("FF8800", "#"));
    ASSERT_FALSE(starts_with("hi", "hello"));
}

TEST(trim_whitespace) {
    ASSERT_EQ(trim("  hello  "), "hello");
    ASSERT_EQ(trim("\t\n test \r\n"), "test");
    ASSERT_EQ(trim("no_whitespace"), "no_whitespace");
}
