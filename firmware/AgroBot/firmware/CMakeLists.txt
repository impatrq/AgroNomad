cmake_minimum_required(VERSION 3.16)

project(agro_neck_client C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_executable(agro-neck-client main.c)
add_executable(agrobot-lora-receiver lora_receiver.c)

foreach(target agro-neck-client agrobot-lora-receiver)
    target_compile_options(${target} PRIVATE
        -Wall
        -Wextra
        -O2
    )
endforeach()

# How to build
# cmake -S . -B build
# cmake --build build