# AgroNomad - Frontend

El frontend de AgroNomad es una aplicación web desarrollada con React, Vite, Tailwind CSS y Leaflet. Consume la API del backend para mostrar el estado y la ubicación de los animales conectados.

## Funciones principales

- Muestra un mapa con la posición GPS de los animales y los límites de los campos.
- Permite seleccionar un animal para consultar su ID, nombre y temperatura.
- Actualiza los datos de los animales automáticamente cada 15 segundos.
- Permite cambiar el nombre del animal seleccionado mediante un formulario.
- Muestra estados de carga y mensajes de error cuando no se pueden obtener los datos.
- Incluye navegación entre el mapa, el inicio de sesión y la configuración del usuario.

## Pantallas y componentes

| Archivo | Función |
|---|---|
| `src/App.jsx` | Controla la navegación básica entre las vistas principales. |
| `src/pages/Home.jsx` | Página principal con mapa, resumen de animales y detalles del animal seleccionado. |
| `src/pages/Login.jsx` | Formulario de inicio de sesión conectado a la API. |
| `src/pages/UserConfig.jsx` | Muestra información del usuario, del campo y del estado general del predio. |
| `src/hooks/useAnimalDashboard.js` | Carga, normaliza y actualiza los datos de animales y límites del campo. |
| `src/components/home/` | Contiene el mapa, la navegación, el resumen y los detalles de los animales. |
| `src/components/RenameAnimalModal.jsx` | Formulario para cambiar el nombre de un animal. |

## Datos utilizados

El frontend obtiene los datos principales desde:

- `GET /api/animals`: animales, coordenadas, nombres y temperaturas.
- `POST /api/animals/rename`: actualización del nombre de un animal.

Las respuestas de la API se normalizan para aceptar campos como `ID`, `LAT`, `LONG` y `TEMP`, además de sus versiones en minúsculas.

## Ejecución

Desde esta carpeta se puede iniciar el entorno de desarrollo con:

```bash
npm install
npm run dev
```

La aplicación necesita que el backend esté disponible para cargar los animales y actualizar sus nombres.


