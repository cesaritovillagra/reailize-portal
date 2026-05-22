# 🚀 Guía de Instalación — Reailize Portal
## Paso a paso para Windows (sin conocimientos técnicos)

---

## ANTES DE EMPEZAR — ¿Qué vas a instalar?

El portal necesita tres programas para funcionar:
1. **Docker Desktop** → levanta la base de datos PostgreSQL
2. **Node.js** → corre el backend (ya lo tenés instalado)
3. **Git** → para manejar el código (puede que ya lo tengas)

---

## PASO 1 — Verificar que tenés Node.js

1. Presioná la tecla **Windows** (esquina inferior izquierda de tu teclado)
2. Escribí `cmd` y presioná **Enter** — se abre una ventana negra (llamada "terminal")
3. Escribí exactamente esto y presioná **Enter**:
   ```
   node --version
   ```
4. Si ves algo como `v18.0.0` o similar → ✅ Node.js está instalado, seguí al Paso 2
5. Si ves un error → bajá Node.js de https://nodejs.org (botón verde "LTS") e instalalo

---

## PASO 2 — Instalar Docker Desktop

Docker es el programa que corre la base de datos.

1. Abrí tu navegador y entrá a: **https://www.docker.com/products/docker-desktop**
2. Hacé clic en **"Download for Windows"**
3. Se descarga un archivo .exe — abrilo y seguí los pasos del instalador (Next, Next, Finish)
4. Cuando termine, **reiniciá tu computadora**
5. Después del reinicio, buscá "Docker Desktop" en el menú de Windows y abrilo
6. Esperá hasta que el ícono de Docker (una ballena 🐳) aparezca en la barra de tareas abajo a la derecha
7. El ícono tiene que estar quieto (no animado) — eso significa que Docker está listo

---

## PASO 3 — Verificar que tenés Git

1. Abrí la terminal nuevamente (tecla Windows → escribí `cmd` → Enter)
2. Escribí esto y presioná Enter:
   ```
   git --version
   ```
3. Si ves algo como `git version 2.x.x` → ✅ Git está instalado, seguí al Paso 4
4. Si ves un error → bajá Git de **https://git-scm.com/download/win** e instalalo con todas las opciones por defecto

---

## PASO 4 — Configurar el archivo de variables del backend

1. Abrí la carpeta del proyecto:
   `Documentos → Repositorio Claude → reailize-portal → backend`
2. Vas a ver un archivo llamado `.env.example`
3. Hacé una **copia** de ese archivo y nombrala exactamente `.env` (sin el "example")
   - Clic derecho en `.env.example` → Copiar
   - Clic derecho en espacio vacío → Pegar
   - Renombrá la copia a `.env`
4. Abrí el archivo `.env` con el Bloc de notas
5. Reemplazá la línea que dice:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
   ```
   con tu API key real de Claude (la conseguís en https://console.anthropic.com)
6. También reemplazá:
   ```
   JWT_SECRET=cambia_esto_por_una_clave_secreta_larga
   ```
   con cualquier texto largo que inventes (ejemplo: `MiClaveSecreta2026ReailizePortal`)
7. Guardá el archivo (Ctrl+S)

---

## PASO 5 — Levantar la base de datos

1. Abrí la terminal (tecla Windows → cmd → Enter)
2. Navegá a la carpeta del proyecto escribiendo esto (copiá y pegá exactamente):
   ```
   cd "%USERPROFILE%\OneDrive - B.Yond\Documents\Repositorio Claude\reailize-portal"
   ```
3. Presioná Enter
4. Ahora escribí esto y presioná Enter:
   ```
   docker-compose up -d
   ```
5. La primera vez va a descargar PostgreSQL — puede tardar 1-2 minutos
6. Cuando termine, vas a ver algo como `Container reailize_db Started`
7. ✅ La base de datos está corriendo

---

## PASO 6 — Instalar dependencias del backend

En la misma terminal, escribí estos comandos uno por uno, esperando que cada uno termine:

```
cd backend
npm install
```

Esto instala todos los paquetes necesarios. Puede tardar 1-2 minutos.

---

## PASO 7 — Instalar dependencias del frontend

Abrí **una nueva terminal** (tecla Windows → cmd → Enter) y escribí:

```
cd "%USERPROFILE%\OneDrive - B.Yond\Documents\Repositorio Claude\reailize-portal\frontend"
npm install
```

Esperá que termine.

---

## PASO 8 — Iniciar el portal

Ahora necesitás tener **dos terminales abiertas** al mismo tiempo.

**Terminal 1 — Backend:**
```
cd "%USERPROFILE%\OneDrive - B.Yond\Documents\Repositorio Claude\reailize-portal\backend"
npm run dev
```
Vas a ver: `✅ Reailize Portal Backend corriendo en http://localhost:3001`

**Terminal 2 — Frontend:**
```
cd "%USERPROFILE%\OneDrive - B.Yond\Documents\Repositorio Claude\reailize-portal\frontend"
npm run dev
```
Vas a ver algo como: `Local: http://localhost:5173`

---

## PASO 9 — Abrir el portal

1. Abrí tu navegador (Chrome, Edge, o Firefox)
2. Entrá a: **http://localhost:5173**
3. ¡El portal debería aparecer con la pantalla de login de Reailize!

---

## 🔑 Credenciales iniciales

```
Usuario:    cesar
Contraseña: Admin2026!
```

> ⚠️ Cambiá la contraseña inmediatamente después de tu primer ingreso desde tu perfil.

---

## ⚙️ Para iniciar el portal en el futuro

Cada vez que quieras usar el portal, seguí estos pasos:

1. Asegurate de que **Docker Desktop** está abierto y corriendo (ícono de ballena en la barra de tareas)
2. Abrí **dos terminales** y corré en cada una:
   - Terminal 1: `cd ... backend` → `npm run dev`
   - Terminal 2: `cd ... frontend` → `npm run dev`
3. Abrí el navegador en `http://localhost:5173`

---

## 🆘 Problemas comunes

**"Cannot connect to database"**
→ Docker Desktop no está corriendo. Abrilo desde el menú de Windows y esperá a que la ballena quede quieta.

**"Port 3001 already in use"**
→ El backend ya está corriendo. Cerrá la terminal anterior o reiniciá la computadora.

**"Module not found"**
→ Corré `npm install` nuevamente en la carpeta correspondiente.

**La pantalla aparece en blanco**
→ Esperá 5 segundos y recargá el navegador (F5).

---

## 🚀 Cuando quieras publicar el portal en internet

Cuando estés listo para que otras personas accedan, Claude te va a guiar para publicarlo en la nube con una URL pública. No necesitás hacer nada extra ahora.

---

*Reailize Portal v1.0 — Desarrollado con Claude*
