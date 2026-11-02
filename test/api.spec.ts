import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataType, newDb } from 'pg-mem';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Article } from '../src/articles/article.entity';
import { AuthService } from '../src/auth/auth.service';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { User } from '../src/auth/user.entity';
import { Campaign } from '../src/campaigns/campaign.entity';
import { Category } from '../src/categories/category.entity';
import { productionConfigProblems } from '../src/config';
import { DatabaseModule } from '../src/database/database.module';
import { entities } from '../src/database/entities';
import { MailMessage, MailService } from '../src/mail/mail.service';
import { migrations } from '../src/database/migrations';
import { Portal } from '../src/portal/portal.entity';
import { Sponsor } from '../src/sponsors/sponsor.entity';

const internalKey = 'test-internal-key-0123456789abcdef';
/** Token of the "criar minha senha" link in an invitation e-mail. */
const inviteToken = (mail: MailMessage) => /convite\?token=([A-Za-z0-9_-]{43})/.exec(mail.text)?.[1] ?? '';
const mediaDir = mkdtempSync(join(tmpdir(), 'itajuba-media-'));
process.env.MEDIA_DIR = mediaDir;
process.env.INTERNAL_API_KEY = internalKey;
process.env.JWT_SECRET = 'test-only-secret-32-characters-long';
process.env.PORTAL_SLUG = 'itajuba-news';

/** Real PostgreSQL when TEST_DATABASE_URL is set (CI), otherwise pg-mem. */
async function createDataSource(): Promise<DataSource> {
  const options = { type: 'postgres' as const, entities, migrations, synchronize: false };
  if (process.env.TEST_DATABASE_URL) return new DataSource({ ...options, url: process.env.TEST_DATABASE_URL });
  const mem = newDb();
  mem.public.registerFunction({ name: 'current_database', returns: DataType.text, implementation: () => 'test' });
  mem.public.registerFunction({ name: 'version', returns: DataType.text, implementation: () => 'PostgreSQL 17' });
  for (const name of ['gen_random_uuid', 'uuid_generate_v4'])
    mem.public.registerFunction({ name, returns: DataType.uuid, implementation: randomUUID, impure: true });
  return mem.adapters.createTypeormDataSource(options);
}

