import { hashPassword } from '../auth/password';
import { User } from '../auth/user.entity';
import db from '../database/data-source';
import { Portal } from '../portal/portal.entity';

/** Sets ADMIN_PASSWORD on the existing ADMIN_EMAIL user and ends their open sessions. */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !email.includes('@') || !password || password.length < 12)
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) no ambiente.');
  await db.initialize();
  try {
    const portal = await db.getRepository(Portal).findOneByOrFail({ slug: process.env.PORTAL_SLUG || 'itajuba-news' });
    const { affected } = await db.getRepository(User).update(
      { email, portalId: portal.id },
      {
        passwordHash: hashPassword(password),
        passwordSetAt: new Date(),
        sessionVersion: () => '"sessionVersion" + 1',
        passwordResetHash: null,
        passwordResetExpiresAt: null,
      },
    );
    if (!affected) throw new Error('Usuário não encontrado. Use npm run admin:create.');
    console.log('Senha redefinida.');
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
