#include "neo6m.h"

#include <signal.h>
#include <unistd.h>

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <errno.h>

#include <termios.h>
#include <fcntl.h>

#include <unistd.h>

/*

    ******************************************************************************
                                        PARSE DATA
    ******************************************************************************
    
*/

double convert_to_decimal_degrees(double raw_coordinate) {
    // Extract the integer part as degrees.
    // For 3445.30788, floor(3445.30788 / 100) gives 34.
    double degrees = floor(raw_coordinate / 100.0);

    // Extract the fractional part (after removing degrees) as minutes.
    // For 3445.30788, fmod(3445.30788, 100.0) gives 45.30788.
    double minutes = fmod(raw_coordinate, 100.0);

    // Calculate the decimal degrees.
    // 34 + (45.30788 / 60)
    return degrees + (minutes / 60.0);
}

float parse_gprmc_speed(const char *nmea_sentence) {
    if (strstr(nmea_sentence, "$GPRMC") == NULL) return -1;

    char *tokens[12] = {0};
    char *temp = strdup(nmea_sentence);
    char *token = strtok(temp, ",");

    int i = 0;
    while (token != NULL && i < 12) {
        tokens[i++] = token;
        token = strtok(NULL, ",");
    }

    float speed_knots = 0.0;
    if (i >= 8 && tokens[7] != NULL && strlen(tokens[7]) > 0) {
        speed_knots = atof(tokens[7]);
    }

    free(temp);

    // Convert knots to km/h
    return speed_knots * 1.852;
}



uint8_t neo6m_get_parse_data(const char *buffer, double *latitude, double *longitude, char *lat_hemisphere, char *lon_hemisphere, double *speedKmh) {

    //data adquisiton latitude and longtitude
    char lat[12], lon[12];
    // Declare these new char variables to store 'S', 'W', 'N', or 'E'
    char lat_h; // Will store 'S' or 'N'
    char lon_h; // Will store 'W' or 'E'
    
    const char *indexGP;

    indexGP = strstr(buffer, "$GPGGA");
    
    if (indexGP != NULL) {
        
        sscanf(indexGP, "$GPGGA,%*[^,],%11[^,],%c,%11[^,],%c", lat, &lat_h, lon, &lon_h);

        *latitude = convert_to_decimal_degrees(atof(lat));
        *longitude = convert_to_decimal_degrees(atof(lon));

        *lat_hemisphere = lat_h;
        *lon_hemisphere = lon_h;
    }

    indexGP = strstr(buffer, "$GPRMC");

    if(indexGP != NULL){
        *speedKmh = parse_gprmc_speed(indexGP);
    }

    //printf("Parsing GPS data: %lf / %c ^^ lon: %lf / %c, Speed: %lf km/h\n", *latitude, *lat_hemisphere, *longitude, *lon_hemisphere, *speedKmh);
    
    return 0;
}


/*

    ******************************************************************************
                                        READ DATA
    ******************************************************************************
    
*/

// Read data from the UART interface
uint8_t neo6m_read_data(int fd, double *latitude, double *longitude, char *lat_hemisphere, char *lon_hemisphere, double *speedKmh) {

    char read_buffer[256];
    int num_bytes;
    
    // Clear the buffer for the read
    memset(&read_buffer, '\0', sizeof(read_buffer));
    
    // Read operation blocks until conditions in VMIN/VTIME are met
    num_bytes = read(fd, &read_buffer, sizeof(read_buffer) - 1);

    if (num_bytes < 0) {
        printf("Error reading: %s\n", strerror(errno));
        return 1;
    } else if (num_bytes == 0) {
        printf("Read timeout occurred.\n");
        return 1;
    } else {
        //printf("Read %i bytes. Received message: %s\n", num_bytes, read_buffer);

        // Parse the GPS data
        neo6m_get_parse_data(read_buffer, latitude, longitude, lat_hemisphere, lon_hemisphere, speedKmh);
            
        //printf("Parsed GPS data: Lat: %lf %c, Lon: %lf %c, Speed: %lf km/h\n", *latitude, *lat_hemisphere, *longitude, *lon_hemisphere, *speedKmh);
    }
    return 0;
}

