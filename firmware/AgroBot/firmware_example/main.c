#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <errno.h>

#define SERVER_IP   "127.0.0.1"
#define SERVER_PORT 4001

#define BUFFER_SIZE 4096

typedef struct {
    char id[32];
    char firmware_vers[16];
    char hardware_vers[16];
    char temp[32];
    double lat;
    double lon;
} collar_data_t;

/**
 * In the real AgroNeck, these values come from sensors/drivers:
 * - GPS module for LAT/LONG
 * - LM35 / MLX for temperature
 * - device ID and firmware metadata stored in the device
 */
static void read_agro_neck_device_id(char *id, size_t size)
{
    snprintf(id, size, "COLLAR-01");
}

static void read_agro_neck_firmware_version(char *version, size_t size)
{
    snprintf(version, size, "1.0");
}

static void read_agro_neck_hardware_version(char *version, size_t size)
{
    snprintf(version, size, "1.0");
}

static double read_agro_neck_temperature_c(void)
{
    return 38.4;
}

static void read_agro_neck_position(double *lat, double *lon)
{
    *lat = -34.707652;
    *lon = -58.242300;
}

static void read_agro_neck_data(collar_data_t *data)
{
    read_agro_neck_device_id(data->id, sizeof(data->id));
    read_agro_neck_firmware_version(data->firmware_vers, sizeof(data->firmware_vers));
    read_agro_neck_hardware_version(data->hardware_vers, sizeof(data->hardware_vers));
    read_agro_neck_position(&data->lat, &data->lon);

    snprintf(data->temp, sizeof(data->temp), "%.1f", read_agro_neck_temperature_c());
}





/* ---------------------------------------------------------
 * Connect to the TCP server
 * --------------------------------------------------------- */
int tcp_connect(void)
{
    int sock;
    struct sockaddr_in server_addr;

    sock = socket(AF_INET, SOCK_STREAM, 0);

    if (sock < 0)
    {
        perror("socket");
        return -1;
    }

    memset(&server_addr, 0, sizeof(server_addr));

    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(SERVER_PORT);

    if (inet_pton(AF_INET, SERVER_IP, &server_addr.sin_addr) <= 0)
    {
        perror("inet_pton");
        close(sock);
        return -1;
    }

    printf("Connecting to %s:%d...\n",
           SERVER_IP,
           SERVER_PORT);

    if (connect(sock,
                (struct sockaddr *)&server_addr,
                sizeof(server_addr)) < 0)
    {
        perror("connect");
        close(sock);
        return -1;
    }

    printf("TCP connection established.\n");

    return sock;
}


/* ---------------------------------------------------------
 * Send all bytes of a message
 * --------------------------------------------------------- */
int tcp_send(int sock, const char *data)
{
    size_t total = 0;
    size_t length = strlen(data);

    while (total < length)
    {
        ssize_t sent = send(
            sock,
            data + total,
            length - total,
            0
        );

        if (sent < 0)
        {
            perror("send");
            return -1;
        }

        total += sent;
    }

    return 0;
}


/* ---------------------------------------------------------
 * Send collar data as JSON
 * --------------------------------------------------------- */
int send_collar_data(
    int sock,
    const char *id,
    const char *firmware_vers,
    const char *hardware_vers,

    const char *temp,
    
    double lat,
    double lon
)
{
    char json[BUFFER_SIZE];

    /*
        Create the JSON to send  
    */
    snprintf(
        json,
        sizeof(json),
        "{\"ID\":\"%s\","
        "\"FIRMWARE_VERS\":\"%s\","
        "\"HARDWARE_VERS\":\"%s\","
        "\"LAT\":%.6f,"
        "\"LONG\":%.6f,"
        "\"TEMP\":\"%s\"}\n",
        id,
        firmware_vers,
        hardware_vers,
        lat,
        lon,
        temp
    );

    printf("Sending:\n%s", json);

    return tcp_send(sock, json);
}


/* ---------------------------------------------------------
 * Main
 * --------------------------------------------------------- */
int main(void)
{
    int sock;

    /* Connect once */
    sock = tcp_connect();

    if (sock < 0)
    {
        return EXIT_FAILURE;
    }

    int result;

    while (1)
    {
        collar_data_t collar;
        read_agro_neck_data(&collar);

        sleep(5);

        result = send_collar_data(
            sock,
            collar.id,
            collar.firmware_vers,
            collar.hardware_vers,
            collar.temp,
            collar.lat,
            collar.lon
        );

        if (result < 0)
        {
            printf("Connection lost. Reconnecting...\n");

            close(sock);

            sleep(2);

            sock = tcp_connect();

            if (sock < 0)
            {
                printf("Could not reconnect.\n");
                continue;
            }
        }
    }

    close(sock);

    return EXIT_SUCCESS;
}