cmake_minimum_required(VERSION 3.16)

# Engine test suite
set(TEST_SOURCES
    main_test.cpp
    test_string_utils.cpp
    test_colorspace.cpp
    test_delta_e.cpp
    test_export_json.cpp
    test_quantize.cpp
    test_similar_colors.cpp
)

add_executable(perler_tests ${TEST_SOURCES})

target_include_directories(perler_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../engine/src
    ${CMAKE_CURRENT_SOURCE_DIR}/../engine/vendor
)

target_link_libraries(perler_tests PRIVATE perler_engine)

if(MSVC)
    target_compile_options(perler_tests PRIVATE /W3 /O2)
else()
    target_compile_options(perler_tests PRIVATE -Wall -Wextra -O2)
endif()

# Register with CTest
enable_testing()
add_test(NAME engine_tests COMMAND perler_tests)
