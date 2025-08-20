# Producer - Gerador de Roadmap para Jogos 🎮

Um sistema avançado que analisa Game Design Documents (GDD) e gera **roadmaps dinâmicos** e **quadros kanban detalhados** para desenvolvimento de jogos usando inteligência artificial.

## ✨ Características Principais

### 🎯 **Product Roadmap Timeline**
- **Timeline horizontal dinâmica** com quarters (Q1, Q2, Q3, Q4...)
- **Suporte para projetos de até 2 anos** (8 quarters automáticos)
- **Barras coloridas por categoria** com timing inteligente baseado na IA
- **Posicionamento realista** considerando dependências de desenvolvimento

### 📋 **Kanban Board Estilo Trello**
- **Colunas por categoria** (Programação, Arte, Design, Áudio)
- **Cards de tarefas granulares** (máximo 1-2 sprints cada)
- **Sistema de prioridades** (High, Medium, Low)
- **Contadores de tarefas** por coluna
- **Checkboxes interativos** com persistência local

### 🤖 **IA Inteligente e Configurável**
- **Sistema de API flexível** com suporte a múltiplos provedores
- **Prompt otimizado** para tarefas granulares e timing realista
- **Configuração de chaves** através de interface moderna
- **Fallback inteligente** caso dados da IA sejam incompletos

### 🎨 **Interface Moderna**
- **Design responsivo** para desktop, tablet e mobile
- **Glassmorphism** e efeitos visuais modernos
- **Scroll horizontal** para timelines longas
- **Animações suaves** e feedback visual

## 🚀 Como Usar

### 1. **Configure a API de IA**
- Clique no ícone de configuração (⚙️) no header
- Adicione sua chave de API (recomendamos Google Gemini)
- A chave fica salva localmente no seu navegador

### 2. **Faça Upload do GDD**
- Arraste e solte ou clique para selecionar
- Formatos suportados: PDF, DOC, DOCX, TXT
- Tamanho máximo: 10MB

### 3. **Analise e Visualize**
- A IA processa o documento e gera:
  - **Visão geral** do projeto
  - **Product roadmap** com timeline de quarters
  - **Quadro kanban** com tarefas granulares

### 4. **Gerencie as Tarefas**
- Marque tarefas como concluídas
- Progresso salvo automaticamente
- Exporte resultados em JSON

## 🔧 Configuração de APIs Suportadas

### Google Gemini (Recomendado) ⭐
```javascript
// Já configurado! Apenas adicione sua chave via interface
// Acesse: https://aistudio.google.com/
```

### OpenAI GPT
```javascript
// Configure no script.js para usar GPT-4/3.5
const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
        'Authorization': 'Bearer YOUR_API_KEY'
    }
});
```

### Anthropic Claude
```javascript
// Configure no script.js para usar Claude
const response = await fetch('https://api.anthropic.com/v1/messages', {
    headers: {
        'x-api-key': 'YOUR_API_KEY'
    }
});
```

## 📊 Exemplo de Resultado

### Product Roadmap Timeline
```
Timeline (6 Quarters)
┌─────┬─────┬─────┬─────┬─────┬─────┐
│ Y1Q1│ Y1Q2│ Y1Q3│ Y1Q4│ Y2Q1│ Y2Q2│
└─────┴─────┴─────┴─────┴─────┴─────┘

Arte      ████████████████████████████░░
Progr.      ██████████████████████████████
Design    ████████████████████░░░░░░░░░░░░
Audio           ████████████████░░░░░░░░░░
```

### Kanban Board
```
┌─ Programação (12) ─┬─ Arte (10) ─┬─ Design (8) ─┬─ Audio (6) ─┐
│ ☐ Setup projeto    │ ☐ Style guide│ ☐ Game loop  │ ☐ Direção   │
│ ☐ Input system     │ ☐ Concept art│ ☐ Level design│ ☐ SFX UI    │
│ ☐ Physics básico   │ ☐ Sprites    │ ☐ Balancing  │ ☐ Música    │
│ ...                │ ...          │ ...          │ ...         │
└────────────────────┴──────────────┴──────────────┴─────────────┘
```

## 🎮 Exemplo de GDD para Teste

