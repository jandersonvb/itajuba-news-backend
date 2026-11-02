import { Column, Entity } from 'typeorm';
import { PortalScopedEntity } from '../common/portal-scoped.entity';

/** Image uploaded through the admin. The file itself is kept by MediaStorage. */
@Entity('media')
export class Media extends PortalScopedEntity {
  /** Random uuid plus the detected extension; also the public path `/media/<filename>`. */
  @Column({ unique: true })
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  /** Bytes. */
  @Column()
  size: number;
}
