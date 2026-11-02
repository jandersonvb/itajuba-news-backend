import { Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/** Base of every record that belongs to a portal (tenant). */
export abstract class PortalScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  portalId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
