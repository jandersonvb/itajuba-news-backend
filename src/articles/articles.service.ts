import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, ILike, Repository } from 'typeorm';
import type { StaffSession } from '../auth/auth.constants';
import { CategoriesService } from '../categories/categories.service';
import { PortalService } from '../portal/portal.service';
import { Article } from './article.entity';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';

const PAGE_SIZE = 12;
/** URLs one sitemap file may list. */
const SITEMAP_LIMIT = 50_000;
const UNIQUE_VIOLATION = '23505';

/** Fields whose change makes the article "atualizada" (see Article.updatedAt). */
const CONTENT_FIELDS = ['title', 'excerpt', 'content', 'imageUrl'] as const;

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    private readonly categories: CategoriesService,
    private readonly portal: PortalService,
  ) {}

  /** Published articles of the current portal, newest first. Drafts never leave the admin. */
  async listPublished({ search, category, page }: ListArticlesQueryDto) {
    const portal = await this.portal.current();
    const base: FindOptionsWhere<Article> = {
      portalId: portal.id,
      status: 'published',
      ...(category ? { categoryId: category } : {}),
    };
    const where = search
      ? [
          { ...base, title: ILike(`%${search}%`) },
          { ...base, excerpt: ILike(`%${search}%`) },
        ]
      : base;
    const [items, total] = await this.articles.findAndCount({
      where,
      order: { publishedAt: 'DESC' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    });
    return { items: await this.withCategory(items, portal.id), total, page };
  }

  async findPublished(slug: string) {
    const portal = await this.portal.current();
    const article = await this.articles.findOneBy({ portalId: portal.id, slug, status: 'published' });
    if (!article) throw new NotFoundException('Matéria não encontrada');
    const [withCategory] = await this.withCategory([article], portal.id);
    return withCategory;
  }

  /** Published articles for the sitemap, newest first. Demo articles are left out (they are noindex). */
  async sitemap() {
    const portal = await this.portal.current();
    return this.articles.find({
      where: { portalId: portal.id, status: 'published', demo: false },
      select: { slug: true, title: true, publishedAt: true, updatedAt: true },
      order: { publishedAt: 'DESC' },
      take: SITEMAP_LIMIT,
    });
  }

  /** Admins and editors see every article of the portal; reporters only the ones they created. */
  listAll(staff: StaffSession) {
    return this.articles.find({ where: this.visibleTo(staff), order: { createdAt: 'DESC' } });
  }

  create(dto: CreateArticleDto, staff: StaffSession) {
    this.checkReporterChange(dto, staff);
    return this.persist({ ...dto, portalId: staff.portalId, createdById: staff.sub }, null);
  }

  async update(id: string, dto: UpdateArticleDto, staff: StaffSession) {
    const existing = await this.findVisible(id, staff);
    this.checkReporterChange(dto, staff, existing);
    return this.persist({ ...existing, ...dto, portalId: staff.portalId }, existing);
  }

  async remove(id: string, staff: StaffSession) {
    const existing = await this.findVisible(id, staff);
    this.checkReporterChange({}, staff, existing);
    await this.articles.delete({ id: existing.id, portalId: staff.portalId });
    return { deleted: true };
  }

  private visibleTo({ portalId, role, sub }: StaffSession): FindOptionsWhere<Article> {
    return role === 'reporter' ? { portalId, createdById: sub } : { portalId };
  }

  /** 404 for other portals' articles and, for reporters, for other people's articles. */
  private async findVisible(id: string, staff: StaffSession) {
    const article = await this.articles.findOneBy({ id, ...this.visibleTo(staff) });
    if (!article) throw new NotFoundException();
    return article;
  }

  /** Reporters write drafts only: they cannot publish, feature, or touch a published article. */
  private checkReporterChange(dto: UpdateArticleDto, { role }: StaffSession, existing?: Article) {
    if (role !== 'reporter') return;
    if (existing?.status === 'published')
      throw new ForbiddenException('Matéria publicada: só editores podem alterá-la');
    if (dto.status === 'published' || dto.featured)
      throw new ForbiddenException('Repórteres salvam apenas rascunhos; um editor publica a matéria');
  }

  /**
   * Public shape: adds `category: { id, name, slug }` (or null) so the portal does not need a
   * second request, and leaves out the internal id of the user who created the article.
   */
  private async withCategory(articles: Article[], portalId: string) {
    const categories = await this.categories.byId(portalId);
    return articles.map(({ createdById: _, ...article }) => {
      const category = categories.get(article.categoryId);
      return { ...article, category: category ? { id: category.id, name: category.name, slug: category.slug } : null };
    });
  }

  private async persist(data: DeepPartial<Article>, existing: Article | null) {
    if (!(await this.categories.belongsToPortal(data.categoryId!, data.portalId!)))
      throw new BadRequestException('Categoria inválida');
    const now = new Date();
    data.publishedAt = data.status === 'published' ? existing?.publishedAt || now : null;
    const firstPublication = !!data.publishedAt && !existing?.publishedAt;
    const edited =
      !existing || CONTENT_FIELDS.some((field) => data[field] !== undefined && data[field] !== existing[field]);
    if (firstPublication || edited) data.updatedAt = now;
    try {
      return await this.articles.save(this.articles.create(data));
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException('Slug já utilizado');
      throw error;
    }
  }
}
