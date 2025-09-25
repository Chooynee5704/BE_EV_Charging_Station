import nodemailer from 'nodemailer';

export interface MailEnvelope {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

function getEnvOrThrow(name: string, fallback?: string) {
  const raw = process.env[name] ?? fallback;
  const val = (typeof raw === 'string') ? raw.trim() : raw;
  if (!val) throw new Error(`[mail] Missing ENV ${name}`);
  return val;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function createTransporter(): nodemailer.Transporter {
  const host = getEnvOrThrow('SMTP_HOST');
  const port = Number(getEnvOrThrow('SMTP_PORT', '587'));
  const secure = String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';
  const user = getEnvOrThrow('SMTP_USER');
  const pass = getEnvOrThrow('SMTP_PASS');

  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
  });

  return transporter;
}

function getTransporter(): nodemailer.Transporter {
  if (!cachedTransporter) cachedTransporter = createTransporter();
  return cachedTransporter;
}

export async function sendMail({ to, subject, html, text }: MailEnvelope) {
  const fromName = (process.env.SMTP_FROM_NAME || 'No-Reply').trim();
  const fromEmail = getEnvOrThrow('SMTP_FROM_EMAIL');
  const from = `"${fromName}" <${fromEmail}>`;
  const transporter = getTransporter();
  return transporter.sendMail({ from, to, subject, html, text });
}

export async function verifySmtpConnection() {
  const transporter = getTransporter();
  return transporter.verify();
}
