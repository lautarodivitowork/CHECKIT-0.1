# Tareas — una PWA minimalista para iPhone

Aplicación de tareas por día, privada y sin cuentas. Se instala desde Safari como una aplicación de la pantalla de inicio. Se aloja en **GitHub Pages** sin backend, suscripciones ni claves API.

## Qué incluye

- Calendario día a día con flechas; tocar la fecha vuelve a hoy (hora **local**, no UTC).
- Tareas tocables, completado individual por fecha y tareas completadas siempre al final.
- Categorías reutilizables que consisten únicamente en un color y un emoji.
- Frecuencias: una sola vez, todos los días, días de semana seleccionables y fechas concretas.
- Mantener presionada una tarea para abrir **Editar / Eliminar**. Sin levantar el dedo, desplazarlo tras la pulsación prolongada inicia el reordenamiento manual en pantallas táctiles. En desktop funciona también con mouse; clic derecho o `Shift + F10` abre el menú.
- Modificaciones desde una fecha hacia el futuro sin alterar el historial previo.
- Eliminar solo una aparición o desde una fecha en adelante.
- Orden manual (por fecha), reciente o por categoría. Las tareas completadas siempre quedan debajo.
- Modo claro/oscuro automático, microinteracciones, y opción de reducir movimiento.
- Almacenamiento local (IndexedDB y reserva en localStorage), con copia JSON para exportar/importar.
- PWA offline después de la primera carga e instalación correcta.

## Requisitos

- **Node.js 22** y npm para el desarrollo local (GitHub Actions lo configura por vos al publicar).
- Navegador moderno; para instalación en iPhone, abrir **Safari**.

## 1. Ejecutar localmente

Abrí una terminal en esta carpeta:

```bash
npm install
npm run dev
```

Vite mostrará una dirección local (normalmente `http://localhost:5173`). Abrila en tu navegador.

Para comprobar la lógica de fechas, recurrencias, historial y orden:

```bash
npm test
```

Para generar la versión de producción:

```bash
npm run build
npm run preview
```

La carpeta `dist/` es la versión publicada. No subas `node_modules/` ni `dist/` al repositorio.

## 2. Subir el código a GitHub

1. Creá un repositorio nuevo en GitHub, por ejemplo **tareas**. No agregues un README de GitHub si ya vas a subir esta carpeta.
2. Subí **todos** los archivos y carpetas de este proyecto, incluidos `.github/workflows/deploy.yml` y `public/`. Si subís desde la web, revisá que se conserve la carpeta oculta `.github`.
3. Si preferís la terminal, desde la carpeta de este proyecto:

```bash
git init
git branch -M main
git add .
git commit -m "Primera versión de Tareas"
git remote add origin https://github.com/TU_USUARIO/tareas.git
git push -u origin main
```

Reemplazá `TU_USUARIO` por tu usuario real de GitHub. Si GitHub pide autenticación, utilizá el método que tengas configurado en tu equipo.

## 3. Publicar en GitHub Pages

1. En el repositorio, entrá a **Settings → Pages**.
2. En **Build and deployment → Source**, seleccioná **GitHub Actions**.
3. La acción de `.github/workflows/deploy.yml` se ejecuta al subir cambios a `main`; también podés iniciarla manualmente en **Actions → Publicar PWA en GitHub Pages → Run workflow**.
4. Una vez que la ejecución finalice con éxito, la app quedará disponible en:

   `https://TU_USUARIO.github.io/tareas/`

La configuración de Vite detecta el nombre real del repositorio durante GitHub Actions. Si llamás al repositorio de otra manera, la URL y los recursos se ajustan automáticamente. También funciona en un repositorio de tipo `TU_USUARIO.github.io` (raíz del dominio).

**Si el workflow falla al publicar:** verificá que Pages esté configurado en GitHub Actions, que la rama principal se llame `main` y que el repositorio permita las GitHub Actions. En un repositorio privado, comprobá si tu plan de GitHub admite publicar Pages desde repositorios privados.

## 4. Instalar en un iPhone

