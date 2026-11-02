import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Article } from '../articles/article.entity';
import { PortalService } from '../portal/portal.service';
import { Category } from './category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    // Only to block deleting a category that still has articles (no foreign key yet).
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    private readonly portal: PortalService,
  ) {}

  /** Categories of the current portal in menu order. */
  async list() {
    return this.listAll((await this.portal.current()).id);
  }

  listAll(portalId: string) {
    return this.categories.find({ where: { portalId }, order: { position: 'ASC', name: 'ASC' } });
  }

  /** id → category of a portal, to embed the category in article responses. */
  async byId(portalId: string) {
    return new Map((await this.listAll(portalId)).map((category) => [category.id, category]));
  }

  async belongsToPortal(id: string, portalId: string) {
    return !!(await this.categories.findOneBy({ id, portalId }));
  }

  create(dto: CreateCategoryDto, portalId: string) {
    return this.persist({ ...dto, portalId });
  }

  async update(id: string, dto: UpdateCategoryDto, portalId: string) {
    const existing = await this.categories.findOneBy({ id, portalId });
    if (!existing) throw new NotFoundException();
    return this.persist({ ...existing, ...dto, portalId });
  }

  async remove(id: string, portalId: string) {
    if (await this.articles.countBy({ categoryId: id, portalId }))
      throw new ConflictException('Mova ou exclua as notícias desta editoria primeiro');
    const { affected } = await this.categories.delete({ id, portalId });
    if (!affected) throw new NotFoundException();
    return { deleted: true };
  }

  private async persist(data: DeepPartial<Category>) {
    try {
      return await this.categories.save(this.categories.create(data));
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException('Slug já utilizado');
      throw error;
    }
  }
}
