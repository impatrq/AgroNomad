#ifndef LORA_H
#define LORA_H

#include <stdint.h>
#include <stdio.h>

#define SPI_DEVICE "/dev/spidev0.0"
#define GPIO_CHIP_DEVICE "/dev/gpiochip0"
#define GPIO_LORA_RESET 25
#define GPIO_LORA_DIO0 24
#define SPI_SPEED_HZ 5000000U
#define LORA_PACKET_SIZE 14
#define BACKEND_IP "127.0.0.1"
#define BACKEND_PORT 4001

int lora_initialize(void);
int lora_receive_packet(uint8_t *data, size_t capacity, size_t *length);
//static int forward_to_backend(const agro_neck_payload_t *payload);
void close_receiver(void);

typedef struct __attribute__((packed)) {
    uint16_t id_collar;
    float temperatura;
    int32_t latitud;
    int32_t longitud;
} agro_neck_payload_t;

#endif