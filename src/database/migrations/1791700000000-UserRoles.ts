import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Staff roles, display name and session version on users, plus the author user of each
 * article. Existing users become admins, which is what they could already do.
 */
export class UserRoles1791700000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE users ADD COLUMN name varchar NOT NULL DEFAULT ''`);
    await q.query(`ALTER TABLE users ADD COLUMN role varchar NOT NULL DEFAULT 'admin'`);
    await q.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','editor','reporter'))`);
    await q.query(`ALTER TABLE users ADD COLUMN "sessionVersion" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE articles ADD COLUMN "createdById" varchar`);
  }

  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE articles DROP COLUMN "createdById"`);
    await q.query(`ALTER TABLE users DROP CONSTRAINT users_role_check`);
    for (const column of ['"sessionVersion"', 'role', 'name']) await q.query(`ALTER TABLE users DROP COLUMN ${column}`);
  }
}
