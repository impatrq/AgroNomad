#define _DEFAULT_SOURCE

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <linux/gpio.h>
#include <linux/spi/spidev.h>
#include <netinet/in.h>
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

//Library to resolve hostnames to IP addresses.
#include <netdb.h>

#define SPI_DEVICE "/dev/spidev0.0"
#define GPIO_CHIP_DEVICE "/dev/gpiochip0"
#define GPIO_LORA_RESET 25
#define GPIO_LORA_DIO0 24
#define SPI_SPEED_HZ 5000000U
#define LORA_PACKET_SIZE 14
/* Backends that receive every reading (AgroBot, MooPing...): TELEMETRY_TARGETS="host:port,host:port". */
#define DEFAULT_TARGETS "127.0.0.1:4001"
#define MAX_TARGETS 4
/* A backend that is off must not block the radio loop (connect() alone can hang ~2 min). */
#define BACKEND_TIMEOUT_MS 2000
#define GATEWAY_ID_MAX 32
#define TELEMETRY_KEY_MAX 64
#define JSON_MAX 384

typedef struct __attribute__((packed)) {
    uint16_t id_collar;
    float temperatura;
    int32_t latitud;
    int32_t longitud;
} agro_neck_payload_t;

_Static_assert(sizeof(agro_neck_payload_t) == LORA_PACKET_SIZE,
               "AgroNeck LoRa payload layout changed");

typedef struct {
    char label[64];
    struct sockaddr_in address;
} telemetry_target_t;

typedef struct {
    int rssi_dbm;
    double snr_db;
} radio_quality_t;

static telemetry_target_t targets[MAX_TARGETS];
static size_t target_count = 0;
static char gateway_id[GATEWAY_ID_MAX + 1] = "";
static char telemetry_key[TELEMETRY_KEY_MAX + 1] = "";

static int spi_fd = -1;
static int reset_line_fd = -1;
static int dio0_event_fd = -1;

static int request_gpio_lines(void)
{
    int chip_fd = open(GPIO_CHIP_DEVICE, O_RDONLY | O_CLOEXEC);
    if (chip_fd < 0) {
        perror("open GPIO chip");
        return -1;
    }

    struct gpiohandle_request reset_request = { 0 };
    reset_request.lineoffsets[0] = GPIO_LORA_RESET;
    reset_request.flags = GPIOHANDLE_REQUEST_OUTPUT;
    reset_request.default_values[0] = 1;
    reset_request.lines = 1;
    snprintf(reset_request.consumer_label, sizeof(reset_request.consumer_label), "agrobot-lora-reset");

    if (ioctl(chip_fd, GPIO_GET_LINEHANDLE_IOCTL, &reset_request) < 0) {
        perror("request LoRa reset GPIO");
        close(chip_fd);
        return -1;
    }
    reset_line_fd = reset_request.fd;

    struct gpioevent_request dio0_request = { 0 };
    dio0_request.lineoffset = GPIO_LORA_DIO0;
    dio0_request.handleflags = GPIOHANDLE_REQUEST_INPUT;
    dio0_request.eventflags = GPIOEVENT_REQUEST_RISING_EDGE;
    snprintf(dio0_request.consumer_label, sizeof(dio0_request.consumer_label), "agrobot-lora-dio0");

    if (ioctl(chip_fd, GPIO_GET_LINEEVENT_IOCTL, &dio0_request) < 0) {
        perror("request LoRa DIO0 GPIO event");
        close(reset_line_fd);
        reset_line_fd = -1;
        close(chip_fd);
        return -1;
    }
    dio0_event_fd = dio0_request.fd;

    close(chip_fd);
    return 0;
}

static int set_reset_gpio(int value)
{
    struct gpiohandle_data data = { 0 };
    data.values[0] = (uint8_t)value;
    return ioctl(reset_line_fd, GPIOHANDLE_SET_LINE_VALUES_IOCTL, &data);
}

