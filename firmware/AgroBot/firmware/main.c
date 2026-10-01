#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>

#define SERVER_IP "127.0.0.1"
#define SERVER_PORT 4001
#define SEND_INTERVAL_SECONDS 5

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

static int send_collar_data(int sock, const char *payload)
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

    printf("Sent telemetry: %s", payload);
    return 0;
}

int main(void)
{
    static const char *payloads[] = {
        "{\"ID\":\"COLLAR-01\",\"FIRMWARE_VERS\":\"1.0\",\"HARDWARE_VERS\":\"1.0\",\"LAT\":-34.707652,\"LONG\":-58.242300,\"TEMP\":\"38.4\"}\n",
        "{\"ID\":\"COLLAR-02\",\"FIRMWARE_VERS\":\"1.0\",\"HARDWARE_VERS\":\"1.0\",\"LAT\":-34.708100,\"LONG\":-58.243000,\"TEMP\":\"37.9\"}\n",
    };
    const size_t payload_count = sizeof(payloads) / sizeof(payloads[0]);
    size_t payload_index = 0;
    int sock = -1;

    for (;;)
    {
        if (sock < 0)
        {
            sock = connect_to_backend();
            if (sock < 0)
            {
                fprintf(stderr, "Retrying in %d seconds...\n", SEND_INTERVAL_SECONDS);
                sleep(SEND_INTERVAL_SECONDS);
                continue;
            }
        }

        if (send_collar_data(sock, payloads[payload_index]) < 0)
        {
            close(sock);
            sock = -1;
            continue;
        }

        payload_index = (payload_index + 1) % payload_count;
        sleep(SEND_INTERVAL_SECONDS);
    }

    close(sock);
    return EXIT_SUCCESS;
}
