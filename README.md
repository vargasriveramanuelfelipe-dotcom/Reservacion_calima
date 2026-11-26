# Brisa · Reservas de viaje

Aplicación web en español para descubrir destinos, consultar alojamientos y solicitar reservas. Incluye una experiencia de demostración local y conexión opcional a Supabase.

## Ejecutar en local

Requiere Node.js 20.19+ o 22.12+.

```bash
npm install
npm run dev
```

Sin variables de entorno, Brisa abre el modo demo. Puedes crear cuentas adicionales de viajero desde **Crea tu cuenta**; se guardan solo en el `localStorage` del navegador actual y **no se comparten ni se sincronizan**. Las contraseñas de estas cuentas demo se guardan como hashes locales, pero este modo no sustituye un servicio de autenticación real: usa Supabase para cuentas reales y no reutilices contraseñas importantes.

### Cuentas demo

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Viajera | `viajero@brisa.demo` | `Brisa2026!` |
| Administradora | `admin@brisa.demo` | `Admin2026!` |

Usa los botones de acceso demo en la pantalla de inicio para completar el formulario. Las cuentas nuevas del modo demo tienen rol de viajero; la demo no usa un backend ni representa cuentas reales.

## Conectar Supabase

1. Crea un proyecto Supabase y copia `.env.example` a `.env.local`.
2. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con la URL del proyecto y la clave pública/publishable (anon). Nunca pongas una `service_role` o clave secreta en variables `VITE_*`.
3. En Supabase, abre **SQL Editor** y ejecuta `supabase/schema.sql`. El script crea tablas, perfil al registrar usuarios, catálogo inicial y políticas RLS.
4. Para permitir el acceso sin verificar el correo, abre **Authentication → Providers → Email** en el Dashboard de Supabase y desactiva **Confirm email**. La configuración local de Supabase CLI también lo deja desactivado en `supabase/config.toml`. En proyectos hospedados, el cambio debe hacerse en el Dashboard.
5. Registra una cuenta desde la pantalla de Brisa. Con **Confirm email** desactivado, la cuenta inicia sesión inmediatamente. Los correos no se validan; usa esta opción solo si aceptas ese comportamiento.
6. Si necesitas asignar administración, tras crear la cuenta ejecuta en SQL Editor, reemplazando el correo:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id from auth.users where email = 'admin@tu-dominio.com'
   );
   ```

   La asignación de rol es una acción manual del propietario del proyecto; no hay una ruta pública para que una persona cambie su propio rol.

Al configurar ambas variables de Supabase se desactiva el modo demo. El inicio de sesión, el catálogo y las reservas pasarán a Supabase y las políticas RLS aplicarán los permisos de viajero/administración.

## Subir el proyecto a GitHub

1. Crea un repositorio nuevo en [GitHub](https://github.com/new). Puedes dejarlo vacío, sin README, licencia ni `.gitignore`.
2. Desde la carpeta del proyecto, inicializa Git y guarda los archivos:

   ```bash
   git init
   git add .
   git commit -m "Crear aplicación Brisa"
   git branch -M main
   ```

3. Conecta el repositorio remoto y sube el proyecto. Reemplaza la URL por la que GitHub muestra en tu repositorio:

   ```bash
   git remote add origin https://github.com/USUARIO/NOMBRE-DEL-REPOSITORIO.git
   git push -u origin main
   ```

   Si Git solicita autenticación, inicia sesión con GitHub o utiliza el método de autenticación recomendado por GitHub. No pongas contraseñas ni tokens dentro de los comandos o archivos del proyecto.

El archivo `.gitignore` excluye `.env.local`, dependencias y archivos generados. **No subas claves secretas ni el archivo `.env.local` a GitHub.** La plantilla `.env.example` sí se puede compartir porque solo contiene valores de ejemplo.

## Despliegue en Vercel

Después de subir el proyecto a GitHub, en Vercel selecciona **Add New → Project**, importa el repositorio y configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Environment Variables** antes de desplegar. Vercel puede volver a desplegar automáticamente cada vez que subas cambios a la rama conectada. `vercel.json` redirige rutas de la aplicación a `index.html`. Ejecuta `npm run build` para generar la carpeta `dist`.

## Funcionalidad

- Explorar recomendaciones y buscar alojamientos por nombre, zona o destino.
- Crear y revisar reservas con fechas y cantidad de huéspedes.
- Consultar y actualizar el catálogo y el estado de reservas con rol administrador.
- Estados de carga, error y vacío, accesibilidad de teclado y diseño adaptable.

La demo y Supabase son modos excluyentes: la demo es local al navegador; la sincronización remota solo queda activa después de configurar un proyecto Supabase propio.