static int spi_transfer(const uint8_t *tx_data, uint8_t *rx_data, size_t length)
{
    struct spi_ioc_transfer transfer = {
        .tx_buf = (uintptr_t)tx_data,
        .rx_buf = (uintptr_t)rx_data,
        .len = (uint32_t)length,
        .speed_hz = SPI_SPEED_HZ,
        .bits_per_word = 8,
    };

    int result = ioctl(spi_fd, SPI_IOC_MESSAGE(1), &transfer);
    if (result != (int)length) {
        if (result >= 0) {
            errno = EIO;
        }
        return -1;
    }
    return 0;
}

static int lora_read_register(uint8_t reg, uint8_t *value)
{
    uint8_t tx_data[2] = { (uint8_t)(reg & 0x7F), 0 };
    uint8_t rx_data[2] = { 0 };

    if (spi_transfer(tx_data, rx_data, sizeof(tx_data)) < 0) {
        return -1;
    }
    *value = rx_data[1];
    return 0;
}

static int lora_write_register(uint8_t reg, uint8_t value)
{
    uint8_t tx_data[2] = { (uint8_t)(reg | 0x80), value };
    return spi_transfer(tx_data, NULL, sizeof(tx_data));
}

static int lora_read_fifo(uint8_t *data, size_t length)
{
    uint8_t tx_data[LORA_PACKET_SIZE + 1] = { 0 };
    uint8_t rx_data[LORA_PACKET_SIZE + 1] = { 0 };

    if (length == 0 || length > LORA_PACKET_SIZE) {
        errno = EMSGSIZE;
        return -1;
    }

    if (spi_transfer(tx_data, rx_data, length + 1) < 0) {
        return -1;
    }
    memcpy(data, &rx_data[1], length);
    return 0;
}

static int lora_initialize(void)
{
    spi_fd = open(SPI_DEVICE, O_RDWR | O_CLOEXEC);
    if (spi_fd < 0) {
        perror("open SPI device");
        return -1;
    }

    uint8_t mode = SPI_MODE_0;
    uint8_t bits_per_word = 8;
    uint32_t speed_hz = SPI_SPEED_HZ;
    if (ioctl(spi_fd, SPI_IOC_WR_MODE, &mode) < 0 ||
        ioctl(spi_fd, SPI_IOC_WR_BITS_PER_WORD, &bits_per_word) < 0 ||
        ioctl(spi_fd, SPI_IOC_WR_MAX_SPEED_HZ, &speed_hz) < 0) {
        perror("configure SPI device");
        return -1;
    }

    if (request_gpio_lines() < 0) {
        return -1;
    }
    if (set_reset_gpio(0) < 0) {
        perror("reset SX1278");
        return -1;
    }
    usleep(10000);
    if (set_reset_gpio(1) < 0) {
        perror("release SX1278 reset");
        return -1;
    }
    usleep(10000);

    uint8_t version = 0;
    if (lora_read_register(0x42, &version) < 0) {
        perror("read SX1278 version");
        return -1;
    }
    printf("SX1278 version: 0x%02X\n", version);

    if (lora_write_register(0x01, 0x80) < 0) return -1;
    usleep(10000);
    if (lora_write_register(0x01, 0x81) < 0) return -1;
    if (lora_write_register(0x06, 0x6C) < 0) return -1;
    if (lora_write_register(0x07, 0x40) < 0) return -1;
    if (lora_write_register(0x08, 0x00) < 0) return -1;
    if (lora_write_register(0x1D, 0x72) < 0) return -1;
    if (lora_write_register(0x1E, 0x74) < 0) return -1;
    if (lora_write_register(0x26, 0x00) < 0) return -1;
    if (lora_write_register(0x39, 0x34) < 0) return -1;
    if (lora_write_register(0x0E, 0x00) < 0) return -1;
    if (lora_write_register(0x0F, 0x00) < 0) return -1;
    if (lora_write_register(0x40, 0x00) < 0) return -1;
    if (lora_write_register(0x12, 0xFF) < 0) return -1;
    if (lora_write_register(0x01, 0x85) < 0) return -1;

    printf("Listening for AgroNeck LoRa packets at 433 MHz\n");
    return 0;
}

