# Automatización de Manuscritos Sagrados

Este proyecto es una solución automatizada desarrollada para un desafío técnico de Node.js. El script `index.js` realiza las siguientes tareas:

- Autenticación en una página web específica.
- Navegación entre páginas para localizar manuscritos.
- Desbloqueo de manuscritos usando códigos (extraídos de PDFs o generados por API).
- Descarga de PDFs de los manuscritos desbloqueados.

El código utiliza Playwright para automatización web, Axios para solicitudes a la API, y bibliotecas como `pdf-parse` y `pdf-lib` para procesar archivos PDF.

## Requisitos

- **Node.js**: Versión 14.x o superior.
- **npm**: Incluido con Node.js.
- **Dependencias**:
  - `playwright`
  - `axios`
  - `pdf-parse`
  - `pdf-lib`

## Instalación

1. Clona este repositorio o descarga el archivo `index.js`:
    ```bash
    git clone https://github.com/facu-alba/sherpa-tech-test
    cd sherpa-tech-test
    ```
2. Instala las dependencias necesarias:
    ```bash
    npm install playwright axios pdf-parse pdf-lib
    ```
3. Asegúrate de que el directorio downloads exista o sea creado automáticamente al ejecutar el script. Puedes crearlo manualmente si es necesario:
    ```bash
    mkdir downloads
    ```

## Ejecución

1. Ejecuta el script con Node.js:
    ```bash
    node index.js
    ```
2. El script abrirá un navegador (en modo no headless por defecto) y realizará las siguientes acciones:
  * Iniciará sesión en https://pruebatecnica-sherpa-production.up.railway.app/login con las credenciales predefinidas (monje@sherpa.local y cript@123).
  * Navegará a las páginas de manuscritos.
  * Desbloqueará manuscritos como "Necronomicon" y "Malleus Maleficarum" usando códigos extraídos o generados.
  * Descargará los PDFs en la carpeta downloads (por ejemplo, manuscrito-105.pdf y manuscrito-104.pdf).
3. Observa los logs en la consola para seguir el progreso y detectar posibles errores.

## Notas Importantes

* **Credenciales**: Las credenciales (monje@sherpa.local y cript@123) están hardcodeadas. Para un entorno de producción, se recomienda usar variables de entorno o un archivo de configuración.
* **Dependencia de API**: El script realiza solicitudes a https://backend-production-9d875.up.railway.app/api/cipher/challenge. Asegúrate de que la API esté activa y accesible.
* **Modo Headless**: El script se ejecuta en modo no headless (headless: false) para facilitar la depuración. Para ejecutarlo en modo headless, modifica la línea chromium.launch({ headless: false }) a chromium.launch({ headless: true }).
* **Errores**: Si un PDF no se descarga o un manuscrito no se desbloquea, revisa los logs. Usa page.pause() (activado en errores) para inspeccionar el estado del navegador.

## Contribuciones

Este proyecto fue desarrollado como parte de un desafío técnico. No se aceptan contribuciones externas, pero cualquier sugerencia puede enviarse por correo o a través de los issues de GitHub.
