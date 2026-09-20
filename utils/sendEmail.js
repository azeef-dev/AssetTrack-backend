import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = () => {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return null;
    }
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
    }
    return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
    const t = getTransporter();
    if (!t) {
        console.log(`[Email skipped - not configured] To: ${to} | Subject: ${subject}`);
        return { skipped: true };
    }
    try {
        await t.sendMail({
            from: process.env.EMAIL_FROM || `"AssetTrack" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        return { sent: true };
    } catch (err) {
        console.error('Email send failed:', err.message);
        return { sent: false, error: err.message };
    }
};

export default sendEmail;