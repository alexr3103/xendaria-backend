import dotenv from "dotenv";
dotenv.config();

import nodemailer from 'nodemailer'
import jwt from 'jsonwebtoken'

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
})

export function recuperarCuenta(mail){
    const token = jwt.sign({mail}, "RECUPERAR", {expiresIn: '1h'})

    const resetLink = `${process.env.RESET_URL_FRONT}?token=${token}`
    const mailOptions = {
        from: process.env.MAIL_USER,
        to: mail,
        subject: "🔑 Recuperá tu acceso a Xendaria",
        text: `Recuperá tu acceso a Xendaria ingresando al siguiente enlace: ${resetLink}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #1a1a1a; padding: 20px; max-width: 480px;">
                
                <h2 style="color: #6A4AE3; margin-bottom: 12px; font-weight: 700;">
                    Recuperá tu acceso a Xendaria
                </h2>
    
                <p style="margin-bottom: 18px; line-height: 1.5;">
                    Hola explorador/a,
                </p>
    
                <p style="margin-bottom: 18px; line-height: 1.5;">
                    Detectamos que solicitaste restablecer tu contraseña.  
                    En Xendaria cada paso te acerca a una nueva historia,  
                    así que queremos asegurarnos de que puedas volver a ingresar sin problemas.
                </p>
    
                <p style="margin-bottom: 20px; line-height: 1.5;">
                    Hacé clic en el siguiente enlace para continuar con la recuperación:
                </p>
    
                <p style="text-align: center; margin: 25px 0;">
                    <a href="${resetLink}"
                        style="background: #6A4AE3; color: #ffffff; text-decoration: none;
                               padding: 12px 24px; border-radius: 8px; font-weight: bold;">
                        Recuperar contraseña
                    </a>
                </p>
    
                <p style="margin-top: 18px; font-size: 14px; color: #555;">
                    Si no fuiste vos quien solicitó este cambio, simplemente ignorá este mensaje.  
                    Tu cuenta seguirá protegida.
                </p>
    
                <p style="margin-top: 25px; font-size: 13px; color: #777;">
                    — El equipo de Xendaria  
                    <br>Explorá la ciudad. Descubrí sus secretos.
                </p>
    
            </div>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if(error){
            console.error("No se pudo enviar", error)
        }else{
            console.log("Enviado")
        }
    })
}
