#include <stdint.h>

// Pines LORA
#define LORA_CS         5
#define LORA_RESET      14
#define LORA_CLK        18
#define LORA_MISO       19
#define LORA_MOSI       23
#define LORA_DIO0       10

// Estructuras
typedef struct __attribute__((packed)) {
    uint16_t id_collar;
    float temperatura;     
    int32_t latitud;       
    int32_t longitud;     
} payload_t;               

// Funciones
void lora_init(void);
void transmitir_datos(payload_t *paquete);