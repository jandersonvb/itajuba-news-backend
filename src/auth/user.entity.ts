import { Check, Column, Entity, Unique } from 'typeorm';
import { PortalScopedEntity } from '../common/portal-scoped.entity';

/**
 * - `admin`: everything, including users, sponsors, campaigns and leads.
 * - `editor`: articles of anyone (publishing included), categories and media.
 * - `reporter`: only their own articles, always as drafts; can upload images.
 */
export const USER_ROLES = ['admin', 'editor', 'reporter'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity('users')
@Unique('users_portalId_email_key', ['portalId', 'email'])
@Check('users_role_check', `role IN ('admin', 'editor', 'reporter')`)
export class User extends PortalScopedEntity {
  @Column()
  email: string;

  @Column({ default: '' })
  name: string;

  @Column({ default: 'admin' })
  role: UserRole;

  @Column({ select: false })
  passwordHash: string;

  /** Signed into the JWT; a password reset increments it, which ends the open sessions. */
  @Column({ default: 0 })
  sessionVersion: number;

  /** SHA-256 of the pending "forgot password" token; the token itself only goes in the e-mail. */
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordResetHash: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetExpiresAt: Date | null;

  /** When the user last chose a password; null while their invitation is pending. */
  @Column({ type: 'timestamptz', nullable: true })
  passwordSetAt: Date | null;

  @Column({ default: true })
  active: boolean;
}
