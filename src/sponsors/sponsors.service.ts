import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/campaign.entity';
import { PortalService } from '../portal/portal.service';
import { CreateSponsorDto, UpdateSponsorDto } from './dto/sponsor.dto';
import { Sponsor } from './sponsor.entity';

@Injectable()
export class SponsorsService {
  constructor(
    @InjectRepository(Sponsor) private readonly sponsors: Repository<Sponsor>,
    // Only to block deleting a sponsor that still has campaigns (no foreign key yet).
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    private readonly portal: PortalService,
  ) {}

  /** Active sponsors of the current portal, with only the fields the portal shows. */
  async listPublic() {
    const portal = await this.portal.current();
    return this.sponsors.find({
      where: { portalId: portal.id, active: true },
      select: { id: true, name: true, logoUrl: true, websiteUrl: true },
      order: { name: 'ASC' },
    });
  }

  listAll(portalId: string) {
    return this.sponsors.find({ where: { portalId }, order: { createdAt: 'DESC' } });
  }

  listActive(portalId: string) {
    return this.sponsors.findBy({ portalId, active: true });
  }

  findOne(id: string, portalId: string) {
    return this.sponsors.findOneBy({ id, portalId });
  }

  create(dto: CreateSponsorDto, portalId: string) {
    return this.sponsors.save(this.sponsors.create({ ...dto, portalId }));
  }

  async update(id: string, dto: UpdateSponsorDto, portalId: string) {
    const existing = await this.findOne(id, portalId);
    if (!existing) throw new NotFoundException();
    return this.sponsors.save(this.sponsors.create({ ...existing, ...dto, portalId }));
  }

  async remove(id: string, portalId: string) {
    if (await this.campaigns.countBy({ sponsorId: id, portalId }))
      throw new ConflictException('Remova as campanhas deste patrocinador primeiro');
    const { affected } = await this.sponsors.delete({ id, portalId });
    if (!affected) throw new NotFoundException();
    return { deleted: true };
  }
}
