import { Column, Entity } from 'typeorm';
import { PortalScopedEntity } from '../common/portal-scoped.entity';

@Entity('sponsors')
export class Sponsor extends PortalScopedEntity {
  @Column()
  name: string;

  @Column({ default: '' })
  logoUrl: string;

  @Column()
  websiteUrl: string;

  /** Campaigns of an inactive sponsor are not shown. */
  @Column({ default: true })
  active: boolean;
}
