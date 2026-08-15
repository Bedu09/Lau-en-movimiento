# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## App nativa Android (Capacitor)

La app se puede compilar como APK nativo para que los temporizadores sigan funcionando (alarmas y notificaciones) con la pantalla apagada o la app cerrada.

Requisitos: [Android Studio](https://developer.android.com/studio) instalado (incluye SDK y JDK).

```bash
# 1. Compilar el bundle web + copiarlo al proyecto Android
npm run cap:sync

# 2. Abrir Android Studio y compilar el APK
npm run cap:android
```

Desde Android Studio: `Run` (instala en el celular conectado por USB) o `Build > Build APK(s)` (genera el archivo `.apk` en `android/app/build/outputs/apk/` para instalarlo manualmente).

- Al usar el cronómetro por primera vez, la app pedirá permiso de notificaciones (imprescindible para que suene la alarma con la pantalla apagada).
- La primera vez que se reinicie el celular, la app debe abrirse una vez para reprogramar las alarmas pendientes.

> Los builds de la PWA para GitHub Pages no se ven afectados: `npm run build` (modo normal) sigue generando `dist/` con base `/Lau-en-movimiento/` y service worker.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://vitejs.dev/templates) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
