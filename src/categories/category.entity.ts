import { Column, Entity, Unique } from 'typeorm';
import { PortalScopedEntity } from '../common/portal-scoped.entity';

@Entity('categories')
@Unique('categories_portalId_slug_key', ['portalId', 'slug'])
export class Category extends PortalScopedEntity {
  @Column()
  name: string;

  @Column()
  slug: string;

  /** Order in the portal menu, ascending. */
  @Column({ default: 0 })
  position: number;
}