static int lora_receive_packet(uint8_t *data, size_t capacity, size_t *length)
{
    struct pollfd event_fd = { .fd = dio0_event_fd, .events = POLLIN };

    for (;;) {
        int poll_result = poll(&event_fd, 1, -1);
        if (poll_result < 0) {
            if (errno == EINTR) continue;
            return -1;
        }

        struct gpioevent_data event;
        if (read(dio0_event_fd, &event, sizeof(event)) != sizeof(event)) {
            if (errno == EINTR) continue;
            return -1;
        }

        uint8_t irq_flags = 0;
        if (lora_read_register(0x12, &irq_flags) < 0) return -1;
        if ((irq_flags & 0x40) == 0) continue;

        if (irq_flags & 0x20) {
            if (lora_write_register(0x12, irq_flags) < 0) return -1;
            fprintf(stderr, "Discarded LoRa packet with CRC error\n");
            continue;
        }

        uint8_t packet_length = 0;
        uint8_t fifo_address = 0;
        if (lora_read_register(0x13, &packet_length) < 0 ||
            lora_read_register(0x10, &fifo_address) < 0) {
            return -1;
        }
        if (packet_length > capacity || packet_length > LORA_PACKET_SIZE) {
            if (lora_write_register(0x12, irq_flags) < 0) return -1;
            fprintf(stderr, "Discarded LoRa packet with unexpected length: %u\n", packet_length);
            continue;
        }

        if (lora_write_register(0x0D, fifo_address) < 0 ||
            lora_read_fifo(data, packet_length) < 0 ||
            lora_write_register(0x12, irq_flags) < 0) {
            return -1;
        }

        *length = packet_length;
        return 0;
    }
}

static int send_all(int sock, const char *message)
{
    size_t length = strlen(message);
    size_t sent = 0;

    while (sent < length) {
        ssize_t result = send(sock, message + sent, length - sent, MSG_NOSIGNAL);
        if (result < 0 && errno == EINTR) continue;
        if (result <= 0) return -1;
        sent += (size_t)result;
    }
    return 0;
}

static int add_target(char *spec)
{
    while (*spec == ' ') spec++;
    char *end = spec + strlen(spec);
    while (end > spec && end[-1] == ' ') *--end = '\0';

    char *colon = strrchr(spec, ':');
    if (colon == NULL || colon == spec) {
        fprintf(stderr, "Invalid telemetry target '%s' (expected host:port)\n", spec);
        return -1;
    }
    *colon = '\0';
    char *port_end = NULL;
    long port = strtol(colon + 1, &port_end, 10);
    if (*port_end != '\0' || port < 1 || port > 65535) {
        fprintf(stderr, "Invalid port in telemetry target '%s:%s'\n", spec, colon + 1);
        return -1;
    }
    if (target_count == MAX_TARGETS) {
        fprintf(stderr, "Too many telemetry targets (max %d)\n", MAX_TARGETS);
        return -1;
    }

    telemetry_target_t *target = &targets[target_count];
    memset(target, 0, sizeof(*target));
    target->address.sin_family = AF_INET;
    target->address.sin_port = htons((uint16_t)port);

    /* Fast path: a numeric IPv4 address needs no resolver call. */
    if (inet_pton(AF_INET, spec, &target->address.sin_addr) != 1) {
        /* Not a literal IP — resolve it via the NSS stack (supports mDNS / .local). */
        struct addrinfo hints;
        memset(&hints, 0, sizeof(hints));
        hints.ai_family   = AF_INET;      /* rest of the code uses AF_INET sockets */
        hints.ai_socktype = SOCK_STREAM;

        struct addrinfo *resolved = NULL;
        int rc = getaddrinfo(spec, NULL, &hints, &resolved);
        if (rc != 0) {
            fprintf(stderr, "Cannot resolve telemetry target '%s': %s\n",
                    spec, gai_strerror(rc));
            return -1;
        }

        struct sockaddr_in *sin = (struct sockaddr_in *)resolved->ai_addr;
        target->address.sin_addr = sin->sin_addr;
        freeaddrinfo(resolved);
    }

    snprintf(target->label, sizeof(target->label), "%s:%ld", spec, port);
    target_count++;
    return 0;
}

