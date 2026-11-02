import { Check, Column, Entity } from 'typeorm';
import { PortalScopedEntity } from '../common/portal-scoped.entity';

/** Ad positions on the portal: top banner and sidebar. */
export const CAMPAIGN_SLOTS = ['leaderboard', 'sidebar'] as const;
export type CampaignSlot = (typeof CAMPAIGN_SLOTS)[number];

@Entity('campaigns')
@Check('campaigns_slot_check', `slot IN ('leaderboard', 'sidebar')`)
@Check('campaigns_check', '"endsAt" > "startsAt"')
export class Campaign extends PortalScopedEntity {
  @Column()
  name: string;

  @Column()
  sponsorId: string;

  @Column()
  slot: CampaignSlot;

  @Column()
  imageUrl: string;

  @Column()
  targetUrl: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ default: true })
  active: boolean;
}
