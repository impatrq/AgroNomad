cmake_minimum_required(VERSION 3.16)

project(agro_neck_client C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

find_package(Threads REQUIRED)

add_executable(agro-neck-client main.c lora.c neo6m.c)
target_link_libraries(agro-neck-client PRIVATE Threads::Threads m)
add_executable(agrobot-lora-receiver lora_receiver.c)
add_executable(agrobot-lora-receiver-all lora_receiver_all.c)

foreach(target agro-neck-client agrobot-lora-receiver agrobot-lora-receiver-all)
    target_compile_options(${target} PRIVATE
        -Wall
        -Wextra
        -O2
    )
endforeach()

# How to build
# cmake -S . -B build
# cmake --build build