static int load_config(void)
{
    const char *spec = getenv("TELEMETRY_TARGETS");
    if (spec == NULL || *spec == '\0') spec = DEFAULT_TARGETS;

    char buffer[512];
    if (strlen(spec) >= sizeof(buffer)) {
        fprintf(stderr, "TELEMETRY_TARGETS is too long\n");
        return -1;
    }
    strcpy(buffer, spec);

    char *saveptr = NULL;
    for (char *item = strtok_r(buffer, ",", &saveptr); item != NULL; item = strtok_r(NULL, ",", &saveptr)) {
        if (add_target(item) < 0) return -1;
    }
    if (target_count == 0) {
        fprintf(stderr, "TELEMETRY_TARGETS has no targets\n");
        return -1;
    }

    /* GATEWAY_ID and TELEMETRY_KEY go inside the JSON as-is, so only plain tokens are accepted. */
    const char *key = getenv("TELEMETRY_KEY");
    if (key != NULL && *key != '\0') {
        size_t length = strspn(key, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-~");
        if (key[length] != '\0' || length > TELEMETRY_KEY_MAX) {
            fprintf(stderr, "TELEMETRY_KEY: use up to %d letters, digits, '-', '_', '.' or '~'\n", TELEMETRY_KEY_MAX);
            return -1;
        }
        strcpy(telemetry_key, key);
    }

    const char *gateway = getenv("GATEWAY_ID");
    if (gateway != NULL && *gateway != '\0') {
        size_t length = strspn(gateway, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-");
        if (gateway[length] != '\0' || length > GATEWAY_ID_MAX) {
            fprintf(stderr, "Ignoring GATEWAY_ID: use up to %d letters, digits, '-', '_' or '.'\n", GATEWAY_ID_MAX);
        } else {
            strcpy(gateway_id, gateway);
        }
    }

    for (size_t index = 0; index < target_count; index++) {
        printf("Forwarding telemetry to %s\n", targets[index].label);
    }
    if (gateway_id[0] != '\0') printf("Gateway ID: %s\n", gateway_id);
    printf("Telemetry key: %s\n", telemetry_key[0] != '\0' ? "set" : "not set (backends must accept any sender)");
    return 0;
}

static int connect_with_timeout(int sock, const struct sockaddr_in *address)
{
    int flags = fcntl(sock, F_GETFL, 0);
    if (flags < 0 || fcntl(sock, F_SETFL, flags | O_NONBLOCK) < 0) return -1;

    if (connect(sock, (const struct sockaddr *)address, sizeof(*address)) < 0) {
        if (errno != EINPROGRESS) return -1;

        struct pollfd connect_fd = { .fd = sock, .events = POLLOUT };
        int poll_result;
        do {
            poll_result = poll(&connect_fd, 1, BACKEND_TIMEOUT_MS);
        } while (poll_result < 0 && errno == EINTR);
        if (poll_result == 0) {
            errno = ETIMEDOUT;
            return -1;
        }
        if (poll_result < 0) return -1;

        int socket_error = 0;
        socklen_t error_length = sizeof(socket_error);
        if (getsockopt(sock, SOL_SOCKET, SO_ERROR, &socket_error, &error_length) < 0) return -1;
        if (socket_error != 0) {
            errno = socket_error;
            return -1;
        }
    }

    if (fcntl(sock, F_SETFL, flags) < 0) return -1;
    struct timeval send_timeout = { .tv_sec = BACKEND_TIMEOUT_MS / 1000,
                                    .tv_usec = (BACKEND_TIMEOUT_MS % 1000) * 1000 };
    return setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &send_timeout, sizeof(send_timeout));
}

static int forward_to_target(const telemetry_target_t *target, const char *json)
{
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        perror("create backend socket");
        return -1;
    }

    if (connect_with_timeout(sock, &target->address) < 0) {
        fprintf(stderr, "connect to telemetry backend %s: %s\n", target->label, strerror(errno));
        close(sock);
        return -1;
    }

    int result = send_all(sock, json);
    if (result < 0) fprintf(stderr, "send telemetry to %s: %s\n", target->label, strerror(errno));
    close(sock);
    return result;
}

