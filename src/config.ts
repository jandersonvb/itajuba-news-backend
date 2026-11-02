import 'dotenv/config';
import { entities } from './database/entities';

/**
 * Development and tests opt out explicitly (`NODE_ENV=development` in the local .env, `test` under
 * Jest). Anything else, including a server where NODE_ENV was forgotten, keeps the production
 * safeguards: e-mails never go to the log and the configuration is checked at startup.
 */
export function isProduction() {
  return !['development', 'test'].includes(process.env.NODE_ENV ?? '');
}

export function databaseOptions() {
  if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL no .env');
  return {
    type: 'postgres' as const,
    url: process.env.DATABASE_URL,
    entities,
    // Schema changes go through migrations only.
    synchronize: false,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  };
}

/** Public address of the Next.js site: allowed by CORS and used in links sent by e-mail. */
export function frontendOrigin() {
  return process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
}

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres');
  return secret;
}

/**
 * Settings a public installation cannot run without. Called at startup in production; returns
 * every problem at once so a deploy shows the whole list. `warnings` work, but degrade something.
 */
export function productionConfigProblems() {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!process.env.DATABASE_URL) errors.push('DATABASE_URL não definida.');
  if ((process.env.JWT_SECRET ?? '').length < 32) errors.push('JWT_SECRET precisa ter pelo menos 32 caracteres.');
  if ((process.env.INTERNAL_API_KEY ?? '').length < 32)
    errors.push(
      'INTERNAL_API_KEY precisa ter pelo menos 32 caracteres (o mesmo valor no frontend); sem ela o rate limit trata todos os visitantes como um só.',
    );
  if (!/^https:\/\/[^/]+$/.test(process.env.FRONTEND_ORIGIN ?? ''))
    errors.push(
      'FRONTEND_ORIGIN precisa ser a origem HTTPS pública do portal, sem barra no fim (ex.: https://itajubanews.com.br).',
    );
  if (process.env.RESEND_API_KEY) {
    if (!process.env.MAIL_FROM)
      errors.push('MAIL_FROM é obrigatório com RESEND_API_KEY (ex.: Itajubá News <nao-responda@seudominio>).');
  } else if (process.env.SMTP_HOST) {
    if (!process.env.MAIL_FROM)
      warnings.push('MAIL_FROM não definido: o remetente será SMTP_USER, que muitos provedores recusam.');
  } else warnings.push('Sem RESEND_API_KEY nem SMTP_HOST: convites e redefinições de senha não serão enviados.');
  if (process.env.ENABLE_DOCS === 'true')
    warnings.push('ENABLE_DOCS=true: a documentação Swagger está pública em /api/docs.');
  return { errors, warnings };
}
