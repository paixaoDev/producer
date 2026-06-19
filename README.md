# Producer — Gerador de Roadmap para Jogos com IA

> Transforme seu Game Design Document em um roadmap de produção profissional, com tarefas de sprint, milestones e resumo para editais — tudo gerado por IA em minutos.

![Producer screenshot](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![Vanilla JS](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-orange)

---

## O que é o Producer?

O **Producer** é uma aplicação web que lê o seu GDD (Game Design Document) e usa IA para gerar um roadmap completo de desenvolvimento de jogos. Ele entende que cada jogo é único — por isso não usa templates genéricos. Ele lê o seu documento, extrai as informações reais (personagens, mecânicas, fases, engine) e cria tarefas específicas para o seu projeto.

O resultado é uma hierarquia de três níveis:

```
Objetivo (Sub-área de desenvolvimento)
  └── Key Result (Entrega verificável dentro da sub-área)
        └── Tarefa de Sprint (Ação concreta de 1-3 dias)
```

Essa estrutura é compatível com metodologias OKR e ágeis (Scrum/Kanban).

---

## Pré-requisitos

- Navegador moderno: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Uma chave de API do **DeepSeek** (gratuita para criar, com créditos iniciais): [platform.deepseek.com](https://platform.deepseek.com/api-keys)
- Seu GDD em um dos formatos suportados: **PDF, DOCX, DOC ou TXT**

Não é necessário instalar nada. A aplicação roda 100% no navegador.

---

## Como usar

### Passo 1 — Abrir o projeto

Abra o arquivo `index.html` diretamente no navegador. Não é necessário servidor web — o projeto funciona via `file://` ou hospedado em qualquer servidor estático (GitHub Pages, Netlify, Vercel, etc.).

### Passo 2 — Configurar a chave de API

Na primeira vez que abrir, você verá a tela de configuração de API. Cole sua chave do DeepSeek (começa com `sk-`) e clique em **Entrar no Producer**. A chave é salva no `localStorage` do navegador — ela nunca sai do seu computador.

> **Onde pegar a chave:** [platform.deepseek.com/api-keys](https://platform.deepseek.com/api-keys)
> A conta DeepSeek é gratuita para criar e vem com créditos iniciais suficientes para vários roadmaps.

### Passo 3 — Fazer upload do GDD

Arraste e solte o arquivo do GDD na área de upload, ou clique em **Escolher Arquivo**. O arquivo pode ser:

- **PDF** — extraído página a página via pdf.js (não funciona com PDFs baseados em imagens/scan)
- **DOCX/DOC** — extraído diretamente do XML interno
- **TXT** — lido diretamente, sem processamento

Tamanho máximo: **10MB**. Para GDDs maiores, exporte os primeiros 20.000 caracteres como TXT.

### Passo 4 — Analisar o GDD

Clique em **Analisar GDD**. A IA passa por 5 fases de processamento, mostradas na barra de progresso:

| Fase | O que acontece |
|------|----------------|
| Normalizando GDD | A IA lê o documento e preenche um template estruturado com todas as informações do jogo |
| Sub-áreas | A IA define de 12 a 22 sub-áreas de desenvolvimento específicas para o seu projeto |
| KRs | Para cada sub-área, a IA gera de 3 a 6 Key Results verificáveis |
| Sprints | Para cada KR, a IA gera de 3 a 7 tarefas pequenas de sprint com estimativa em dias |
| Milestones | A IA define 7 marcos do projeto com critérios de aceite |

Durante o processamento, um painel ao vivo mostra o que a IA está gerando em tempo real.

### Passo 5 — Revisar o GDD normalizado

Antes de gerar o roadmap completo, a aplicação mostra como a IA interpretou o seu GDD. Você verá campos como:

- Título, gênero, plataformas, engine
- Mecânica principal e mecânicas secundárias
- Personagens, ambientes, estilo visual
- Duração estimada, número de fases

Se algo estiver errado ou faltando, clique em **Cancelar** e melhore o GDD. Se estiver correto, clique em **Gerar Roadmap**.

### Passo 6 — Explorar o roadmap

O resultado tem quatro seções principais:

**Visão Geral** — resumo do projeto com contagem total de tarefas e duração.

**Roadmap / Timeline** — linha do tempo horizontal mostrando cada sub-área ao longo dos meses. Tem dois modos:
- *Simples*: uma barra por área (Programação, Arte, Design, Áudio, QA)
- *Detalhado*: uma barra por sub-área (ex: "Arte — Personagem Aria", "Programação — Sistema de Combate")

**Marcos do Projeto** — cards colapsáveis com cada milestone, seus entregáveis e critérios de aceite.

**Tarefas** — hierarquia completa de Objetivos > KRs > Tarefas de Sprint, com filtros por área e checkboxes para marcar progresso.

**Resumo para Edital** — texto gerado automaticamente para uso em editais de fomento (ProAC, BNDES, Rouanet, etc.), com resumo executivo, metodologia, necessidades de equipe e análise de riscos.

---

## Configuração de equipe e timeline

No header do roadmap há um painel **Personalizar equipe**. Você pode ajustar de 1 a 5 pessoas por área:

- Programação
- Arte
- Design
- Áudio
- QA
- Produção

O motor de scheduling redistribui automaticamente os KRs entre os membros da equipe usando a lógica de *earliest-free worker*: cada KR vai para o membro mais livre da área. Quanto mais pessoas, menor o tempo total do projeto. A duração estimada é atualizada em tempo real.

---

## Exportação

Clique em **Exportar** para baixar o roadmap completo em JSON. O arquivo contém:

```json
{
  "metadata": { "title", "genre", "exportDate", "totalMonths", "totalObjectives", "totalTasks" },
  "overview": { ... },
  "milestones": [ ... ],
  "editalSummary": { ... },
  "objectives": [
    {
      "id", "title", "area", "timeline": { "startMonth", "endMonth" },
      "keyResults": [
        {
          "id", "title", "estimatedWeeks",
          "tasks": [ { "id", "title", "estimatedDays", "priority", "type" } ]
        }
      ]
    }
  ]
}
```

O JSON pode ser importado em ferramentas como Notion, Linear, Produto ou processado por scripts próprios.

O botão **Copiar texto** na seção de Resumo para Edital copia o texto formatado diretamente para a área de transferência.

---

## Retomada automática após erro

Se a geração for interrompida (queda de conexão, erro de API, fechar o navegador no meio), o Producer salva o progresso em cada fase. Na próxima vez que abrir, aparece a tela de **Geração interrompida** com o estado de cada fase. Clique em **Continuar de onde parou** para retomar sem repetir as fases já concluídas.

---

## Estrutura do projeto

```
producer/
├── index.html      # Interface completa (upload, loading, resultados)
├── script.js       # Toda a lógica: parsing, IA, rendering, scheduling
├── styles.css      # CSS com variáveis, timeline, cards, filtros
├── LICENSE         # MIT
└── README.md       # Este arquivo
```

O projeto não tem dependências npm, build step ou backend. É vanilla HTML + CSS + JavaScript com duas dependências carregadas via CDN:

- **pdf.js** (extração de texto de PDFs)
- **Font Awesome** (ícones)
- **Inter** (tipografia via Google Fonts)

---

## Arquitetura interna

### Pipeline de geração (Fases 0 a Final)

```
GDD (arquivo) 
  → [Fase 0] normalizarGDD()     → objeto GDD_TEMPLATE preenchido
  → [Fase 1] mdPhase1_Subareas() → Markdown com 12-22 sub-áreas
  → [Fase 2] mdPhase2_KRs()      → Markdown com KRs por sub-área
  → [Fase 3] mdPhase3_Sprints()  → Markdown com tarefas por KR
  → [Fase 4] mdPhase4_Milestones() → Markdown com marcos
  → [Final]  mdToJSON()           → JSON estruturado para a UI
```

A IA conversa em **Markdown** nas fases intermediárias (mais confiável, sem erros de escaping JSON) e só produz JSON no passo final de consolidação.

### GDD_TEMPLATE

O template central que governa o que a IA extrai do GDD:

```javascript
const GDD_TEMPLATE = {
    titulo, genero, subgenero, plataformas, engine, perspectiva, modo,
    tamanho_equipe, papeis,
    sinopse, diferenciais, referencias, publico_alvo,
    mecanica_principal, mecanicas_secundarias, mecanicas_unicas, progressao, economia, ia_inimigos,
    contexto_mundo, protagonista, antagonista, estrutura_narrativa, tom,
    estilo_visual, paleta_cores, resolucao_aspecto, personagens_principais, ambientes_principais,
    estilo_musical, referencias_audio, voice_over,
    duracao_estimada, numero_fases, duracao_desenvolvimento, plataforma_lancamento,
    sistema_finais, formato_extra, arco_emocional
};
```

Cada campo alimenta fases diferentes da geração. A função `gddSecoesPorArea()` garante que cada área (programação, arte, design, áudio, qa) receba apenas as seções relevantes do GDD — reduzindo tokens e aumentando precisão.

### AREA_PIPELINES

Base de conhecimento com o pipeline completo de cada área, usada para enriquecer os prompts:

- **Arte**: concept art → personagem (high poly, retopo, UV, texturas, rig, anims) → NPCs → inimigos → ambientes → UI → cutscenes → polish
- **Programação**: arquitetura → input → cenas → câmera → UI → diálogo → quests → inventário → combate → IA → save → ferramentas internas → performance → plataforma
- **Design**: pré-produção → level design → quests → narrativa → diálogos → balanceamento → tutorial → localização
- **Áudio**: direção sonora → composição → SFX → voice over → implementação e mixagem
- **QA**: playtesting → testes funcionais → testes técnicos → certificação de plataforma

### GENRE_KNOWLEDGE

Base de conhecimento por gênero com objetivos típicos e exemplos de KRs e tarefas:

- RPG, Platformer, FPS/Shooter, Puzzle, Estratégia, Aventura/Action-Adventure, Horror/Survival Horror, Genérico

A função `detectGameGenre()` identifica o gênero pelo texto do GDD e enriquece os prompts com exemplos específicos do gênero.

### Motor de Scheduling

O `scheduleRoadmap()` usa a lógica de *earliest-free worker* por área:

```
Para cada KR de um objetivo:
  1. Pegar o trabalhador mais livre da área (menor freeAtWeek)
  2. Atribuir o KR a ele: startWeek = freeAtWeek, endWeek = startWeek + durationWeeks
  3. Avançar o freeAtWeek do trabalhador
O startMonth/endMonth do objetivo = envelope de todos os seus KRs
```

Isso permite simular equipes de 1 a 5 pessoas por área e ver o impacto imediato na duração do projeto.

### Sistema de Pontos de Sprint

Cada sprint tem capacidade de **10 pontos** (10 dias úteis = 2 semanas). Cada tarefa vale pontos = `estimatedDays` (1 ou 2). A função `assignSprintPoints()` calcula:

- `kr.sprintCount = ceil(totalPoints / 10)`
- `kr.estimatedWeeks = sprintCount * 2`
- `obj._durationMonths = ceil(totalWeeks / 4.33)`

---

## Como customizar

### Adicionar um novo gênero

Em `GENRE_KNOWLEDGE` no `script.js`, adicione:

```javascript
meu_genero: {
    label: "Meu Gênero",
    keywords: ["palavra-chave1", "palavra-chave2"],
    objectives: [
        "Sistema X",
        "Sistema Y",
        "Sistema Z"
    ],
    okr_examples: {
        "Sistema X": ["KR exemplo 1", "KR exemplo 2"]
    },
    sprint_examples: {
        "KR exemplo 1": ["Tarefa específica A", "Tarefa específica B"]
    }
}
```

### Adicionar campos ao GDD_TEMPLATE

Para capturar uma informação adicional do GDD:

1. Adicione o campo em `GDD_TEMPLATE`:
   ```javascript
   meu_campo: '',  // descrição do campo
   ```

2. Adicione a explicação em `normalizarGDD()` dentro do objeto `explicacoes`:
   ```javascript
   meu_campo: 'descrição de como a IA deve preencher este campo',
   ```

3. Adicione o campo nas seções relevantes de `GDD_SECOES_POR_AREA`:
   ```javascript
   programming: [..., 'meu_campo'],
   ```

4. Opcionalmente, adicione o label amigável em `GDD_FIELD_LABELS` e o grupo de exibição em `GDD_REVIEW_GROUPS`.

### Expandir o pipeline de uma área

Em `AREA_PIPELINES`, adicione uma nova fase com seus KRs típicos e exemplos de sprint:

```javascript
art: {
    phases: [
        // ...fases existentes...
        {
            phase: "Minha Nova Fase",
            okrs: [
                "KR 1 desta fase",
                "KR 2 desta fase"
            ],
            sprint_examples: [
                "Tarefa concreta de exemplo",
                "Outra tarefa concreta"
            ]
        }
    ]
}
```

### Trocar o modelo de IA

Em `callAIAPI()`, a variável `models` define a ordem de tentativa:

```javascript
const models = [
    'deepseek-chat',      // DeepSeek-V3: mais rápido
    'deepseek-reasoner'   // DeepSeek-R1: mais poderoso
];
```

Para usar outro provedor compatível com a API OpenAI, altere a URL e o array de modelos:

```javascript
// Exemplo com OpenAI
const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o', messages: [...] })
});
```

### Ajustar a capacidade de sprint

A constante `SPRINT_CAPACITY_POINTS` define quantos dias úteis cabem em uma sprint:

```javascript
const SPRINT_CAPACITY_POINTS = 10; // 10 dias = 2 semanas
```

Altere para `5` (1 semana) ou `20` (4 semanas) se a sua metodologia usar sprints de tamanho diferente.

### Mudar as cores das áreas

Em `AREA_COLORS`:

```javascript
const AREA_COLORS = {
    programming: '#3b82f6',  // azul
    art:         '#8b5cf6',  // roxo
    design:      '#10b981',  // verde
    audio:       '#f59e0b',  // amarelo
    qa:          '#ef4444',  // vermelho
    production:  '#6366f1',  // índigo
};
```

As mesmas cores são usadas na timeline, nos cards de objetivos e nos dots do painel de equipe.

### Customizar o CSS

O arquivo `styles.css` usa variáveis CSS no `:root`. As principais:

```css
:root {
    --primary-color: #6366f1;
    --secondary-color: #f59e0b;
    --success-color: #10b981;
    --danger-color: #ef4444;
    --info-color: #3b82f6;
    --bg-color: #0f0f23;
    --card-bg: rgba(255,255,255,0.05);
    --text-primary: #e2e8f0;
    --text-secondary: #94a3b8;
    --border-color: rgba(255,255,255,0.1);
}
```

---

## Hospedar o projeto

### GitHub Pages

1. Faça fork do repositório
2. Nas configurações do repositório, ative GitHub Pages apontando para a branch `main`
3. Acesse via `https://seu-usuario.github.io/producer/`

### Netlify / Vercel

Arraste a pasta do projeto para o dashboard do Netlify, ou conecte o repositório ao Vercel. Nenhuma configuração de build é necessária.

### Servidor local simples

```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve .
```

Acesse `http://localhost:8080`.

---

## Privacidade e segurança

- A chave de API é salva apenas no `localStorage` do seu navegador, nunca em servidor externo
- Os arquivos GDD são processados localmente no navegador (extração de texto)
- O **texto extraído** do GDD é enviado para a API do DeepSeek para processamento
- O progresso das tarefas (checkboxes) é salvo no `localStorage`
- O resultado da análise é salvo no `localStorage` por até 7 dias para restauração automática

Considere as [políticas de privacidade do DeepSeek](https://www.deepseek.com/privacy) antes de processar documentos confidenciais.

---

## Troubleshooting

**"O PDF parece ser baseado em imagens (scan)"**
PDFs criados por scanner não têm texto extraível. Converta o PDF para DOCX usando o Word ou Google Docs, depois exporte como TXT.

**"Chave de API inválida"**
Verifique que a chave começa com `sk-` e foi copiada completamente. Acesse [platform.deepseek.com](https://platform.deepseek.com) para verificar o status.

**"Saldo insuficiente"**
Adicione créditos em [platform.deepseek.com/top-up](https://platform.deepseek.com/top-up). O DeepSeek-V3 é muito barato — um roadmap completo custa em média menos de U$0,10.

**"Alta demanda na API — aguardando..."**
A API do DeepSeek tem picos de uso. O Producer faz retry automático com backoff exponencial (5s, 15s, 30s). Aguarde ou tente em horário de menor demanda.

**"Geração interrompida"**
Use o botão **Continuar de onde parou**. O progresso de cada fase é salvo automaticamente.

**A timeline está comprimida nos primeiros meses**
Isso acontece quando o GDD tem poucos detalhes de escopo (número de fases, duração de desenvolvimento). Adicione essas informações ao GDD e analise novamente.

---

## Contribuindo

```bash
# 1. Fork e clone
git clone https://github.com/seu-usuario/producer.git

# 2. Crie uma branch
git checkout -b feature/minha-feature

# 3. Faça as mudanças e commit
git commit -m "Adiciona: descrição da mudança"

# 4. Push e Pull Request
git push origin feature/minha-feature
```

Áreas que aceitam contribuições com prioridade:
- Novos gêneros em `GENRE_KNOWLEDGE`
- Expansão dos `AREA_PIPELINES` com mais fases e exemplos reais
- Suporte a mais formatos de arquivo (ODT, MD)
- Internacionalização (i18n) para inglês e espanhol
- Testes automatizados dos parsers de Markdown

---

## Stack técnica

| Componente | Tecnologia |
|------------|------------|
| Frontend | HTML5 + CSS3 + JavaScript Vanilla |
| IA | DeepSeek API (V3 `deepseek-chat` e R1 `deepseek-reasoner`) |
| Extração de PDF | pdf.js 3.11 (via CDN) |
| Extração de DOCX | Parser manual de ZIP/XML |
| Persistência | localStorage / sessionStorage |
| Ícones | Font Awesome 6 (via CDN) |
| Tipografia | Inter (Google Fonts) |

---

## Licença

MIT — veja o arquivo [LICENSE](LICENSE) para detalhes.

---

Desenvolvido para a **comunidade indie de desenvolvimento de jogos brasileira**.
