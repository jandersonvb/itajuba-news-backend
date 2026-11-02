import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../articles/article.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { MEDIA_FILENAME } from '../common/validation';
import { PortalService } from '../portal/portal.service';
import { Sponsor } from '../sponsors/sponsor.entity';
import { detectImageType, IMAGE_TYPES } from './image-type';
import { Media } from './media.entity';
import { MediaStorage } from './media.storage';

/** Below the 4.5 MB request body limit of Vercel Functions, which proxy the uploads from the admin. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const mediaUrl = (filename: string) => `/media/${filename}`;
const withUrl = (media: Media) => ({ ...media, url: mediaUrl(media.filename) });

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    // Only to refuse deleting an image that is still in use.
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(Sponsor) private readonly sponsors: Repository<Sponsor>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    private readonly storage: MediaStorage,
    private readonly portal: PortalService,
  ) {}

  async listAll(portalId: string) {
    return (await this.media.find({ where: { portalId }, order: { createdAt: 'DESC' } })).map(withUrl);
  }

  async upload(file: Express.Multer.File | undefined, portalId: string) {
    if (!file) throw new BadRequestException('Envie a imagem no campo "file"');
    const type = detectImageType(file.buffer);
    if (!type) throw new BadRequestException('Envie uma imagem JPG, PNG, WebP ou GIF');
    const filename = `${randomUUID()}.${type}`;
    await this.storage.save(filename, file.buffer);
    try {
      const media = await this.media.save(
        this.media.create({
          portalId,
          filename,
          // Multer decodes the name as latin1; browsers send UTF-8.
          originalName: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200),
          mimeType: IMAGE_TYPES[type],
          size: file.size,
        }),
      );
      return withUrl(media);
    } catch (error) {
      await this.storage.remove(filename);
      throw error;
    }
  }

  /** Public read of an uploaded file of the current portal. */
  async open(filename: string) {
    if (!MEDIA_FILENAME.test(filename)) throw new NotFoundException();
    const portal = await this.portal.current();
    const media = await this.media.findOneBy({ portalId: portal.id, filename });
    if (!media || !(await this.storage.exists(filename))) throw new NotFoundException();
    return { media, stream: this.storage.read(filename) };
  }

  async remove(id: string, portalId: string) {
    const media = await this.media.findOneBy({ id, portalId });
    if (!media) throw new NotFoundException();
    const url = mediaUrl(media.filename);
    const uses =
      (await this.articles.countBy({ portalId, imageUrl: url })) +
      (await this.sponsors.countBy({ portalId, logoUrl: url })) +
      (await this.campaigns.countBy({ portalId, imageUrl: url }));
    if (uses) throw new ConflictException('Imagem em uso em notícias, patrocinadores ou campanhas');
    await this.media.delete({ id, portalId });
    await this.storage.remove(media.filename);
    return { deleted: true };
  }
}