/* SX1278 low-frequency port (433 MHz): RSSI = -164 + PacketRssi, corrected by SNR when below 0. */
static int read_radio_quality(radio_quality_t *quality)
{
    uint8_t raw_snr = 0;
    uint8_t raw_rssi = 0;
    if (lora_read_register(0x19, &raw_snr) < 0 || lora_read_register(0x1A, &raw_rssi) < 0) return -1;

    quality->snr_db = (int8_t)raw_snr / 4.0;
    quality->rssi_dbm = -164 + raw_rssi;
    if (quality->snr_db < 0) quality->rssi_dbm += (int)(quality->snr_db);
    return 0;
}

static int format_telemetry(char *json, size_t size, const agro_neck_payload_t *payload,
                            const radio_quality_t *quality)
{
    int length = snprintf(json, size, "{\"ID\":\"COLLAR-%u\",\"LAT\":%.6f,\"LONG\":%.6f,\"TEMP\":\"%.2f\"",
                          (unsigned)payload->id_collar,
                          payload->latitud / 1000000.0,
                          payload->longitud / 1000000.0,
                          payload->temperatura);
    if (quality != NULL && length > 0 && (size_t)length < size) {
        length += snprintf(json + length, size - (size_t)length, ",\"RSSI\":%d,\"SNR\":%.2f",
                           quality->rssi_dbm, quality->snr_db);
    }
    if (gateway_id[0] != '\0' && length > 0 && (size_t)length < size) {
        length += snprintf(json + length, size - (size_t)length, ",\"GW\":\"%s\"", gateway_id);
    }
    if (telemetry_key[0] != '\0' && length > 0 && (size_t)length < size) {
        length += snprintf(json + length, size - (size_t)length, ",\"KEY\":\"%s\"", telemetry_key);
    }
    if (length > 0 && (size_t)length < size) {
        length += snprintf(json + length, size - (size_t)length, "}\n");
    }
    if (length < 0 || (size_t)length >= size) {
        fprintf(stderr, "Telemetry JSON does not fit in %zu bytes\n", size);
        return -1;
    }
    return 0;
}

static void close_receiver(void)
{
    if (dio0_event_fd >= 0) close(dio0_event_fd);
    if (reset_line_fd >= 0) close(reset_line_fd);
    if (spi_fd >= 0) close(spi_fd);
}

int main(void)
{
    uint8_t packet[LORA_PACKET_SIZE];
    size_t packet_length = 0;

    if (load_config() < 0) return EXIT_FAILURE;
    if (lora_initialize() < 0) {
        close_receiver();
        return EXIT_FAILURE;
    }

    for (;;) {
        if (lora_receive_packet(packet, sizeof(packet), &packet_length) < 0) {
            perror("receive LoRa packet");
            close_receiver();
            return EXIT_FAILURE;
        }
        if (packet_length != sizeof(agro_neck_payload_t)) {
            fprintf(stderr, "Expected %zu-byte payload, received %zu bytes\n",
                    sizeof(agro_neck_payload_t), packet_length);
            continue;
        }

        printf("Raw LoRa packet (%zu bytes):", packet_length);
        for (size_t index = 0; index < packet_length; index++) {
            printf(" %02X", packet[index]);
        }
        putchar('\n');

        agro_neck_payload_t payload;
        memcpy(&payload, packet, sizeof(payload));
        printf("Received collar=%u temperature=%.2f C latitude=%.6f longitude=%.6f\n",
               (unsigned)payload.id_collar,
               payload.temperatura,
               payload.latitud / 1000000.0,
               payload.longitud / 1000000.0);

        radio_quality_t quality;
        int has_quality = read_radio_quality(&quality) == 0;
        if (has_quality) printf("Signal RSSI=%d dBm SNR=%.2f dB\n", quality.rssi_dbm, quality.snr_db);

        char json[JSON_MAX];
        if (format_telemetry(json, sizeof(json), &payload, has_quality ? &quality : NULL) < 0) continue;
        /* Each backend is independent: one being down doesn't stop the others. */
        for (size_t index = 0; index < target_count; index++) {
            forward_to_target(&targets[index], json);
        }
    }
}