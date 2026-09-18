cmake_minimum_required(VERSION 3.16)
project(perler_engine VERSION 1.0.0 LANGUAGES CXX C)

# ============================================================================
# Configuration
# ============================================================================
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build options
option(PERLER_BUILD_CLI "Build CLI executable target" ON)
option(PERLER_BUILD_WASM "Build standard WASM target (requires Emscripten)" OFF)
option(PERLER_BUILD_MINI "Build mini WASM target (requires Emscripten)" OFF)
option(PERLER_BUILD_TESTS "Build test suite" OFF)
option(PERLER_MINI_BUILD "Strip LuaJIT, libharu, diagnostics for size" OFF)
option(PERLER_USE_FETCHCONTENT "Use CMake FetchContent for deps" ON)

# ============================================================================
# Vendor include directories
# ============================================================================
set(VENDOR_DIR "${CMAKE_CURRENT_SOURCE_DIR}/vendor")
include_directories("${VENDOR_DIR}")

# Check for required vendored headers
if(NOT EXISTS "${VENDOR_DIR}/stb_image.h")
    message(WARNING "stb_image.h not found in ${VENDOR_DIR}. "
                    "Run build-scripts/setup-deps.sh or download manually from "
                    "https://raw.githubusercontent.com/nothings/stb/master/stb_image.h")
endif()
if(NOT EXISTS "${VENDOR_DIR}/stb_image_write.h")
    message(WARNING "stb_image_write.h not found in ${VENDOR_DIR}. "
                    "Run build-scripts/setup-deps.sh or download manually.")
endif()
if(NOT EXISTS "${VENDOR_DIR}/json.hpp")
    message(WARNING "nlohmann/json.hpp not found in ${VENDOR_DIR}. "
                    "Run build-scripts/setup-deps.sh or download manually from "
                    "https://github.com/nlohmann/json/releases/latest/download/json.hpp")
endif()

# ============================================================================
# Engine source files
# ============================================================================
set(ENGINE_SOURCES
    src/engine_context.cpp
    src/colorspace.cpp
    src/delta_e.cpp
    src/image_io.cpp
    src/preprocessing.cpp
    src/pixelation.cpp
    src/quantization.cpp
    src/dither.cpp
    src/similar_colors.cpp
    src/background_removal.cpp
    src/palette.cpp
    src/palette_list.cpp
    src/export_png.cpp
    src/export_csv.cpp
    src/export_project_json.cpp
    src/internal/string_utils.cpp
    src/internal/json_utils.cpp
)

# Optional modules (excluded from mini build)
if(NOT PERLER_MINI_BUILD)
    list(APPEND ENGINE_SOURCES
        src/export_pdf.cpp
        src/diagnostics.cpp
        src/diagnostics_logger.cpp
        src/auto_repair.cpp
        src/plugin_loader.cpp
        src/plugin_registry.cpp
    )
endif()

# ============================================================================
# Third-party dependencies via FetchContent
# ============================================================================
if(PERLER_USE_FETCHCONTENT AND NOT PERLER_MINI_BUILD)
    include(FetchContent)

    # libharu (PDF library)
    if(NOT PERLER_MINI_BUILD)
        FetchContent_Declare(
            libharu
            GIT_REPOSITORY https://github.com/libharu/libharu.git
            GIT_TAG v2.4.4
            GIT_SHALLOW TRUE
        )
        set(LIBHARU_SHARED OFF CACHE BOOL "" FORCE)
        set(LIBHARU_EXAMPLES OFF CACHE BOOL "" FORCE)
        FetchContent_MakeAvailable(libharu)
    endif()

    # LuaJIT (plugin scripting engine)
    if(NOT PERLER_MINI_BUILD)
        # LuaJIT doesn't have official CMake support; use a CMake-friendly fork
        FetchContent_Declare(
            luajit
            GIT_REPOSITORY https://github.com/moonjit/moonjit.git
            GIT_TAG 2.2.0
            GIT_SHALLOW TRUE
        )
        # Note: moonjit/luajit may need manual CMake setup.
        # Fallback: set -DPERLER_USE_FETCHCONTENT=OFF and place LuaJIT in engine/lua/
        FetchContent_GetProperties(luajit)
        if(NOT luajit_POPULATED)
            message(STATUS "Attempting to fetch LuaJIT...")
            # LuaJIT uses Makefile, not CMake. We provide a wrapper.
            # For now, LuaJIT is optional.
            set(LUAJIT_FOUND FALSE)
        endif()
    endif()
endif()

# ============================================================================
# Engine static library target
# ============================================================================
add_library(perler_engine STATIC ${ENGINE_SOURCES})

target_include_directories(perler_engine
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<BUILD_INTERFACE:${VENDOR_DIR}>
)

# Link libraries
target_link_libraries(perler_engine PRIVATE)

if(TARGET libharu)
    target_link_libraries(perler_engine PRIVATE libharu)
    target_compile_definitions(perler_engine PRIVATE PERLER_HAS_LIBHARU=1)
endif()

