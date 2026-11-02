import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { isProduction } from '../config';

/**
 * `text` is required (mail apps without HTML, and the local log); `html` is the branded version.
 * `replyTo` is where "Responder" goes, e.g. the person who sent a commercial request.
 */
export type MailMessage = { to: string; subject: string; text: string; html?: string; replyTo?: string };

/** Local development without a mail provider: each e-mail is also saved here as a page to open in the browser. */
const OUTBOX = join(process.cwd(), '.mail-outbox');

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends e-mail through the Resend HTTPS API (RESEND_API_KEY) or an SMTP server (SMTP_HOST). The API
 * is preferred: hosts like Railway (below Pro) and Render's free instances block outbound SMTP.
 * Without either, outside production the message goes to the log and to .mail-outbox/, so flows
 * that depend on e-mail can be used locally.
 */
@Injectable()
export class MailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailService.name);
  private readonly resendKey = process.env.RESEND_API_KEY || null;
  private readonly transport =
    !this.resendKey && process.env.SMTP_HOST
      ? createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_PORT === '465',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
        })
      : null;

  /**
   * Checks the SMTP connection and login at startup, so a wrong password or a blocked port shows
   * up in the deploy log instead of in the first invitation. Runs in the background: a blocked port
   * only answers after a long timeout, and the API must not wait for it to start.
   */
  onApplicationBootstrap() {
    this.transport
      ?.verify()
      .then(() => this.logger.log(`SMTP conectado em ${process.env.SMTP_HOST}.`))
      .catch((error: Error) =>
        this.logger.error(
          `Não foi possível conectar ao SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}: ${error.message}`,
        ),
      );
  }

  /** False when the message could not leave (production without a provider); provider errors throw. */
  async send(message: MailMessage): Promise<boolean> {
    if (this.resendKey) {
      await this.sendWithResend(message);
      return true;
    }
    if (this.transport) {
      await this.transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...message });
      return true;
    }
    if (isProduction()) {
      this.logger.error(`Sem RESEND_API_KEY nem SMTP_HOST: o e-mail "${message.subject}" não foi enviado.`);
      return false;
    }
    const file = await this.saveToOutbox(message).catch(() => null);
    this.logger.warn(
      `Sem RESEND_API_KEY nem SMTP_HOST. E-mail para ${message.to}${file ? ` (abra ${file})` : ''}:\n${message.subject}\n\n${message.text}`,
    );
    return true;
  }

  private async sendWithResend({ to, subject, text, html, replyTo }: MailMessage) {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html, reply_to: replyTo }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Resend respondeu ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  private async saveToOutbox({ to, text, html }: MailMessage) {
    await mkdir(OUTBOX, { recursive: true });
    const file = join(OUTBOX, `${new Date().toISOString().replace(/[:.]/g, '-')}-${to.replace(/[^\w.@-]/g, '_')}.html`);
    const page =
      html ?? `<pre>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)}</pre>`;
    await writeFile(file, page);
    return file;
  }
}
