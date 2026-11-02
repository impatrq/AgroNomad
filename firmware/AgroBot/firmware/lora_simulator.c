#define _POSIX_C_SOURCE 200809L

#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

/* Edit these values to configure the simulated collar telemetry. */
#define COLLAR_ID 1U
#define TEMPERATURE_C 38.4
#define LATITUDE -34.707652
#define LONGITUDE -58.242300
#define SEND_INTERVAL_SECONDS 5U

#define BACKEND_IP "127.0.0.1"
#define BACKEND_PORT 4001

static int send_all(int sock, const char *message)
{
    size_t length = strlen(message);
    size_t sent = 0;

    while (sent < length) {
        ssize_t result = send(sock, message + sent, length - sent, MSG_NOSIGNAL);
        if (result < 0 && errno == EINTR) {
            continue;
        }
        if (result <= 0) {
            if (result == 0) {
                errno = EPIPE;
            }
            return -1;
        }
        sent += (size_t)result;
    }

    return 0;
}

static int forward_to_backend(const char *message)
{
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        perror("create backend socket");
        return -1;
    }

    struct sockaddr_in backend_address = { 0 };
    backend_address.sin_family = AF_INET;
    backend_address.sin_port = htons(BACKEND_PORT);
    if (inet_pton(AF_INET, BACKEND_IP, &backend_address.sin_addr) != 1) {
        fprintf(stderr, "Invalid backend IP address: %s\n", BACKEND_IP);
        close(sock);
        return -1;
    }
    if (connect(sock, (struct sockaddr *)&backend_address,
                sizeof(backend_address)) < 0) {
        perror("connect to telemetry backend");
        close(sock);
        return -1;
    }

    int result = send_all(sock, message);
    if (result < 0) {
        perror("send telemetry to backend");
    }
    close(sock);
    return result;
}

int main(void)
{
    unsigned long long reading = 0;

    printf("Starting LoRa telemetry simulation for COLLAR-%02u\n",
           COLLAR_ID);
    printf("Configured values: temperature=%.2f C, latitude=%.6f, "
           "longitude=%.6f; interval=%u seconds\n",
           TEMPERATURE_C, LATITUDE, LONGITUDE, SEND_INTERVAL_SECONDS);
    printf("Backend: %s:%d (Ctrl+C to stop)\n", BACKEND_IP, BACKEND_PORT);

    for (;;) {
        char message[192];
        snprintf(message, sizeof(message),
                 "{\"ID\":\"COLLAR-%02u\",\"LAT\":%.6f,"
                 "\"LONG\":%.6f,\"TEMP\":\"%.2f\"}\n",
                 COLLAR_ID, LATITUDE, LONGITUDE, TEMPERATURE_C);

        printf("[LoRa simulation #%llu] Received COLLAR-%02u: "
               "temperature=%.2f C, latitude=%.6f, longitude=%.6f\n",
               ++reading, COLLAR_ID, TEMPERATURE_C, LATITUDE, LONGITUDE);
        fflush(stdout);

        if (forward_to_backend(message) == 0) {
            printf("[Backend] Sent telemetry: %s", message);
        }

        sleep(SEND_INTERVAL_SECONDS);
    }
}
