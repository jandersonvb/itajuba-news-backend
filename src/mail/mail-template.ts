import { frontendOrigin } from '../config';

export type EmailContent = {
  /** Line that mail apps show next to the subject. */
  preview: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; url: string };
  /** Small print below the button, e.g. how long the link works. */
  note: string;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Branded e-mail in HTML (tables and inline styles, which is what mail apps render reliably) and
 * in plain text. The logo is loaded from the public site, so it shows once FRONTEND_ORIGIN is a
 * real address.
 */
export function renderEmail(portalName: string, content: EmailContent) {
  const site = frontendOrigin();
  const name = escapeHtml(portalName);
  const url = escapeHtml(content.action.url);
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font:15px/1.6 ${FONT};color:#3f3f46;">${escapeHtml(p)}</p>`)
    .join('');
  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(content.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <tr><td style="height:4px;background:#e3141d;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 36px 8px;"><img src="${escapeHtml(site)}/logo-email.png" width="140" alt="${name}" style="display:block;border:0;width:140px;height:auto;"></td></tr>
    <tr><td style="padding:16px 36px 8px;">
      <h1 style="margin:0 0 16px;font:700 22px/1.3 ${FONT};color:#18181b;">${escapeHtml(content.heading)}</h1>
      ${paragraphs}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr>
        <td style="border-radius:8px;background:#e3141d;"><a href="${url}" style="display:inline-block;padding:14px 26px;font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(content.action.label)}</a></td>
      </tr></table>
      <p style="margin:0 0 20px;font:13px/1.6 ${FONT};color:#71717a;">${escapeHtml(content.note)}</p>
      <p style="margin:0 0 28px;font:12px/1.6 ${FONT};color:#a1a1aa;">Se o botão não funcionar, copie este endereço no navegador:<br><a href="${url}" style="color:#71717a;word-break:break-all;">${url}</a></p>
    </td></tr>
    <tr><td style="padding:18px 36px;border-top:1px solid #e4e4e7;background:#fafafa;font:12px/1.6 ${FONT};color:#a1a1aa;">${name} · <a href="${escapeHtml(site)}" style="color:#a1a1aa;">${escapeHtml(site.replace(/^https?:\/\//, ''))}</a></td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    content.heading,
    ...content.paragraphs,
    `${content.action.label}: ${content.action.url}`,
    content.note,
    `${portalName} · ${site}`,
  ].join('\n\n');
  return { html, text };
}