uint8_t neo6m_check_uart(int fd){
    char read_buffer[256];
    int num_bytes;
    
    // Clear the buffer for the read
    memset(&read_buffer, '\0', sizeof(read_buffer));
    
    // Read operation blocks until conditions in VMIN/VTIME are met
    num_bytes = read(fd, &read_buffer, sizeof(read_buffer) - 1);

    if (num_bytes <= 0) {
        printf("Error reading NEO6M - (Check uart): %s\n", strerror(errno));
        return 1;
    }
    printf("NEO6M UART check successful. Read %i bytes.\n", num_bytes);
    return 0;
}


/*

    ******************************************************************************
                                        INIT NEO6M
    ******************************************************************************
    
*/




void set_tty_conf(struct termios *tty) {
    // Set control modes
    tty->c_cflag &= ~PARENB;        // Clear parity bit (No parity)
    tty->c_cflag &= ~CSTOPB;        // Clear stop field (1 stop bit)
    tty->c_cflag &= ~CSIZE;         // Clear bits-per-byte size
    tty->c_cflag |= CS8;            // 8 bits per byte
    tty->c_cflag &= ~CRTSCTS;       // Disable RTS/CTS hardware flow control
    tty->c_cflag |= CREAD | CLOCAL; // Turn on READ & ignore ctrl lines

    // Set local, input, and output modes for raw data
    tty->c_lflag &= ~ICANON;        // Disable canonical mode (read line-by-line)
    tty->c_lflag &= ~ECHO;          // Disable echo
    tty->c_lflag &= ~ECHOE;         // Disable erasure
    tty->c_lflag &= ~ECHONL;        // Disable new-line echo
    tty->c_lflag &= ~ISIG;          // Disable interpretation of INTR, QUIT and SUSP
    tty->c_iflag &= ~(IXON | IXOFF | IXANY); // Turn off software flow control
    tty->c_iflag &= ~(IGNBRK|BRKINT|PARMRK|ISTRIP|INLCR|IGNCR|ICRNL); // Disable special handling of bytes
    tty->c_oflag &= ~OPOST;         // Prevent special interpretation of output bytes
    tty->c_oflag &= ~ONLCR;         // Prevent conversion of newline to carriage return

    // Set timeout behavior (Blocking Read)
    tty->c_cc[VMIN] = 1;            // Wait for at least 1 character
    tty->c_cc[VTIME] = 10;          // 1 second timeout (10 deciseconds)

    // Set Baud Rate (9600)
    cfsetispeed(tty, B9600);
    cfsetospeed(tty, B9600);
}


int neo6m_init(char* SERIAL_PORT){

    // 1. Open the serial port device file
    // O_RDWR: Read/Write, O_NOCTTY: Prevents terminal control

    int serial_port = open(SERIAL_PORT, O_RDWR | O_NOCTTY);
    
    if (serial_port < 0) {
        printf("Error %i from open: %s\n", errno, strerror(errno));
        return -1;
    }

    // 2. Configure the serial port using termios
    struct termios tty;

    if(tcgetattr(serial_port, &tty) != 0) {
        printf("Error %i from tcgetattr: %s\n", errno, strerror(errno));
        close(serial_port);
        return -1;
    }

    //Configure the tty settings for the serial port
    set_tty_conf(&tty);

    // Save tty settings
    if (tcsetattr(serial_port, TCSANOW, &tty) != 0) {
        printf("Error %i from tcsetattr: %s\n", errno, strerror(errno));
        close(serial_port);
        return -1;
    }
    printf("Serial port %s initialized successfully.\n", SERIAL_PORT);
    return serial_port;
}

uint8_t neo6m_close_conn(int fd){
    return close(fd);
}