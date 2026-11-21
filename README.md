# Alerta Agraria

Panel para ver ayudas, líneas de la PAC y novedades oficiales del campo, la ganadería y la pesca. Pensado para Salamanca y Castilla y León, y también para lo que se publica en España.

La información sale de boletines y sedes oficiales. Se recoge sola. Lo que obliga es siempre el documento original.

## Arrancar

```bash
npm ci --omit=dev
npm start
```

Queda en el puerto 3847 (`http://localhost:3847`). En Render el comando de instalación es `npm ci --omit=dev` y el de arranque es `npm start`.

## Clave de administración

La consulta es pública: no hace falta clave para ver ayudas, PAC, resumen, filtros ni fuentes.

La clave sigue igual. Si existen `ACCESS_SALT` y `ACCESS_HASH`, se usan esas variables. Si no, se lee `data/auth.json`, que no se sube al repositorio. Sirve solo para la administración: forzar la recogida, sincronizar el ordenador con el móvil y gestionar el archivo. Entra por `/admin`.

## Cuentas

Las cuentas están apagadas. `ACCOUNTS_ENABLED` no hace falta: si no está definida, el registro no existe y esas rutas responden 404. Las preferencias se quedan en el navegador, en `alerta_prefs_v1`.

El código sigue en `lib/accounts.js`. Para volver a usarlo más adelante, con una base de datos, haría falta `ACCOUNTS_ENABLED=true` y `SESSION_SECRET`. Hoy no.

## Modo «En revisión» (`REVIEW_MODE`)

Mientras la app se revisa, todas las páginas públicas llevan un cartel fijo arriba: «Versión en revisión. Estamos comprobando los datos; consulta siempre la publicación oficial.» Esto incluye la consulta, `/herramientas`, `/fuentes` y las páginas legales.

- **Activo por defecto.** Está encendido si `REVIEW_MODE` no está definida o vale cualquier cosa distinta de `off`, `0` o `false`.
- **Mientras está activo:**
  - el servidor pinta el cartel en el HTML;
  - añade `<meta name="robots" content="noindex, nofollow">`;
  - envía la cabecera `X-Robots-Tag: noindex, nofollow` en todas las respuestas;
  - sirve `/robots.txt` con `Disallow: /`.
- **Para quitarlo,** pon `REVIEW_MODE=off`. Desaparecen el cartel y el noindex, y `/robots.txt` pasa a `Allow: /`.
- **El cliente lo ve** en `/api/review` (`{ reviewMode, text }`) y en el campo `reviewMode` de `/api/state`.

## Datos

`data/store.json` guarda lo recogido, lo archivado y lo descartado. El archivo no se sube. Al actualizar, las leídas y lo archivado se conservan. El resumen del día se añade en ese mismo archivo.

`data/auth.json` tampoco se sube. Ahí está la clave de administración si no usas las variables de entorno.

## Textos legales

Aviso legal, privacidad y cookies están en el pie. Los datos del titular están en `LEGAL_OWNER` de `lib/legal.js`. El nombre del titular solo aparece en Aviso legal y Privacidad; cookies lleva solo el contacto. No se muestra NIF.

La información es orientativa. En el pie, en cada ficha de ayuda o PAC y en el resumen del día se recuerda consultar la publicación oficial.

## Fuentes

La lista que consulta la app está en `lib/config.js`. La página pública [Fuentes oficiales](/fuentes) sale de esa lista. La investigación completa está en `docs/fuentes-sector-primario.md` y `docs/fuentes-sector-primario.json`.

Otra comunidad, o una fuente europea, se activa en esa configuración: el territorio y la fuente, los dos. No hace falta un país nuevo en el código para dejar la fuente preparada.

El certificado de la raíz FNMT que usa el Ministerio va en `certs/`. No se desactiva la comprobación TLS.

## Pruebas

```bash
npm test
```

## Sincronizar la tablet, el móvil y la web

No hay usuarios ni contraseñas. En Ajustes, «Sincronizar dispositivos», un dispositivo crea un código y los demás lo escriben. Se comparten lo marcado, lo borrado, las favoritas y la zona. Nada más.

La app sigue funcionando si no usas el código. Sin conexión, se queda en el aparato.

Hace falta una base PostgreSQL. La variable `DATABASE_URL` se pone en Render, no en el repositorio.

**Recomendado: [Neon](https://neon.com/pricing).** El plan Free es de 0 €, no pide tarjeta y no caduca: los datos se quedan. Cuando no se usa, el servidor se apaga y vuelve a arrancar al sincronizar. Cabe de sobra un JSON pequeño de preferencias.

El Postgres gratis de Render **caduca a los 30 días** (documentación de Render, noviembre de 2026). Después hay 14 días para pasarlo a un plan de pago; si no, Render borra la base. No lo uses para esto.

### Crear la base en Neon

1. Entra en https://neon.com y crea una cuenta (plan Free).
2. Crea un proyecto. El nombre puede ser `alerta-agraria`.
3. Pulsa **Connect** y copia la cadena de conexión. Debe empezar por `postgresql://` y llevar `sslmode=require`.
4. Esa cadena es un secreto. No la pegues en el chat ni en git.

### Ponerla en Render

1. Abre el servicio de Alerta Agraria en el panel de Render.
2. **Environment** → **Add Environment Variable**.
3. Nombre: `DATABASE_URL`. Valor: la cadena copiada de Neon.
4. Guarda. Render vuelve a arrancar el servicio.
5. La tabla `alerta_sync` se crea sola la primera vez que alguien sincroniza.

Si `DATABASE_URL` no está, Ajustes muestra «Sincronización no disponible todavía». El resto de la app no cambia.

## Llevar esta versión al PC

En la carpeta donde ya está Alerta Agraria:

1. Cierra el programa que esté en marcha.
2. Copia los archivos nuevos encima. Deja como están `data/store.json`, `data/auth.json` y el archivo de la clave.
3. En esa carpeta:

```bash
npm ci --omit=dev
npm start
```

Sigue en el puerto 3847. La clave de administración no cambia. La consulta queda abierta sin esa clave.

## Llevarla a Render

El servicio sigue siendo el mismo: https://alerta-agraria-bcana.onrender.com

Esta copia todavía no está desplegada. Cuando toque, en el panel de Render despliega este código sobre ese mismo servicio.

- Instalación: `npm ci --omit=dev`
- Arranque: `npm start`
- Deja `ACCESS_SALT` y `ACCESS_HASH` como están.
- `SESSION_SECRET` no hace falta. Solo firmaría las cuentas, y están apagadas. La administración usa la clave de siempre.
- `ACCOUNTS_ENABLED` déjala sin definir.
- `REVIEW_MODE`: sin definir mientras la app está en revisión, con cartel y noindex. `REVIEW_MODE=off` cuando esté revisada.

El certificado del Ministerio va dentro del proyecto, en `certs/`. La comprobación TLS sigue activa.

En el plan gratuito el disco del servicio puede vaciarse al desplegar. Conserva en el PC `data/store.json`. Cuando el PC vuelva a sincronizar, lo leído y lo archivado regresan al servicio. Las preferencias de quien consulta están en su navegador, no en ese disco.
