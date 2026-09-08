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



/**
 * Data sent by every AgroNeck ---> {
 *      DEVICE_ID
 *      FIRMWARE_VERS
 *      HARDWARE_VERS
 *      
 *      TEMP
 *      HB
 * 
 *      LAT
 *      LONG     
 * 
 *      BATTERYLEVEL
 * }
 */





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
    const char *hb,
    
    double lat,
    double lon,

    int battery_level
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
        "\"BATTERY_LEVEL\":%d,"
        "\"TEMP\":\"%s\","
        "\"HB\":\"%s\"}\n",
        id,
        firmware_vers,
        hardware_vers,
        lat,
        lon,
        battery_level,
        temp,
        hb
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


    /*
     * Example:
     * These would normally come from your LoRa receiver.
     */

    send_collar_data(
        sock,
        "COLLAR-01",//device id
        "1.0",//firmware vers
        "1.0",//hardware vers 

        "38.4",//temp
        "72",//heart rate

        -34.707652,//lat
        -58.2423,//lon
        
        67//battery level
        
    );


    send_collar_data(
        sock,
        "COLLAR-02",//device id
        "1.0",//firmware vers
        "1.0",//hardware vers 

        "38.1",
        "68",

        -34.707546,
        -58.239348,
        
        88
    );


    /*
     * Example of continuously sending data.
     *
     * In your real application, replace this
     * with your LoRa receive function.
     */

    while (1)
    {
        sleep(5);

        /*
         * New data received from LoRa
         */

        int result = send_collar_data(
            sock,
            "COLLAR-01",//device id
            "1.0",//firmware vers
            "1.0",//hardware vers 

            "38.4",//temp
            "72",//heart rate

            -34.707652,//lat
            -58.2423,//lon
            
            67//battery level
            
        );

        /*
         * If the connection was lost,
         * reconnect.
         */

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