1. Abrí la URL pública usando **Safari** (no el navegador integrado de otra app).
2. Tocá **Compartir**.
3. Elegí **Añadir a pantalla de inicio** (en algunas versiones de iOS puede estar bajo «Más»).
4. Activá la opción de abrir como aplicación web si aparece, y tocá **Añadir**.
5. Abrí **Tareas** desde el nuevo icono. Se mostrará en pantalla completa, sin barra de Safari.

Conectate a Internet al menos durante la primera carga correcta. Luego los recursos principales estarán disponibles offline. Las tareas no requieren Internet.

## 5. Uso diario

- **Toque simple en una tarea:** completar o volver a dejar pendiente.
- **Pulsación prolongada:** aparece el menú para editar o eliminar.
- **Pulsación prolongada + deslizar el dedo:** reordenar tareas. Si estabas usando otro criterio, la lista pasa automáticamente a **Orden manual**.
- **Botón de orden arriba a la derecha:** elegir entre manual, más recientes o categoría.
- **Icono discreto de archivo en el pie:** abrir las opciones de datos y copias JSON.

**Consejo:** El orden manual se guarda **por fecha**, para que reorganizar una jornada no cambie las demás. Las categorías se comparten entre todas las fechas.

## 6. Actualizar sin perder datos

1. Modificá el código fuente en tu repositorio.
2. Publicá los cambios con `git add`, `git commit` y `git push` a `main` (o cargalos desde la web de GitHub).
3. GitHub Actions generará y publicará la nueva versión automáticamente.
4. La PWA descargará los recursos actualizados cuando haya conexión. Puede ser necesario cerrarla y volverla a abrir para ver la versión nueva.

Las tareas se guardan en IndexedDB, **no** dentro de los archivos estáticos que se reemplazan al publicar. Actualizar el código no debería borrar los datos mientras mantengas el mismo dominio, ruta y almacenamiento del navegador.

**Importante sobre los datos:** esta versión no tiene cuentas ni sincronización. Los datos de una instalación de la app pueden ser independientes de los de Safari o de otro dispositivo. iOS o el propio usuario pueden borrar almacenamiento de sitios web. **Exportá copias JSON periódicamente**, y antes de desinstalar la app, cambiar de dispositivo, borrar datos del navegador o cambiar la URL del proyecto. Desde la app usá el icono de archivo → **Exportar copia**. Para recuperar datos: icono de archivo → **Importar copia**. Importar reemplaza todos los datos actuales tras confirmación.

## 7. Estructura de archivos

```text
Tareas-PWA/
├── .github/workflows/deploy.yml  # prueba, compila y publica en Pages
├── public/
│   ├── apple-touch-icon.png
│   ├── favicon.svg
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── App.tsx                 # interfaz y gestos táctiles
│   ├── domain.ts               # recurrencias, historial y ordenamiento
│   ├── main.tsx                # entrada de React y registro PWA
│   ├── storage.ts              # IndexedDB y copias de reserva
│   ├── styles.css              # claro/oscuro y animaciones
│   ├── types.ts                # modelo de datos
│   └── vite-env.d.ts
├── tests/domain.test.mjs       # pruebas de reglas de negocio
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 8. Cómo se preserva el historial

Cada tarea tiene una identidad propia y una lista de **revisiones** con fecha de inicio. La aplicación calcula sus apariciones al navegar; no precarga años de tareas futuras. El estado de completado se almacena con la clave `ID de tarea + fecha`. El borrado de un solo día se guarda como excepción; el borrado desde una fecha se almacena como límite. Al editar, una nueva revisión empieza en el día que estás mirando y las versiones anteriores siguen vigentes para consultar el pasado.

## 9. Limitaciones y próxima verificación

El proyecto se entrega con pruebas automatizadas de la lógica, pero para comprobar la experiencia táctil exacta conviene probar en el iPhone de destino: pulsación prolongada, transición a arrastre, teclado sobre el modal, guardado/importación y modo offline. No usa notificaciones, sincronización o servicios en la nube porque no fueron solicitados.
