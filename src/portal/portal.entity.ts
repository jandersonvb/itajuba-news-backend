import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('portals')
export class Portal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;
}
