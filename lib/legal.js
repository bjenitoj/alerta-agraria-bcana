/**
 * Datos del titular. El nombre solo aparece en las páginas de Aviso legal y Privacidad
 * (lo mínimo legalmente); no en el pie, la portada ni «Quiénes somos». No se muestra NIF.
 */
export const LEGAL_OWNER = { name: "BC", email: "gestind26@gmail.com" };

export const LEGAL_PAGES = {
  "aviso-legal": {
    title: "Aviso legal",
    blocks: [
      {
        type: "p",
        text: `El titular de este sitio es ${LEGAL_OWNER.name}. Contacto: ${LEGAL_OWNER.email}.`,
      },
      {
        type: "p",
        text: "Alerta Agraria reúne ayudas, PAC y novedades oficiales del campo, la ganadería y la pesca. La información es orientativa: hay que comprobar siempre la publicación oficial enlazada. No sustituye a esa publicación ni a un asesoramiento.",
      },
      {
        type: "p",
        text: "Los textos oficiales pertenecen a los organismos que los publican. Aquí se muestran con su enlace y su fecha.",
      },
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    blocks: [
      {
        type: "p",
        text: `Responsable: ${LEGAL_OWNER.name}. Contacto: ${LEGAL_OWNER.email}.`,
      },
      {
        type: "p",
        text: "Esta consulta no recoge datos personales y no hay cuentas de usuario. No se pide nombre, correo ni contraseña.",
      },
      {
        type: "p",
        text: "Las preferencias (zona, sector, cultivos, secano o regadío y tipos de información) se guardan solo en el navegador de quien consulta, en la clave alerta_prefs_v1. El tema claro u oscuro se guarda igual, en el propio navegador. El servidor no recibe esos datos.",
      },
      {
        type: "p",
        text: `La clave de administración es del titular del sitio. No es una cuenta para terceros. Quien tenga una duda puede escribir a ${LEGAL_OWNER.email}. También puede reclamar ante la Agencia Española de Protección de Datos.`,
      },
      {
        type: "p",
        text: "El resumen del día lo genera el propio programa con lo recogido de fuentes oficiales. No se envía a un servicio externo de inteligencia artificial.",
      },
    ],
  },
  cookies: {
    title: "Cookies",
    blocks: [
      {
        type: "p",
        text: `Contacto: ${LEGAL_OWNER.email}.`,
      },
      {
        type: "p",
        text: "No hay banner de cookies. No se usan cookies de publicidad ni de medición.",
      },
      {
        type: "ul",
        items: [
          "alerta_sesion: cookie técnica, httpOnly, solo si el titular entra en la administración. Dura 30 días.",
          "En el propio navegador: alerta_prefs_v1 (preferencias) y alerta_theme (tema claro u oscuro). Si el titular entra en administración, también alerta_token.",
        ],
      },
      {
        type: "p",
        text: "Se borran desde los ajustes del navegador.",
      },
    ],
  },
};

export function legalPage(id) {
  return LEGAL_PAGES[id] || null;
}
