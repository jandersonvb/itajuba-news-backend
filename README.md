# Itajubá News — Backend

API NestJS independente com PostgreSQL. Frontend: https://github.com/jandersonvb/itajuba-news-frontend.

**Execute os comandos neste repositório.** Este README também descreve as capacidades do sistema integrado.

## O que funciona

- Home responsiva consumindo a API real; filtros por editoria, busca e paginação.
- Página de matéria com URL própria, título, resumo, texto, imagem, autoria e metadados sociais.
- Painel administrativo: login, criação/edição/exclusão de notícias e alternância rascunho/publicado.
- Cadastro/edição/exclusão de patrocinadores e campanhas.
- Campanhas por posição (`leaderboard` ou `sidebar`), vigência e ativação. Exibe a campanha ativa mais recente do slot, desde que o patrocinador esteja ativo.
- Formulário comercial que grava pedidos no PostgreSQL. O painel permite consultar e excluir esses dados. Não envia e-mail.
- Senhas com salt/scrypt; JWT com validade de uma hora; sessão do frontend em cookie HttpOnly; verificação de origem nas mutações do frontend.
- Validação de DTOs, limitação de requisições, migrations, documentação Swagger opcional e CI.
- Escopo por portal em todas as operações implementadas, validado no servidor. A instalação atende **um portal configurado por vez**. Há base de dados para evolução SaaS, mas ainda não há gestão de tenants, domínios ou planos.

## Estrutura

`src/`: API, autenticação e migrations. `test/`: testes integrados. `compose.yml`: banco local.

## Rodar localmente

Requisitos: Node.js 22+, npm e Docker com Compose. Os comandos abaixo podem ser executados no Terminal/PowerShell na raiz do projeto.

```bash
npm ci
npm run setup
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

O setup gera `.env` com segredo JWT aleatório; não sobrescreve configurações existentes. O frontend é configurado separadamente no outro repositório. O Compose contém credenciais **exclusivas para desenvolvimento local** e expõe o PostgreSQL apenas em 127.0.0.1.

Para criar um administrador, edite **.env**, preenchendo `ADMIN_EMAIL` e `ADMIN_PASSWORD` (ao menos 12 caracteres). Então execute:

```bash
npm run admin:create
npm run dev
```

Remova `ADMIN_PASSWORD` do arquivo após criar o usuário. O comando não altera uma senha já existente. Não há usuário/senha padrão.

- Portal: http://localhost:3000
- Painel: http://localhost:3000/admin
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs quando `ENABLE_DOCS=true`

O seed cria portal e editorias e pode ser executado novamente. **Não cria notícias fictícias por padrão**. Para demonstrar o visual, configure `SEED_DEMO=true` no .env antes do seed. As matérias serão marcadas como exemplos e terão fotos ilustrativas; exclua-as antes do lançamento. O seed insere exemplos apenas quando o portal não possui nenhuma matéria.

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
| GET | /health | Público |
| GET | /portal | Público |
| GET | /categories | Público |
| GET | /articles?search=&category=&page=1 | Público; somente publicados |
| GET | /articles/:slug | Público; somente publicados |
| GET | /campaigns?slot=leaderboard | Público; somente campanhas vigentes |
| POST | /leads | Público; exige consentimento |
| POST | /auth/login | Público; e-mail e senha |
| GET | /admin/articles, /admin/sponsors, /admin/campaigns, /admin/leads | Administrador |
| POST | /admin/articles, /admin/sponsors, /admin/campaigns | Administrador |
| PATCH | /admin/articles/:id, /admin/sponsors/:id, /admin/campaigns/:id | Administrador |
| DELETE | /admin/:resource/:id | Administrador |

A API administrativa aceita `Authorization: Bearer <token>`. O navegador acessa as rotas intermediárias do Next.js; o token fica em cookie HttpOnly e não é enviado ao JavaScript. Não há token/segredo embutido no frontend.

## Deploy

- PostgreSQL: aplique migrations antes de iniciar a API. `synchronize` está desativado.
- Backend: `npm ci`, `npm run build` e `npm run start`. Configure DATABASE_URL, JWT_SECRET, PORTAL_SLUG e FRONTEND_ORIGIN. Em banco com TLS, use DATABASE_SSL=true e certificado válido.
- Frontend: siga o README do repositório frontend. Configure API_URL com a URL desta API, incluindo `/api`, acessível pelo servidor Next.js; configure SITE_URL com a origem HTTPS do portal.
- Em produção, o cookie é Secure e exige HTTPS. SITE_URL deve corresponder à origem vista pelo usuário para validar as mutações.
- Use segredos do provedor, credenciais de produção, backups e migrations controladas. Desative Swagger público se não for necessário.
- O rate limit atual é por processo/IP, e requisições via Next.js compartilham o IP do servidor. Ajuste proxy confiável e armazenamento distribuído de limites antes de operar em escala. Não confie indiscriminadamente em cabeçalhos de IP enviados pelo cliente.
- Texto das notícias é renderizado como texto simples, sem HTML arbitrário. URLs de imagens são externas; use imagens próprias/autorizadas e um armazenamento de mídia ao evoluir.

## Próximas etapas

Cobrança e assinaturas, métricas reais de impressões/cliques, rotação de banners, upload de imagens, guia comercial, newsletter com confirmação/descadastro, agenda, papéis de jornalista/editor e revisão editorial, agendamento de matérias, gestão completa de tenants e domínios. **Esses recursos ainda não estão implementados.**

A publicação de notícias reais depende da redação; não há coleta automática de notícias. Não há promessa de audiência ou rentabilidade. Defina preços após medir alcance, custos e demanda comercial.

