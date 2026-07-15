import "dotenv/config";
import jwt from "jsonwebtoken";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const mailFrom = process.env.MAIL_FROM || "no-reply@xendaria.com.ar";

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

    await getResendClient().emails.send({
      from: mailFrom,
      to: email,
      subject: "Recupera tu acceso a Xendaria",
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 20px; max-width: 480px;">
          <h2 style="color: #6A4AE3; margin-bottom: 12px;">Recupera tu acceso a Xendaria</h2>

          <p style="line-height: 1.5;">Hola explorador/a,</p>

          <p style="line-height: 1.5;">
            Detectamos que solicitaste restablecer tu contrasena.
            Hace clic en el siguiente enlace para continuar:
          </p>

          <p style="text-align: center; margin: 25px 0;">
            <a href="${resetLink}" style="background: #6A4AE3; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">
              Recuperar contrasena
            </a>
          </p>

          <p style="font-size: 14px; color: #555; line-height: 1.5;">
            Si no fuiste vos quien solicito este cambio, ignora este mensaje.
          </p>

          <p style="margin-top: 25px; font-size: 13px; color: #777;">
            Equipo de Xendaria
          </p>
        </div>
      `,
    });

    console.log("Mail de recuperacion enviado");
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
          <div style="border: 1px solid #ececec; border-radius: 10px; padding: 12px; margin-bottom: 12px; background: #ffffff;">
            <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              <tr>
                ${
                  item.imagen
                    ? `
                      <td style="width: 72px; vertical-align: top;">
                        <img src="${item.imagen}" alt="${item.nombre}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #ececec; display: block;" />
                      </td>
                    `
                    : ""
                }

                <td style="vertical-align: top;">
                  <div style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">
                    ${item.nombre}
                  </div>

                  ${
                    varianteTexto
                      ? `<div style="font-size: 13px; color: #555; margin-bottom: 4px;">${varianteTexto}</div>`
                      : ""
                  }

                  <div style="font-size: 13px; color: #555;">Cantidad: ${item.cantidad}</div>
                </td>

                <td style="text-align: right; vertical-align: top; font-size: 14px; font-weight: 700; color: #6A4AE3; white-space: nowrap;">
                  ${formatearMoneda(item.subtotal)}
                </td>
              </tr>
            </table>
          </div>
        `;
      })
      .join("");

    const datosEnvio = orden.datosEnvio || {};

    await getResendClient().emails.send({
      from: mailFrom,
      to: destinatario,
      subject: `Confirmacion de compra ${orden.numeroCompra} - Xendaria`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 20px; max-width: 560px;">
          <h2 style="color: #6A4AE3; margin-bottom: 12px;">Confirmacion de compra en Xendaria</h2>

          <p style="line-height: 1.5;">
            Tu compra fue registrada correctamente. Te compartimos el detalle del pedido.
          </p>

          <div style="margin: 20px 0; padding: 14px 16px; background: #faf8ff; border-left: 4px solid #6A4AE3; border-radius: 8px;">
            <div style="font-size: 13px; color: #555; margin-bottom: 4px;">Numero de compra</div>
            <div style="font-size: 22px; font-weight: 700; color: #6A4AE3;">${orden.numeroCompra}</div>
          </div>

          <h3 style="color: #6A4AE3; margin: 24px 0 12px;">Resumen del pedido</h3>

          <div style="margin-bottom: 20px;">${itemsHtml}</div>

          <div style="margin: 20px 0; padding: 16px; background: #faf8ff; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
              <span>Subtotal</span>
              <span>${formatearMoneda(orden.subtotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
              <span>Descuento</span>
              <span>${formatearMoneda(orden.descuento)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
              <span>Envio</span>
              <span>${formatearMoneda(orden.costoEnvio)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 14px; padding-top: 12px; border-top: 1px solid #ececec; font-size: 17px; font-weight: 700; color: #6A4AE3;">
              <span>Total</span>
              <span>${formatearMoneda(orden.total)}</span>
            </div>
          </div>

          <h3 style="color: #6A4AE3; margin: 24px 0 12px;">Datos de envio</h3>

          <div style="line-height: 1.6; font-size: 14px;">
            <div><strong>Nombre:</strong> ${datosEnvio.nombreCompleto || "-"}</div>
            <div><strong>Telefono:</strong> ${datosEnvio.telefono || "-"}</div>
            <div><strong>Direccion:</strong> ${datosEnvio.calle || ""} ${datosEnvio.numero || ""}</div>
            ${
              datosEnvio.pisoDepto
                ? `<div><strong>Piso / Depto:</strong> ${datosEnvio.pisoDepto}</div>`
                : ""
            }
            <div><strong>Ciudad:</strong> ${datosEnvio.ciudad || "-"}</div>
            <div><strong>Provincia:</strong> ${formatearProvincia(datosEnvio.provincia)}</div>
            <div><strong>Codigo postal:</strong> ${datosEnvio.codigoPostal || "-"}</div>
            ${
              datosEnvio.referencias
                ? `<div><strong>Referencias:</strong> ${datosEnvio.referencias}</div>`
                : ""
            }
          </div>

          <p style="margin-top: 24px; font-size: 13px; color: #777; line-height: 1.5;">
            Equipo de Xendaria
          </p>
        </div>
      `,
    });

    console.log("Mail de confirmacion enviado");
  } catch (error) {
    console.error("No se pudo enviar el mail de confirmacion", error);
  }
}
