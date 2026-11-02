import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { PortalService } from '../portal/portal.service';
import { SponsorsService } from '../sponsors/sponsors.service';
import { Campaign, CampaignSlot } from './campaign.entity';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

type CampaignInput = Partial<Omit<Campaign, 'startsAt' | 'endsAt'>> & {
  startsAt?: string | Date;
  endsAt?: string | Date;
};

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    private readonly sponsors: SponsorsService,
    private readonly portal: PortalService,
  ) {}

  /** Active campaigns running now in a slot, newest first, only from active sponsors. */
  async listRunning(slot: CampaignSlot) {
    const portal = await this.portal.current();
    const now = new Date();
    const campaigns = await this.campaigns.find({
      where: {
        portalId: portal.id,
        slot,
        active: true,
        startsAt: LessThanOrEqual(now),
        endsAt: MoreThanOrEqual(now),
      },
      order: { createdAt: 'DESC' },
    });
    const sponsors = await this.sponsors.listActive(portal.id);
    return campaigns.flatMap((campaign) => {
      const sponsor = sponsors.find((s) => s.id === campaign.sponsorId);
      return sponsor ? [{ ...campaign, sponsor }] : [];
    });
  }

  listAll(portalId: string) {
    return this.campaigns.find({ where: { portalId }, order: { createdAt: 'DESC' } });
  }

  create(dto: CreateCampaignDto, portalId: string) {
    return this.persist({ ...dto, portalId });
  }

  async update(id: string, dto: UpdateCampaignDto, portalId: string) {
    const existing = await this.campaigns.findOneBy({ id, portalId });
    if (!existing) throw new NotFoundException();
    return this.persist({ ...existing, ...dto, portalId });
  }

  async remove(id: string, portalId: string) {
    const { affected } = await this.campaigns.delete({ id, portalId });
    if (!affected) throw new NotFoundException();
    return { deleted: true };
  }

  private async persist(data: CampaignInput) {
    if (!(await this.sponsors.findOne(data.sponsorId!, data.portalId!)))
      throw new BadRequestException('Patrocinador inválido');
    const startsAt = new Date(data.startsAt!);
    const endsAt = new Date(data.endsAt!);
    if (!(endsAt > startsAt)) throw new BadRequestException('Fim deve ser posterior ao início');
    return this.campaigns.save(this.campaigns.create({ ...data, startsAt, endsAt }));
  }
}