describe('API integrada — PostgreSQL (pg-mem como fallback local)', () => {
  let app: INestApplication, db: DataSource, portal: Portal, other: Portal, category: Category, token: string;
  /** E-mails the API would have sent. */
  const sentMail: MailMessage[] = [];
  const password = 'Strong-integration-password!';
  const api = () => request(app.getHttpServer());
  const bearer = () => 'Bearer ' + token;

  beforeAll(async () => {
    db = await createDataSource();
    await db.initialize();
    await db.runMigrations();
    portal = await db.getRepository(Portal).save({ slug: 'itajuba-news', name: 'Itajubá News' });
    other = await db.getRepository(Portal).save({ slug: 'other', name: 'Outro' });
    category = await db.getRepository(Category).save({ portalId: portal.id, name: 'Cidade', slug: 'cidade' });
    await db.getRepository(User).save({
      portalId: portal.id,
      email: 'admin@example.com',
      passwordHash: hashPassword(password),
      passwordSetAt: new Date(),
      active: true,
    });

    // The whole AppModule, with only the database connection swapped.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(TypeOrmModule.forRootAsync({ useFactory: () => ({}), dataSourceFactory: async () => db }))
      .overrideProvider(MailService)
      .useValue({ send: async (message: MailMessage) => (sentMail.push(message), true) })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();

    const login = await api().post('/api/auth/login').send({ email: 'admin@example.com', password }).expect(201);
    token = login.body.accessToken;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
    if (db?.isInitialized) await db.destroy();
    rmSync(mediaDir, { recursive: true, force: true });
  });

  it('armazena senha com salt e rejeita senha errada', () => {
    const hash = hashPassword(password);
    expect(hash).not.toContain(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword('incorrect', hash)).toBe(false);
  });

  it('protege o painel e rejeita token inválido', async () => {
    await api().get('/api/admin/articles').expect(401);
    await api().get('/api/admin/articles').set('Authorization', 'Bearer invalid').expect(401);
  });

  it('não permite escolher portal pelo corpo da requisição', async () => {
    await api()
      .post('/api/admin/articles')
      .set('Authorization', bearer())
      .send({
        title: 'Notícia válida',
        slug: 'titulo-noticia',
        excerpt: 'Resumo de uma matéria de exemplo.',
        content: 'Conteúdo completo para testar a publicação.',
        categoryId: category.id,
        status: 'draft',
        portalId: other.id,
      })
      .expect(400);
  });

  it('publica, busca e retira matéria do ar, sem expor rascunhos', async () => {
    const create = await api()
      .post('/api/admin/articles')
      .set('Authorization', bearer())
      .send({
        title: 'Notícia teste de Itajubá',
        slug: 'noticia-teste',
        excerpt: 'Resumo suficiente para a matéria de teste.',
        content: 'Texto de uma matéria de teste suficientemente longo.',
        categoryId: category.id,
        status: 'draft',
      })
      .expect(201);
    await api().get('/api/articles/noticia-teste').expect(404);

    await api()
      .patch('/api/admin/articles/' + create.body.id)
      .set('Authorization', bearer())
      .send({ status: 'published' })
      .expect(200);
    const publicRead = await api().get('/api/articles/noticia-teste').expect(200);
    expect(publicRead.body.publishedAt).toBeTruthy();
    const search = await api().get('/api/articles?search=Itajubá').expect(200);
    expect(search.body.total).toBe(1);

    await api()
      .patch('/api/admin/articles/' + create.body.id)
      .set('Authorization', bearer())
      .send({ status: 'draft' })
      .expect(200);
    await api().get('/api/articles/noticia-teste').expect(404);
  });

  it('impede leitura e edição de registros de outro portal', async () => {
    const foreign = await db.getRepository(Article).save({
      portalId: other.id,
      title: 'Matéria externa',
      slug: 'externa',
      excerpt: 'Resumo externo',
      content: 'Conteúdo externo',
      categoryId: category.id,
      status: 'published',
      publishedAt: new Date(),
    });
    await api().get('/api/articles/externa').expect(404);
    await api()
      .patch('/api/admin/articles/' + foreign.id)
      .set('Authorization', bearer())
      .send({ title: 'Tentativa de alteração' })
      .expect(404);
    const foreignToken = await app.get(JwtService).signAsync({ sub: randomUUID(), portalId: other.id, ver: 0 });
    await api()
      .get('/api/admin/articles')
      .set('Authorization', 'Bearer ' + foreignToken)
      .expect(401);
  });

  it('valida categoria do portal e rejeita slug duplicado', async () => {
    const foreignCategory = await db.getRepository(Category).save({ portalId: other.id, name: 'Outra', slug: 'outra' });
    const payload = {
      title: 'Notícia de teste',
      slug: 'slug-unico',
      excerpt: 'Resumo da notícia para teste.',
      content: 'Texto suficientemente longo para a notícia.',
      categoryId: foreignCategory.id,
      status: 'draft',
    };
    await api().post('/api/admin/articles').set('Authorization', bearer()).send(payload).expect(400);
    payload.categoryId = category.id;
    await api().post('/api/admin/articles').set('Authorization', bearer()).send(payload).expect(201);
    await api().post('/api/admin/articles').set('Authorization', bearer()).send(payload).expect(409);
  });

  it('mostra apenas campanhas no período válido de patrocinador ativo', async () => {
    const sponsor = await db
      .getRepository(Sponsor)
      .save({ portalId: portal.id, name: 'Empresa teste', websiteUrl: 'https://example.com', active: true });
    const now = Date.now();
    const banner = {
      portalId: portal.id,
      sponsorId: sponsor.id,
      slot: 'leaderboard' as const,
      imageUrl: 'https://example.com/banner.png',
      targetUrl: 'https://example.com',
      active: true,
    };
    await db.getRepository(Campaign).save({
      ...banner,
      name: 'Campanha ativa',
      startsAt: new Date(now - 3600000),
      endsAt: new Date(now + 3600000),
    });
    await db.getRepository(Campaign).save({
      ...banner,
      name: 'Campanha expirada',
      startsAt: new Date(now - 7200000),
      endsAt: new Date(now - 3600000),
    });
    let r = await api().get('/api/campaigns?slot=leaderboard').expect(200);
    expect(r.body).toHaveLength(1);
    await db.getRepository(Sponsor).update(sponsor.id, { active: false });
    r = await api().get('/api/campaigns?slot=leaderboard').expect(200);
    expect(r.body).toHaveLength(0);
  });

  it('rejeita URL executável e período invertido', async () => {
    await api()
      .post('/api/admin/sponsors')
      .set('Authorization', bearer())
      .send({ name: 'Empresa', websiteUrl: 'javascript:alert(1)' })
      .expect(400);
    const sponsor = await db.getRepository(Sponsor).findOneByOrFail({ portalId: portal.id });
    await api()
      .post('/api/admin/campaigns')
      .set('Authorization', bearer())
      .send({
        name: 'Invertida',
        sponsorId: sponsor.id,
        slot: 'sidebar',
        imageUrl: 'https://example.com/banner.png',
        targetUrl: 'https://example.com',
        startsAt: '2026-10-10T00:00:00Z',
        endsAt: '2026-10-09T00:00:00Z',
      })
      .expect(400);
  });

  it('só exclui patrocinador depois de excluir suas campanhas', async () => {
    const sponsor = await db.getRepository(Sponsor).findOneByOrFail({ portalId: portal.id });
    await api()
      .delete('/api/admin/sponsors/' + sponsor.id)
      .set('Authorization', bearer())
      .expect(409);
    for (const campaign of await db.getRepository(Campaign).findBy({ sponsorId: sponsor.id }))
      await api()
        .delete('/api/admin/campaigns/' + campaign.id)
        .set('Authorization', bearer())
        .expect(200);
    await api()
      .delete('/api/admin/sponsors/' + sponsor.id)
      .set('Authorization', bearer())
      .expect(200);
  });

  it('exige consentimento e mantém leads privados', async () => {
    const dto = {
      name: 'Empresa teste',
      email: 'contato@example.com',
      interest: 'Banner premium',
      message: 'Gostaria de receber uma proposta comercial.',
      consent: false,
    };
    await api().post('/api/leads').send(dto).expect(400);
    await api()
      .post('/api/leads')
      .send({ ...dto, consent: true })
      .expect(201);
    await api().get('/api/admin/leads').expect(401);
    const r = await api().get('/api/admin/leads').set('Authorization', bearer()).expect(200);
    expect(r.body).toHaveLength(1);
  });

  it('avisa por e-mail os administradores ativos sobre um pedido comercial', async () => {
    const users = db.getRepository(User);
    const pending = await users.save({ portalId: portal.id, email: 'pendente@example.com', passwordHash: 'x' });
    const inactive = await users.save({
      portalId: portal.id,
      email: 'inativo-admin@example.com',
      passwordHash: 'x',
      passwordSetAt: new Date(),
      active: false,
    });
    const isLeadMail = (m: MailMessage) => m.subject.startsWith('Novo pedido comercial');
    const before = sentMail.filter(isLeadMail).length;
    await api()
      .post('/api/leads')
      .set({ 'x-internal-key': internalKey, 'x-client-ip': '198.51.100.60' })
      .send({
        name: 'Padaria Central',
        email: 'compras@padaria.example.com',
        interest: 'Banner\nlateral',
        message: 'Queremos anunciar a promoção de fim de ano.',
        consent: true,
      })
      .expect(201);
    // The e-mail leaves after the response.
    for (let i = 0; i < 100 && sentMail.filter(isLeadMail).length === before; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    const mails = sentMail.filter(isLeadMail).slice(before);
    expect(mails.map((m) => m.to)).toEqual(['admin@example.com']);
    expect(mails[0]).toMatchObject({
      subject: 'Novo pedido comercial: Banner lateral',
      replyTo: 'compras@padaria.example.com',
    });
    expect(mails[0].text).toContain('Queremos anunciar a promoção de fim de ano.');
    expect(mails[0].text).toContain('/admin?aba=leads');
    await users.delete([pending.id, inactive.id]);
  });

  it('mantém a sessão do painel por um dia de trabalho', async () => {
    const login = await api()
      .post('/api/auth/login')
      .set({ 'x-internal-key': internalKey, 'x-client-ip': '198.51.100.61' })
      .send({ email: 'admin@example.com', password })
      .expect(201);
    expect(login.body.expiresIn).toBe(12 * 60 * 60);
    const claims = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString());
    expect(claims.exp - claims.iat).toBe(12 * 60 * 60);
  });

  it('valida paginação e não expõe hash de senha', async () => {
    await api().get('/api/articles?page=-1').expect(400);
    const user = await db.getRepository(User).findOneByOrFail({ portalId: portal.id });
    expect(user.passwordHash).toBeUndefined();
  });

  it('lista só patrocinadores ativos, com os campos públicos', async () => {
    const sponsors = db.getRepository(Sponsor);
    await sponsors.save({ portalId: portal.id, name: 'Ativo', websiteUrl: 'https://example.com', active: true });
    await sponsors.save({ portalId: portal.id, name: 'Inativo', websiteUrl: 'https://example.com', active: false });
    await sponsors.save({ portalId: other.id, name: 'Outro portal', websiteUrl: 'https://example.com', active: true });
    const r = await api().get('/api/sponsors').expect(200);
    expect(r.body.map((s: Sponsor) => s.name)).toEqual(['Ativo']);
    expect(Object.keys(r.body[0]).sort()).toEqual(['id', 'logoUrl', 'name', 'websiteUrl']);
  });

  it('inclui a editoria nas notícias públicas', async () => {
    await api()
      .post('/api/admin/articles')
      .set('Authorization', bearer())
      .send({
        title: 'Notícia com editoria',
        slug: 'com-editoria',
        excerpt: 'Resumo da notícia com editoria.',
        content: 'Texto suficientemente longo para a notícia.',
        categoryId: category.id,
        status: 'published',
      })
      .expect(201);
    const expected = { id: category.id, name: 'Cidade', slug: 'cidade' };
    const list = await api().get('/api/articles').expect(200);
    expect(list.body.items[0].category).toEqual(expected);
    const one = await api().get('/api/articles/com-editoria').expect(200);
    expect(one.body.category).toEqual(expected);
  });

  it('marca a matéria como atualizada só quando o texto muda', async () => {
    const created = await api()
      .post('/api/admin/articles')
      .set('Authorization', bearer())
      .send({
        title: 'Matéria que será atualizada',
        slug: 'atualizada',
        excerpt: 'Resumo da matéria que será atualizada.',
        content: 'Texto original suficientemente longo.',
        categoryId: category.id,
        status: 'draft',
      })
      .expect(201);
    const edit = (changes: object) =>
      api()
        .patch('/api/admin/articles/' + created.body.id)
        .set('Authorization', bearer())
        .send(changes)
        .expect(200);
    const published = await edit({ status: 'published' });
    expect(published.body.updatedAt).toBe(published.body.publishedAt);

    const past = new Date('2026-01-01T12:00:00Z');
    await db.getRepository(Article).update(created.body.id, { publishedAt: past, updatedAt: past });
    await edit({ featured: true, author: 'Outra Pessoa' });
    let read = await api().get('/api/articles/atualizada').expect(200);
    expect(read.body.updatedAt).toBe(past.toISOString());

    await edit({ content: 'Texto corrigido, também suficientemente longo.' });
    read = await api().get('/api/articles/atualizada').expect(200);
    expect(read.body.publishedAt).toBe(past.toISOString());
    expect(Date.parse(read.body.updatedAt)).toBeGreaterThan(past.getTime());
  });

  it('lista no sitemap só matérias publicadas do portal que não são exemplo', async () => {
    const save = (portalId: string, slug: string, extra: Partial<Article> = {}) =>
      db.getRepository(Article).save({
        portalId,
        slug,
        title: 'Matéria ' + slug,
        excerpt: 'Resumo para o sitemap.',
        content: 'Texto para o sitemap.',
        categoryId: category.id,
        status: 'published',
        publishedAt: new Date(),
        ...extra,
      });
    // One at a time: pg-mem rejects a multi-row insert that mixes DEFAULT and values in a column.
    await save(portal.id, 'no-sitemap');
    await save(portal.id, 'rascunho-sitemap', { status: 'draft', publishedAt: null });
    await save(portal.id, 'exemplo-sitemap', { demo: true });
    await save(other.id, 'outro-sitemap');
    const r = await api().get('/api/sitemap').expect(200);
    const slugs = r.body.map((a: Article) => a.slug);
    expect(slugs).toContain('no-sitemap');
    for (const hidden of ['rascunho-sitemap', 'exemplo-sitemap', 'outro-sitemap']) expect(slugs).not.toContain(hidden);
    expect(Object.keys(r.body[0]).sort()).toEqual(['publishedAt', 'slug', 'title', 'updatedAt']);
  });

  it('em produção, só atende quem tem a chave interna, menos o health check e as imagens', async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await api().get('/api/categories').expect(403);
      await api().get('/api/categories').set('x-internal-key', 'chave-errada').expect(403);
      await api().get('/api/categories').set('x-internal-key', internalKey).expect(200);
      await api().post('/api/auth/login').send({ email: 'admin@example.com', password }).expect(403);
      await api().get('/api/health').expect(200);
      await api().get('/api/media/00000000-0000-0000-0000-000000000000.png').expect(404);
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  });

  it('informa no health check se o banco responde', async () => {
    const r = await api().get('/api/health').expect(200);
    expect(r.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('gerencia editorias pelo painel, em ordem de menu', async () => {
    await api().post('/api/admin/categories').send({ name: 'Turismo', slug: 'turismo' }).expect(401);
    const created = await api()
      .post('/api/admin/categories')
      .set('Authorization', bearer())
      .send({ name: 'Turismo', slug: 'turismo', position: 8 })
      .expect(201);
    await api()
      .post('/api/admin/categories')
      .set('Authorization', bearer())
      .send({ name: 'Repetida', slug: 'turismo' })
      .expect(409);
    await api()
      .patch('/api/admin/categories/' + created.body.id)
      .set('Authorization', bearer())
      .send({ name: 'Turismo & lazer' })
      .expect(200);
    const menu = await api().get('/api/categories').expect(200);
    expect(menu.body.map((c: Category) => c.slug)).toEqual(['cidade', 'turismo']);
    expect(menu.body[1].name).toBe('Turismo & lazer');

    await api()
      .delete('/api/admin/categories/' + category.id)
      .set('Authorization', bearer())
      .expect(409);
    await api()
      .delete('/api/admin/categories/' + created.body.id)
      .set('Authorization', bearer())
      .expect(200);
  });

  it('envia, serve e protege imagens', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await api().post('/api/admin/media').attach('file', png, 'foto.png').expect(401);
    await api()
      .post('/api/admin/media')
      .set('Authorization', bearer())
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'falsa.png', contentType: 'image/png' })
      .expect(400);
    const upload = await api()
      .post('/api/admin/media')
      .set('Authorization', bearer())
      .attach('file', png, { filename: 'Praça Theodomiro.png', contentType: 'image/png' })
      .expect(201);
    expect(upload.body.url).toMatch(/^\/media\/[0-9a-f-]{36}\.png$/);
    expect(upload.body.originalName).toBe('Praça Theodomiro.png');

    const served = await api()
      .get('/api' + upload.body.url)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toContain('immutable');
    expect(served.headers['x-ratelimit-limit']).toBeUndefined();
    expect(Buffer.compare(served.body, png)).toBe(0);
    await api().get('/api/media/..%2F..%2Fpackage.json').expect(404);

    const article = await db.getRepository(Article).findOneByOrFail({ slug: 'com-editoria' });
    const setImage = (imageUrl: string) =>
      api()
        .patch('/api/admin/articles/' + article.id)
        .set('Authorization', bearer())
        .send({ imageUrl });
    await setImage('/media/../../etc/passwd').expect(400);
    await setImage(upload.body.url).expect(200);
    await api()
      .delete('/api/admin/media/' + upload.body.id)
      .set('Authorization', bearer())
      .expect(409);
    await setImage('https://example.com/foto.jpg').expect(200);
    await api()
      .delete('/api/admin/media/' + upload.body.id)
      .set('Authorization', bearer())
      .expect(200);
    await api()
      .get('/api' + upload.body.url)
      .expect(404);
    expect(existsSync(join(mediaDir, upload.body.filename))).toBe(false);
  });

  it('não limita leituras internas sem IP do visitante e ignora chave inválida', async () => {
    const internal = await api().get('/api/health').set('x-internal-key', internalKey).expect(200);
    expect(internal.headers['x-ratelimit-limit']).toBeUndefined();
    const forged = await api()
      .get('/api/health')
      .set('x-internal-key', 'wrong-key')
      .set('x-client-ip', '203.0.113.5')
      .expect(200);
    expect(forged.headers['x-ratelimit-limit']).toBe('120');
  });

  it('limita o login por IP do visitante encaminhado pelo frontend', async () => {
    const attempt = (ip: string) =>
      api()
        .post('/api/auth/login')
        .set('x-internal-key', internalKey)
        .set('x-client-ip', ip)
        .send({ email: 'admin@example.com', password: 'wrong-password-123' });
    for (let i = 0; i < 5; i++) expect((await attempt('198.51.100.1')).status).toBe(401);
    expect((await attempt('198.51.100.1')).status).toBe(429);
    expect((await attempt('198.51.100.2')).status).toBe(401);
  });

  it('convida o primeiro administrador pelo ADMIN_EMAIL, e só quem recebe o e-mail cria a senha', async () => {
    const auth = app.get(AuthService);
    const visitor = { 'x-internal-key': internalKey, 'x-client-ip': '198.51.100.30' };
    const status = async () => (await api().get('/api/auth/setup').expect(200)).body;
    const lastInvite = () => sentMail.filter((m) => m.subject.startsWith('Convite')).at(-1) as MailMessage;
    const info = (token: string) => api().get('/api/auth/invite').query({ token });
    const accept = (body: object) => api().post('/api/auth/accept-invite').set(visitor).send(body);

    expect(await status()).toEqual({ state: 'ready' });

    const fresh = await db.getRepository(Portal).save({ slug: 'portal-novo', name: 'Portal Novo' });
    // The local .env may define the admin; this test sets its own.
    const { ADMIN_EMAIL, ADMIN_NAME } = process.env;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_NAME;
    process.env.PORTAL_SLUG = fresh.slug;
    try {
      // Without ADMIN_EMAIL there is nothing to invite, and nothing to claim from the browser.
      await auth.onApplicationBootstrap();
      expect(await status()).toEqual({ state: 'unconfigured' });

      process.env.ADMIN_EMAIL = 'Chefe@Example.com';
      process.env.ADMIN_NAME = 'Chefe de Redação';
      await auth.onApplicationBootstrap();
      expect(await status()).toEqual({ state: 'invited', email: 'ch•••@example.com' });
      const first = lastInvite();
      expect(first).toMatchObject({ to: 'chefe@example.com', subject: 'Convite para a redação do Portal Novo' });
      expect(first.html).toContain('Criar minha senha');

      // A corrected ADMIN_EMAIL moves the invitation; the old link stops working.
      process.env.ADMIN_EMAIL = 'diretoria@example.com';
      await auth.onApplicationBootstrap();
      const moved = lastInvite();
      expect(moved.to).toBe('diretoria@example.com');
      await info(inviteToken(first)).expect(400);

      // "Reenviar convite" on the login: a new link replaces the previous one.
      await api().post('/api/auth/setup/resend').set(visitor).expect(204);
      const resent = lastInvite();
      expect(resent).not.toBe(moved);
      await info(inviteToken(moved)).expect(400);
      expect((await info(inviteToken(resent)).expect(200)).body).toEqual({
        name: 'Chefe de Redação',
        email: 'diretoria@example.com',
        role: 'admin',
      });

      await accept({ token: inviteToken(resent), password: 'curta' }).expect(400);
      const session = await accept({
        token: inviteToken(resent),
        password: 'Chefe-password-123!',
        name: 'Chefe',
      }).expect(201);
      const me = await api()
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ' + session.body.accessToken)
        .expect(200);
      expect(me.body).toMatchObject({ name: 'Chefe', email: 'diretoria@example.com', role: 'admin' });
      expect(await status()).toEqual({ state: 'ready' });
      await accept({ token: inviteToken(resent), password: 'Chefe-password-123!' }).expect(400);

      // Ready: neither a restart nor "reenviar" sends anything else.
      const sent = sentMail.length;
      await auth.onApplicationBootstrap();
      await api().post('/api/auth/setup/resend').set(visitor).expect(204);
      expect(sentMail.length).toBe(sent);
    } finally {
      process.env.PORTAL_SLUG = 'itajuba-news';
      Object.assign(process.env, { ADMIN_EMAIL, ADMIN_NAME });
      if (ADMIN_EMAIL === undefined) delete process.env.ADMIN_EMAIL;
      if (ADMIN_NAME === undefined) delete process.env.ADMIN_NAME;
    }
  });

  it('redefine a senha pelo link do e-mail uma única vez, sem revelar quem tem conta', async () => {
    const oldPassword = 'Forgotten-password-123!';
    const newPassword = 'Recovered-password-456!';
    const users = db.getRepository(User);
    await users.save([
      { portalId: portal.id, email: 'redacao@example.com', passwordHash: hashPassword(oldPassword), active: true },
      { portalId: portal.id, email: 'inativo@example.com', passwordHash: hashPassword(oldPassword), active: false },
    ]);
    const visitor = (ip: number) => ({ 'x-internal-key': internalKey, 'x-client-ip': '203.0.113.' + ip });
    const forgot = (email: string) => api().post('/api/auth/forgot-password').set(visitor(1)).send({ email });
    const reset = (resetToken: string, pass = newPassword) =>
      api().post('/api/auth/reset-password').set(visitor(2)).send({ token: resetToken, password: pass });
    const login = (pass: string) =>
      api().post('/api/auth/login').set(visitor(3)).send({ email: 'redacao@example.com', password: pass });
    const tokenFromMail = () => /redefinir-senha\?token=([\w-]{43})$/m.exec(sentMail.at(-1)!.text)![1];
    // Earlier tests send invitations; this one counts only its own e-mails.
    sentMail.length = 0;

    for (const email of ['ninguem@example.com', 'inativo@example.com']) {
      const r = await forgot(email).expect(204);
      expect(r.text).toBe('');
    }
    expect(sentMail).toEqual([]);

    await forgot('Redacao@Example.com').expect(204);
    expect(sentMail).toHaveLength(1);
    expect(sentMail[0].to).toBe('redacao@example.com');
    expect(sentMail[0].text).toContain('http://localhost:3000/admin/redefinir-senha?token=');
    const resetToken = tokenFromMail();
    const stored = await users.findOneOrFail({
      where: { email: 'redacao@example.com' },
      select: { id: true, passwordResetHash: true },
    });
    expect(stored.passwordResetHash).toMatch(/^[0-9a-f]{64}$/);

    const session = (await login(oldPassword).expect(201)).body.accessToken;
    await reset(resetToken, 'curta').expect(400);
    await reset('x'.repeat(43)).expect(400);
    expect((await reset(resetToken).expect(200)).body).toEqual({ updated: true });
    await api()
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ' + session)
      .expect(401);
    await reset(resetToken, 'Third-password-789!').expect(400);
    await login(oldPassword).expect(401);
    await login(newPassword).expect(201);

    await forgot('redacao@example.com').expect(204);
    await users.update({ id: stored.id }, { passwordResetExpiresAt: new Date(Date.now() - 1000) });
    await reset(tokenFromMail()).expect(400);
  });

  describe('usuários e perfis', () => {
    const staffPassword = 'Staff-integration-password!';
    let editor: string, reporter: string, reporterId: string;
    /** Each login from its own visitor IP, so the 5-per-minute login limit does not get in the way. */
    const loginAs = async (email: string, pass = staffPassword) => {
      const r = await api()
        .post('/api/auth/login')
        .set('x-internal-key', internalKey)
        .set('x-client-ip', '192.0.2.' + Math.floor(Math.random() * 250 + 1))
        .send({ email, password: pass });
      return r.status === 201 ? (r.body.accessToken as string) : r.status;
    };
    const as = (t: string) => 'Bearer ' + t;
    const draft = (slug: string) => ({
      title: 'Pauta do repórter',
      slug,
      excerpt: 'Resumo da pauta do repórter.',
      content: 'Texto suficientemente longo para a pauta.',
      categoryId: category.id,
      status: 'draft',
    });

    beforeAll(async () => {
      const create = (email: string, role: string) =>
        api()
          .post('/api/admin/users')
          .set('Authorization', bearer())
          .send({ name: 'Equipe ' + role, email, role, password: staffPassword })
          .expect(201);
      await create('Editora@Example.com', 'editor');
      reporterId = (await create('reporter@example.com', 'reporter')).body.id;
      editor = (await loginAs('editora@example.com')) as string;
      reporter = (await loginAs('reporter@example.com')) as string;
    });

    it('cadastra usuários sem expor senha e recusa e-mail repetido', async () => {
      const list = await api().get('/api/admin/users').set('Authorization', bearer()).expect(200);
      expect(list.body.map((u: User) => u.email)).toEqual(
        expect.arrayContaining(['admin@example.com', 'editora@example.com', 'reporter@example.com']),
      );
      for (const user of list.body)
        expect(Object.keys(user).sort()).toEqual([
          'active',
          'createdAt',
          'email',
          'id',
          'inviteExpiresAt',
          'name',
          'pending',
          'role',
        ]);
      await api()
        .post('/api/admin/users')
        .set('Authorization', bearer())
        .send({ name: 'Repetido', email: 'reporter@example.com', role: 'editor', password: staffPassword })
        .expect(409);
      const me = await api().get('/api/auth/me').set('Authorization', as(reporter)).expect(200);
      expect(me.body).toMatchObject({ email: 'reporter@example.com', role: 'reporter', name: 'Equipe reporter' });
    });

    it('convida por e-mail quem é cadastrado sem senha', async () => {
      const users = () => api().get('/api/admin/users').set('Authorization', bearer());
      const created = await api()
        .post('/api/admin/users')
        .set('Authorization', bearer())
        .send({ name: 'Nova Repórter', email: 'Nova@Example.com', role: 'reporter' })
        .expect(201);
      expect(created.body).toMatchObject({ email: 'nova@example.com', pending: true, inviteSent: true });
      const invite = sentMail.at(-1) as MailMessage;
      expect(invite).toMatchObject({ to: 'nova@example.com', subject: 'Convite para a redação do Itajubá News' });
      expect(invite.text).toContain('como repórter');
      // No password yet: the account cannot sign in.
      expect(await loginAs('nova@example.com', 'qualquer-senha-123')).toBe(401);

      const listed = (await users()).body.find((u: { id: string }) => u.id === created.body.id);
      expect(listed.pending).toBe(true);
      expect(new Date(listed.inviteExpiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60_000);

      // A corrected e-mail cancels the old link and sends a new invitation.
      const corrected = await api()
        .patch('/api/admin/users/' + created.body.id)
        .set('Authorization', bearer())
        .send({ email: 'nova.reporter@example.com' })
        .expect(200);
      expect(corrected.body.inviteSent).toBe(true);
      await api()
        .get('/api/auth/invite')
        .query({ token: inviteToken(invite) })
        .expect(400);

      const resend = () =>
        api()
          .post('/api/admin/users/' + created.body.id + '/invite')
          .set('Authorization', bearer());
      await resend().expect(200);
      const latest = sentMail.at(-1) as MailMessage;
      expect(latest.to).toBe('nova.reporter@example.com');
      await api()
        .post('/api/auth/accept-invite')
        .set({ 'x-internal-key': internalKey, 'x-client-ip': '198.51.100.40' })
        .send({ token: inviteToken(latest), password: staffPassword })
        .expect(201);
      expect(typeof (await loginAs('nova.reporter@example.com'))).toBe('string');
      expect((await users()).body.find((u: { id: string }) => u.id === created.body.id).pending).toBe(false);
      await resend().expect(409);

      // Only admins invite.
      await api()
        .post('/api/admin/users')
        .set('Authorization', as(editor))
        .send({ name: 'Sem Permissão', email: 'sem@example.com', role: 'reporter' })
        .expect(403);
    });

    it('limita cada perfil às suas áreas', async () => {
      for (const path of ['users', 'sponsors', 'campaigns', 'leads'])
        await api()
          .get('/api/admin/' + path)
          .set('Authorization', as(editor))
          .expect(403);
      await api().get('/api/admin/categories').set('Authorization', as(editor)).expect(200);
      await api().get('/api/admin/categories').set('Authorization', as(reporter)).expect(403);
      await api().get('/api/admin/media').set('Authorization', as(reporter)).expect(200);
      await api()
        .delete('/api/admin/media/' + randomUUID())
        .set('Authorization', as(reporter))
        .expect(403);
    });

    it('deixa o repórter só com os próprios rascunhos', async () => {
      await api()
        .post('/api/admin/articles')
        .set('Authorization', as(reporter))
        .send({ ...draft('pauta-publicada'), status: 'published' })
        .expect(403);
      const own = await api()
        .post('/api/admin/articles')
        .set('Authorization', as(reporter))
        .send(draft('pauta-reporter'))
        .expect(201);
      expect(own.body.createdById).toBe(reporterId);

      const list = await api().get('/api/admin/articles').set('Authorization', as(reporter)).expect(200);
      expect(list.body.map((a: Article) => a.slug)).toEqual(['pauta-reporter']);
      const others = await db.getRepository(Article).findOneByOrFail({ slug: 'com-editoria' });
      await api()
        .patch('/api/admin/articles/' + others.id)
        .set('Authorization', as(reporter))
        .send({ title: 'Tentativa do repórter' })
        .expect(404);

      await api()
        .patch('/api/admin/articles/' + own.body.id)
        .set('Authorization', as(editor))
        .send({ status: 'published' })
        .expect(200);
      const published = await api().get('/api/articles/pauta-reporter').expect(200);
      expect(published.body.createdById).toBeUndefined();
      await api()
        .patch('/api/admin/articles/' + own.body.id)
        .set('Authorization', as(reporter))
        .send({ title: 'Mudança depois de publicada' })
        .expect(403);
      await api()
        .delete('/api/admin/articles/' + own.body.id)
        .set('Authorization', as(reporter))
        .expect(403);
    });

    it('impede o admin de tirar o próprio acesso', async () => {
      const admin = await db.getRepository(User).findOneByOrFail({ email: 'admin@example.com' });
      for (const change of [{ role: 'editor' }, { active: false }])
        await api()
          .patch('/api/admin/users/' + admin.id)
          .set('Authorization', bearer())
          .send(change)
          .expect(400);
    });

    it('aplica mudança de perfil na hora e encerra sessões ao redefinir senha', async () => {
      await api()
        .patch('/api/admin/users/' + reporterId)
        .set('Authorization', bearer())
        .send({ role: 'editor' })
        .expect(200);
      await api().get('/api/admin/categories').set('Authorization', as(reporter)).expect(200);

      await api()
        .patch('/api/admin/users/' + reporterId + '/password')
        .set('Authorization', bearer())
        .send({ password: 'curta' })
        .expect(400);
      const newPassword = 'Another-strong-password!';
      await api()
        .patch('/api/admin/users/' + reporterId + '/password')
        .set('Authorization', bearer())
        .send({ password: newPassword })
        .expect(200);
      await api().get('/api/auth/me').set('Authorization', as(reporter)).expect(401);
      expect(await loginAs('reporter@example.com')).toBe(401);
      const fresh = await loginAs('reporter@example.com', newPassword);
      await api()
        .get('/api/auth/me')
        .set('Authorization', as(fresh as string))
        .expect(200);

      await api()
        .patch('/api/admin/users/' + reporterId)
        .set('Authorization', bearer())
        .send({ active: false })
        .expect(200);
      await api()
        .get('/api/auth/me')
        .set('Authorization', as(fresh as string))
        .expect(401);
    });
  });
});

