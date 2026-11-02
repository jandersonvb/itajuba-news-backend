import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Invitations: accounts can be created without a password, and the person chooses it through an
 * e-mailed link. `passwordSetAt` is null while that invitation is pending.
 */
export class Invitations1791900000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE users ADD COLUMN "passwordSetAt" timestamptz`);
    // Accounts created before this migration already have a password.
    await q.query(`UPDATE users SET "passwordSetAt" = "createdAt"`);
  }

  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE users DROP COLUMN "passwordSetAt"`);
  }
}
