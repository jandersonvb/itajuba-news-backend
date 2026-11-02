import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portal } from './portal.entity';

@Injectable()
export class PortalService {
  constructor(@InjectRepository(Portal) private readonly portals: Repository<Portal>) {}

  /** The portal served by this installation, chosen by PORTAL_SLUG. */
  async current() {
    const portal = await this.portals.findOneBy({ slug: process.env.PORTAL_SLUG || 'itajuba-news' });
    if (!portal) throw new NotFoundException('Portal não configurado. Execute o seed.');
    return portal;
  }
}