describe('configuração de produção e e-mail', () => {
  const keys = [
    'DATABASE_URL',
    'FRONTEND_ORIGIN',
    'INTERNAL_API_KEY',
    'SMTP_HOST',
    'RESEND_API_KEY',
    'MAIL_FROM',
    'ENABLE_DOCS',
    'NODE_ENV',
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of keys)
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
  });

  it('lista o que impede a API de iniciar em produção', () => {
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://localhost/db',
      FRONTEND_ORIGIN: 'http://localhost:3000',
      INTERNAL_API_KEY: 'curta',
    });
    delete process.env.SMTP_HOST;
    delete process.env.RESEND_API_KEY;
    const { errors, warnings } = productionConfigProblems();
    expect(errors.join(' ')).toMatch(/INTERNAL_API_KEY/);
    expect(errors.join(' ')).toMatch(/FRONTEND_ORIGIN/);
    expect(warnings.join(' ')).toMatch(/RESEND_API_KEY nem SMTP_HOST/);

    Object.assign(process.env, {
      FRONTEND_ORIGIN: 'https://itajubanews.com.br',
      INTERNAL_API_KEY: internalKey,
      RESEND_API_KEY: 're_test',
      ENABLE_DOCS: 'false',
    });
    delete process.env.MAIL_FROM;
    expect(productionConfigProblems().errors.join(' ')).toMatch(/MAIL_FROM/);
    process.env.MAIL_FROM = 'Itajubá News <nao-responda@example.com>';
    expect(productionConfigProblems()).toEqual({ errors: [], warnings: [] });
  });

  it('envia pela API do Resend quando RESEND_API_KEY está definida', async () => {
    Object.assign(process.env, { RESEND_API_KEY: 're_test', MAIL_FROM: 'Itajubá News <nao-responda@example.com>' });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{"message":"domain not verified"}', { status: 403 }));
    const mail = new MailService();
    const message = { to: 'pessoa@example.com', subject: 'Assunto', text: 'Texto', html: '<p>Texto</p>' };

    expect(await mail.send(message)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init?.body as string)).toEqual({
      from: 'Itajubá News <nao-responda@example.com>',
      to: ['pessoa@example.com'],
      subject: 'Assunto',
      text: 'Texto',
      html: '<p>Texto</p>',
    });

    await expect(mail.send(message)).rejects.toThrow(/Resend respondeu 403/);
  });

  it('não escreve e-mails no log em produção sem provedor', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    process.env.NODE_ENV = 'production';
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    expect(await new MailService().send({ to: 'pessoa@example.com', subject: 'Convite', text: 'token secreto' })).toBe(
      false,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
