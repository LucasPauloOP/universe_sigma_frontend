# Universe Sigma — Frontend

Interface web do **universe_sigma_backend** (gerenciador do modo Universe dos jogos WWE 2K).

- Angular 22 (standalone, signals, zoneless, control flow nativo)
- **PrimeNG 22** + Tailwind CSS 4, sobre o template **Atlantis** (layout, menu lateral, topbar, configurador de tema)
- Reactive Forms, `HttpClient` com interceptor de JWT, rotas lazy

## Requisitos

- Node **≥ 24.15** (exigência do Angular 22). Com nvm: `nvm install 24 && nvm use 24`
- Backend rodando (por padrão em `http://localhost:3000`)

## Como rodar

```bash
npm install
npm start            # http://localhost:4200
```

O `ng serve` usa [proxy.conf.json](proxy.conf.json): tudo em `/api` vai para `http://localhost:3000`
(se o backend usar outra porta, edite o `target`). O app chama sempre a URL relativa `/api`
(constante `API_BASE` em `src/app/core/api.ts`).

```bash
npm test             # vitest (montagem de payloads e datas)
npm run build
```

### Licença PrimeUI

A chave PrimeUI fica em `src/license.local.ts` (no `.gitignore`, **não commite**). Em uma máquina nova,
copie `src/license.local.example.ts` para `src/license.local.ts` e cole a chave. Sem ela o app funciona,
mas o PrimeNG mostra o aviso de licença. O arquivo é obrigatório para compilar.

Em produção, sirva `dist/universe-sigma/browser` no mesmo domínio do backend (ou proxy reverso
`/api` → backend) e redirecione rotas desconhecidas para `index.html`.

## O que tem

| Área | Rota | O que faz |
|---|---|---|
| Login / Cadastro | `/login`, `/register` | JWT no `localStorage`; cadastro já cria um universe (com ou sem template) |
| Universes | `/universes` | Criar, editar, trocar, **restaurar padrão** e excluir (com confirmação) |
| Painel | `/dashboard` | Totais do universe e campeões atuais |
| CRUD genérico | `/r/<recurso>` | Lutadores, duplas/facções, brands, rivalidades, alinhamentos, divisões, categorias de peso, títulos, reinados, temporadas, shows, episódios, tipos de luta e torneios: busca, filtros, ordenação, paginação, formulário em dialog, upload de imagem |
| Divisões (ranking) | `/divisions` | Main Card, Mid Card, Tags, Women's World/Mid/Tag, Legends, Others por brand, lado a lado: título, campeão (do reinado em aberto) e a fila de desafiantes (arrastar para reordenar). Cadastro em `/r/card-divisions` |
| Episódios | `/episodes` | Cards por mês, calendário de **maio a abril**, abas Shows semanais / PLEs e especiais, destaque do próximo a jogar |
| Retrospecto / histórico | ações na linha | `wrestlers/:id/record` e `titles/:id/history` |
| Gerar episódios | botão em Episódios | `POST /episodes/generate` |
| Card do episódio | `/episodes/:id/card` | Monta o card com **drag-and-drop** (`PUT .../segments/order`), lados/vencedor, main event, título em jogo |
| Torneios | `/tournaments/:id` | Inscritos, gerar chave, chave visual (eliminatória) ou grupos + classificação, resultado por luta |

O ícone de paleta na topbar abre o configurador do Atlantis (cor primária, superfície, claro/escuro, modo do menu).

## Estrutura

```
src/
  app.config.ts, main.ts
  assets/            estilos do template (layout/*.scss) + tailwind.css
  app/
    layout/          shell do Atlantis (topbar, sidebar, menu, configurador) — menu montado a partir de core/resources.ts
    core/            api, auth, interceptor, guards, universe-store, refs (cache), resources (config dos CRUDs), locale pt-BR
    shared/          dialogs (confirmação + abrir dialog), image-field, page-header
    features/        auth, dashboard, universes, resources, episodes, tournaments
```

**Adicionar/ajustar um recurso CRUD** é editar `src/app/core/resources.ts`: cada entrada descreve campos
(formulário), colunas (tabela), filtros e ações de linha; as telas e o menu lateral são gerados a partir dela.
Os ícones são do PrimeIcons (nome sem o prefixo `pi-`).

## Detalhes importantes do backend

- Imagens: a API devolve `imageUrl` como **URL assinada temporária** (1 h). O formulário só reenvia
  `imageUrl` quando você troca/remove a imagem — nunca a URL assinada.
- Datas são tratadas como dia civil (UTC), exibidas sem deslocar o dia por fuso.
- Listagens do backend limitam em 500 por página; o front busca todas as páginas e faz busca/filtro/ordenação no cliente.
- O vínculo `TournamentMatch.segmentId` (luta real ↔ chave) é exibido, mas ainda não editável pela UI.