```markdown
GAME DESIGN DOCUMENT
Título: Souls of the Labyrinth
Gênero: Action RPG / Soulslike
Plataforma: PC, PlayStation 5, Xbox Series X/S
Duração Estimada: 18 meses

VISÃO GERAL:
Um Action RPG desafiador ambientado em um labirinto místico em constante mudança. 
Os jogadores exploram masmorras procedurais, enfrentam chefes épicos e descobrem 
os segredos de uma civilização perdida.

MECÂNICAS PRINCIPAIS:
- Sistema de combate preciso com timing e posicionamento
- Progressão baseada em almas coletadas
- Labirinto procedural com salas fixas e aleatórias  
- Boss fights únicos com múltiplas fases
- Sistema de crafting para armas e armaduras

PILARES DO DESIGN:
1. Desafio Justo: Dificuldade alta mas sempre superável
2. Exploração Recompensada: Segredos e tesouros escondidos
3. Progressão Significativa: Cada upgrade faz diferença
4. Atmosfera Imersiva: Visual e áudio coesos
```

## 🎨 Personalização Avançada

### Cores e Temas
```css
:root {
    --primary-color: #6366f1;    /* Azul principal */
    --secondary-color: #f59e0b;  /* Amarelo destaque */
    --success-color: #10b981;    /* Verde sucesso */
    --danger-color: #ef4444;     /* Vermelho perigo */
    
    /* Gradientes de fundo */
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Categorias Customizadas
```javascript
// No prompt da IA, adicione novas categorias:
"marketing": {
    "icon": "📢",
    "color": "#ec4899",
    "startQuarter": 4,
    "endQuarter": 6,
    "tasks": [...]
}
```

## 📱 Compatibilidade e Performance

### Navegadores Suportados
- **Chrome/Edge** 90+ ✅
- **Firefox** 88+ ✅  
- **Safari** 14+ ✅
- **Mobile** Responsivo ✅

### Limites Técnicos
- **Upload**: Máximo 10MB
- **Quarters**: Até 8 quarters (2 anos)
- **Tarefas**: Ilimitadas por categoria
- **APIs**: Rate limits variam por provedor

## 🔒 Segurança e Privacidade

### Dados Locais
- ✅ Chaves de API salvas apenas no `localStorage`
- ✅ Arquivos processados no navegador
- ✅ Progresso das tarefas persistido localmente
- ✅ Nenhum dado enviado para servidores próprios

### APIs Externas
- ⚠️ Documentos são enviados para APIs de IA configuradas
- ⚠️ Considere políticas de privacidade dos provedores
- ✅ Conexões sempre via HTTPS

## 🚧 Roadmap do Projeto

### ✅ Implementado
- [x] Product roadmap com timeline de quarters
- [x] Kanban board estilo Trello
- [x] Tarefas granulares (1-2 sprints)
- [x] Sistema de configuração de API
- [x] Interface moderna e responsiva
- [x] Timing inteligente baseado em IA

### 🔄 Em Desenvolvimento
- [ ] Modo colaborativo multi-usuário
- [ ] Templates de GDD predefinidos
- [ ] Integração com GitHub Projects
- [ ] Análise de riscos do projeto
- [ ] Estimativas de orçamento

### 🔮 Futuro
- [ ] IA local com WebAssembly
- [ ] Sincronização em nuvem
- [ ] App mobile nativo
- [ ] Integração com engines (Unity, Unreal)
- [ ] Marketplace de templates

## 🤝 Contribuindo

### Como Contribuir
```bash
# 1. Fork o repositório
# 2. Clone sua fork
git clone https://github.com/seu-usuario/Producer.git

# 3. Crie uma branch para sua feature
git checkout -b feature/nova-funcionalidade

# 4. Faça commit das mudanças
git commit -m "Adiciona nova funcionalidade"

# 5. Push para sua branch
git push origin feature/nova-funcionalidade

# 6. Abra um Pull Request
```

### Áreas que Precisam de Ajuda
- 🌐 **Internacionalização** (i18n)
- 🎨 **Design System** aprimorado
- 🧪 **Testes automatizados**
- 📱 **PWA** (Progressive Web App)
- 🔧 **Performance** otimizações

## 📄 Licença

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🏆 Créditos

### Tecnologias Utilizadas
- **HTML5** + **CSS3** + **JavaScript** vanilla
- **Google Gemini API** para análise de IA
- **Font Awesome** para ícones
- **Inter Font** para tipografia

### Inspirações
- **Linear** - Timeline de roadmap
- **Trello** - Interface de kanban
- **Notion** - UX de produtividade
- **Figma** - Sistema de design

---

Desenvolvido com ❤️ para a **comunidade indie de desenvolvimento de jogos**.

**Transforme seu GDD em um roadmap profissional em minutos!** 🚀