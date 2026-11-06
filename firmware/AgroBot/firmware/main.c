#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <pthread.h>
#include <sys/socket.h>

#include "lora.h"

#define SERVER_IP "127.0.0.1"
#define SERVER_PORT 4001
#define SEND_INTERVAL_SECONDS 5
#define COLLAR_QUEUE_CAPACITY 32

typedef struct {
    agro_neck_payload_t collar_queue[COLLAR_QUEUE_CAPACITY];
    size_t collar_queue_head;
    size_t collar_queue_count;
} telemetry_state_t;

static telemetry_state_t telemetry_state;
static pthread_mutex_t telemetry_mutex = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t telemetry_condition = PTHREAD_COND_INITIALIZER;

static int connect_to_backend(void)
{
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0)
    {
        perror("socket");
        return -1;
    }

    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(SERVER_PORT);

    if (inet_pton(AF_INET, SERVER_IP, &server_addr.sin_addr) != 1)
    {
        fprintf(stderr, "Invalid backend IP address: %s\n", SERVER_IP);
        close(sock);
        return -1;
    }

    if (connect(sock, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0)
    {
        perror("connect");
        close(sock);
        return -1;
    }

    printf("Connected to AgroBot backend at %s:%d\n", SERVER_IP, SERVER_PORT);
    return sock;
}

static int send_telemetry(int sock, const char *source, const char *payload)
{
    size_t length = strlen(payload);
    size_t sent = 0;

    while (sent < length)
    {
        ssize_t result = send(sock, payload + sent, length - sent, 0);
        if (result <= 0)
        {
            perror("send");
            return -1;
        }
        sent += (size_t)result;
    }

    printf("[Backend] Sent %s telemetry: %s", source, payload);
    return 0;
}

static void *lora_worker(void *argument)
{
    (void)argument;
    uint8_t packet[LORA_PACKET_SIZE];

    for (;;) {
        size_t packet_length = 0;
        if (lora_receive_packet(packet, sizeof(packet), &packet_length) < 0) {
            perror("receive LoRa packet");
            sleep(1);
            continue;
        }

        if (packet_length != sizeof(agro_neck_payload_t)) {
            fprintf(stderr, "Expected %zu-byte LoRa payload, received %zu bytes\n",
                    sizeof(agro_neck_payload_t), packet_length);
            continue;
        }

        agro_neck_payload_t collar_data;
        memcpy(&collar_data, packet, sizeof(collar_data));

         printf("[LoRa] Received %zu-byte packet: COLLAR-%02u, temperature=%.2f C, "
             "latitude=%.6f, longitude=%.6f\n",
             packet_length,
             (unsigned)collar_data.id_collar,
             collar_data.temperatura,
             collar_data.latitud / 1000000.0,
             collar_data.longitud / 1000000.0);

        uint16_t dropped_collar_id = 0;
        int dropped_oldest = 0;
        pthread_mutex_lock(&telemetry_mutex);
        if (telemetry_state.collar_queue_count == COLLAR_QUEUE_CAPACITY) {
            dropped_collar_id = telemetry_state.collar_queue[
                telemetry_state.collar_queue_head].id_collar;
            dropped_oldest = 1;
            telemetry_state.collar_queue_head =
                (telemetry_state.collar_queue_head + 1) % COLLAR_QUEUE_CAPACITY;
            telemetry_state.collar_queue_count--;
        }

        size_t queue_tail = (telemetry_state.collar_queue_head +
                             telemetry_state.collar_queue_count) % COLLAR_QUEUE_CAPACITY;
        telemetry_state.collar_queue[queue_tail] = collar_data;
        telemetry_state.collar_queue_count++;
        pthread_cond_signal(&telemetry_condition);
        pthread_mutex_unlock(&telemetry_mutex);

        if (dropped_oldest) {
            fprintf(stderr, "[LoRa] Queue full; dropped oldest packet for COLLAR-%02u\n",
                    (unsigned)dropped_collar_id);
        }
    }

    return NULL;
}

int main(void)
{   /*
        static const char *payloads[] = {
        "{\"ID\":\"COLLAR-01\",\"FIRMWARE_VERS\":\"1.0\",\"HARDWARE_VERS\":\"1.0\",\"LAT\":-34.707652,\"LONG\":-58.242300,\"TEMP\":\"38.4\"}\n",
        "{\"ID\":\"COLLAR-02\",\"FIRMWARE_VERS\":\"1.0\",\"HARDWARE_VERS\":\"1.0\",\"LAT\":-34.708100,\"LONG\":-58.243000,\"TEMP\":\"37.9\"}\n",
        };
        
    */

    /*

    ******************************************************************************
                            LORA XL1278 SPI interface
    ******************************************************************************
    
    */

    if (lora_initialize() < 0) {
        close_receiver();
        return EXIT_FAILURE;
    }

    pthread_t lora_thread;
    int thread_result = pthread_create(&lora_thread, NULL, lora_worker, NULL);
    if (thread_result != 0) {
        fprintf(stderr, "Could not start LoRa worker: %s\n", strerror(thread_result));
        close_receiver();
        return EXIT_FAILURE;
    }

    int sock = -1;

    for (;;)
    {   
        //Socket conn -> server
        
        if (sock < 0)
        {
            sock = connect_to_backend();
            if (sock < 0)
            {
                fprintf(stderr, "Server: Retrying in %d seconds...\n", SEND_INTERVAL_SECONDS);
                sleep(SEND_INTERVAL_SECONDS);
                continue;
            }
        }
        agro_neck_payload_t collar_data;

        pthread_mutex_lock(&telemetry_mutex);
        while (telemetry_state.collar_queue_count == 0) {
            pthread_cond_wait(&telemetry_condition, &telemetry_mutex);
        }
        collar_data = telemetry_state.collar_queue[telemetry_state.collar_queue_head];
        pthread_mutex_unlock(&telemetry_mutex);

        char payload[192];
        snprintf(payload, sizeof(payload),
                 "{\"ID\":\"COLLAR-%02u\",\"FIRMWARE_VERS\":\"1.0\",\"HARDWARE_VERS\":\"1.0\",\"LAT\":%.6f,\"LONG\":%.6f,\"TEMP\":\"%.2f\"}\n",
                 (unsigned)collar_data.id_collar,
                 collar_data.latitud / 1000000.0,
                 collar_data.longitud / 1000000.0,
                 collar_data.temperatura);

        if (send_telemetry(sock, "collar", payload) < 0) {
            close(sock);
            sock = -1;
            continue;
        }

        pthread_mutex_lock(&telemetry_mutex);
        telemetry_state.collar_queue_head =
            (telemetry_state.collar_queue_head + 1) % COLLAR_QUEUE_CAPACITY;
        telemetry_state.collar_queue_count--;
        pthread_mutex_unlock(&telemetry_mutex);
    }

    close(sock);
    return EXIT_SUCCESS;
}
