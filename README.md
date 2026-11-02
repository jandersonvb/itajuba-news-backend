# Itajubá News — Backend

API NestJS independente com PostgreSQL. Frontend: https://github.com/jandersonvb/itajuba-news-frontend.

**Execute os comandos neste repositório.** Este README também descreve as capacidades do sistema integrado.

## O que funciona

- Home responsiva consumindo a API real; filtros por editoria, busca e paginação.
- Página de matéria com URL própria, título, resumo, texto, imagem, autoria e metadados sociais.
- Painel administrativo: login, criação/edição/exclusão de notícias e alternância rascunho/publicado.
- Vários usuários por portal, com perfis **Administrador** (tudo, incluindo usuários, patrocinadores, campanhas e pedidos), **Editor** (todas as notícias, publicação, editorias e mídia) e **Repórter** (só os próprios rascunhos e envio de imagens). O perfil é lido do banco a cada requisição: mudar ou desativar um usuário vale na hora, e redefinir a senha encerra as sessões abertas. Não há cadastro público: só um administrador cria contas.
- "Esqueci minha senha": o usuário recebe por e-mail um link de uso único, válido por 30 minutos. A resposta é a mesma para e-mails com e sem conta.
- Cadastro/edição/exclusão de patrocinadores e campanhas.
- Campanhas por posição (`leaderboard` ou `sidebar`), vigência e ativação. Exibe a campanha ativa mais recente do slot, desde que o patrocinador esteja ativo.
- Formulário comercial que grava pedidos no PostgreSQL e avisa por e-mail os administradores (o "Responder" vai para quem pediu). O painel permite consultar e excluir esses dados.
- Senhas com salt/scrypt; JWT com validade de 12 horas (desativar o usuário ou trocar a senha encerra a sessão na hora); sessão do frontend em cookie HttpOnly; verificação de origem nas mutações do frontend.
- Validação de DTOs, limitação de requisições, migrations, documentação Swagger opcional e CI.
- Escopo por portal em todas as operações implementadas, validado no servidor. A instalação atende **um portal configurado por vez**. Há base de dados para evolução SaaS, mas ainda não há gestão de tenants, domínios ou planos.

## Estrutura

Um módulo NestJS por domínio. Cada módulo tem entidade, DTOs, service e controllers; rotas do painel ficam em um `admin-*.controller.ts` separado, protegido por `@AdminOnly()` (só administradores) ou `@StaffOnly('admin', 'editor', ...)` (perfis listados; sem argumentos, qualquer perfil). `@Roles(...)` restringe uma rota dentro do controller, e `@CurrentStaff()` entrega `{ sub, portalId, role }`.

| Módulo | Rotas públicas | Rotas do painel | Usado no frontend por |
| --- | --- | --- | --- |
| `portal/` (global) | `GET /portal` | — | todos os módulos (portal atual via `PORTAL_SLUG`) |
| `health/` | `GET /health` | — | monitoramento |
| `auth/` | `POST /auth/login` | `GET /auth/me` | `/admin/login`, cabeçalho e abas do painel; exporta `AdminGuard` |
| `users/` | — | `/admin/users` (listar/criar/editar, `PATCH /:id/password`) | aba Usuários |
| `categories/` | `GET /categories` (ordem do menu) | `/admin/categories` | menu, busca por editoria, aba Editorias |
| `articles/` | `GET /articles`, `GET /articles/:slug`, `GET /sitemap` | `/admin/articles` | home, `/noticias/[slug]`, aba Notícias |
| `sponsors/` | `GET /sponsors` (ativos) | `/admin/sponsors` | "Quem apoia", aba Patrocinadores |
| `campaigns/` | `GET /campaigns?slot=` | `/admin/campaigns` | banners da home, aba Campanhas |
| `leads/` | `POST /leads` | `/admin/leads` (listar/excluir) | `/anuncie`, aba Pedidos comerciais |
| `media/` | `GET /media/:arquivo` | `/admin/media` (listar/enviar/excluir) | imagens de notícias, logos e banners |

