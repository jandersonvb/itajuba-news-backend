import { Check, Column, Entity, Index, Unique } from 'typeorm';
import { PortalScopedEntity } from '../common/portal-scoped.entity';

export const ARTICLE_STATUSES = ['draft', 'published'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

@Entity('articles')
@Unique('articles_portalId_slug_key', ['portalId', 'slug'])
@Index('article_public_idx', ['portalId', 'status', 'publishedAt'])
@Check('articles_status_check', `status IN ('draft', 'published')`)
export class Article extends PortalScopedEntity {
  @Column()
  title: string;

  @Column()
  slug: string;

  @Column('text')
  excerpt: string;

  /** Plain text; the frontend renders each line as a paragraph. */
  @Column('text')
  content: string;

  @Column()
  categoryId: string;

  @Column({ default: '' })
  imageUrl: string;

  @Column({ default: 'Redação Itajubá News' })
  author: string;

  @Column({ default: 'draft' })
  status: ArticleStatus;

  /** Set on the first publication, cleared when the article goes back to draft. */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /**
   * Last change to the title, summary, text or image; reset to `publishedAt` on the first
   * publication, so on a published article it is never earlier. Other edits (status, featured,
   * category, author) do not count: readers would see "Atualizado" without anything new.
   */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @Column({ default: false })
  featured: boolean;

  /** Sample content created by the seed (SEED_DEMO=true). */
  @Column({ default: false })
  demo: boolean;

  /** User who created the article in the admin; null for seed and older articles. */
  @Column({ type: 'varchar', nullable: true })
  createdById: string | null;
}
