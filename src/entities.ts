import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
export abstract class RecordBase {
 @PrimaryGeneratedColumn('uuid') id: string;
 @Column() portalId: string;
 @CreateDateColumn({type:'timestamptz'}) createdAt: Date;
}
@Entity('portals') export class Portal {
 @PrimaryGeneratedColumn('uuid') id: string;
 @Column({unique:true}) slug: string;
 @Column() name: string;
}
@Entity('users') @Index(['portalId','email'],{unique:true}) export class User extends RecordBase {
 @Column() email: string;
 @Column({select:false}) passwordHash: string;
 @Column({default:true}) active: boolean;
}
@Entity('categories') @Index(['portalId','slug'],{unique:true}) export class Category extends RecordBase {
 @Column() name: string;
 @Column() slug: string;
}
@Entity('articles') @Index(['portalId','slug'],{unique:true}) export class Article extends RecordBase {
 @Column() title: string;
 @Column() slug: string;
 @Column('text') excerpt: string;
 @Column('text') content: string;
 @Column() categoryId: string;
 @Column({default:''}) imageUrl: string;
 @Column({default:'Redação Itajubá News'}) author: string;
 @Column({default:'draft'}) status: 'draft'|'published';
 @Column({type:'timestamptz',nullable:true}) publishedAt: Date|null;
 @Column({default:false}) featured: boolean;
 @Column({default:false}) demo: boolean;
}
@Entity('sponsors') export class Sponsor extends RecordBase {
 @Column() name: string;
 @Column({default:''}) logoUrl: string;
 @Column() websiteUrl: string;
 @Column({default:true}) active: boolean;
}
@Entity('campaigns') export class Campaign extends RecordBase {
 @Column() name: string;
 @Column() sponsorId: string;
 @Column() slot: 'leaderboard'|'sidebar';
 @Column() imageUrl: string;
 @Column() targetUrl: string;
 @Column({type:'timestamptz'}) startsAt: Date;
 @Column({type:'timestamptz'}) endsAt: Date;
 @Column({default:true}) active: boolean;
}
@Entity('leads') export class Lead extends RecordBase {
 @Column() name: string;
 @Column() email: string;
 @Column() interest: string;
 @Column('text') message: string;
 @Column({default:false}) consent: boolean;
}
export const entities=[Portal,User,Category,Article,Sponsor,Campaign,Lead];
