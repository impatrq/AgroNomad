cmake_minimum_required(VERSION 3.16)

project(agro_neck_client C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_executable(agro-neck-client main.c)

target_compile_options(agro-neck-client PRIVATE
    -Wall
    -Wextra
    -O2
)

# How to build
# cmake -S . -B build
# cmake --build build