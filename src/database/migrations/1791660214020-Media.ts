import { MigrationInterface, QueryRunner } from 'typeorm';

/** Images uploaded through the admin. The files live in MEDIA_DIR; this table keeps their metadata. */
export class Media1791660214020 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "portalId" varchar NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), filename varchar NOT NULL UNIQUE, "originalName" varchar NOT NULL, "mimeType" varchar NOT NULL, size integer NOT NULL)`,
    );
  }

  async down(q: QueryRunner) {
    await q.query(`DROP TABLE media`);
  }
}
