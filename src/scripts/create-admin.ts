import { hashPassword } from '../auth/password';
import { User } from '../auth/user.entity';
import db from '../database/data-source';
import { Portal } from '../portal/portal.entity';

/**
 * Creates the admin from ADMIN_EMAIL/ADMIN_PASSWORD, without the e-mail invitation. Also completes
 * an invitation still pending for that e-mail. Never changes a password someone already chose.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !email.includes('@') || !password || password.length < 12)
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) no ambiente.');
  await db.initialize();
  try {
    const portal = await db.getRepository(Portal).findOneByOrFail({ slug: process.env.PORTAL_SLUG || 'itajuba-news' });
    const users = db.getRepository(User);
    const existing = await users.findOneBy({ email, portalId: portal.id });
    if (existing?.passwordSetAt) throw new Error('Administrador já existe. Nenhuma senha foi alterada.');
    const name = process.env.ADMIN_NAME?.trim() || existing?.name || 'Administrador';
    await users.save({
      ...existing,
      email,
      name,
      role: 'admin',
      passwordHash: hashPassword(password),
      passwordSetAt: new Date(),
      portalId: portal.id,
      active: true,
    });
    console.log(existing ? 'Convite pendente concluído: senha definida.' : 'Administrador criado.');
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