if(LUAJIT_FOUND)
    target_link_libraries(perler_engine PRIVATE luajit)
    target_compile_definitions(perler_engine PRIVATE PERLER_HAS_LUAJIT=1)
endif()

# Platform-specific settings
if(WIN32)
    target_compile_definitions(perler_engine PRIVATE _CRT_SECURE_NO_WARNINGS)
endif()

if(MSVC)
    target_compile_options(perler_engine PRIVATE /W3 /O2)
else()
    target_compile_options(perler_engine PRIVATE -Wall -Wextra -O2 -fPIC)
endif()

# ============================================================================
# CLI target
# ============================================================================
if(PERLER_BUILD_CLI)
    add_executable(perler_cli
        ${CMAKE_CURRENT_SOURCE_DIR}/../frontends/cli/main.cpp
    )
    target_include_directories(perler_cli PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${CMAKE_CURRENT_SOURCE_DIR}/../frontends/cli
    )
    target_link_libraries(perler_cli PRIVATE perler_engine)

    if(MSVC)
        target_compile_options(perler_cli PRIVATE /W3 /O2)
    else()
        target_compile_options(perler_cli PRIVATE -Wall -Wextra -O2)
    endif()
endif()

# ============================================================================
# Emscripten WASM targets
# ============================================================================
if(PERLER_BUILD_WASM OR PERLER_BUILD_MINI)
    # Ensure Emscripten toolchain is in use
    if(NOT CMAKE_TOOLCHAIN_FILE MATCHES "Emscripten")
        message(WARNING "Emscripten toolchain not detected. "
                        "Use 'emcmake cmake ...' or set CMAKE_TOOLCHAIN_FILE.")
    endif()
endif()

if(PERLER_BUILD_WASM)
    add_executable(perler_engine_wasm
        ${ENGINE_SOURCES}
        src/bindings.cpp
    )
    target_include_directories(perler_engine_wasm PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${VENDOR_DIR}
    )
    target_link_options(perler_engine_wasm PRIVATE
        -sEXPORT_NAME='PerlerEngine'
        -sMODULARIZE=1
        -sEXPORT_ES6=1
        -sALLOW_MEMORY_GROWTH=1
        -sINITIAL_MEMORY=16MB
        -sMAXIMUM_MEMORY=256MB
        -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]'
        --emit-tsd perler_engine.d.ts
    )
    set_target_properties(perler_engine_wasm PROPERTIES
        SUFFIX ".js"
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/wasm_output"
    )

    if(TARGET libharu)
        target_link_libraries(perler_engine_wasm PRIVATE libharu)
        target_compile_definitions(perler_engine_wasm PRIVATE PERLER_HAS_LIBHARU=1)
    endif()
endif()

if(PERLER_BUILD_MINI)
    # Build minimal WASM for WeChat Mini Programs
    set(MINI_ENGINE_SOURCES
        src/engine_context.cpp
        src/colorspace.cpp
        src/delta_e.cpp
        src/image_io.cpp
        src/preprocessing.cpp
        src/pixelation.cpp
        src/quantization.cpp
        src/dither.cpp
        src/palette.cpp
        src/export_png.cpp
        src/export_project_json.cpp
        src/internal/string_utils.cpp
        src/internal/json_utils.cpp
        src/bindings.cpp
    )

    add_executable(perler_engine_mini ${MINI_ENGINE_SOURCES})

    target_include_directories(perler_engine_mini PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${VENDOR_DIR}
    )

    target_compile_definitions(perler_engine_mini PRIVATE
        PERLER_MINI_BUILD=1
    )

    target_link_options(perler_engine_mini PRIVATE
        -sEXPORT_NAME='PerlerEngineMini'
        -sMODULARIZE=1
        -sEXPORT_ES6=1
        -sALLOW_MEMORY_GROWTH=1
        -sINITIAL_MEMORY=8MB
        -sMAXIMUM_MEMORY=64MB
        -sMINIMAL_RUNTIME=1
        -sENVIRONMENT=web
        -sFILESYSTEM=0
        -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8"]'
        -Os
        -flto
        --closure 1
    )

    set_target_properties(perler_engine_mini PROPERTIES
        SUFFIX ".js"
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/mini_output"
    )

    if(MSVC)
        target_compile_options(perler_engine_mini PRIVATE /O1 /GL)
    else()
        target_compile_options(perler_engine_mini PRIVATE -Os -flto -fno-exceptions -fno-rtti)
    endif()
endif()

# ============================================================================
# Install
# ============================================================================
install(TARGETS perler_engine
    ARCHIVE DESTINATION lib
    LIBRARY DESTINATION lib
)
install(DIRECTORY src/ DESTINATION include/perler
    FILES_MATCHING PATTERN "*.h"
)
install(DIRECTORY palettes/ DESTINATION share/perler/palettes
    FILES_MATCHING PATTERN "*.json"
)

# ============================================================================
# Tests
# ============================================================================
if(PERLER_BUILD_TESTS)
    enable_testing()
    add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../tests
                     ${CMAKE_BINARY_DIR}/tests)
endif()
