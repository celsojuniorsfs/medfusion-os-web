# Instruções para o Claude neste repositório

Lições de erros já cometidos nesta base de código — leia antes de mexer em `core/`,
`features/*/data-access/` ou escrever testes com `TestBed`. Convenções de arquitetura
(estrutura de pastas, `core/` vs `features/`, padrão de store) ficam no `README.md`; este
arquivo é só sobre armadilhas operacionais do Angular/Vitest.

## `core/` não conhece nenhuma feature — nem para reagir a eventos

O README já documenta a regra ("uma feature nunca importa `data-access/` de outra, só o
store dela — `core/` não conhece nenhuma feature"), mas vale reforçar o caso que quase
violei nesta sessão: **AuthSessionStore.clearSession() não pode chamar `ClientsStore`/
`EquipmentsStore` diretamente** para limpá-los no logout, mesmo sendo um caso de uso
plausível — isso inverteria a dependência (`core/` importando `features/`).

A direção certa é a feature observar o core, nunca o contrário: cada store de feature que
precisa reagir à sessão usa `withHooks` + `effect()` observando `AuthSessionStore` (que a
feature já pode injetar livremente):

```ts
withHooks((store) => {
  const auth = inject(AuthSessionStore);
  return {
    onInit() {
      effect(() => {
        if (!auth.isAuthenticated()) store.reset();
      });
    },
  };
});
```

Ver `features/clients/data-access/clients.store.ts` e `equipments.store.ts` para o padrão
completo.

## Fronteira entre features, confirmada por auditoria

A auditoria de acoplamento de 13/09/2026 apagou `core/` e cada feature de verdade (branch
descartável + `git rm -r` + `ng build`, revertido depois) pra confirmar o que o README já
promete. Veio 100% limpo: zero import feature→feature, tudo passando por `core/` ou pela
rota lazy em `app.routes.ts`. Duas coisas pra manter assim:

- **`core/` é importado por toda feature — nunca o contrário.** `authGuard`,
  `authInterceptor`, `AuthSessionStore`, `ShellComponent`: todos usados por
  `features/identity`, `features/clients` e (quando crescer) `features/orders`. Nenhum
  desses pode importar nada de dentro de `features/`.
- **Entre features, o único import permitido é o *store* de outra feature** — nunca outro
  arquivo do `data-access/` dela, nem `pages/`. O comentário em
  `features/clients/data-access/equipments.store.ts` já antecipa isso: a futura feature de
  Ordens vai importar `EquipmentsStore` (e provavelmente `ClientsStore`) pra montar o
  seletor de equipamentos/cliente na tela de nova OS — isso é o uso sancionado. Importar
  `equipments.ts` (o helper de busca client-side) ou qualquer coisa de
  `features/clients/pages/` de dentro de `features/orders/` não seria: o store é a
  superfície pública da feature, o resto é implementação interna dela.

`features/orders/` hoje é um stub vazio (`OrdersStore` sem métodos). Quando crescer e
passar a importar `EquipmentsStore`/`ClientsStore` de verdade, vale repetir o teste de
deleção (apagar `features/clients/`, rodar `ng build`) pra confirmar que só esses imports
de store quebram — nada mais.

## Testando SignalStore + localStorage: a leitura só acontece na construção

`AuthSessionStore` lê o token do `localStorage` dentro do inicializador de `withState`
(`token: localStorage.getItem(TOKEN_KEY)`) — isso roda **uma vez**, na construção do
store. `TestBed.inject(AuthSessionStore)` constrói (ou retorna a instância já
construída) — se você escrever no `localStorage` DEPOIS de já ter injetado o store no
mesmo teste, essa escrita não tem efeito nenhum sobre a instância existente.

```ts
// ERRADO — a segunda linha não muda nada, o store já foi construído com token null
const store = TestBed.inject(AuthSessionStore);
localStorage.setItem(TOKEN_KEY, 'algum-token');

// CERTO — escreve no localStorage ANTES de injetar
localStorage.setItem(TOKEN_KEY, 'algum-token');
const store = TestBed.inject(AuthSessionStore);
```

Por isso `auth-session.store.spec.ts` não injeta o store no `beforeEach` — cada teste que
depende de um token pré-existente decide sozinho quando injetar.

## Testando `effect()`/`withHooks`: chame `TestBed.flushEffects()`

Um `effect()` registrado dentro de `withHooks` (como o `reset()` automático no logout,
acima) não roda de forma síncrona no ponto onde o signal observado muda. Depois de mudar o
estado que o effect observa, chame `TestBed.flushEffects()` antes de checar o resultado:

```ts
auth.clearSession();
TestBed.flushEffects();
expect(store.entities()).toHaveLength(0);
```

## Testando guards: rode dentro de um contexto de injeção

`CanActivateFn` espera ser chamado pelo Router, que já fornece um contexto de injeção.
Chamar `authGuard(...)` direto num teste falha com "NG0203: inject() must be called from
an injection context". Use `runInInjectionContext`:

```ts
const injector = TestBed.inject(Injector);
const result = await runInInjectionContext(injector, () => authGuard({} as never, {} as never));
```

## Testando HTTP: `provideHttpClient()` + `provideHttpClientTesting()`

Nenhum teste neste repositório usava `TestBed` com HTTP antes desta sessão. Para testar
um store, guard ou interceptor que faz chamadas HTTP:

```ts
TestBed.configureTestingModule({
  providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])],
});
const httpMock = TestBed.inject(HttpTestingController);
// ...
httpMock.expectOne(url).flush(corpoDaResposta);
httpMock.verify(); // no afterEach
```

`withInterceptors([...])` só é necessário quando o próprio teste precisa exercitar o
interceptor (ex.: `auth.interceptor.spec.ts`); testes de store não precisam dele.

## O builder de teste do Angular 22 não tem arquivo de config — isso é esperado

`angular.json` declara `"test": { "builder": "@angular/build:unit-test" }` sem nenhuma
opção, e não existe `vitest.config.ts` no repositório. Isso **não é uma configuração
incompleta** — o builder novo do Angular 22 roda Vitest de forma zero-config, integrado ao
próprio CLI. `npm test` já funciona assim; não crie um `vitest.config.ts` achando que está
consertando algo.

## "Fecha #N" em português NÃO fecha a issue

O corpo das PRs aqui é escrito em português, e escrever "Fecha #92" **não fecha nada**: o
GitHub só reconhece palavra-chave de fechamento em inglês (`close`/`closes`/`closed`,
`fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved`). Em português vira texto comum e a
issue fica aberta para sempre, mesmo com a PR mergeada.

Já aconteceu com #87, #92 e #93 (e no repo da API com #92, #101, #102) — todas entregues e
esquecidas abertas, dando impressão de backlog pendente que não existe.

Duas saídas, escolha uma e seja consistente: escrever `Closes #92` no corpo da PR (mistura
idioma, mas fecha sozinho), ou manter o português e **fechar à mão depois do merge**, com
um comentário dizendo qual PR entregou.

## Testando um store que chama outro método do próprio store: cuidado com o microtask

`EquipmentPhotosStore.upload()` faz `await` no POST e só então dispara o GET do reload.
Num teste, `flush()` resolve o observable mas a continuação do `await` roda no **próximo
microtask** — então um `httpMock.expectOne(...)` chamado logo depois do `flush` não acha o
GET e falha com "found none". Basta um `await Promise.resolve()` entre os dois.

O sintoma engana: parece que o método encadeado não foi chamado. Antes de reescrever o
store (foi o que quase fiz, culpando o `this` dentro de `withMethods` — que funciona
normalmente), cheque se é só ordem de execução no teste.

## `inert` é uma propriedade do DOM, não algo que CSS alterna

Pra desabilitar o drawer de navegação (mobile) quando fechado sem afetar o desktop (onde
ele fica sempre visível, sem breakpoint nenhum controlando isso), é preciso saber em JS se
está abaixo do breakpoint — uma media query CSS não consegue condicionar a propriedade
`inert` do jeito que condiciona uma classe. Use `BreakpointObserver`
(`@angular/cdk/layout`, já uma dependência do projeto) + `toSignal()`, não tente resolver
isso só com Tailwind. Ver `core/layout/shell.component.ts`.

## Toast atrás do diálogo de confirmação: feche o diálogo antes do `toast.error()`

Achado ao investigar "mensagem de erro ficando no fundo" (print do usuário mostrando o toast
esmaecido atrás do backdrop do `ConfirmDialogComponent`): quando um `catch` de
`confirmRemove()` chamava `toast.error(...)` sem fechar o diálogo primeiro, o toast ficava
**permanentemente** escondido atrás do backdrop — não é só questão de aumentar `z-index`.

Causa raiz, confirmada em runtime via `elementFromPoint`/`elementsFromPoint`: o
`BrnAlertDialog` (Angular CDK `Dialog`) renderiza seu overlay com `popover="manual"` — a
Popover API nativa do navegador, que promove o elemento pro **top layer**, uma camada de
composição inteiramente separada da árvore normal de stacking contexts. Nenhum `z-index`,
por maior que seja (testado até `2147483647`), consegue fazer um elemento fora do top layer
(como o `<ol data-sonner-toaster>`, que só tem um `z-index: 999999999` "normal") aparecer por
cima de um elemento que está nele. Ver `shared/ui/confirm-dialog.component.ts` (usa
`BrnAlertDialogImports`, que por baixo usa `@angular/cdk/dialog`).

A saída não é brigar com o top layer — é nunca deixar o diálogo aberto no momento em que o
toast aparece. Nos três lugares que têm esse padrão (`catalog.page.ts`,
`clients.page.ts`, `equipments.page.ts`, todos em `confirmRemove()`), o `catch` agora chama
`this.removeDialog().close()` **antes** do `toast.error(...)`, do mesmo jeito que o caminho de
sucesso já fazia. Qualquer novo fluxo que misture `ConfirmDialogComponent` com um toast de
erro precisa do mesmo cuidado.
