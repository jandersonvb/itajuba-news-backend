import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the text of each article last changed, for "Atualizado em", `dateModified` and the sitemap.
 * Existing articles start at their publication (or creation) date.
 */
export class ArticleUpdatedAt1792000000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE articles ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now()`);
    await q.query(`UPDATE articles SET "updatedAt" = COALESCE("publishedAt", "createdAt")`);
  }

  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE articles DROP COLUMN "updatedAt"`);
  }
}