Outras pastas: `common/` (entidade base por portal, rate limit, validações), `database/` (conexão, lista de entidades, migrations), `scripts/` (seed e criação de admin). `test/` sobe o `AppModule` inteiro com banco em memória (pg-mem) ou PostgreSQL real (`TEST_DATABASE_URL`).

### Criar um módulo novo

1. `src/<nome>/`: `<nome>.entity.ts` (estenda `PortalScopedEntity`), `dto/*.dto.ts`, `<nome>.service.ts`, controllers e `<nome>.module.ts` com `TypeOrmModule.forFeature([...])`. Importe `AuthModule` se houver rotas `@AdminOnly()`.
2. Registre a entidade em `src/database/entities.ts` e o módulo em `src/app.module.ts`.
3. Gere a migration com o banco local atualizado: `npm run db:generate -- src/database/migrations/<NomeDaMudanca>`, adicione-a em `src/database/migrations/index.ts` e rode `npm run db:migrate`.
4. Teste em `test/` e rode `npm run format`.

## Rodar localmente

Requisitos: Node.js 22+, npm e Docker com Compose. Os comandos abaixo podem ser executados no Terminal/PowerShell na raiz do projeto.

```bash
npm ci
npm run setup
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

O setup gera `.env` com `JWT_SECRET` e `INTERNAL_API_KEY` aleatórios; não sobrescreve configurações existentes. O `.env` local precisa de `NODE_ENV=development`: sem ele, a API aplica as regras de produção e recusa iniciar com `FRONTEND_ORIGIN` em http. Copie `INTERNAL_API_KEY` para o `.env.local` do frontend (mesmo valor nos dois). O Compose contém credenciais **exclusivas para desenvolvimento local** e expõe o PostgreSQL apenas em 127.0.0.1.

Se a porta 5432 já estiver em uso (outro PostgreSQL), troque `POSTGRES_PORT` no `.env` (ex.: `5433`) e a porta em `DATABASE_URL` antes do `docker compose up`. O Compose lê `POSTGRES_PORT` do mesmo `.env`.

O container sobe de novo sozinho quando o Docker reinicia (`restart: unless-stopped`). Se a API mostrar `ECONNREFUSED` na porta do banco, o PostgreSQL está parado: abra o Docker Desktop e rode `docker compose up -d postgres`.

Inicie a API:

```bash
npm run start:dev
```

`start:dev` (ou `dev`) recompila e reinicia a API a cada alteração em `src/`.

**Primeiro administrador.** Defina `ADMIN_EMAIL` (e, se quiser, `ADMIN_NAME`) no `.env` ou nas variáveis de ambiente do servidor e inicie a API. Enquanto nenhuma conta tem senha, a API cria o administrador com esse e-mail e envia um convite "Criar minha senha", válido por 7 dias. Quem abre o link escolhe a senha e já entra no painel; ninguém consegue assumir o painel pelo navegador sem acesso a essa caixa de e-mail. Se o e-mail estiver errado, corrija `ADMIN_EMAIL` e reinicie: o convite passa para o endereço novo e o link antigo deixa de valer. A tela de login mostra "Convite enviado" com o botão "Reenviar convite" até a senha ser criada. Não há usuário/senha padrão.

**Equipe.** Na aba Usuários, o administrador informa nome, e-mail e perfil; a pessoa recebe um convite e cria a própria senha (ninguém repassa senhas). A lista mostra "Convite pendente" ou "Convite expirado" e tem "Reenviar convite". Corrigir o e-mail de quem ainda não aceitou envia um convite novo e cancela o antigo.

**E-mail em desenvolvimento.** Sem `RESEND_API_KEY` nem `SMTP_HOST`, nenhum e-mail sai: cada um aparece no terminal e é salvo como página em `.mail-outbox/` (abra o arquivo no navegador para ver o e-mail como ele chegaria e clicar no link).

Alternativa sem e-mail, pelo terminal: preencha também `ADMIN_PASSWORD` (ao menos 12 caracteres) no `.env`, rode `npm run admin:create` e depois remova `ADMIN_PASSWORD` do arquivo. O comando conclui um convite pendente para esse e-mail e nunca altera uma senha já escolhida.

Esqueceu a senha? Use "Esqueci minha senha" na tela de login. Sem `RESEND_API_KEY` nem `SMTP_HOST` no `.env`, o e-mail com o link não é enviado: ele aparece no terminal do `npm run start:dev` e em `.mail-outbox/`. Também dá para redefinir pelo terminal, preenchendo `ADMIN_EMAIL` com o e-mail do usuário e `ADMIN_PASSWORD` com a nova senha e executando `npm run admin:reset-password`. Nos dois casos, as sessões abertas desse usuário são encerradas. Depois, remova `ADMIN_PASSWORD` do arquivo.

- Portal: http://localhost:3000
- Painel: http://localhost:3000/admin
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs quando `ENABLE_DOCS=true`

O seed cria o portal e, enquanto ele não tiver nenhuma, as editorias padrão. Pode ser executado de novo (em produção roda a cada início): editorias renomeadas ou excluídas no painel não voltam. **Não cria notícias fictícias por padrão**. Para demonstrar o visual, configure `SEED_DEMO=true` no .env antes do seed. As matérias serão marcadas como exemplos e terão fotos ilustrativas; exclua-as antes do lançamento. O seed insere exemplos apenas quando o portal não possui nenhuma matéria.

## Testar e compilar

```bash
npm run typecheck
npm test
npm run build
```

Os testes locais usam pg-mem, que emula PostgreSQL. A migration inicial é executada nesses testes. O CI configura um serviço PostgreSQL real e executa os mesmos testes nele via `TEST_DATABASE_URL`.

Para executar localmente em PostgreSQL real, use um **banco de testes vazio e separado**, preenchendo `TEST_DATABASE_URL` no ambiente. Os testes criam dados; não utilize o banco de operação. Um novo banco vazio é necessário para repetir a suíte sem conflito de fixtures.

Validação realizada nesta entrega: build de ambas as aplicações, verificação TypeScript e 10 testes de integração em pg-mem. O workflow para PostgreSQL real está incluído, mas seu resultado dependerá da execução no GitHub. Não houve validação visual em navegador. A tentativa de teste HTTP do Next.js nesta execução foi bloqueada pelo isolamento de rede do ambiente.

A auditoria de dependências de produção encontrou alertas moderados em js-yaml/Swagger, sem alertas altos ou críticos na verificação inicial. A atualização automática disponível não resolveu toda a cadeia. Antes de produção, revisar a atualização compatível do Swagger/js-yaml; mantenha ENABLE_DOCS=false se não utilizar a documentação interativa.

## APIs

Todas as rotas usam prefixo `/api`.

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | /health | Público; 503 quando o banco não responde |
| GET | /sitemap | Público; slug, título, publicação e atualização de cada matéria publicada (sem exemplos), para o sitemap do portal |
| GET | /portal | Público |
| GET | /categories | Público; em ordem de menu (`position`) |
| GET | /sponsors | Público; somente ativos (id, name, logoUrl, websiteUrl) |
| GET | /media/:arquivo | Público; imagem enviada, cache imutável |
| GET | /articles?search=&category=&page=1 | Público; somente publicados |
| GET | /articles/:slug | Público; somente publicados |
| GET | /campaigns?slot=leaderboard | Público; somente campanhas vigentes |
| POST | /leads | Público; exige consentimento |
| POST | /auth/login | Público; e-mail e senha |
| GET | /auth/setup | Público; `{ state }`: `ready` (login normal), `invited` (com o e-mail mascarado do administrador convidado) ou `unconfigured` (falta `ADMIN_EMAIL`) |
| POST | /auth/setup/resend | Público; sempre 204. Reenvia o convite do primeiro administrador, só para `ADMIN_EMAIL` |
| GET | /auth/invite?token= | Público; nome, e-mail e perfil do convite. 400 "Convite inválido ou expirado" |
| POST | /auth/accept-invite | Público; `{ token, password, name? }`. Cria a senha e devolve a sessão como o login; o link vale uma vez |
| POST | /auth/forgot-password | Público; `{ email }`, sempre 204. Envia o link `FRONTEND_ORIGIN/admin/redefinir-senha?token=...` se o e-mail for de um usuário ativo |
| POST | /auth/reset-password | Público; `{ token, password }`. 400 "Link inválido ou expirado. Peça um novo." para link usado, vencido ou substituído por um pedido mais novo |
| GET | /auth/me | Qualquer perfil; id, nome, e-mail e perfil do usuário logado |
| GET, POST, PATCH, DELETE | /admin/articles | Qualquer perfil; o repórter só vê e altera os próprios rascunhos e não publica nem destaca (403) |
| GET, POST, PATCH, DELETE | /admin/categories | Administrador e editor |
| GET, POST | /admin/media (envio multipart, campo `file`, até 4 MB, JPG/PNG/WebP/GIF) | Qualquer perfil |
| DELETE | /admin/media/:id | Administrador e editor |
| GET, POST, PATCH, DELETE | /admin/sponsors, /admin/campaigns; GET e DELETE em /admin/leads | Administrador |
| GET, POST, PATCH | /admin/users; PATCH /admin/users/:id/password | Administrador; usuários são desativados, não excluídos, e o admin não pode tirar o próprio acesso |

Perfil sem acesso recebe 403; token inválido, expirado, de usuário desativado ou emitido antes de uma redefinição de senha recebe 401. Tokens emitidos antes da migration `UserRoles` não têm a versão de sessão e precisam de um novo login.

A API administrativa aceita `Authorization: Bearer <token>`. O navegador acessa as rotas intermediárias do Next.js; o token fica em cookie HttpOnly e não é enviado ao JavaScript. Não há token/segredo embutido no frontend.

## Deploy

**Comandos.** Build: `npm ci && npm run build`. Start: `npm run start:prod`, que aplica as migrations pendentes, roda o seed (portal e editorias padrão só na primeira vez) e inicia a API. Os scripts `*:prod` (`db:migrate:prod`, `db:seed:prod`, `admin:create:prod`, `admin:reset-password:prod`) usam o `dist/` e não dependem de ts-node. Health check: `/api/health`, que responde 503 quando o banco não responde. No Railway, o `railway.json` já define o start, o health check e o volume obrigatório em `/app/uploads`: sem o volume, o deploy nem começa, para nenhuma imagem ser gravada num disco que some no próximo deploy.

**Variáveis.** Defina `NODE_ENV=production`. Só `development` e `test` desligam as proteções, então um servidor sem NODE_ENV também é tratado como produção. Em produção, a API recusa iniciar sem:
- `DATABASE_URL`;
- `JWT_SECRET` com 32 ou mais caracteres;
- `INTERNAL_API_KEY` com 32 ou mais caracteres, o mesmo valor do frontend;
- `FRONTEND_ORIGIN` em HTTPS, sem barra no fim;
- `MAIL_FROM`, quando usar Resend.

Ela só avisa no log quando falta um provedor de e-mail e quando `ENABLE_DOCS=true`. Configure também `PORTAL_SLUG`, `MEDIA_DIR` (caminho do volume) e `ADMIN_EMAIL` (primeiro administrador). `PORT` vem do provedor; com o frontend na rede privada do Railway, fixe `PORT=4000`, para o endereço interno não mudar. `DATABASE_SSL=true` só para conexões externas com TLS; pela rede privada do provedor, deixe `false`.

**Rede.** Em produção, a API só atende requisições com `INTERNAL_API_KEY` (cabeçalho `x-internal-key`), que o servidor Next.js envia em todas as chamadas. As exceções são `/api/health` (health check do provedor) e `/api/media/*` (imagens repassadas pelo rewrite do frontend). Por isso a API pode ter endereço público, necessário quando o frontend roda na Vercel (ex.: `API_URL=https://api.seudominio/api`), sem que ninguém contorne o portal nem o rate limit. Se o frontend ficar no mesmo provedor, prefira a rede privada (ex.: `http://api.railway.internal:4000/api`) e não publique a API. A API escuta em IPv4 e IPv6, porque a rede privada do Railway é só IPv6 nos ambientes criados antes de 16/10/2025.

**E-mail.** Prefira `RESEND_API_KEY` (API HTTPS do Resend). O Railway, nos planos Free e Hobby, e as instâncias gratuitas do Render bloqueiam SMTP de saída; `SMTP_*` continua disponível onde o SMTP é liberado. `MAIL_FROM` precisa usar um domínio verificado no provedor, com os registros SPF, DKIM e, de preferência, DMARC no DNS, ex.: `Itajubá News <nao-responda@seudominio>`. `FRONTEND_ORIGIN` monta os links dos e-mails, e a logo vem de `FRONTEND_ORIGIN/logo-email.png`. Com SMTP, a API confere a conexão e o login ao iniciar e registra o resultado no log. Em produção sem provedor, os convites não saem e o painel avisa; o primeiro administrador pode ser criado com `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `npm run admin:create:prod`.

**Uploads.** `MEDIA_DIR` deve apontar para um volume persistente (no Railway, um volume montado em `/app/uploads`; no Render, um disco). Com volume, a API roda em uma instância só e fica alguns segundos fora do ar a cada deploy. Para várias instâncias, troque `MediaStorage` por armazenamento de objetos (S3, R2).

**Backup.**
- **Railway:** ative backups agendados (diário e semanal) no volume do Postgres e no volume de uploads.
- **Render:** o Postgres pago recupera qualquer ponto dos últimos 3 dias (workspace Hobby) ou 7 dias (Pro), e o disco tem um snapshot por dia, mantido por 7 dias.
- **Fora do provedor:** de tempos em tempos, guarde um `pg_dump` do banco e uma cópia da pasta de uploads. Teste uma restauração antes do lançamento.

**Frontend.** Siga o README do repositório frontend. `API_URL` (com `/api`) precisa ser alcançável pelo servidor Next.js e estar definida já no build. `SITE_URL` é a origem HTTPS do portal: o cookie é Secure, e as mutações só são aceitas dessa origem.

**Outros.**
- O rate limit é por IP e por rota, em memória (por processo). Requisições do Next.js com `INTERNAL_API_KEY` válida são limitadas pelo IP do visitante (`x-client-ip`); leituras do servidor sem IP de visitante (cache do Next.js) não são limitadas. Sem a chave, o cabeçalho `x-client-ip` é ignorado. Para vários processos, use armazenamento distribuído de limites (ex.: Redis).
- O texto das notícias é renderizado como texto simples, sem HTML arbitrário. Imagens podem ser URLs http(s) externas ou enviadas pelo painel (`/media/<arquivo>`); o frontend repassa `/media/*` para a API.

## Próximas etapas

Cobrança e assinaturas, métricas reais de impressões/cliques, rotação de banners, guia comercial, newsletter com confirmação/descadastro, agenda, fluxo de revisão editorial (enviar para revisão, comentários), troca de senha pelo próprio usuário, agendamento de matérias, gestão completa de tenants e domínios. **Esses recursos ainda não estão implementados.**

A publicação de notícias reais depende da redação; não há coleta automática de notícias. Não há promessa de audiência ou rentabilidade. Defina preços após medir alcance, custos e demanda comercial.

