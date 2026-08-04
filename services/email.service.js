import "dotenv/config";
import jwt from "jsonwebtoken";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const mailFrom = process.env.MAIL_FROM || "no-reply@xendaria.com.ar";
const xendariaWebUrl =
  process.env.XENDARIA_WEB_URL || "https://xendaria.com.ar";
const xendariaContactEmail =
  process.env.XENDARIA_CONTACT_EMAIL || "xendariaoficial@gmail.com";
const xendariaSignatureEmail =
  process.env.XENDARIA_SIGNATURE_EMAIL || "xendariaoficial@gmail.com";
const xendariaEmailLogoUrl =
  process.env.XENDARIA_EMAIL_LOGO_URL ||
  "https://app.xendaria.com.ar/icons/icon-192.png";

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

function getResetUrl() {
  return (
    process.env.RESET_URL_FRONT ||
    process.env.RESTABLECER_URL_FRONTAL ||
    process.env.FRONTEND_URL
  );
}

function getResetSecret() {
  return (
    process.env.RESET_PASSWORD_SECRET ||
    process.env.RESTABLECER_PASSWORD_SECRET
  );
}

function getResendClient() {
  if (!resend) {
    throw new Error("RESEND_API_KEY no configurada");
  }

  return resend;
}

function armarTextoVariante(variante) {
  if (!variante) return "";

  return [
    variante.color ? `Color: ${variante.color}` : null,
    variante.talle ? `Talle: ${variante.talle}` : null,
    variante.diseno ? `Diseno: ${variante.diseno}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatearProvincia(provincia) {
  const provincias = {
    capital_federal: "Capital Federal",
    conurbano_buenos_aires: "GCBA",
    buenos_aires: "Buenos Aires",
    catamarca: "Catamarca",
    chaco: "Chaco",
    chubut: "Chubut",
    cordoba: "Cordoba",
    corrientes: "Corrientes",
    entre_rios: "Entre Rios",
    formosa: "Formosa",
    jujuy: "Jujuy",
    la_pampa: "La Pampa",
    la_rioja: "La Rioja",
    mendoza: "Mendoza",
    misiones: "Misiones",
    neuquen: "Neuquen",
    rio_negro: "Rio Negro",
    salta: "Salta",
    san_juan: "San Juan",
    san_luis: "San Luis",
    santa_cruz: "Santa Cruz",
    santa_fe: "Santa Fe",
    santiago_del_estero: "Santiago del Estero",
    tierra_del_fuego: "Tierra del Fuego",
    tucuman: "Tucuman",
  };

  return provincias[provincia] || provincia || "-";
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function etiquetaBeneficio(tipo) {
  const etiquetas = {
    descuento: "Descuento porcentual",
    cortesia: "Producto o consumición de cortesía",
    primera_visita: "Beneficio por primera visita",
    contacto_equipo: "Solicitar contacto del equipo",
  };

  return etiquetas[tipo] || tipo;
}

function firmaEmailXendaria() {
  return `
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="margin-top: 36px; border-collapse: collapse; border-top: 1px solid #dfd5dc;"
    >
      <tr>
        <td style="padding-top: 22px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
            <tr>
              <td style="width: 50px; padding-right: 13px; vertical-align: middle;">
                <img
                  src="${escaparHtml(xendariaEmailLogoUrl)}"
                  width="46"
                  height="46"
                  alt="Xendaria"
                  style="display: block; width: 46px; height: 46px; border: 0;"
                />
              </td>
              <td style="vertical-align: middle;">
                <p
                  class="xendaria-heading"
                  style="margin: 0; color: #401A37; font-family: 'Fredoka', Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 600;"
                >
                  Equipo Xendaria
                </p>
                <p style="margin: 3px 0 6px; color: #66515f; font-size: 13px; line-height: 1.4;">
                  Explorá la ciudad, descubrí sus secretos.
                </p>
                <p style="margin: 0; color: #66515f; font-size: 12px; line-height: 1.45;">
                  <a
                    href="${escaparHtml(xendariaWebUrl)}"
                    style="color: #401A37; font-weight: 700; text-decoration: none;"
                  >xendaria.com.ar</a>
                  <span style="color: #c5abbc;">&nbsp;|&nbsp;</span>
                  <a
                    href="mailto:${escaparHtml(xendariaSignatureEmail)}"
                    style="color: #401A37; text-decoration: none;"
                  >${escaparHtml(xendariaSignatureEmail)}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function plantillaEmailXendaria({
  preheader = "",
  etiqueta = "Xendaria",
  titulo,
  contenido,
  maxWidth = 600,
}) {
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escaparHtml(titulo)}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito+Sans:wght@400;600;700&display=swap");

          body,
          table,
          td,
          p,
          a {
            font-family: "Nunito Sans", Arial, Helvetica, sans-serif !important;
          }

          h1,
          h2,
          .xendaria-heading {
            font-family: "Fredoka", Arial, Helvetica, sans-serif !important;
            font-weight: 600 !important;
          }

          @media only screen and (max-width: 620px) {
            .email-page {
              padding: 18px 10px !important;
            }

            .email-content {
              padding: 26px 20px 24px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background: #ffffff; font-family: 'Nunito Sans', Arial, Helvetica, sans-serif;">
        <div
          style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;"
        >${escaparHtml(preheader)}</div>

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          style="width: 100%; border-collapse: collapse; background: #ffffff;"
        >
          <tr>
            <td class="email-page" align="center" style="padding: 34px 18px;">
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                style="width: 100%; max-width: ${maxWidth}px; overflow: hidden; border: 1px solid #9f8998; border-radius: 20px; border-collapse: separate; border-spacing: 0; background: #ffffff; box-shadow: 0 9px 24px rgba(64, 26, 55, 0.08);"
              >
                <tr>
                  <td style="padding: 0; font-size: 0; line-height: 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td width="58%" style="height: 7px; background: #401A37; font-size: 0; line-height: 0;">&nbsp;</td>
                        <td width="27%" style="height: 7px; background: #AA63E0; font-size: 0; line-height: 0;">&nbsp;</td>
                        <td width="15%" style="height: 7px; background: #F1879E; font-size: 0; line-height: 0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="email-content" style="padding: 32px 30px 27px; font-family: 'Nunito Sans', Arial, Helvetica, sans-serif; color: #401A37;">
                    <p style="margin: 0 0 8px; color: #AA63E0; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
                      ${escaparHtml(etiqueta)}
                    </p>
                    <h1 style="margin: 0 0 22px; color: #401A37; font-family: 'Fredoka', Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 600; line-height: 1.2;">
                      ${escaparHtml(titulo)}
                    </h1>
                    ${contenido}
                    ${firmaEmailXendaria()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function recuperarCuenta(email) {
  try {
    const secret = getResetSecret();
    const resetUrl = getResetUrl();

    if (!secret) {
      throw new Error("RESET_PASSWORD_SECRET no configurado");
    }

    if (!resetUrl) {
      throw new Error("RESET_URL_FRONT no configurado");
    }

    const token = jwt.sign(
      { email, mail: email },
      secret,
      { expiresIn: "1h" }
    );

    const resetLink = `${resetUrl}?token=${token}`;

    return await getResendClient().emails.send({
      from: mailFrom,
      to: email,
      subject: "Recupera tu acceso a Xendaria",
      text:
        `Recuperá tu acceso a Xendaria\n\n` +
        `Abrí este enlace para cambiar tu contraseña: ${resetLink}\n\n` +
        `Si no solicitaste este cambio, ignorá este mensaje.`,
      html: plantillaEmailXendaria({
        preheader: "Usá este enlace para restablecer tu contraseña.",
        etiqueta: "Seguridad de la cuenta",
        titulo: "Recuperá tu acceso",
        maxWidth: 520,
        contenido: `
          <p style="margin: 0 0 14px; color: #66515f; font-size: 15px; line-height: 1.65;">
            Hola, explorador/a:
          </p>
          <p style="margin: 0; color: #66515f; font-size: 15px; line-height: 1.65;">
            Recibimos una solicitud para restablecer tu contraseña. Usá el botón
            para continuar. El enlace vence dentro de una hora.
          </p>
          <p style="margin: 28px 0; text-align: center;">
            <a
              href="${escaparHtml(resetLink)}"
              style="display: inline-block; border-radius: 10px; background: #401A37; padding: 13px 22px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none;"
            >Cambiar contraseña</a>
          </p>
          <p style="margin: 0; border-top: 1px solid #dfd5dc; padding-top: 16px; color: #66515f; font-size: 13px; line-height: 1.55;">
            Si no fuiste vos quien solicitó este cambio, podés ignorar el mensaje.
          </p>
        `,
      }),
    });

  } catch (error) {
    console.error("No se pudo enviar el mail de recuperacion", error);
  }
}

export async function enviarConfirmacionCompra(destinatario, orden) {
  try {
    const itemsHtml = (orden.items || [])
      .map((item) => {
        const varianteTexto = armarTextoVariante(item.variante);

        return `
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border-bottom: 1px solid #dfd5dc;">
            <tr>
              <td style="padding: 13px 0;">
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              <tr>
                ${
                  item.imagen
                    ? `
                      <td style="width: 70px; vertical-align: middle;">
                        <img src="${escaparHtml(item.imagen)}" alt="${escaparHtml(item.nombre)}" style="display: block; width: 58px; height: 58px; border: 1px solid #dfd5dc; border-radius: 8px; object-fit: cover;" />
                      </td>
                    `
                    : ""
                }

                <td style="vertical-align: middle;">
                  <div style="margin-bottom: 4px; color: #401A37; font-size: 15px; font-weight: 700;">
                    ${escaparHtml(item.nombre)}
                  </div>

                  ${
                    varianteTexto
                      ? `<div style="margin-bottom: 4px; color: #66515f; font-size: 13px;">${escaparHtml(varianteTexto)}</div>`
                      : ""
                  }

                  <div style="color: #66515f; font-size: 13px;">Cantidad: ${Number(item.cantidad) || 0}</div>
                </td>

                <td style="vertical-align: middle; color: #401A37; font-size: 14px; font-weight: 700; text-align: right; white-space: nowrap;">
                  ${formatearMoneda(item.subtotal)}
                </td>
              </tr>
                </table>
              </td>
            </tr>
          </table>
        `;
      })
      .join("");

    const datosEnvio = orden.datosEnvio || {};

    return await getResendClient().emails.send({
      from: mailFrom,
      to: destinatario,
      subject: `Confirmación de compra ${orden.numeroCompra} - Xendaria`,
      text:
        `Tu compra ${orden.numeroCompra} fue registrada correctamente.\n` +
        `Total: ${formatearMoneda(orden.total)}\n\n` +
        `Podés consultar su estado desde tu perfil de Xendaria.`,
      html: plantillaEmailXendaria({
        preheader: `Tu compra ${orden.numeroCompra} fue registrada correctamente.`,
        etiqueta: "Tienda Xendaria",
        titulo: "¡Recibimos tu compra!",
        contenido: `
          <p style="margin: 0; color: #66515f; font-size: 15px; line-height: 1.65;">
            Tu compra fue registrada correctamente. Te compartimos el detalle del pedido.
          </p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 23px 0; border-collapse: collapse; border-top: 1px solid #dfd5dc; border-bottom: 1px solid #dfd5dc;">
            <tr>
              <td style="padding: 14px 0; color: #66515f; font-size: 12px; font-weight: 700; text-transform: uppercase;">Número de compra</td>
              <td style="padding: 14px 0; color: #401A37; font-size: 17px; font-weight: 700; text-align: right;">${escaparHtml(orden.numeroCompra)}</td>
            </tr>
          </table>

          <h2 style="margin: 26px 0 12px; color: #401A37; font-size: 18px;">Resumen del pedido</h2>

          <div style="margin-bottom: 24px; border-top: 1px solid #dfd5dc;">${itemsHtml}</div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 22px 0 28px; border-collapse: collapse; border-top: 2px solid #401A37; border-bottom: 1px solid #dfd5dc;">
            <tr>
              <td style="padding: 13px 0 4px; color: #66515f; font-size: 14px;">Subtotal</td>
              <td style="padding: 13px 0 4px; color: #401A37; font-size: 14px; text-align: right;">${formatearMoneda(orden.subtotal)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #66515f; font-size: 14px;">Descuento</td>
              <td style="padding: 4px 0; color: #401A37; font-size: 14px; text-align: right;">${formatearMoneda(orden.descuento)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0 12px; color: #66515f; font-size: 14px;">Envío</td>
              <td style="padding: 4px 0 12px; color: #401A37; font-size: 14px; text-align: right;">${formatearMoneda(orden.costoEnvio)}</td>
            </tr>
            <tr>
              <td style="border-top: 1px solid #dfd5dc; padding: 13px 0; color: #401A37; font-size: 16px; font-weight: 700;">Total</td>
              <td style="border-top: 1px solid #dfd5dc; padding: 13px 0; color: #401A37; font-size: 16px; font-weight: 700; text-align: right;">${formatearMoneda(orden.total)}</td>
            </tr>
          </table>

          <h2 style="margin: 26px 0 12px; color: #401A37; font-size: 18px;">Datos de envío</h2>

          <div style="color: #66515f; font-size: 14px; line-height: 1.7;">
            <div><strong style="color: #401A37;">Nombre:</strong> ${escaparHtml(datosEnvio.nombreCompleto || "-")}</div>
            <div><strong style="color: #401A37;">Teléfono:</strong> ${escaparHtml(datosEnvio.telefono || "-")}</div>
            <div><strong style="color: #401A37;">Dirección:</strong> ${escaparHtml(datosEnvio.calle || "")} ${escaparHtml(datosEnvio.numero || "")}</div>
            ${
              datosEnvio.pisoDepto
                ? `<div><strong style="color: #401A37;">Piso / Depto:</strong> ${escaparHtml(datosEnvio.pisoDepto)}</div>`
                : ""
            }
            <div><strong style="color: #401A37;">Ciudad:</strong> ${escaparHtml(datosEnvio.ciudad || "-")}</div>
            <div><strong style="color: #401A37;">Provincia:</strong> ${escaparHtml(formatearProvincia(datosEnvio.provincia))}</div>
            <div><strong style="color: #401A37;">Código postal:</strong> ${escaparHtml(datosEnvio.codigoPostal || "-")}</div>
            ${
              datosEnvio.referencias
                ? `<div><strong style="color: #401A37;">Referencias:</strong> ${escaparHtml(datosEnvio.referencias)}</div>`
                : ""
            }
          </div>
        `,
      }),
    });

  } catch (error) {
    console.error("No se pudo enviar el mail de confirmación", error);
  }
}

export async function enviarSolicitudComercioAdmin(solicitud) {
  const destinatario = xendariaContactEmail;

  return getResendClient().emails.send({
    from: mailFrom,
    to: destinatario,
    replyTo: solicitud.email,
    subject: `Nueva solicitud comercial - ${solicitud.nombreComercio}`,
    text:
      `Nueva solicitud comercial\n\n` +
      `Comercio: ${solicitud.nombreComercio}\n` +
      `Plan: ${solicitud.plan}\n` +
      `Contacto: ${solicitud.email} - ${solicitud.telefono}\n` +
      `Beneficio: ${solicitud.beneficio}`,
    html: plantillaEmailXendaria({
      preheader: `${solicitud.nombreComercio} quiere sumarse a Xendaria.`,
      etiqueta: "Xendaria comercios",
      titulo: "Nueva solicitud comercial",
      maxWidth: 640,
      contenido: `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border-top: 1px solid #dfd5dc;">
          <tr>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #66515f; font-size: 13px;">Comercio</td>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #401A37; font-size: 14px; font-weight: 700; text-align: right;">${escaparHtml(solicitud.nombreComercio)}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #66515f; font-size: 13px;">Plan</td>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #401A37; font-size: 14px; text-align: right;">${escaparHtml(solicitud.plan)}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #66515f; font-size: 13px;">Rubro</td>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #401A37; font-size: 14px; text-align: right;">${escaparHtml(solicitud.rubro)}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #66515f; font-size: 13px;">Dirección</td>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #401A37; font-size: 14px; text-align: right;">${escaparHtml(solicitud.direccion)}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #66515f; font-size: 13px;">Email</td>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #401A37; font-size: 14px; text-align: right;">${escaparHtml(solicitud.email)}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #66515f; font-size: 13px;">Teléfono</td>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #401A37; font-size: 14px; text-align: right;">${escaparHtml(solicitud.telefono)}</td>
          </tr>
          <tr>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #66515f; font-size: 13px;">Instagram o web</td>
            <td style="padding: 11px 0; border-bottom: 1px solid #dfd5dc; color: #401A37; font-size: 14px; text-align: right;">${escaparHtml(solicitud.redes || "No informado")}</td>
          </tr>
        </table>

        <h2 style="margin: 26px 0 10px; color: #401A37; font-size: 18px;">Propuesta para usuarios</h2>
        <p><strong>Tipo:</strong> ${escaparHtml(etiquetaBeneficio(solicitud.tipoBeneficio))}</p>
        <p style="color: #66515f; line-height: 1.65;">${escaparHtml(solicitud.beneficio)}</p>

        <h2 style="margin: 26px 0 10px; color: #401A37; font-size: 18px;">Contenido opcional</h2>
        <p style="color: #66515f; line-height: 1.65;">${escaparHtml(solicitud.historia || "No informó una historia o leyenda.")}</p>
        <p><strong>Quiere insignia:</strong> ${solicitud.quiereInsignia ? "Sí" : "No"}</p>
        <p><strong>Asocia la historia a la insignia:</strong> ${solicitud.asociarHistoriaInsignia ? "Sí" : "No"}</p>

        <p style="margin: 26px 0 0; border-top: 1px solid #dfd5dc; padding-top: 16px; color: #66515f; font-size: 13px; line-height: 1.55;">
          La solicitud también quedó guardada en el panel de administración.
        </p>
      `,
    }),
  });
}

export async function enviarConfirmacionSolicitudComercio(solicitud) {
  return getResendClient().emails.send({
    from: mailFrom,
    to: solicitud.email,
    subject: "Recibimos tu solicitud comercial - Xendaria",
    text:
      `¡Gracias por sumar tu comercio a Xendaria!\n\n` +
      `Recibimos la solicitud de ${solicitud.nombreComercio} para el plan ${solicitud.plan}.\n` +
      `Vamos a revisar la propuesta y responderte por este mismo correo.`,
    html: plantillaEmailXendaria({
      preheader: `Recibimos la solicitud de ${solicitud.nombreComercio}.`,
      etiqueta: "Comercios locales",
      titulo: "¡Gracias por sumar tu comercio!",
      maxWidth: 580,
      contenido: `
        <p style="margin: 0 0 14px; color: #66515f; font-size: 15px; line-height: 1.65;">
          Recibimos la solicitud de <strong>${escaparHtml(solicitud.nombreComercio)}</strong>
          para el plan de <strong>${escaparHtml(solicitud.plan)}</strong>.
        </p>
        <p style="margin: 0; color: #66515f; font-size: 15px; line-height: 1.65;">
          Vamos a revisar la propuesta y te vamos a responder por este mismo email
          con los próximos pasos y cualquier contenido adicional que necesitemos.
        </p>
        <div style="margin-top: 24px; border-left: 3px solid #AA63E0; padding: 2px 0 2px 16px;">
          <strong style="color: #401A37;">Beneficio propuesto</strong>
          <p style="margin: 7px 0 0; color: #66515f; line-height: 1.6;">${escaparHtml(solicitud.beneficio)}</p>
        </div>
      `,
    }),
  });
}
