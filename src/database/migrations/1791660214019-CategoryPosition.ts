import { MigrationInterface, QueryRunner } from 'typeorm';

/** Menu order of the categories. The default categories get the order the portal header used. */
export class CategoryPosition1791660214019 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE categories ADD COLUMN position integer NOT NULL DEFAULT 0`);
    await q.query(
      `UPDATE categories SET position = CASE slug WHEN 'cidade' THEN 1 WHEN 'politica' THEN 2 WHEN 'seguranca' THEN 3 WHEN 'economia' THEN 4 WHEN 'esportes' THEN 5 WHEN 'cultura' THEN 6 WHEN 'regiao' THEN 7 ELSE 0 END`,
    );
  }

  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE categories DROP COLUMN position`);
  }
}
