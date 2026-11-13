<div align="center">
    
# [AgroNomad](https://linktr.ee/agronomad2026)

<img src="docs/Logo Green AgroNomad.png" height="450" width="450" />

&nbsp;

| Página web | Email | Instagram | Tiktok |
|------------|-------|-----------|---------|
|[AgroNomad Page](https://agro-nomad-page.vercel.app)|nomadbusiness2026@gmail.com|[@proyecto.agronomad](https://www.instagram.com/proyecto.agronomad/)|[@proyecto.agronomad](https://www.tiktok.com/@proyecto.agronomad)|


### MONITOREO INTELIGENTE DE GANADO 

AgroNomad es un sistema de monitoreo inteligente de ganado que combina collares smart, sensores, posicionamiento GPS y comunicación LoRa para obtener información de los animales directamente desde el campo.

El sistema está compuesto por collares inteligentes, una estación de recepción fija y una interfaz de usuario que permite visualizar y gestionar la información obtenida.

---

## Objetivo

Desarrollar un sistema IoT que permita realizar el seguimiento remoto del ganado, obteniendo información sobre su ubicación, movimiento y diferentes parámetros del animal, y centralizando estos datos en una estación de control.

---

## Componentes del Proyecto  


### AgroNeck

Collar inteligente colocado en el animal.

Se encarga de adquirir y procesar la información proveniente de los sensores y transmitirla mediante LoRa hacia el AgroBot.

### AgroBot

Estación de recepción fija del sistema.

Recibe la información enviada por los AgroNeck y funciona como centro de control para los animales monitoreados.

### AgroServer

Interfaz de usuario del sistema.

Permite visualizar y gestionar la información recibida desde los AgroNeck a través del AgroBot.

---

## Estructura del Proyecto  
**docs/** Documentación e Informes del Proyecto  
**firmware/** Código de los Microcontroladores  
**hardware/** Esquemáticos y PCB  
**mechanical/** Diseños 3D  
**web/** Landing Page del Proyecto  

---

### AgroNeck  
<img src="mechanical/Renders/NeckUsuario.jpeg" alt="AgroNeck" width="400">

### AgroBot
<img src="mechanical/Renders/BotUsuario.jpeg" alt="AgroBot" width="400">

---

## Equipo AgroNomad

<div align="center">
  <img src="docs/Imagenes/AgroNomad Team.png" alt="Equipo AgroNomad" width="600" />
</div>

<br />

| Integrante | Rol | LinkedIn |
|------------|-----|----------|
| **Della Torre, Joaquín** | Diseño de Placas electrónicas, Montaje del AgroBot y Desarrollo del AgroServer y Base de Datos. | [linkedin.com/in/joaquin-della-torre](https://www.linkedin.com/in/joaquin-della-torre/) |
| **Gonzalez Camiscia, Santiago** | Programación del AgroNeck, Sistemas, optimización y gestión de energía con ESP32. | [linkedin.com/in/santiago-gonzalez](https://www.linkedin.com/in/santiago-gonzalez-a80209353/) |
| **Romero Dominguez, Braulio** | Diseño físico, Desarrollo e Integración del Hardware y Firmware y Documentación. | [linkedin.com/in/braulio-romero-dominguez](www.linkedin.com/in/braulio-romero-dominguez-9a4729419) |
| **Villegas Gonzalez, Alejandro** | Desarrollo Web y de Interfaces. Programación e Integración de Datos. | [linkedin.com/in/alejandro-villegas-gonzalez](https://www.linkedin.com/in/alejandro-villegas-gonzalez-748a94432/) |