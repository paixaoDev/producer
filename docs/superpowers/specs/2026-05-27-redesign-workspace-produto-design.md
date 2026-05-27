# Redesign Workspace Produto

## Objetivo

Retrabalhar a tela de resultados do Producer para parecer uma ferramenta de producao profissional, na linha de Jira ou ClickUp, com foco principal em Cronograma, Backlog e Board.

## Escopo

- Transformar Cronograma, Backlog e Board em abas principais de uma unica area de trabalho.
- Reduzir a presenca visual do nome Producer e do cabecalho, deixando-os com comportamento de barra de produto.
- Remover a sensacao visual infantil causada por gradientes fortes, cards grandes e excesso de cores.
- Mover dados secundarios para um painel lateral acionado por botoes redondos.
- Preparar tarefas para exibirem titulo e descricao opcional.
- Manter a logica atual de geracao de tarefas por IA fora do escopo.

## Fora de Escopo

- Alterar prompts, parsing ou formato gerado pela IA para criar nomes melhores de tarefas.
- Criar edicao persistente de descricao de tarefa.
- Reorganizar o modelo de dados salvo no localStorage.
- Trocar bibliotecas ou transformar o app em framework.

## Layout

A tela de resultados passa a funcionar como workspace.

O topo deve ser compacto, com Producer pequeno no canto esquerdo, titulo do projeto em destaque moderado e acoes principais no lado direito. A barra nao deve parecer uma hero section.

A area principal deve conter uma navegacao de abas:

- Cronograma
- Backlog
- Board

O Cronograma deixa de ser um card separado acima das tarefas e passa a ocupar uma aba propria. Backlog e Board continuam usando a logica existente, mas com visual mais limpo e consistente.

## Painel Lateral

Dados secundarios saem do fluxo principal e ficam em um rail lateral direito com botoes redondos. Cada botao abre um painel lateral contextual.

Os paineis iniciais sao:

- Marcos
- Resumo
- Equipe
- Edital

O painel lateral deve ter acao clara de fechar e ocupar largura limitada. Em telas menores, ele deve abrir sobre o conteudo principal.

## Visual

A paleta deve ser sobria:

- Fundo geral claro, proximo de `#F4F5F7`.
- Superficies brancas.
- Bordas cinza claras.
- Texto principal em cinza escuro.
- Azul somente para selecao, foco e acoes principais.

Cores de areas devem continuar existindo apenas em dots, badges pequenos e indicadores, sem dominar a interface.

O layout deve reduzir cards decorativos. Cards continuam adequados para tarefas e colunas do board.

## Tarefas

As listas do backlog e os cards do board devem ter mais hierarquia:

- ID pequeno ou badge tecnico.
- Titulo principal em tamanho legivel.
- Descricao opcional abaixo do titulo.
- Metadados compactos para sprint, prioridade, area e estimativa.

Quando `task.description` nao existir, a UI deve omitir a linha de descricao. Isso evita poluir a lista enquanto a geracao de descricoes pela IA ainda nao for ajustada.

## Responsividade

Em telas menores, as abas continuam no topo da area de trabalho. O rail lateral deve manter botoes compactos e o painel aberto deve se comportar como drawer sobreposto.

## Validacao

- Abrir a tela de resultados com um roadmap existente ou importado.
- Confirmar que Cronograma, Backlog e Board alternam por abas.
- Confirmar que Marcos, Resumo, Equipe e Edital abrem pelo painel lateral.
- Confirmar que o backlog continua filtrando e adicionando tarefas ao board.
- Confirmar que o board continua permitindo mover tarefas entre colunas.
- Confirmar que textos longos de tarefas nao quebram o layout.
