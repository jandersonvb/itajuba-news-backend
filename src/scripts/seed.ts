import { Article } from '../articles/article.entity';
import { Category } from '../categories/category.entity';
import db from '../database/data-source';
import { Portal } from '../portal/portal.entity';

const CATEGORIES = [
  ['Cidade', 'cidade'],
  ['Política', 'politica'],
  ['Segurança', 'seguranca'],
  ['Economia', 'economia'],
  ['Esportes', 'esportes'],
  ['Cultura', 'cultura'],
  ['Região', 'regiao'],
];

const DEMO_ARTICLES = [
  ['Uma cidade, muitas histórias: um novo olhar para Itajubá', 'cidade', 'photo-1519608487953-e999c86e7455'],
  ['Comércio local: as pessoas por trás dos negócios da cidade', 'economia', 'photo-1556742049-0cfed4f6a45d'],
  ['Música e encontros: espaço para a agenda cultural', 'cultura', 'photo-1514525253161-7a46d19cd819'],
  ['Esporte de bairro: os talentos da nossa cidade', 'esportes', 'photo-1574629810360-7efbbe195018'],
];

/**
 * Creates the portal and, while it has none, the default categories. Safe to run on every deploy
 * (`start:prod` does): categories the newsroom renamed or deleted in the admin are left alone.
 * With SEED_DEMO=true it also adds sample articles (flagged `demo`), but only while the portal has
 * no articles at all.
 */
async function main() {
  await db.initialize();
  try {
    await db.transaction(async (m) => {
      const portalSlug = process.env.PORTAL_SLUG || 'itajuba-news';
      const portal =
        (await m.findOneBy(Portal, { slug: portalSlug })) ??
        (await m.save(Portal, { slug: portalSlug, name: 'Itajubá News' }));

      if (!(await m.countBy(Category, { portalId: portal.id })))
        for (const [index, [name, slug]] of CATEGORIES.entries())
          await m.save(Category, { portalId: portal.id, name, slug, position: index + 1 });

      if (process.env.SEED_DEMO !== 'true' || (await m.countBy(Article, { portalId: portal.id }))) return;
      const categories = await m.findBy(Category, { portalId: portal.id });
      for (const [index, [title, category, photo]] of DEMO_ARTICLES.entries())
        await m.save(Article, {
          portalId: portal.id,
          title,
          slug: `exemplo-${index + 1}`,
          excerpt: 'Conteúdo demonstrativo para apresentar o portal. Esta chamada não relata um acontecimento real.',
          content:
            'Esta é uma matéria de demonstração. Na operação real, a redação publicará conteúdo apurado, com autoria, fontes e imagens autorizadas.\n\nA fotografia é ilustrativa e não identifica um local de Itajubá. Exclua os exemplos antes de lançar o portal.',
          categoryId: categories.find((c) => c.slug === category)!.id,
          status: 'published',
          featured: index === 0,
          demo: true,
          publishedAt: new Date(),
          imageUrl: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1000&q=80`,
        });
    });
    console.log('Portal e categorias configurados. Exemplos somente quando SEED_DEMO=true.');
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
