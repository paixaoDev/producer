# Producer - Gerador de Roadmap para Jogos

Um site simples que analisa Game Design Documents (GDD) e gera roadmaps estruturados e listas de tarefas para desenvolvimento de jogos usando inteligência artificial.

## 🚀 Características

- **Interface moderna e responsiva** - Design limpo e intuitivo
- **Upload de arquivos** - Suporte para PDF, DOC, DOCX e TXT
- **Análise por IA** - Processa o GDD e gera insights inteligentes
- **Roadmap visual** - Timeline interativa com fases de desenvolvimento
- **Lista de tarefas** - Tarefas categorizadas por área (programação, arte, design, áudio)
- **Persistência local** - Salva progresso das tarefas no navegador
- **Exportação** - Exporta resultados em formato JSON

## 📁 Estrutura do Projeto

```
Producer/
├── index.html          # Página principal
├── styles.css          # Estilos CSS
├── script.js           # Lógica JavaScript
└── README.md          # Este arquivo
```

## 🛠️ Como Usar

1. **Abra o arquivo `index.html`** em qualquer navegador moderno
2. **Faça upload do seu GDD** - arraste e solte ou clique para selecionar
3. **Clique em "Analisar GDD"** - a IA processará o documento
4. **Visualize os resultados** - roadmap, tarefas e visão geral do projeto
5. **Marque tarefas concluídas** - o progresso é salvo automaticamente
6. **Exporte os resultados** - baixe um arquivo JSON com todos os dados

## 🔧 Configuração da API de IA

O projeto inclui uma simulação de IA para demonstração. Para usar uma API real:

### OpenAI GPT
```javascript
// No arquivo script.js, substitua a função analyzeWithRealAI
async function analyzeWithRealAI(content) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer SEU_TOKEN_AQUI'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000
        })
    });
    
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}
```

### Anthropic Claude
```javascript
async function analyzeWithRealAI(content) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'SEU_TOKEN_AQUI',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
        })
    });
    
    const data = await response.json();
    return JSON.parse(data.content[0].text);
}
```

### Google Gemini
```javascript
async function analyzeWithRealAI(content) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=SEU_TOKEN_AQUI`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    
    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
}
```

## 🎮 Exemplo de GDD

Para testar o sistema, você pode usar este exemplo de GDD:

```
GAME DESIGN DOCUMENT
Título: Legends of Aetheria
Gênero: RPG de Fantasia
Plataforma: PC, PlayStation, Xbox

VISÃO GERAL:
Legends of Aetheria é um RPG de fantasia medieval com mundo aberto, onde os jogadores exploram um reino mágico cheio de criaturas místicas, masmorras perigosas e segredos antigos.

GAMEPLAY:
- Sistema de combate estratégico em turnos
- Crafting de itens e equipamentos
- Sistema de progressão baseado em habilidades
- Quests principais e secundárias
- Exploração de mundo aberto

CARACTERÍSTICAS TÉCNICAS:
- Engine: Unity 3D
- Arte: Estilo cartoon/anime
- Áudio: Trilha sonora orquestral
- Duração estimada: 40-60 horas
- Tamanho da equipe: 6 desenvolvedores
```

## 🎨 Personalização

### Cores e Tema
Edite as variáveis CSS no arquivo `styles.css`:
```css
:root {
    --primary-color: #6366f1;
    --secondary-color: #f59e0b;
    --success-color: #10b981;
    /* ... outras cores */
}
```

### Categorias de Tarefas
Modifique a função `generateMockAnalysis()` no `script.js` para adicionar novas categorias ou alterar as existentes.

## 📱 Compatibilidade

- **Navegadores**: Chrome, Firefox, Safari, Edge (versões modernas)
- **Dispositivos**: Desktop, tablet e mobile (design responsivo)
- **Tamanho de arquivo**: Máximo 10MB para upload

## 🔒 Segurança e Privacidade

- Os arquivos são processados localmente no navegador
- Nenhum dado é enviado para servidores externos (exceto APIs de IA configuradas)
- O progresso das tarefas é salvo apenas no localStorage do navegador

## 🚧 Limitações Atuais

- Extração de texto de PDFs complexos pode ser limitada
- Análise simulada por padrão (requer configuração de API real)
- Sem autenticação ou sincronização em nuvem

## 🔮 Melhorias Futuras

- [ ] Suporte para mais formatos de arquivo
- [ ] Templates de GDD integrados
- [ ] Colaboração em tempo real
- [ ] Integração com ferramentas de gestão de projetos
- [ ] Estimativas de tempo mais precisas
- [ ] Análise de viabilidade técnica

## 📄 Licença

Este projeto é open source e está disponível sob a licença MIT.

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir melhorias
- Enviar pull requests
- Compartilhar feedback

---

Desenvolvido com ❤️ para a comunidade de desenvolvimento de jogos indie.
