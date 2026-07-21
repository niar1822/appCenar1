import dotenv from "dotenv";

dotenv.config();

const cleanEnv = value => {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().replace(/^["']|["']$/g, "");
};

const sendgridApiKey = cleanEnv(process.env.SENDGRID_API_KEY);
const sendgridFromEmail = cleanEnv(process.env.SENDGRID_FROM);
const brevoApiKey = cleanEnv(process.env.BREVO_API_KEY);
const brevoSenderEmail = cleanEnv(process.env.BREVO_SENDER_EMAIL);
const brevoSenderName = cleanEnv(process.env.BREVO_SENDER_NAME) || "AppCenar";
const defaultSenderName = brevoSenderName;

const normalizeRecipients = value => {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
        return [value.trim()];
    }

    return [];
};

const getMailerProvider = () => {
    if (sendgridApiKey && sendgridFromEmail) {
        return "sendgrid";
    }

    if (brevoApiKey && brevoSenderEmail) {
        return "brevo";
    }

    return null;
};

export const isMailerConfigured = () => Boolean(getMailerProvider());

export const transporter = {
    async sendMail({ from, to, subject, html, text }) {
        const recipients = normalizeRecipients(to);

        if (recipients.length === 0) {
            throw new Error("No se especifico un destinatario para el correo.");
        }

        const provider = getMailerProvider();

        if (!provider) {
            throw new Error("El mailer no esta configurado. Revisa SENDGRID_API_KEY y SENDGRID_FROM, o BREVO_API_KEY y BREVO_SENDER_EMAIL.");
        }

        if (provider === "sendgrid") {
            const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${sendgridApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    personalizations: [
                        {
                            to: recipients.map(email => ({ email }))
                        }
                    ],
                    from: {
                        email: from || sendgridFromEmail,
                        name: defaultSenderName
                    },
                    subject,
                    content: [
                        {
                            type: "text/html",
                            value: html || text || ""
                        }
                    ]
                })
            });

            if (response.ok) {
                return { ok: true, provider };
            }

            const data = await response.json().catch(() => ({}));
            const message = Array.isArray(data?.errors) && data.errors.length > 0
                ? data.errors.map(error => error.message).filter(Boolean).join(", ")
                : `SendGrid respondio con estado ${response.status}`;

            throw new Error(message);
        }

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "api-key": brevoApiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sender: from
                    ? { email: from, name: defaultSenderName }
                    : { email: brevoSenderEmail, name: defaultSenderName },
                to: recipients.map(email => ({ email })),
                subject,
                htmlContent: html || text || ""
            })
        });

        if (response.ok) {
            return { ok: true, provider };
        }

        const data = await response.json().catch(() => ({}));
        const message = data?.message || `Brevo respondio con estado ${response.status}`;
        throw new Error(message);
    }
};

export const verifyMailer = async () => {
    const provider = getMailerProvider();

    if (!provider) {
        console.log("Mailer omitido: faltan SENDGRID_API_KEY y SENDGRID_FROM, o BREVO_API_KEY y BREVO_SENDER_EMAIL");
        return false;
    }

    console.log(`Mailer listo (${provider})`);
    return true;
};
