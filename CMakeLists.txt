cmake_minimum_required(VERSION 3.20...3.30)

project(ResumeTitan
  VERSION 1.0
  DESCRIPTION "Lightweight ResumeTitan version"
  LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(default_build_type "Debug")
if (NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  message(STATUS "Setting build type to '${default_build_type}' as none was specified")
  set(CMAKE_BUILD_TYPE "${default_build_type}" CACHE STRING "Choose the type of build" FORCE)
  set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS "Debug" "Release" "MinSizeRel" "RelWithDebInfo")
endif()

find_package(nlohmann_json 3.11.0 REQUIRED)
find_package(httplib CONFIG REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)

add_executable(rt src/main.cpp)

target_link_libraries(rt 
  PRIVATE 
  nlohmann_json::nlohmann_json
  httplib::httplib
  OpenSSL::Crypto
  OpenSSL::SSL
  Threads::Threads
)
target_compile_options(rt PRIVATE -Wall -Wextra -Wpedantic -Werror)
