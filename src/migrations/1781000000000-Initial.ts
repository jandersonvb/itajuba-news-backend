import { MigrationInterface, QueryRunner } from 'typeorm';
export class Initial1781000000000 implements MigrationInterface {
 async up(q:QueryRunner){
 await q.query(`CREATE TABLE portals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug varchar NOT NULL UNIQUE, name varchar NOT NULL)`);
 const base=`id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "portalId" varchar NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()`;
 await q.query(`CREATE TABLE users (${base}, email varchar NOT NULL, "passwordHash" varchar NOT NULL, active boolean NOT NULL DEFAULT true, UNIQUE("portalId",email))`);
 await q.query(`CREATE TABLE categories (${base}, name varchar NOT NULL, slug varchar NOT NULL, UNIQUE("portalId",slug))`);
 await q.query(`CREATE TABLE articles (${base}, title varchar NOT NULL, slug varchar NOT NULL, excerpt text NOT NULL, content text NOT NULL, "categoryId" varchar NOT NULL, "imageUrl" varchar NOT NULL DEFAULT '', author varchar NOT NULL DEFAULT 'Redação Itajubá News', status varchar NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')), "publishedAt" timestamptz, featured boolean NOT NULL DEFAULT false, demo boolean NOT NULL DEFAULT false, UNIQUE("portalId",slug))`);
 await q.query(`CREATE TABLE sponsors (${base}, name varchar NOT NULL, "logoUrl" varchar NOT NULL DEFAULT '', "websiteUrl" varchar NOT NULL, active boolean NOT NULL DEFAULT true)`);
 await q.query(`CREATE TABLE campaigns (${base}, name varchar NOT NULL, "sponsorId" varchar NOT NULL, slot varchar NOT NULL CHECK (slot IN ('leaderboard','sidebar')), "imageUrl" varchar NOT NULL, "targetUrl" varchar NOT NULL, "startsAt" timestamptz NOT NULL, "endsAt" timestamptz NOT NULL, active boolean NOT NULL DEFAULT true, CHECK ("endsAt">"startsAt"))`);
 await q.query(`CREATE TABLE leads (${base}, name varchar NOT NULL, email varchar NOT NULL, interest varchar NOT NULL, message text NOT NULL, consent boolean NOT NULL DEFAULT false)`);
 await q.query(`CREATE INDEX article_public_idx ON articles ("portalId",status,"publishedAt")`);
 }
 async down(q:QueryRunner){for(const t of ['leads','campaigns','sponsors','articles','categories','users','portals'])await q.query(`DROP TABLE ${t}`);}
}
