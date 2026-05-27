# Filtro de Marcos Jira-Style

## Objetivo

Transformar o filtro de marcos do backlog em um campo de busca com sugestoes, parecido com o Jira, mantendo um atalho rapido para o primeiro marco do projeto.

## Comportamento

- O backlog continua filtrando por um unico marco por vez.
- O filtro rapido seleciona sempre o primeiro marco ordenado por mes.
- O campo de busca mostra sugestoes enquanto o usuario digita.
- A busca considera titulo, tipo, id e mes do marco.
- Ao selecionar uma sugestao, o backlog e renderizado apenas com itens daquele marco.
- Quando ha um marco selecionado, o filtro mostra um pill com o nome do marco e permite limpar a selecao.
- Os chips `M1`, `M2` e similares deixam de ser a interface principal.

## Nomenclatura

Os marcos devem priorizar nomes de producao legiveis, como `Prototipo Jogavel`, `Vertical Slice`, `Alpha`, `Beta`, `Gold Master`, `Demo Publica` e `Release`. O prompt da IA deve reforcar que `id` continua tecnico (`m1`, `m2`), mas `title` deve ser o nome exibivel.

## Arquitetura

A mudanca fica concentrada em `script.js` e `styles.css`. Funcoes puras pequenas cuidam de ordenar, rotular e filtrar sugestoes de marcos; a UI usa essas funcoes para renderizar o campo e atualizar `jiraSelectedMilestone`.

## Testes

Criar uma verificacao em `tests/milestone-filter.test.js` para cobrir:

- ordenacao dos marcos por mes;
- busca por texto no titulo/tipo/id/mes;
- rotulo do primeiro marco;
- rotulo do estado selecionado.
