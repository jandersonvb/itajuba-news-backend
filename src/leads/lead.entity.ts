import { Column, Entity } from 'typeorm';
import { PortalScopedEntity } from '../common/portal-scoped.entity';

/** Advertising request sent from the "Anuncie" form. */
@Entity('leads')
export class Lead extends PortalScopedEntity {
  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  interest: string;

  @Column('text')
  message: string;

  @Column({ default: false })
  consent: boolean;
}
