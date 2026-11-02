import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pending "forgot password" link of each user: hash of the token and when it stops working. */
export class PasswordReset1791800000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE users ADD COLUMN "passwordResetHash" varchar`);
    await q.query(`ALTER TABLE users ADD COLUMN "passwordResetExpiresAt" timestamptz`);
  }

  async down(q: QueryRunner) {
    for (const column of ['"passwordResetExpiresAt"', '"passwordResetHash"'])
      await q.query(`ALTER TABLE users DROP COLUMN ${column}`);
  }
}
