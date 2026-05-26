// ============================================================
// PRODUCER - Game Roadmap Generator
// Arquitetura: GDD → Objetivos Macro → OKRs → Tarefas de Sprint
// ============================================================

// Estado da aplicação
let currentFile = null;
let analysisResult = null;

// Configuração de equipe (sliders) — persiste entre re-renders
let teamConfig = { programming: 1, art: 1, design: 1, audio: 1, qa: 1, production: 1 };

// Modo de exibição da timeline: 'simple' = uma barra por área | 'detailed' = uma barra por objetivo
let timelineMode = 'detailed';

// Resultado do scheduling (objectives com startMonth/endMonth calculados pelo scheduler)
let scheduledResult = null;

// Elementos DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFile = document.getElementById('removeFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const exportBtn = document.getElementById('exportBtn');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

// ============================================================
// GDD PADRÃO — Template fixo com seções enxutas
// A IA preenche este template com base no GDD enviado pelo usuário.
// Cada fase do roadmap lê apenas as seções relevantes.
// ============================================================
const GDD_TEMPLATE = {
    // — Identidade do projeto —
    titulo: '',
    genero: '',
    subgenero: '',
    plataformas: '',
    engine: '',
    perspectiva: '',           // ex: top-down, first-person, side-scroll
    modo: '',                  // single-player, multiplayer, co-op

    // — Equipe —
    tamanho_equipe: '',        // ex: solo, 2 pessoas, 5 pessoas
    papeis: '',                // ex: programador, artista 2D, sound designer

    // — Conceito —
    sinopse: '',               // 2-4 frases: o que é o jogo
    diferenciais: '',          // o que torna este jogo único
    referencias: '',           // jogos/filmes/obras de referência
    publico_alvo: '',

    // — Mecânicas —
    mecanica_principal: '',    // loop de gameplay central
    mecanicas_secundarias: '', // sistemas de suporte
    progressao: '',            // como o jogador avança
    economia: '',              // recursos, moedas, itens
    ia_inimigos: '',           // comportamento dos inimigos (se houver)

    // — Narrativa —
    contexto_mundo: '',        // setting/universo
    protagonista: '',          // quem é o personagem principal
    antagonista: '',           // vilão ou conflito central
    estrutura_narrativa: '',   // linear, aberta, episódica
    tom: '',                   // ex: dark, humor, épico, melancólico

    // — Arte —
    estilo_visual: '',         // ex: pixel art, low poly, cartoon, realista
    paleta_cores: '',          // ex: cores quentes, monocromático, vibrante
    resolucao_aspecto: '',     // ex: 1080p, 16:9, 4:3 pixel art
    personagens_principais: '', // lista dos personagens com breve descrição
    ambientes_principais: '',  // lista dos cenários/biomas

    // — Áudio —
    estilo_musical: '',        // ex: chiptune, orquestral, ambient, eletrônico
    referencias_audio: '',     // referências de trilha sonora
    voice_over: '',            // sim/não e detalhes

    // — Escopo —
    duracao_estimada: '',      // tempo de jogo estimado
    numero_fases: '',          // quantas fases/níveis/mundos
    duracao_desenvolvimento: '', // meses estimados
    plataforma_lancamento: '', // onde vai lançar primeiro

    // — Sistemas únicos e diferenciais técnicos —
    mecanicas_unicas: '',      // mecânicas que não existem em outros jogos — descrever com precisão
    sistema_finais: '',        // como os finais funcionam (condições, quantidade, diferenças)
    formato_extra: '',         // produto adicional ao jogo (livro, trilha, quadrinho, etc.)
    arco_emocional: '',        // como o estado emocional/narrativo muda ao longo das fases
};

// Seções do GDD relevantes por área de desenvolvimento
const GDD_SECOES_POR_AREA = {
    programming: ['titulo', 'genero', 'engine', 'perspectiva', 'modo', 'mecanica_principal', 'mecanicas_secundarias', 'mecanicas_unicas', 'progressao', 'economia', 'ia_inimigos', 'numero_fases', 'sistema_finais', 'duracao_desenvolvimento'],
    art:         ['titulo', 'estilo_visual', 'paleta_cores', 'resolucao_aspecto', 'personagens_principais', 'ambientes_principais', 'referencias', 'numero_fases', 'tom'],
    design:      ['titulo', 'genero', 'mecanica_principal', 'mecanicas_secundarias', 'mecanicas_unicas', 'progressao', 'economia', 'ia_inimigos', 'estrutura_narrativa', 'sistema_finais', 'numero_fases', 'duracao_estimada', 'diferenciais', 'arco_emocional'],
    audio:       ['titulo', 'tom', 'estilo_musical', 'referencias_audio', 'voice_over', 'ambientes_principais', 'personagens_principais', 'numero_fases'],
    narrative:   ['titulo', 'contexto_mundo', 'protagonista', 'antagonista', 'estrutura_narrativa', 'sistema_finais', 'tom', 'duracao_estimada', 'arco_emocional', 'formato_extra'],
    qa:          ['titulo', 'plataformas', 'engine', 'modo', 'numero_fases', 'sistema_finais', 'duracao_desenvolvimento'],
};

// Converte qualquer valor para string segura (nunca lança erro)
function toStr(v) {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(toStr).join(', ');
    if (typeof v === 'object') return Object.entries(v).map(([a, b]) => `${a}: ${b}`).join('; ');
    return String(v);
}

// Monta um bloco de texto com apenas as seções relevantes para uma área
function gddSecoesPorArea(gddNormalizado, area) {
    const chaves = GDD_SECOES_POR_AREA[area] || Object.keys(GDD_TEMPLATE);
    return chaves
        .filter(k => toStr(gddNormalizado[k]).trim())
        .map(k => `${k.replace(/_/g, ' ')}: ${toStr(gddNormalizado[k])}`)
        .join('\n');
}

// Monta o GDD completo como texto legível
function gddCompleto(gddNormalizado) {
    return Object.entries(gddNormalizado)
        .filter(([, v]) => toStr(v).trim())
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${toStr(v)}`)
        .join('\n');
}

// ============================================================
// BASE DE CONHECIMENTO POR GÊNERO DE JOGO
// Usada para enriquecer os prompts com contexto de jogos reais
// ============================================================
const GENRE_KNOWLEDGE = {
    rpg: {
        label: "RPG",
        keywords: ["rpg", "role-playing", "quest", "level up", "inventory", "npc", "dialogue", "story"],
        objectives: [
            "Sistema de Progressão do Personagem",
            "Sistema de Quests e Narrativa",
            "Sistema de Combate",
            "Sistema de Inventário e Economia",
            "Mundo e Exploração",
            "Sistema de Diálogos e NPCs",
            "Arte e Assets do Mundo",
            "Áudio e Trilha Sonora"
        ],
        okr_examples: {
            "Sistema de Quests e Narrativa": [
                "Estrutura de dados de quests (main/side/daily)",
                "Sistema de tracking e progresso de quests",
                "UI de journal/diário de quests",
                "Sistema de recompensas por quest",
                "Quest giver NPC behavior",
                "Integração quests com mapa"
            ],
            "Sistema de Progressão do Personagem": [
                "Sistema de XP e level up",
                "Árvore de habilidades (skill tree)",
                "Sistema de atributos (STR/DEX/INT etc)",
                "Sistema de classes/builds",
                "Persistência de progressão",
                "UI de status do personagem"
            ]
        },
        sprint_examples: {
            "Sistema de tracking e progresso de quests": [
                "Criar ScriptableObject/struct de Quest com campos (id, nome, descrição, objetivos, recompensas)",
                "Implementar QuestManager singleton com lista de quests ativas/completas",
                "Criar método StartQuest() e CompleteQuest() com validação de pré-requisitos",
                "Implementar sistema de objetivos com contadores (matar X inimigos, coletar Y itens)",
                "Salvar e carregar estado das quests no save file",
                "Criar evento OnQuestUpdated para notificar UI"
            ]
        }
    },
    platformer: {
        label: "Plataformer",
        keywords: ["platformer", "platform", "jump", "run", "side-scroll", "2d", "plataforma"],
        objectives: [
            "Movimento e Física do Personagem",
            "Design de Fases e Level Design",
            "Sistema de Inimigos e IA",
            "Coletáveis e Power-ups",
            "Câmera e Scrolling",
            "Arte e Animações",
            "Áudio e Feedback de Jogo",
            "UI e Menus"
        ],
        okr_examples: {
            "Movimento e Física do Personagem": [
                "Controller de movimento (andar/correr)",
                "Sistema de pulo (single/double/wall jump)",
                "Detecção de colisão com terreno",
                "Animações de estado (idle/run/jump/fall)",
                "Coyote time e input buffering",
                "Sistema de dash/roll"
            ]
        }
    },
    fps: {
        label: "FPS / Shooter",
        keywords: ["fps", "first person", "shooter", "gun", "weapon", "shoot", "tiro"],
        objectives: [
            "Sistema de Armas e Combate",
            "Movimento do Jogador (FPS Controller)",
            "IA de Inimigos",
            "Design de Mapas e Levels",
            "Sistema de Dano e Hitboxes",
            "HUD e UI de Combate",
            "Sistema de Progressão/Loadout",
            "Áudio e Feedback Visual"
        ],
        okr_examples: {
            "Sistema de Armas e Combate": [
                "Base weapon class com atributos (dano, cadência, recarga)",
                "Sistema de hitscan vs projectile",
                "Animações de arma (idle, atirar, recarregar)",
                "Sistema de munição e recarga",
                "Recoil e spread pattern",
                "Troca de armas e inventário de loadout"
            ]
        }
    },
    puzzle: {
        label: "Puzzle",
        keywords: ["puzzle", "enigma", "logic", "solve", "brain", "match", "quebra-cabeça"],
        objectives: [
            "Core Puzzle Mechanics",
            "Level Design e Progressão de Dificuldade",
            "Sistema de Dicas e Tutorial",
            "Feedback Visual e Sonoro",
            "UI e Navegação",
            "Sistema de Salvamento e Progresso",
            "Arte e Estilo Visual"
        ]
    },
    strategy: {
        label: "Estratégia",
        keywords: ["strategy", "rts", "turn-based", "tower defense", "resource", "build", "estratégia"],
        objectives: [
            "Sistema de Recursos e Economia",
            "Sistema de Construção/Build",
            "IA de Unidades e Inimigos",
            "Mapa e Território",
            "Sistema de Pesquisa/Tech Tree",
            "UI de Gestão e Informação",
            "Balanceamento e Meta",
            "Multijogador (se aplicável)"
        ]
    },
    adventure: {
        label: "Aventura/Action-Adventure",
        keywords: ["adventure", "explore", "open world", "action", "sword", "combat", "dungeon", "aventura"],
        objectives: [
            "Sistema de Combate e Habilidades",
            "Exploração e Mundo Aberto",
            "Sistema de Progressão",
            "Narrativa e Cutscenes",
            "Sistema de Inventário",
            "Dungeons e Puzzles Ambientais",
            "Arte do Mundo e Assets",
            "Áudio Dinâmico"
        ]
    },
    horror: {
        label: "Horror/Survival Horror",
        keywords: ["horror", "survival", "scary", "monster", "terror", "atmosfera"],
        objectives: [
            "Atmosfera e Tensão",
            "Sistema de Recursos Limitados",
            "IA do Antagonista",
            "Stealth e Evasão",
            "Narrativa e Lore",
            "Sistema de Sanidade/Medo",
            "Áudio e Sound Design",
            "Iluminação e Efeitos Visuais"
        ]
    },
    generic: {
        label: "Genérico",
        keywords: [],
        objectives: [
            "Core Gameplay Loop",
            "Sistema de Progressão",
            "Arte e Assets",
            "Áudio e Música",
            "UI e Menus",
            "Testes e QA",
            "Polimento e Feel",
            "Lançamento e Deploy"
        ]
    }
};

// ============================================================
// PIPELINES COMPLETOS POR ÁREA DE PRODUÇÃO
// Usados para garantir que a IA não esqueça nenhuma etapa
// Cada área tem: fases (macro), sub-etapas comuns e exemplos
// de tarefas de sprint reais da indústria
// ============================================================
const AREA_PIPELINES = {

    art: {
        label: "Arte",
        description: "Pipeline completo de arte 3D/2D para jogos",
        phases: [
            {
                phase: "Direção de Arte e Pré-Produção",
                okrs: [
                    "Definir style guide visual (paleta, iluminação, referências)",
                    "Criar mood boards e referências por bioma/área",
                    "Concept art do personagem principal (10+ variações)",
                    "Concept art dos personagens secundários e NPCs",
                    "Concept art dos inimigos (cada tipo)",
                    "Concept art dos ambientes (cada bioma/área)",
                    "Concept art de props e itens importantes",
                    "Concept art de UI/HUD (wireframes visuais)",
                    "Definir limites técnicos: poly count, resolução de texturas, atlas",
                    "Criar guia de nomenclatura e organização de assets"
                ],
                sprint_examples: [
                    "Criar moodboard com 50+ referências para bioma floresta sombria",
                    "Desenhar 3 propostas de silhueta para o personagem principal",
                    "Definir paleta de cores principal (primária, secundária, accent) no style guide",
                    "Escrever documento de limites técnicos de arte (poly budget, texture budget)",
                    "Criar sheet de referência de escala (personagem vs objetos do mundo)"
                ]
            },
            {
                phase: "Personagem Principal — Pipeline Completo",
                okrs: [
                    "Concept art final aprovado do personagem principal",
                    "Modelagem high poly do personagem principal",
                    "Retopologia e UV unwrap (low poly)",
                    "Texturização PBR (albedo, normal, roughness, metallic, emissive)",
                    "Rigging — esqueleto e pesos",
                    "Animações de locomotion (idle, walk, run, sprint)",
                    "Animações de combate (ataque 1/2/3, esquiva, bloqueio, hit reaction, morte)",
                    "Animações de interação (pegar item, abrir porta, escalar, nadar)",
                    "Animações de UI/cutscene",
                    "Blend trees e state machine de animação",
                    "VFX do personagem (rastros de arma, partículas de habilidade, impactos)"
                ],
                sprint_examples: [
                    "Modelar tronco e membros do personagem principal em ZBrush (high poly)",
                    "Modelar acessórios e roupa do personagem em ZBrush",
                    "Fazer retopologia do corpo completo para ~8000 triângulos",
                    "Criar UV map sem sobreposição com aproveitamento de 90%+",
                    "Bake de normal map, ambient occlusion e curvature do high poly",
                    "Pintar albedo map no Substance Painter",
                    "Criar roughness/metallic maps para materiais diferentes (pele, tecido, metal)",
                    "Criar rig de esqueleto com 60-80 ossos incluindo facial rig básico",
                    "Fazer skinning e testar pesos nas poses extremas",
                    "Animar ciclo de idle (30 frames, loop perfeito)",
                    "Animar ciclo de walk (24 frames, loop perfeito)",
                    "Animar ciclo de run (20 frames, loop perfeito)",
                    "Animar ataque básico 1 (swing de espada, 18 frames)",
                    "Animar ataque combo 2 (18 frames, emenda com ataque 1)",
                    "Animar ataque combo 3 (24 frames, finalizador)",
                    "Animar esquiva com roll (20 frames)",
                    "Animar bloqueio e hit reaction (12 frames cada)",
                    "Animar morte (30 frames, 2 variações)",
                    "Criar blend tree de locomotion no Animator Controller",
                    "Criar partícula de trilha de espada no VFX Graph",
                    "Criar efeito de impacto de golpe (spark + blood opcional)"
                ]
            },
            {
                phase: "NPCs — Pipeline por Tipo",
                okrs: [
                    "Concept art de cada arquétipo de NPC (comerciante, guerreiro, mago, etc.)",
                    "Modelagem e texturização base (usar como base para variações)",
                    "Sistema de variações de roupa/cor por instância",
                    "Animações compartilhadas: idle, walk, fala (gestos)",
                    "Animações específicas por função (forja, venda, patrulha)",
                    "Facial animations para diálogos (lipsync básico)",
                    "LODs (Level of Detail) para NPCs distantes"
                ],
                sprint_examples: [
                    "Modelar NPC base masculino (base mesh reutilizável)",
                    "Criar 3 variações de roupa por tecido usando o mesmo UV",
                    "Criar 4 variações de skin tone e cor de cabelo",
                    "Animar idle NPC (olhar ao redor, ajustar roupa — 60 frames, loop)",
                    "Animar walk genérico de NPC (reutilizável para todos os NPCs)",
                    "Criar LOD1 (50% polys) e LOD2 (25% polys) do NPC base"
                ]
            },
            {
                phase: "Inimigos — Pipeline por Tipo",
                okrs: [
                    "Concept art de cada tipo de inimigo (soldado, bruto, mago, boss)",
                    "Modelagem e texturização de cada inimigo",
                    "Rigging e skinning de cada inimigo",
                    "Animações de combate por tipo (ataque melee, distância, especial)",
                    "Animações de estado (patrol idle, alert, stagger, morte)",
                    "VFX de habilidades e ataques dos inimigos",
                    "Boss — pipeline especial com animações cinemáticas"
                ],
                sprint_examples: [
                    "Modelar inimigo soldado básico (~5000 tris)",
                    "Texturizar inimigo soldado (PBR completo)",
                    "Animar ataque de espada do inimigo soldado (2 variações)",
                    "Animar hit reaction e morte do inimigo soldado",
                    "Modelar e texturizar inimigo bruto (boss menor, ~8000 tris)",
                    "Animar ataque slam do bruto (slow, impactante, 35 frames)",
                    "Criar VFX de terra levantando no ataque slam do bruto"
                ]
            },
            {
                phase: "Ambientes — Pipeline por Bioma",
                okrs: [
                    "Concept art detalhado de cada bioma (wide shots, detalhe, paleta)",
                    "Kit de modular pieces para cada bioma (paredes, chão, teto, bordas)",
                    "Terrain sculpting e texturização (splatmap)",
                    "Vegetação: árvores, arbustos, grama (com LODs e wind shader)",
                    "Props de ambiente (grandes: construções, ruínas, penhascos)",
                    "Props médios (barris, caixas, mesas, cadeiras, luminárias)",
                    "Props pequenos (decoração de chão, debris, folhas, pedras)",
                    "Iluminação do bioma (baked lightmap + realtime fill)",
                    "Skybox e atmosfera (fog, god rays, nuvens)",
                    "Efeitos ambientais (partículas de poeira, fogo, água)"
                ],
                sprint_examples: [
                    "Scultar 5 variações de pedras modulares para bioma floresta",
                    "Criar material de pedra musgosa com blend entre 2 camadas",
                    "Modelar árvore hero (árvore principal do bioma — high detail)",
                    "Criar 3 variações de árvore low (background trees, LOD agressivo)",
                    "Modelar kit de cerca de madeira (reta, curva, poste, portão)",
                    "Criar shader de grama com wind sway e interaction",
                    "Fazer scatter de vegetação em área de teste 50x50m",
                    "Configurar lightmap resolution e fazer bake de iluminação",
                    "Criar VFX de fireflies para bioma floresta noturna",
                    "Modelar ruína de parede com 3 alturas modulares",
                    "Criar material de concreto envelhecido com decal de rachadura"
                ]
            },
            {
                phase: "UI Art e Interface",
                okrs: [
                    "Style guide visual de UI (fonte, cores, bordas, iconografia)",
                    "Mockup de todas as telas principais",
                    "Arte final do HUD (vida, stamina, minimapa, ícones de habilidade)",
                    "Arte final do inventário e equipamentos",
                    "Arte final do menu de pausa e configurações",
                    "Arte final do menu principal (background, logotipo)",
                    "Ícones de habilidades (cada skill, item e status effect)",
                    "Ícones de itens do inventário (cada item único)",
                    "Fontes e hierarquia tipográfica",
                    "Animações de UI (transições, feedback de dano, level up)"
                ],
                sprint_examples: [
                    "Criar mockup de HUD em alta fidelidade no Figma",
                    "Desenhar 20 ícones de habilidades no estilo definido",
                    "Criar arte final da barra de vida com estados (cheio, médio, crítico)",
                    "Criar 50 ícones de itens (armas, armaduras, consumíveis)",
                    "Desenvolver animação de level up (partículas + UI flash)",
                    "Criar background art do menu principal (landscape art)"
                ]
            },
            {
                phase: "Cutscenes e Narrativa Visual",
                okrs: [
                    "Storyboard de cada cutscene",
                    "Animações cinemáticas de personagens para cutscenes",
                    "Iluminação específica de cutscene",
                    "Integrações com sistema de diálogo (lipsync, expressões)"
                ],
                sprint_examples: [
                    "Fazer storyboard da cutscene de abertura (12 shots)",
                    "Animar cutscene de abertura no Unity Timeline",
                    "Criar expressões faciais: feliz, triste, raiva, neutro para PJ",
                    "Integrar lipsync básico com Oculus Lipsync ou manual keyframe"
                ]
            },
            {
                phase: "Polimento e Otimização de Arte",
                okrs: [
                    "Revisão de consistência de estilo em todos os assets",
                    "Otimização de draw calls (batching, atlasing)",
                    "Revisão e correção de LODs",
                    "Revisão de qualidade de texturas em diferentes resoluções",
                    "Streaming de assets e memory budget final",
                    "Correção de artefatos visuais reportados pelo QA"
                ],
                sprint_examples: [
                    "Criar texture atlas para props pequenos (reduz draw calls em 40%)",
                    "Revisar e corrigir LODs de todos os personagens",
                    "Passar por todos os biomas e corrigir inconsistências de estilo",
                    "Otimizar vegetação: reduzir densidade em áreas off-screen"
                ]
            }
        ]
    },

    programming: {
        label: "Programação",
        description: "Pipeline completo de engenharia para jogos — agnóstico de engine e plataforma",
        phases: [
            {
                phase: "Arquitetura, setup e fundação técnica",
                okrs: [
                    "Definir arquitetura geral do projeto (pastas, módulos, padrões de código)",
                    "Configurar controle de versão (Git + LFS para assets binários)",
                    "Configurar pipeline de build automatizado (CI/CD)",
                    "Implementar sistema de logs e debug utilities",
                    "Implementar sistema de eventos/mensageria desacoplado",
                    "Implementar pool de objetos genérico (performance)",
                    "Configurar sistema de flags de debug e cheat codes para dev",
                    "Documentar convenções de código e arquitetura para o time"
                ],
                sprint_examples: [
                    "Criar estrutura de pastas do projeto com guia de nomenclatura",
                    "Configurar Git LFS para extensões de asset (.psd, .fbx, .wav, .mp4)",
                    "Implementar EventBus/MessageBroker genérico com tipagem",
                    "Implementar ObjectPool<T> com grow/shrink automático",
                    "Criar sistema de cheat console ativável por hotkey (god mode, teleport, etc.)"
                ]
            },
            {
                phase: "Input system e controles",
                okrs: [
                    "Abstração de input agnóstica de dispositivo (teclado, gamepad, touch, mouse)",
                    "Remapping de controles pelo jogador",
                    "Suporte a múltiplos layouts de gamepad (Xbox, PlayStation, Switch)",
                    "Input buffering e coyote time (para ações de timing crítico)",
                    "Perfis de controle salvos por jogador",
                    "Detecção automática de dispositivo e troca de prompts na UI"
                ],
                sprint_examples: [
                    "Criar InputAction map com todas as ações do jogo (movement, attack, interact, menu)",
                    "Implementar rebinding de teclas com persistência em arquivo de configuração",
                    "Criar sistema de prompt icons que troca automaticamente entre KB e gamepad",
                    "Implementar input buffer de 10 frames para ações de combate"
                ]
            },
            {
                phase: "Gerenciamento de cenas e loading",
                okrs: [
                    "Sistema de gerenciamento de cenas/estados do jogo (SceneManager)",
                    "Tela de loading com progresso real (não fake)",
                    "Loading assíncrono de assets em background (async/await ou coroutine)",
                    "Streaming de mundo (load/unload de chunks conforme o jogador avança)",
                    "Transições entre cenas (fade, wipe, cutscene gate)",
                    "Persistência de estado entre cenas (quais objetos sobrevivem ao load)",
                    "Tratamento de erros de loading (asset faltando, timeout)"
                ],
                sprint_examples: [
                    "Implementar SceneLoader com callbacks OnLoadStart/OnLoadComplete",
                    "Criar tela de loading com barra de progresso atrelada ao AsyncOperation",
                    "Implementar fade-to-black como transição padrão entre áreas",
                    "Criar sistema de DontDestroyOnLoad para managers persistentes",
                    "Implementar loading de audio e texturas em background sem hitch"
                ]
            },
            {
                phase: "Sistema de câmera",
                okrs: [
                    "Câmera follow com suavização configurável (lerp, SmoothDamp)",
                    "Câmera em primeira ou terceira pessoa (dependendo do gênero)",
                    "Sistema de lock-on / targeting (se combate exige)",
                    "Câmera cinemática para cutscenes (dolly, zoom, shake)",
                    "Camera shake com falloff (impacto, explosão, dano)",
                    "Collision avoidance de câmera (não atravessar paredes)",
                    "Zoom in/out e field of view dinâmico por estado",
                    "Câmera de menu e inventário (separada do gameplay)"
                ],
                sprint_examples: [
                    "Implementar câmera follow com SmoothDamp (sem snap)",
                    "Implementar collision avoidance: raycast da câmera ao personagem",
                    "Criar CameraShake com trauma system (trauma decai com tempo)",
                    "Implementar lock-on: listar alvos em cone de visão, selecionar mais próximo",
                    "Criar VirtualCamera de cutscene com blend in/out"
                ]
            },
            {
                phase: "Sistema de UI — arquitetura e telas",
                okrs: [
                    "Definir arquitetura de UI (stack de telas, MVP/MVC, data binding)",
                    "Sistema de abertura e fechamento de telas (push/pop stack)",
                    "Sistema de navegação por gamepad na UI (focus, D-pad nav)",
                    "Sistema de tooltips e popovers",
                    "Animações e transições de UI (fade, slide, scale)",
                    "Sistema de notificações e toasts in-game",
                    "Sistema de confirmação de ação (modal sim/não)",
                    "Responsividade e suporte a resoluções diferentes (16:9, 21:9, 4:3)",
                    "Suporte a Safe Area para TV (overscan) e notch de celular"
                ],
                sprint_examples: [
                    "Implementar UIManager com stack de telas (Open, Close, CloseAll)",
                    "Criar sistema de foco de gamepad que navega entre elementos interativos",
                    "Implementar NotificationQueue: lista de toasts que entram e saem sem sobrepor",
                    "Criar ConfirmationDialog reutilizável com callbacks de sim/não",
                    "Implementar CanvasScaler configurado para múltiplas resoluções"
                ]
            },
            {
                phase: "UI — telas específicas do jogo",
                okrs: [
                    "Menu principal (new game, continue, options, quit)",
                    "Tela de pausa (resume, options, save, quit to menu)",
                    "HUD de gameplay (vida, stamina, minimapa, habilidades, ícones de status)",
                    "Tela de inventário (grid de slots, drag & drop, equip, drop, inspect)",
                    "Tela de equipamentos (comparação de stats, sockets, aparência)",
                    "Tela de habilidades / skill tree",
                    "Tela de mapa (geral e por área, fog of war, marcadores)",
                    "Tela de journal de quests (ativas, completas, falhadas)",
                    "Tela de diálogo (caixa de fala, retrato, escolhas)",
                    "Tela de lore / codex / enciclopédia",
                    "Tela de configurações (gráficos, áudio, controles, acessibilidade)",
                    "Tela de créditos",
                    "Tela de game over e tela de vitória",
                    "Tela de seleção de personagem / new game setup (se aplicável)"
                ],
                sprint_examples: [
                    "Implementar grade de inventário 6×8 com drag & drop entre slots",
                    "Criar tooltip de item com stats, descrição e comparação com equipado",
                    "Implementar minimapa: renderizar em RenderTexture, aplicar fog of war",
                    "Criar tela de mapa com zoom, pan e marcadores de quest/fast travel",
                    "Implementar skill tree com nodes, conexões e preview de efeito"
                ]
            },
            {
                phase: "Sistema de diálogo e narrativa técnica",
                okrs: [
                    "Parser de arquivo de diálogo (formato próprio, JSON, Yarn, Ink ou similar)",
                    "Motor de execução de diálogo (avanço, escolhas, branching)",
                    "Sistema de flags e variáveis de narrativa (bool, int, string por jogo)",
                    "Condicionais em diálogo (mostrar linha se flag X = true)",
                    "Consequências de diálogo (setar flags, dar itens, abrir quests)",
                    "Lipsync básico (shape keys driven by phoneme ou por beat de áudio)",
                    "Retratos e expressões de personagens na caixa de diálogo",
                    "Suporte a voice over (sincronizar texto com áudio)",
                    "Skip e avanço de texto (letras por segundo configurável)",
                    "Log de diálogo (reler linhas passadas)",
                    "Localização: troca de strings em runtime sem rebuild"
                ],
                sprint_examples: [
                    "Criar parser de arquivo .dialogue (nó, texto, personagem, escolhas, condição)",
                    "Implementar DialogueRunner: processar nós, aguardar escolha, avançar",
                    "Criar DialogueFlagSystem: set/get/check flags persistidas no save",
                    "Implementar typewriter effect com punctuation pause e skip no click",
                    "Criar sistema de portraits: carregar sprite por personagem + expressão"
                ]
            },
            {
                phase: "Sistema de quests",
                okrs: [
                    "Estrutura de dados de quest (id, tipo, estado, objetivos, recompensas, pré-requisitos)",
                    "QuestManager: registrar, iniciar, atualizar, completar, falhar quests",
                    "Tipos de objetivo: ir a local, falar com NPC, matar X, coletar X, usar item, sobreviver",
                    "Quest giver: NPC que oferece, rastreia e conclui quests",
                    "Integração com diálogo: abrir/completar quest via nó de diálogo",
                    "Integração com mapa: marcadores de quest, waypoints",
                    "Notificações de quest (nova, atualizada, completa, falhada)",
                    "Quests com múltiplas etapas e sub-objetivos",
                    "Quests com timer (missão cronometrada)",
                    "Persistência de quests no save"
                ],
                sprint_examples: [
                    "Criar QuestDefinition ScriptableObject/JSON com todos os campos",
                    "Implementar QuestManager com métodos StartQuest, UpdateObjective, CompleteQuest",
                    "Criar ObjectiveTracker para tipo 'kill': escutar evento OnEnemyDied",
                    "Criar ObjectiveTracker para tipo 'collect': escutar evento OnItemPickedUp",
                    "Implementar marcador de waypoint no mundo que atualiza com objective ativo"
                ]
            },
            {
                phase: "Sistema de inventário e itens",
                okrs: [
                    "Definição de item (id, nome, tipo, stats, raridade, peso, ícone, descrição)",
                    "ItemDatabase: catálogo de todos os itens do jogo",
                    "Inventário do jogador (slots limitados ou peso/bulk)",
                    "Stacking de itens consumíveis",
                    "Drag & drop entre slots (inventário, equipamento, loja, baú, crafting)",
                    "Sistema de equipamento (slots por parte do corpo, comparação de stats)",
                    "Sistema de loot (drops de inimigos, baús, coleta do mundo)",
                    "Sistema de pick-up interativo (item no chão, prompt de coletar)",
                    "Lixo/descarte e venda de itens",
                    "Itens de quest (não podem ser descartados)",
                    "Persistência do inventário no save"
                ],
                sprint_examples: [
                    "Criar ItemDefinition com todos os campos (tipo enum, stats como dict flexível)",
                    "Implementar ItemDatabase com lookup por ID e por tag",
                    "Implementar InventoryComponent: add, remove, has, getAll com eventos",
                    "Criar LootTable: lista de itens com peso de probabilidade",
                    "Implementar PickupItem no mundo: trigger de coleta com prompt"
                ]
            },
            {
                phase: "Sistema de progressão do personagem",
                okrs: [
                    "Atributos base do personagem (vida, stamina, dano, defesa, velocidade, etc.)",
                    "Sistema de XP e level up com curva configurável",
                    "Distribuição de pontos por level up",
                    "Modificadores de atributo (equipamentos, buffs, debuffs, habilidades)",
                    "Cálculo de stat final: base + flat bonus + percent bonus (ordem importa)",
                    "Skill tree ou sistema de habilidades desbloqueáveis",
                    "Habilidades ativas (com cooldown, custo de stamina/mana)",
                    "Habilidades passivas (modificam atributos ou comportamento)",
                    "Reset de pontos e respec (se o jogo suportar)",
                    "Persistência de progressão no save"
                ],
                sprint_examples: [
                    "Criar StatSystem com base + flatModifiers + percentModifiers + computed final",
                    "Implementar XPSystem: dar XP, calcular level, disparar OnLevelUp",
                    "Implementar SkillTree como grafo: nós com prerequisite, custo e efeito",
                    "Criar AbilityComponent: lista de habilidades, cooldowns, custo de recurso",
                    "Implementar buff/debuff: stack de modificadores com duração e source"
                ]
            },
            {
                phase: "Sistema de combate",
                okrs: [
                    "Hitboxes e hurtboxes (áreas de ataque e de dano separadas)",
                    "Detecção de dano (overlap, raycast ou collider — conforme o gênero)",
                    "Cálculo de dano (ataque vs defesa, tipos elementais, crítico)",
                    "Estados de personagem durante combate (attacking, dodging, stunned, dead)",
                    "Sistema de combo (janelas de input, cancel windows)",
                    "Invencibilidade frames (i-frames na esquiva)",
                    "Stagger, knockback e hitstop (feedback de impacto)",
                    "Sistema de alvo/lock-on",
                    "Projéteis (criação, física, colisão, dano em área)",
                    "Área de efeito (AoE) com forma configurável",
                    "Sistema de morte e respawn/game over"
                ],
                sprint_examples: [
                    "Criar HitboxComponent com enable/disable via animation event",
                    "Implementar DamageSystem: calcular dano final com resistências",
                    "Criar CombatStateMachine: estados Idle, Attacking, Dodging, Stunned, Dead",
                    "Implementar hitstop: pausar animação por N frames no momento do impacto",
                    "Criar ProjectileComponent: mover, colidir, aplicar dano, destruir"
                ]
            },
            {
                phase: "IA de personagens e NPCs",
                okrs: [
                    "Máquina de estados ou behaviour tree para inimigos",
                    "Navegação e pathfinding no mapa (navmesh ou grid)",
                    "Percepção: visão (cone), audição (raio), memória de último avistamento",
                    "Comportamentos: patrol, idle, investigate, chase, attack, retreat, dead",
                    "Inimigos à distância vs corpo a corpo (lógica de distância ideal)",
                    "IA de grupo: flanqueamento, suporte, cobertura",
                    "NPCs não-combatentes: patrol de rota, reagir ao jogador, schedules (acordado/dormindo)",
                    "Reação a eventos do mundo (ouvir tiro, ver corpo, alarme ativado)"
                ],
                sprint_examples: [
                    "Implementar Behaviour Tree com Sequence, Selector, Condition, Action nodes",
                    "Criar PerceptionSystem: FieldOfView cone check + hearing radius check",
                    "Implementar PatrolBehaviour: seguir waypoints em loop, aguardar por tempo",
                    "Criar ChaseBehaviour: pathfind ao alvo, perder de vista após X segundos",
                    "Implementar NPCSchedule: waypoints e behaviours diferentes por hora do dia"
                ]
            },
            {
                phase: "Sistemas de mundo e interação",
                okrs: [
                    "Sistema de interação com objetos (porta, baú, alavanca, NPC, item)",
                    "Sistema de trigger e zone events (entrar em área = cutscene, spawn, etc.)",
                    "Sistema de tempo e ciclo dia/noite (se aplicável)",
                    "Sistema de clima dinâmico (se aplicável)",
                    "Sistema de fast travel (pontos desbloqueáveis)",
                    "Sistema de respawn de inimigos (timer ou never)",
                    "Destruição de ambiente (se aplicável)",
                    "Sistema de portas e travas (chave, puzzle, missão)"
                ],
                sprint_examples: [
                    "Criar InteractableComponent: detectar jogador em range, mostrar prompt, executar ação",
                    "Implementar DoorSystem: aberta/fechada/trancada, ouvir evento de chave",
                    "Criar TriggerZone: OnEnter executa lista de GameEvents configurados no editor",
                    "Implementar FastTravelSystem: unlock de pontos, tela de seleção, load de cena"
                ]
            },
            {
                phase: "Sistema de save e configurações",
                okrs: [
                    "Serialização de todos os dados do jogo (inventário, quests, flags, posição, progressão)",
                    "Múltiplos slots de save com screenshot e metadados",
                    "Auto-save em checkpoints e em saída do jogo",
                    "Sistema de configurações de jogo (gráficos, áudio, controles, idioma)",
                    "Persistência de configurações entre sessões (arquivo de config separado do save)",
                    "Versionamento de save (migrar saves antigos sem quebrar)",
                    "Backup de save e detecção de corrupção"
                ],
                sprint_examples: [
                    "Criar SaveData struct com todos os campos serializáveis",
                    "Implementar SaveManager: Write/Read em JSON com encrypt opcional",
                    "Criar SaveSlotUI: listar slots com nome, data, screenshot, tempo de jogo",
                    "Implementar ConfigManager: load no boot, apply imediato, save on change",
                    "Criar sistema de auto-save em checkpoint: disparado por trigger no mundo"
                ]
            },
            {
                phase: "Ferramentas internas para desenvolvimento (dev tools)",
                okrs: [
                    "Editor de quests: criar/editar quests sem programar (inspector/editor tool)",
                    "Editor de itens: criar/editar itens no editor com preview",
                    "Editor de diálogos: criar/editar árvores de diálogo visualmente",
                    "Editor de NPCs: configurar rotas, schedules, diálogos sem código",
                    "Editor de loot tables: configurar drops com peso visual",
                    "Editor de níveis/rooms: pintar tiles, colocar objetos, testar em play mode",
                    "Sistema de playtesting rápido (spawn no ponto X, dar item Y, set flag Z)",
                    "Overlay de debug em runtime (hitboxes, navmesh, percepção, stats)"
                ],
                sprint_examples: [
                    "Criar QuestEditor no inspector: campos drag & drop para NPCs e objetivos",
                    "Criar ItemEditor: formulário visual com preview do ícone e stats calculados",
                    "Implementar debug overlay: F1 mostra hitboxes, F2 mostra navmesh, F3 mostra percepção",
                    "Criar DevConsole: comandos de texto para dar item, setar flag, teleportar"
                ]
            },
            {
                phase: "Rendering e performance",
                okrs: [
                    "Configurações de qualidade gráfica (low/medium/high/ultra)",
                    "Sistema de LOD (Level of Detail) para meshes e texturas",
                    "Occlusion culling (não renderizar o que está atrás de paredes)",
                    "Batching de draw calls (static e dynamic batching)",
                    "Profiling de CPU e GPU: identificar gargalos",
                    "Memory profiling: detectar vazamentos e picos",
                    "Target framerate e vsync configuráveis",
                    "Configurações de resolução e modo de tela (fullscreen, windowed, borderless)"
                ],
                sprint_examples: [
                    "Configurar 4 níveis de qualidade gráfica com presets de shadow, AA, textures",
                    "Implementar QualitySettings: aplicar preset ao iniciar e ao mudar em runtime",
                    "Criar benchmark scene para medir framerate em hardware mínimo alvo",
                    "Identificar top 5 gargalos com profiler e documentar para correção"
                ]
            },
            {
                phase: "Áudio — implementação técnica",
                okrs: [
                    "Integrar middleware de áudio (FMOD, Wwise, ou sistema nativo do engine)",
                    "Gerenciador de áudio: play, stop, pause, volume por canal (música, sfx, voz, ambiente)",
                    "Áudio 3D posicional (sfx no espaço 3D com attenuation)",
                    "Áudio dinâmico e adaptativo (camadas que entram e saem por estado de gameplay)",
                    "Ducking: baixar música quando voz está tocando",
                    "Reverb e filtros por ambiente (caverna, exterior, interior)"
                ],
                sprint_examples: [
                    "Integrar FMOD/Wwise: criar AudioManager wrapper com Play(eventPath), Stop, SetParam",
                    "Implementar AudioMixer com grupos: Music, SFX, Ambient, Voice — cada com volume slider",
                    "Criar AudioEmitter3D: posicionar no mundo com attenuation por distância",
                    "Implementar music transition: crossfade entre trilhas ao trocar de área"
                ]
            },
            {
                phase: "Plataforma, localização e lançamento",
                okrs: [
                    "Integração com SDK da plataforma alvo (Steam, PlayStation, Xbox, Nintendo, Mobile)",
                    "Sistema de conquistas/troféus (achievements)",
                    "Sistema de placar e leaderboards (se aplicável)",
                    "Cloud save (Steam Cloud, PSN Cloud, iCloud)",
                    "Localização: sistema de strings com suporte a idiomas (pt-BR, en, es, fr, etc.)",
                    "Acessibilidade: tamanho de fonte ajustável, modo daltônico, legendas",
                    "Build pipeline automatizado para cada plataforma",
                    "Certificação de plataforma (checklist completo Sony/MS/Nintendo/Valve/Apple/Google)",
                    "Analytics e telemetria (opcional: sessões, eventos, crash reports)"
                ],
                sprint_examples: [
                    "Integrar Steamworks SDK: achievements, cloud save, overlay",
                    "Criar LocalizationSystem: carregar arquivo de strings por idioma, trocar em runtime",
                    "Implementar tela de seleção de idioma no first boot",
                    "Criar build script automatizado (CI) que gera builds para PC/Console/Mobile",
                    "Completar checklist de certificação Steam (~200 itens) e corrigir falhas"
                ]
            }
        ]
    },

    design: {
        label: "Game Design e Narrativa",
        description: "Pipeline completo de design, conteúdo e narrativa — agnóstico de gênero",
        phases: [
            {
                phase: "Pré-produção e documentação de design",
                okrs: [
                    "Documento de visão do jogo (elevator pitch, pilares, público-alvo)",
                    "GDD completo: mecânicas, sistemas, progressão, mundo, personagens",
                    "Análise de competidores e posicionamento de mercado",
                    "Definição dos 3-5 pilares de design (princípios invioláveis)",
                    "Documento de core loop (loop de 5 segundos, 5 minutos, 1 hora)",
                    "Documento de economia e progressão (curvas, moedas, recursos)",
                    "Documento técnico de narrativa (world bible, tom, restrições)",
                    "Aprovação do GDD por todos os líderes de área antes de produção"
                ],
                sprint_examples: [
                    "Escrever documento de visão de 1 página (one-pager) do jogo",
                    "Mapear core loop: diagrama de ação → recompensa → motivação",
                    "Escrever world bible: história do mundo, facções, regras do universo",
                    "Criar planilha de progressão: level 1-50 com XP, stats, desbloqueios"
                ]
            },
            {
                phase: "Level design — layout, fluxo e greybox",
                okrs: [
                    "Mapa geral do jogo (todas as áreas/níveis em relação entre si)",
                    "Layout de cada área no papel: fluxo de espaço, chokepoints, secrets",
                    "Greybox no engine: geometria bruta sem arte, testável",
                    "Encounters de combate posicionados e testados no greybox",
                    "Puzzles ambientais e de navegação projetados e testados",
                    "Collectibles, segredos e easter eggs posicionados",
                    "Pacing de tensão e alívio por área (mapa de intensidade)",
                    "Art pass: integração com artistas para substituir greybox por arte final",
                    "Polish pass: iluminação, VFX, som ambiente integrados ao level"
                ],
                sprint_examples: [
                    "Desenhar layout da área 1 no papel: entradas, saídas, cobertura, linha de visão",
                    "Construir greybox da área 1 no engine com geometria primitiva",
                    "Posicionar 3 encounters de combate no greybox e testar com playtester",
                    "Criar mapa de intensidade: grafar tensão vs tempo para cada área"
                ]
            },
            {
                phase: "Sistema de quests — design e conteúdo",
                okrs: [
                    "Fluxograma de todas as quests (main, side, daily, repeatable, hidden)",
                    "Design de cada quest principal: setup, confronto, resolução, recompensa",
                    "Design de cada side quest com plot próprio e personagem memorável",
                    "Dependências entre quests (qual deve estar completa para outra abrir)",
                    "Recompensas balanceadas por dificuldade e tempo da quest",
                    "Quests com múltiplos finais baseados em escolhas do jogador",
                    "Quests que afetam o estado do mundo (NPC morre, cidade muda)",
                    "Tutorial quest — introduz mecânicas progressivamente sem overwhelm"
                ],
                sprint_examples: [
                    "Criar fluxograma completo de quests da quest principal (diagrama de dependências)",
                    "Escrever design doc da quest 1: beats, objetivos, NPCs envolvidos, recompensas",
                    "Definir todas as recompensas de quests em planilha balanceada",
                    "Projetar 3 side quests completas com plot próprio"
                ]
            },
            {
                phase: "Narrativa — escrita e roteiro",
                okrs: [
                    "Outline narrativo completo (todos os atos, turning points, clímax, resolução)",
                    "Roteiro do ato 1 (abertura, apresentação de personagens, incidente incitador)",
                    "Roteiro do ato 2 (desenvolvimento, reviravoltas, crise)",
                    "Roteiro do ato 3 (clímax, resolução, desfecho)",
                    "Arcos de personagens: protagonista, antagonista, supporting cast",
                    "Backstories de personagens principais",
                    "Roteiro de cutscenes (descrição de ação + diálogo + notas de câmera)",
                    "Storyboard de cutscenes principais"
                ],
                sprint_examples: [
                    "Escrever outline narrativo completo em bullet points (1 linha por beat)",
                    "Escrever roteiro completo do ato 1 (esperado: 20-40 páginas)",
                    "Criar character bible: motivações, voz, arco, contradições de cada personagem",
                    "Fazer storyboard da cutscene de abertura (12 shots com descrição)"
                ]
            },
            {
                phase: "Narrativa — diálogos e world building",
                okrs: [
                    "Árvores de diálogo de cada NPC principal (com ramificações e flags)",
                    "Ambient dialogue de NPCs de fundo (30-50 linhas por área)",
                    "Diálogos de reação a eventos (jogador completou quest, mundo mudou, etc.)",
                    "Descrições de itens (cada item tem flavor text + descrição funcional)",
                    "Entradas de codex/lore (história do mundo por fragmento descoberto)",
                    "Notas, cartas e documentos colecionáveis no mundo",
                    "Nomes de lugares, personagens e termos do universo (glossário)",
                    "Revisão de consistência: todo o texto tem voz e tom uniformes"
                ],
                sprint_examples: [
                    "Escrever árvore de diálogo do NPC guia com 3 ramificações morais",
                    "Escrever 40 linhas de ambient dialogue para o hub central",
                    "Escrever flavor text de todos os 60 itens do inventário",
                    "Criar 20 entradas de codex sobre a história do mundo"
                ]
            },
            {
                phase: "Balanceamento de gameplay",
                okrs: [
                    "Planilha de dano e vida de todos os inimigos por área",
                    "Curva de dificuldade: dano/vida cresce proporcionalmente com progressão do jogador",
                    "Balanceamento de habilidades (nenhuma habilidade deve ser obviamente superior)",
                    "Balanceamento de economia (moeda, recursos, preços de itens, drop rates)",
                    "Balanceamento de tempo de jogo por área (sem grind excessivo ou pico de dificuldade)",
                    "Sessões de playtesting focadas em balanceamento",
                    "Iteração pós-playtesting: ajustar valores com base em dados e feedback"
                ],
                sprint_examples: [
                    "Criar planilha de balanceamento com fórmula de dano vs defesa por nível",
                    "Ajustar HP e dano dos inimigos da área 2 com base em sessão de playtesting",
                    "Revisar drop rates de itens raros: garantir que player encontre ao menos 1 em 30min"
                ]
            },
            {
                phase: "Tutorial e onboarding",
                okrs: [
                    "Mapeamento de todas as mecânicas que precisam ser ensinadas",
                    "Sequência de introdução de mecânicas (nenhuma overwhelm, 1 por vez)",
                    "Tutorial in-world (ensinado pelo jogo, não por menu de ajuda)",
                    "Tooltips e hints contextuais (aparecem quando relevante, não no boot)",
                    "Testes de onboarding com jogadores que nunca viram o jogo",
                    "Iteração: remover hints que jogadores ignoram, adicionar onde ficam presos"
                ],
                sprint_examples: [
                    "Mapear todas as mecânicas em ordem de introdução ideal",
                    "Projetar sala de tutorial: ensinar movimento → pulo → ataque → esquiva em sequência",
                    "Testar tutorial com 3 jogadores novos e documentar onde travam"
                ]
            },
            {
                phase: "Localização e acessibilidade",
                okrs: [
                    "Exportar todos os textos do jogo para planilha de localização",
                    "Tradução para os idiomas alvo (en, es, fr, de, etc.)",
                    "Revisão de tradução por native speaker",
                    "Testes de layout: textos em alemão e russo são maiores, checar overflow",
                    "Legendas: implementar para todos os diálogos e cutscenes",
                    "Modo daltônico: checar contraste, não usar apenas cor para comunicar info",
                    "Documentar recomendações de acessibilidade seguidas (WCAG para jogos)"
                ],
                sprint_examples: [
                    "Exportar todas as strings para CSV de localização com context column",
                    "Revisar layout com texto em alemão (20% maior): corrigir overflow em 5 telas",
                    "Testar modo daltônico (protanopia) em todas as telas de UI"
                ]
            }
        ]
    },

    audio: {
        label: "Áudio",
        description: "Pipeline completo de áudio — composição, sound design e implementação",
        phases: [
            {
                phase: "Direção e identidade sonora",
                okrs: [
                    "Definir referências musicais e sonoras (5-10 referências por área do jogo)",
                    "Documento de áudio design: sistemas de áudio, orçamento de memória, ferramentas",
                    "Escolher ferramenta de implementação (FMOD, Wwise, sistema nativo do engine)",
                    "Definir identidade sonora: instrumentos predominantes, paleta de timbre",
                    "Criar protótipo sonoro de 2 minutos para aprovação antes de produção"
                ]
            },
            {
                phase: "Música — composição",
                okrs: [
                    "Tema principal do jogo (leitmotif memorável, 2-3 minutos)",
                    "Trilha de menu principal",
                    "Trilha de exploração — área 1 (loop seamless, 2-3 minutos)",
                    "Trilha de exploração — área 2 (identidade sonora distinta da área 1)",
                    "Trilha de exploração — cada área adicional",
                    "Trilha de combate — nível base (loop tenso, 1-2 minutos)",
                    "Trilha de combate — nível intenso (entra em combate acirrado)",
                    "Trilha de combate — boss (tema único por boss, 3-4 minutos)",
                    "Música de cutscenes (adapta ao arco emocional de cada cena)",
                    "Stingers: level up, quest completa, morte, vitória, descoberta secreta",
                    "Sistema de música dinâmica (horizontal re-sequencing ou vertical layering)"
                ],
                sprint_examples: [
                    "Compor tema principal: melodia principal + harmonia + 3 variações de arranjo",
                    "Compor trilha de exploração da área 1: orquestrar, mixar, exportar loop",
                    "Gravar instrumentos ao vivo para tema principal (se orçamento permitir)",
                    "Implementar sistema de layers: music_base sempre tocando, music_combat entra no combate"
                ]
            },
            {
                phase: "Sound effects — por categoria",
                okrs: [
                    "SFX de movimento do personagem: footsteps (cada tipo de superfície), aterrissagem, pulo, roupa",
                    "SFX de combate — personagem: cada ataque (swing, thrust, heavy), bloqueio, esquiva, parry",
                    "SFX de dano recebido: hit reactions do personagem, morte",
                    "SFX de habilidades: cada habilidade com wind-up, ativação e impacto",
                    "SFX de inimigos: por tipo — ataques, voz (grunt, alerta, morte), movimentação",
                    "SFX de boss: ataques únicos, rugidos, fases especiais",
                    "SFX de ambiente — cada bioma: vento, fauna, flora, estrutura",
                    "SFX de clima: chuva leve, forte, trovão, vento, neve",
                    "SFX de interação: abrir porta, baú, alavanca, pegar item, usar consumível",
                    "SFX de UI: navegar, confirmar, cancelar, notificação, erro, level up",
                    "SFX de magia/tecnologia: cada tipo de magia ou habilidade especial",
                    "SFX de impacto no ambiente: quebrar objeto, colidir, explosão"
                ],
                sprint_examples: [
                    "Gravar e editar 8 variações de footstep em pedra (randomizar em runtime)",
                    "Criar SFX de swing de espada: layer de whoosh + metal + impacto",
                    "Criar SFX de boss Arakar: rugido (grave, sintético + orgânico processado)",
                    "Criar soundscape de floresta: loop de pássaros + vento + galhos"
                ]
            },
            {
                phase: "Voice over (se aplicável)",
                okrs: [
                    "Script de todos os diálogos revisado e finalizado para gravação",
                    "Casting: definir perfil de voz por personagem, audições",
                    "Gravação em estúdio: personagens principais",
                    "Gravação de ambient voice: NPCs de fundo, inimigos",
                    "Edição: limpeza de ruído, normalização, cortes",
                    "Processamento criativo: EQ, reverb, efeitos especiais por personagem",
                    "Integração com sistema de diálogo: sincronizar áudio com texto"
                ]
            },
            {
                phase: "Implementação e mixagem",
                okrs: [
                    "Implementar todos os SFX nos eventos corretos do engine/middleware",
                    "Configurar Audio Mixer: buses por categoria com volume, compressão, EQ",
                    "Snapshot por estado de gameplay: exploração, combate, cutscene, morte",
                    "Ducking automático: baixar música quando voz está tocando",
                    "Reverb e filtros por ambiente (oclusão atrás de paredes, câmara de eco)",
                    "Randomização de variações de SFX (pitch, volume, sample)",
                    "Mixagem final: balancear todas as camadas em ambiente de referência",
                    "Testes em diferentes dispositivos: TV, headphone, estéreo, mono",
                    "Certificação de loudness para console (LUFS target por plataforma)"
                ],
                sprint_examples: [
                    "Implementar todos os footsteps no sistema: 8 superfícies × 8 variações",
                    "Configurar Audio Snapshot 'combat': boost de SFX, comprime música",
                    "Implementar reverb zones: cada bioma com IR reverb distinto",
                    "Fazer session de mix final: ouvir jogo completo e ajustar balanceo geral"
                ]
            }
        ]
    },

    qa: {
        label: "QA e Testes",
        description: "Pipeline completo de testes, qualidade e certificação",
        phases: [
            {
                phase: "Playtesting e UX",
                okrs: [
                    "Sessões de playtesting interno semanais a partir do alpha",
                    "Testes de onboarding: jogadores externos nunca viram o jogo",
                    "Testes de pacing: medir tempo por área e frustração",
                    "Testes de balanceamento focado: só combate, só progressão",
                    "Surveys pós-sessão: NPS, dificuldade percebida, momentos de confusão",
                    "Análise de gravações de playtesting (se possível)"
                ]
            },
            {
                phase: "Testes funcionais por sistema",
                okrs: [
                    "Test plan: lista de todos os sistemas com casos de teste",
                    "Testes de inventário: edge cases (cheio, empilhar, drag entre telas)",
                    "Testes de quests: completar, falhar, estados inconsistentes, ordem não-linear",
                    "Testes de diálogo: todas as branches, flags incorretas, loop de diálogo",
                    "Testes de save/load: salvar em cada state, carregar, verificar consistência",
                    "Testes de combate: hitbox, i-frames, stagger, morte, respawn",
                    "Testes de IA: stuck, teleport, ignorar jogador, aggro incorreto",
                    "Testes de progressão: sequence breaking, skip de área, softlock"
                ]
            },
            {
                phase: "Testes técnicos e performance",
                okrs: [
                    "Testes de framerate em hardware mínimo alvo",
                    "Testes de memória: detectar leaks, picos, OOM",
                    "Testes de loading: medir tempo, detectar hitch e freeze",
                    "Testes de crash: reproduzir e documentar todos os crash reports",
                    "Testes de rede (se multiplayer): latência, desconexão, resync",
                    "Testes de edge case extremos: inventário cheio, mapa inteiramente revelado",
                    "Testes de duração extrema de sessão: 8h sem restart"
                ]
            },
            {
                phase: "Certificação de plataforma",
                okrs: [
                    "Completar checklist de certificação Steam (TRC)",
                    "Completar checklist PlayStation (TCR) — se aplicável",
                    "Completar checklist Xbox (XR) — se aplicável",
                    "Completar checklist Nintendo (LotCheck) — se aplicável",
                    "Testes de achievements/trofeus: desbloquear cada um e verificar",
                    "Testes de suspend/resume: fechar e reabrir app sem perda de estado (console/mobile)",
                    "Testes de acessibilidade: legendas, daltonismo, navegação por teclado",
                    "Rating de classificação etária (ESRB, PEGI, ClassInd)"
                ]
            }
        ]
    }
};

// Formata o contexto de pipeline para incluir nos prompts
function getAreaPipelineContext(areas) {
    return areas.map(area => {
        const pipeline = AREA_PIPELINES[area];
        if (!pipeline) return '';
        const phasesText = pipeline.phases.map(p =>
            `  [${p.phase}]\n  KRs típicos: ${p.okrs.slice(0, 8).join(' | ')}`
        ).join('\n');
        return `=== PIPELINE DE ${pipeline.label.toUpperCase()} ===\n${phasesText}`;
    }).join('\n\n');
}

// Detecta o gênero do jogo baseado no texto do GDD
function detectGameGenre(gddText) {
    const text = gddText.toLowerCase();
    let bestMatch = { genre: 'generic', score: 0 };

    for (const [genreKey, genreData] of Object.entries(GENRE_KNOWLEDGE)) {
        if (genreKey === 'generic') continue;
        let score = 0;
        for (const keyword of genreData.keywords) {
            if (text.includes(keyword)) score++;
        }
        if (score > bestMatch.score) {
            bestMatch = { genre: genreKey, score };
        }
    }

    return bestMatch.genre;
}

// Retorna contexto de exemplos do gênero para enriquecer o prompt
function getGenreContext(genreKey) {
    const genre = GENRE_KNOWLEDGE[genreKey] || GENRE_KNOWLEDGE.generic;
    return {
        label: genre.label,
        objectives: genre.objectives,
        okr_examples: genre.okr_examples || {},
        sprint_examples: genre.sprint_examples || {}
    };
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    // Limpa chave antiga do Google (não começa com "sk-")
    const existingKey = store.getKey();
    if (existingKey && !existingKey.startsWith('sk-')) {
        store.removeKey();
    }

    if (hasApiKey()) {
        showApp();
    } else {
        showApiSetup();
    }
});

function showApp() {
    document.getElementById('apiSetupScreen').style.display = 'none';
    document.getElementById('appMain').style.display = 'block';
    initializeEventListeners();

    // Inicializa sidebar de projetos
    renderSidebar();
    updateSaveBtn();

    // Se há progresso de geração interrompida, oferece retomar
    if (store.hasProgress()) {
        const progress = store.getProgress();
        restoreApplicationState();
        showResumeScreen(
            'Havia uma geração em andamento que foi interrompida. Deseja continuar de onde parou?',
            progress
        );
    } else {
        restoreApplicationState();
    }
}

function showApiSetup() {
    document.getElementById('apiSetupScreen').style.display = 'block';
    document.getElementById('appMain').style.display = 'none';

    const input = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveApiKeyBtn');
    const toggleBtn = document.getElementById('toggleVisibility');

    // Mostrar/ocultar chave
    toggleBtn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggleBtn.querySelector('i').className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    // Salvar e entrar
    const doSave = () => {
        const key = input.value.trim();
        if (!key) {
            input.style.borderColor = 'var(--danger-color)';
            input.placeholder = 'Cole sua chave aqui...';
            input.focus();
            return;
        }
        store.setKey(key);
        showApp();
    };

    saveBtn.addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSave();
        input.style.borderColor = '';
    });
}

function initializeEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // botão já abre o seletor diretamente
        fileInput.click();
    });
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    removeFile.addEventListener('click', clearFile);
    analyzeBtn.addEventListener('click', analyzeDocument);
    exportBtn.addEventListener('click', exportResults);
    newAnalysisBtn.addEventListener('click', resetToUpload);

    // Botões da tela de retomada
    const resumeBtn = document.getElementById('resumeBtn');
    const resumeCancelBtn = document.getElementById('resumeCancelBtn');
    if (resumeBtn) resumeBtn.addEventListener('click', resumeAnalysis);
    if (resumeCancelBtn) resumeCancelBtn.addEventListener('click', resetAndClearProgress);
}

// ============================================================
// MANIPULAÇÃO DE ARQUIVOS
// ============================================================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = event.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

function processFile(file) {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    if (!allowedTypes.includes(file.type)) {
        alert('Tipo de arquivo não suportado. Use PDF, DOC, DOCX ou TXT.');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande. O tamanho máximo é 10MB.');
        return;
    }
    currentFile = file;
    displayFileInfo(file);
}

function displayFileInfo(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    uploadArea.style.display = 'none';
    fileInfo.style.display = 'block';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function clearFile() {
    currentFile = null;
    fileInput.value = '';
    uploadArea.style.display = 'block';
    fileInfo.style.display = 'none';
}

// ============================================================
// LEITURA DO ARQUIVO
// ============================================================
async function readFileContent(file) {
    const name = file.name.toLowerCase();

    // TXT — leitura direta
    if (file.type === 'text/plain' || name.endsWith('.txt')) {
        return await readAsText(file);
    }

    // PDF — extrai texto página a página via pdf.js
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
        return await extractPDFText(file);
    }

    // DOCX — extrai o XML interno com o texto
    if (name.endsWith('.docx') || name.endsWith('.doc')) {
        return await extractDOCXText(file);
    }

    // Fallback: tenta ler como texto
    return await readAsText(file);
}

function readAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file, 'UTF-8');
    });
}

function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function extractPDFText(file) {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('pdf.js não carregou. Tente converter o PDF para TXT e envie novamente.');
    }
    try {
        const arrayBuffer = await readAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const texts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            texts.push(pageText);
        }
        const result = texts.join('\n\n');
        if (!result.trim()) {
            throw new Error('O PDF parece ser baseado em imagens (scan). Converta para TXT ou DOCX e tente novamente.');
        }
        return result;
    } catch (e) {
        if (e.message.includes('scan') || e.message.includes('imagens')) throw e;
        throw new Error(`Erro ao ler PDF: ${e.message}. Tente converter para TXT.`);
    }
}

async function extractDOCXText(file) {
    try {
        const arrayBuffer = await readAsArrayBuffer(file);
        // DOCX é um ZIP — extrai o word/document.xml e remove tags XML
        const uint8 = new Uint8Array(arrayBuffer);
        // Busca por "word/document.xml" dentro do ZIP
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const raw = decoder.decode(uint8);

        // Tenta extrair XML do document.xml via marcadores do formato ZIP
        const marker = 'word/document.xml';
        const idx = raw.indexOf(marker);
        if (idx === -1) {
            throw new Error('Formato DOCX não reconhecido.');
        }

        // Pega o bloco XML após o marcador
        const xmlStart = raw.indexOf('<w:document', idx);
        const xmlEnd = raw.indexOf('</w:document>', xmlStart);
        if (xmlStart === -1 || xmlEnd === -1) {
            throw new Error('Não foi possível extrair texto do DOCX.');
        }

        const xml = raw.substring(xmlStart, xmlEnd + 13);
        // Remove todas as tags XML, preserva texto e quebras de parágrafo
        const text = xml
            .replace(/<w:p[ >]/g, '\n')   // parágrafo → nova linha
            .replace(/<w:br[^>]*>/g, '\n') // quebra de linha
            .replace(/<[^>]+>/g, '')       // remove todas as outras tags
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x[0-9A-Fa-f]+;/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        if (!text) throw new Error('DOCX sem texto extraível. Tente salvar como TXT.');
        return text;
    } catch (e) {
        throw new Error(`Erro ao ler DOCX: ${e.message}`);
    }
}

// ============================================================
// PAINEL DE OUTPUT AO VIVO
// ============================================================
function clearGenerationLog() {
    const log = document.getElementById('generationLog');
    if (log) log.innerHTML = '';
}

function appendGenerationLog(label, icon, content) {
    const log = document.getElementById('generationLog');
    if (!log) return;

    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const item = document.createElement('div');
    item.className = 'log-item open'; // começa aberto
    item.innerHTML = `
        <div class="log-item-header" onclick="toggleLogItem('${id}')">
            <div class="log-item-icon"><i class="${icon}"></i></div>
            <span class="log-item-label">${label}</span>
            <span class="log-item-badge"><i class="fas fa-check"></i> Concluído</span>
            <i class="fas fa-chevron-down log-item-toggle"></i>
        </div>
        <div class="log-item-body" id="${id}">
            <pre class="log-item-content">${escapeHtml(content.substring(0, 3000))}${content.length > 3000 ? '\n\n[... truncado para exibição ...]' : ''}</pre>
        </div>
    `;
    log.appendChild(item);
    // Fecha o item anterior para não poluir a tela
    if (log.children.length > 1) {
        const prev = log.children[log.children.length - 2];
        prev.classList.remove('open');
    }
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleLogItem(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const item = body.closest('.log-item');
    if (item) item.classList.toggle('open');
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================
// TELA DE RETOMADA
// ============================================================
function showResumeScreen(errorMsg, progress) {
    loadingSection.style.display = 'none';
    document.getElementById('reviewSection').style.display = 'none';

    const resumeSection = document.getElementById('resumeSection');
    resumeSection.style.display = 'block';

    document.getElementById('resumeErrorMsg').textContent = errorMsg || 'Ocorreu um erro durante a geração.';

    // Monta resumo do progresso
    const progressEl = document.getElementById('resumeProgress');
    const phases = [
        { key: 'gddNormalizado', label: 'GDD Normalizado', icon: 'fas fa-magic' },
        { key: 'phase1md',       label: 'Sub-áreas mapeadas', icon: 'fas fa-file-search' },
        { key: 'phase2mds',      label: 'KRs detalhados', icon: 'fas fa-key' },
        { key: 'phase3mds',      label: 'Sprints criados', icon: 'fas fa-tasks' },
        { key: 'phase4md',       label: 'Milestones definidos', icon: 'fas fa-flag-checkered' },
    ];

    progressEl.innerHTML = phases.map(p => {
        const done = progress && progress[p.key];
        return `<div class="resume-progress-item ${done ? 'done' : ''}">
            <i class="${done ? 'fas fa-check-circle' : 'fas fa-circle'}" style="${done ? '' : 'opacity:0.3'}"></i>
            <span>${p.label}</span>
        </div>`;
    }).join('');
}

function hideResumeScreen() {
    document.getElementById('resumeSection').style.display = 'none';
}

// ============================================================
// FLUXO PRINCIPAL DE ANÁLISE — 3 FASES
// ============================================================
async function analyzeDocument() {
    if (!currentFile) {
        alert('Por favor, selecione um arquivo primeiro.');
        return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('Chave de API não configurada. Configure nas configurações.');
    }

    showLoadingScreen();
    clearGenerationLog();

    try {
        setLoadingMessage('Lendo arquivo...');
        const fileContent = await readFileContent(currentFile);

        const gddTexto = typeof fileContent === 'string'
            ? fileContent.substring(0, 20000)
            : '';

        if (!gddTexto.trim()) {
            throw new Error('Não foi possível extrair texto do arquivo. Tente salvar como .txt e envie novamente.');
        }

        // FASE 0: Normaliza o GDD para o template padrão
        setLoadingPhase(0, 'Normalizando GDD...');
        setLoadingMessage('Mapeando informações do seu jogo...');
        const gddNormalizado = await normalizarGDD(gddTexto, apiKey);

        // Salva progresso após fase 0
        store.setProgress({ gddNormalizado });

        // Pausa para revisão — mostra o GDD normalizado e aguarda confirmação do usuário
        const confirmado = await mostrarRevisaoGDD(gddNormalizado);
        if (!confirmado) {
            store.removeProgress();
            resetToUpload();
            return;
        }

        showLoadingScreen();
        clearGenerationLog();
        setLoadingPhase(0, 'GDD confirmado. Iniciando geração...');

        // Detecta gênero a partir do GDD normalizado
        const detectedGenre = detectGameGenre(
            `${gddNormalizado.genero} ${gddNormalizado.mecanica_principal} ${gddNormalizado.sinopse}`.substring(0, 3000)
        );
        const genreCtx = getGenreContext(detectedGenre);

        setLoadingPhase(1, 'Mapeando sub-áreas de desenvolvimento...');

        // FASE 1: Lê o GDD normalizado completo → sub-áreas
        const phase1md = await mdPhase1_Subareas(gddCompleto(gddNormalizado), genreCtx, apiKey);

        // Salva progresso + log ao vivo
        store.setProgress({ gddNormalizado, phase1md });
        appendGenerationLog('Sub-áreas de Desenvolvimento', 'fas fa-file-search', phase1md);

        // Extrai lista de sub-áreas do MD
        const subareaList = extractSubareasFromMD(phase1md);
        const totalSubs = subareaList.length;
        setLoadingPhase(2, `Detalhando KRs para ${totalSubs} sub-áreas...`);

        // FASE 2: Para cada sub-área, usa apenas as seções relevantes do GDD
        const phase2mds = await mdPhase2_KRs(subareaList, genreCtx, gddNormalizado, apiKey, (done, total) => {
            setLoadingMessage(`KRs: ${done}/${total} sub-áreas...`);
        });

        // Salva progresso + log ao vivo
        store.setProgress({ gddNormalizado, phase1md, phase2mds });
        appendGenerationLog('Key Results (KRs)', 'fas fa-key', Object.values(phase2mds).join('\n\n---\n\n'));

        setLoadingPhase(3, 'Criando tarefas de sprint (sprints de 2 semanas)...');

        // FASE 3: Sprints com seções relevantes do GDD por área
        const phase3mds = await mdPhase3_Sprints(subareaList, phase2mds, genreCtx, gddNormalizado, apiKey, (done, total) => {
            setLoadingMessage(`Sprints: ${done}/${total} sub-áreas...`);
        });

        // Salva progresso + log ao vivo
        store.setProgress({ gddNormalizado, phase1md, phase2mds, phase3mds });
        appendGenerationLog('Tarefas de Sprint', 'fas fa-tasks', Object.values(phase3mds).join('\n\n---\n\n'));

        setLoadingPhase(4, 'Definindo milestones...');

        // FASE 4: Milestones
        const phase4md = await mdPhase4_Milestones(phase1md, subareaList, genreCtx, gddNormalizado, apiKey);

        // Salva progresso completo + log ao vivo
        store.setProgress({ gddNormalizado, phase1md, phase2mds, phase3mds, phase4md });
        appendGenerationLog('Milestones', 'fas fa-flag-checkered', phase4md);

        setLoadingPhase(5, 'Consolidando em roadmap final...');

        // FASE FINAL: MD → JSON
        const consolidatedMD = buildConsolidatedMD(phase1md, subareaList, phase3mds, phase4md);
        analysisResult = await mdToJSON(consolidatedMD, genreCtx, detectedGenre, apiKey, gddNormalizado);

        // Geração concluída — limpa o cache de progresso
        store.removeProgress();

        showResults();

    } catch (error) {
        console.error('Erro na análise:', error);
        const errorMessage = error.message || 'Ocorreu um erro durante a geração.';
        const progress = store.getProgress();
        showResumeScreen(errorMessage, progress);
    }
}

// ============================================================
// RETOMADA DE ONDE PAROU
// ============================================================
async function resumeAnalysis() {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('Chave de API não configurada.');
        return;
    }

    const progress = store.getProgress();
    if (!progress || !progress.gddNormalizado) {
        alert('Não há progresso salvo para retomar.');
        return;
    }

    hideResumeScreen();
    showLoadingScreen();
    clearGenerationLog();

    const { gddNormalizado } = progress;

    try {
        // Detecta gênero
        const detectedGenre = detectGameGenre(
            `${gddNormalizado.genero} ${gddNormalizado.mecanica_principal} ${gddNormalizado.sinopse}`.substring(0, 3000)
        );
        const genreCtx = getGenreContext(detectedGenre);

        // Reconstrói phase1md — ou usa o salvo
        let phase1md = progress.phase1md;
        if (!phase1md) {
            setLoadingPhase(1, 'Mapeando sub-áreas de desenvolvimento...');
            phase1md = await mdPhase1_Subareas(gddCompleto(gddNormalizado), genreCtx, apiKey);
            store.setProgress({ ...store.getProgress(), phase1md });
        }
        appendGenerationLog('Sub-áreas de Desenvolvimento', 'fas fa-file-search', phase1md);

        const subareaList = extractSubareasFromMD(phase1md);
        const totalSubs = subareaList.length;

        // Reconstrói phase2mds — ou usa o salvo
        let phase2mds = progress.phase2mds;
        if (!phase2mds) {
            setLoadingPhase(2, `Detalhando KRs para ${totalSubs} sub-áreas...`);
            phase2mds = await mdPhase2_KRs(subareaList, genreCtx, gddNormalizado, apiKey, (done, total) => {
                setLoadingMessage(`KRs: ${done}/${total} sub-áreas...`);
            });
            store.setProgress({ ...store.getProgress(), phase2mds });
        }
        appendGenerationLog('Key Results (KRs)', 'fas fa-key', Object.values(phase2mds).join('\n\n---\n\n'));

        // Reconstrói phase3mds — ou usa o salvo
        let phase3mds = progress.phase3mds;
        if (!phase3mds) {
            setLoadingPhase(3, 'Criando tarefas de sprint...');
            phase3mds = await mdPhase3_Sprints(subareaList, phase2mds, genreCtx, gddNormalizado, apiKey, (done, total) => {
                setLoadingMessage(`Sprints: ${done}/${total} sub-áreas...`);
            });
            store.setProgress({ ...store.getProgress(), phase3mds });
        }
        appendGenerationLog('Tarefas de Sprint', 'fas fa-tasks', Object.values(phase3mds).join('\n\n---\n\n'));

        // Reconstrói phase4md — ou usa o salvo
        let phase4md = progress.phase4md;
        if (!phase4md) {
            setLoadingPhase(4, 'Definindo milestones...');
            phase4md = await mdPhase4_Milestones(phase1md, subareaList, genreCtx, gddNormalizado, apiKey);
            store.setProgress({ ...store.getProgress(), phase4md });
        }
        appendGenerationLog('Milestones', 'fas fa-flag-checkered', phase4md);

        setLoadingPhase(5, 'Consolidando em roadmap final...');
        const consolidatedMD = buildConsolidatedMD(phase1md, subareaList, phase3mds, phase4md);
        analysisResult = await mdToJSON(consolidatedMD, genreCtx, detectedGenre, apiKey, gddNormalizado);

        store.removeProgress();
        showResults();

    } catch (error) {
        console.error('Erro ao retomar:', error);
        const errorMessage = error.message || 'Ocorreu um erro ao retomar a geração.';
        showResumeScreen(errorMessage, store.getProgress());
    }
}

function resetAndClearProgress() {
    store.removeProgress();
    hideResumeScreen();
    resetToUpload();
}

// ============================================================
// ARQUITETURA MD → JSON
// As IAs conversam em Markdown (mais confiável, sem escaping).
// Só converte para JSON no passo final de consolidação.
// ============================================================

/// FASE 0: Normaliza o GDD enviado para o template padrão
// Grupos de campos para exibição na tela de revisão
const GDD_REVIEW_GROUPS = [
    { label: 'Identidade', icon: 'fas fa-gamepad', campos: ['titulo', 'genero', 'subgenero', 'plataformas', 'engine', 'perspectiva', 'modo'] },
    { label: 'Equipe', icon: 'fas fa-users', campos: ['tamanho_equipe', 'papeis', 'duracao_desenvolvimento', 'plataforma_lancamento'] },
    { label: 'Conceito', icon: 'fas fa-lightbulb', campos: ['sinopse', 'diferenciais', 'publico_alvo', 'referencias', 'formato_extra'] },
    { label: 'Mecânicas', icon: 'fas fa-gamepad', campos: ['mecanica_principal', 'mecanicas_secundarias', 'mecanicas_unicas', 'progressao', 'economia', 'ia_inimigos'] },
    { label: 'Narrativa', icon: 'fas fa-book', campos: ['contexto_mundo', 'protagonista', 'antagonista', 'estrutura_narrativa', 'sistema_finais', 'arco_emocional', 'tom'] },
    { label: 'Arte', icon: 'fas fa-palette', campos: ['estilo_visual', 'paleta_cores', 'resolucao_aspecto', 'personagens_principais', 'ambientes_principais'] },
    { label: 'Áudio', icon: 'fas fa-music', campos: ['estilo_musical', 'referencias_audio', 'voice_over'] },
    { label: 'Escopo', icon: 'fas fa-clock', campos: ['duracao_estimada', 'numero_fases'] },
];

// Nomes amigáveis para os campos
const GDD_FIELD_LABELS = {
    titulo: 'Título', genero: 'Gênero', subgenero: 'Subgênero', plataformas: 'Plataformas',
    engine: 'Engine', perspectiva: 'Perspectiva', modo: 'Modo', tamanho_equipe: 'Equipe',
    papeis: 'Papéis', sinopse: 'Sinopse', diferenciais: 'Diferenciais', referencias: 'Referências',
    publico_alvo: 'Público-alvo', mecanica_principal: 'Mecânica Principal',
    mecanicas_secundarias: 'Mecânicas Secundárias', mecanicas_unicas: 'Mecânicas Únicas',
    progressao: 'Progressão', economia: 'Economia', ia_inimigos: 'IA / Bosses',
    contexto_mundo: 'Contexto / Mundo', protagonista: 'Protagonista', antagonista: 'Antagonista',
    estrutura_narrativa: 'Estrutura Narrativa', sistema_finais: 'Sistema de Finais',
    arco_emocional: 'Arco Emocional', tom: 'Tom', estilo_visual: 'Estilo Visual',
    paleta_cores: 'Paleta de Cores', resolucao_aspecto: 'Resolução', personagens_principais: 'Personagens',
    ambientes_principais: 'Ambientes / Fases', estilo_musical: 'Estilo Musical',
    referencias_audio: 'Referências de Áudio', voice_over: 'Voice Over',
    duracao_estimada: 'Duração Estimada', numero_fases: 'Número de Fases',
    duracao_desenvolvimento: 'Duração do Desenvolvimento', plataforma_lancamento: 'Plataforma de Lançamento',
    formato_extra: 'Formato Extra (livro, trilha...)',
};

// Mostra a tela de revisão e retorna uma Promise que resolve com true (confirmar) ou false (cancelar)
function mostrarRevisaoGDD(gddNormalizado) {
    return new Promise((resolve) => {
        // Esconde loading, mostra review
        document.getElementById('loadingSection').style.display = 'none';
        const reviewSection = document.getElementById('reviewSection');
        reviewSection.style.display = 'block';

        // Popula o grid
        const grid = document.getElementById('reviewGrid');
        grid.innerHTML = '';

        for (const group of GDD_REVIEW_GROUPS) {
            const camposComValor = group.campos.filter(k => {
                const v = gddNormalizado[k];
                return v && String(v).trim() && String(v).trim() !== 'não especificado';
            });
            // Mostra o grupo mesmo se alguns campos estiverem vazios
            const div = document.createElement('div');
            div.className = 'review-group';
            div.innerHTML = `
                <div class="review-group-title">
                    <i class="${group.icon}"></i> ${group.label}
                </div>
                ${group.campos.map(k => {
                    const v = toStr(gddNormalizado[k]);
                    const label = GDD_FIELD_LABELS[k] || k;
                    const hasValue = v.trim() && v.trim() !== 'não especificado';
                    return `<div class="review-item">
                        <div class="review-item-label">${label}</div>
                        <div class="review-item-value ${hasValue ? '' : 'missing'}">${hasValue ? v : 'não encontrado no GDD'}</div>
                    </div>`;
                }).join('')}
            `;
            grid.appendChild(div);
        }

        // Botões
        document.getElementById('reviewConfirmBtn').onclick = () => {
            reviewSection.style.display = 'none';
            resolve(true);
        };
        document.getElementById('reviewCancelBtn').onclick = () => {
            reviewSection.style.display = 'none';
            resolve(false);
        };
    });
}

async function normalizarGDD(gddTexto, apiKey) {
    const camposExplicados = Object.keys(GDD_TEMPLATE).map(k => {
        const explicacoes = {
            titulo: 'nome do jogo',
            genero: 'gênero principal (ex: RPG, Plataformer, Puzzle, Horror, Shooter)',
            subgenero: 'subgênero ou estilo específico (ex: roguelite, metroidvania, cozy)',
            plataformas: 'plataformas alvo (ex: PC, Nintendo Switch, Mobile)',
            engine: 'engine de desenvolvimento (ex: Unity, Godot, Unreal, GameMaker)',
            perspectiva: 'câmera/perspectiva incluindo dimensionalidade — SEMPRE indique se é 2D ou 3D (ex: top-down 2D, side-scroll 2D, terceira pessoa 3D, first-person 3D, isométrico 3D). Se o GDD mencionar gráficos 3D, cenário 3D ou referências 3D, o campo deve conter "3D".',
            modo: 'modo de jogo (ex: single-player, multiplayer local, co-op online)',
            tamanho_equipe: 'número de pessoas na equipe',
            papeis: 'papéis existentes na equipe',
            sinopse: '2 a 4 frases descrevendo o jogo',
            diferenciais: 'o que torna este jogo único em relação a outros',
            referencias: 'jogos, filmes ou obras de referência citados',
            publico_alvo: 'público-alvo do jogo',
            mecanica_principal: 'loop de gameplay central — o que o jogador faz o tempo todo',
            mecanicas_secundarias: 'sistemas secundários que apoiam o gameplay',
            progressao: 'como o jogador progride (level up, desbloqueios, narrativa)',
            economia: 'recursos, moedas, itens e como funcionam',
            ia_inimigos: 'comportamento dos inimigos ou NPCs (se houver)',
            contexto_mundo: 'setting/universo do jogo',
            protagonista: 'personagem principal — nome, papel, motivação',
            antagonista: 'vilão ou conflito central',
            estrutura_narrativa: 'como a história é contada (linear, aberta, episódica)',
            tom: 'tom emocional do jogo (ex: dark, humor, épico, melancólico, fofo)',
            estilo_visual: 'estilo de arte — SEMPRE indique se é 2D ou 3D (ex: pixel art 2D, cartoon 2D, low poly 3D, cartoon 3D, realista 3D). Se o GDD mencionar "3D" em qualquer campo de gráficos ou visuais, este campo DEVE conter "3D".',
            paleta_cores: 'cores predominantes e atmosfera visual',
            resolucao_aspecto: 'resolução e aspect ratio (ex: 1080p 16:9, 480x270 pixel art)',
            personagens_principais: 'lista dos personagens com breve descrição',
            ambientes_principais: 'cenários, biomas ou fases principais',
            estilo_musical: 'estilo da trilha sonora (ex: chiptune, orquestral, ambient)',
            referencias_audio: 'referências de trilha ou SFX',
            voice_over: 'tem voice over? qual idioma?',
            duracao_estimada: 'tempo de jogo estimado (ex: 8-10 horas)',
            numero_fases: 'número de fases, mundos ou níveis',
            duracao_desenvolvimento: 'tempo estimado de desenvolvimento em meses',
            plataforma_lancamento: 'plataforma de lançamento inicial',
            mecanicas_unicas: 'mecânicas que não existem em outros jogos — descrever com máxima precisão técnica e narrativa (ex: como funciona exatamente, quais inputs, qual efeito)',
            sistema_finais: 'quantos finais existem, quais as condições para cada um, o que muda entre eles',
            formato_extra: 'produto adicional lançado junto ao jogo (livro, trilha sonora, quadrinho, etc.) e como se relaciona',
            arco_emocional: 'como o estado emocional da personagem ou o tom do jogo evolui ao longo das fases — mudanças narrativas por fase',
        };
        return `- ${k}: ${explicacoes[k] || k}`;
    }).join('\n');

    const prompt = `Você é um produtor de jogos sênior. Leia o GDD abaixo e extraia todas as informações para preencher o template estruturado.

REGRAS IMPORTANTES:
- Use APENAS informações presentes no GDD. Não invente nada.
- Se uma informação não estiver no GDD, deixe o campo com o valor "não especificado".
- Preserve nomes próprios, termos técnicos e nomes de mecânicas EXATAMENTE como estão no GDD (nomes de personagens, bosses, locais).
- Para mecânicas_unicas e mecanica_principal: seja tecnicamente preciso. Descreva o que o jogador faz, com qual input, e qual o efeito — não generalize.
- Para personagens_principais e ambientes_principais: liste TODOS mencionados no GDD, com seus nomes reais.
- Para sistema_finais: descreva cada final e suas condições específicas.
- Para perspectiva e estilo_visual: OBRIGATÓRIO identificar se o jogo é 2D ou 3D. Procure pistas em campos como "Gráficos", "Engine", referências de jogos (ex: Mario Odyssey = 3D, Hollow Knight = 2D) e descrições do cenário. Em caso de dúvida, prefira 3D se houver qualquer menção a espaço tridimensional, cenário 3D ou engine com suporte 3D.
- Cada campo pode ter até 3 linhas se necessário para capturar detalhes importantes.

CAMPOS A PREENCHER:
${camposExplicados}

GDD:
${gddTexto}

Retorne APENAS um objeto JSON válido com todos os campos acima. Sem texto antes ou depois. Exemplo:
{
  "titulo": "Hollow Knight",
  "genero": "Metroidvania",
  "engine": "Unity",
  ...
}`;

    const resposta = await callAIAPI(prompt, apiKey);

    // Extrai o JSON da resposta
    try {
        const jsonMatch = resposta.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON não encontrado na resposta');
        const parsed = JSON.parse(jsonMatch[0]);
        return sanitizarGDD({ ...GDD_TEMPLATE, ...parsed });
    } catch (e) {
        console.warn('Erro ao parsear GDD normalizado:', e);
        const fallback = { ...GDD_TEMPLATE };
        const linhas = resposta.split('\n');
        for (const linha of linhas) {
            const m = linha.match(/["']?(\w+)["']?\s*:\s*["']?([^"',\n]+)["']?/);
            if (m && fallback.hasOwnProperty(m[1])) fallback[m[1]] = m[2].trim();
        }
        return sanitizarGDD(fallback);
    }
}

// Garante que todos os campos do GDD normalizado são strings simples.
// A IA às vezes retorna arrays, objetos ou null — isso quebra .trim() e String().
function sanitizarGDD(obj) {
    const resultado = { ...GDD_TEMPLATE }; // começa com todos os campos como string vazia
    for (const k of Object.keys(GDD_TEMPLATE)) {
        const v = obj[k];
        if (v === null || v === undefined) {
            resultado[k] = '';
        } else if (Array.isArray(v)) {
            // Array → junta como texto
            resultado[k] = v.map(item =>
                typeof item === 'object' ? JSON.stringify(item) : String(item)
            ).join(', ');
        } else if (typeof v === 'object') {
            // Objeto aninhado → serializa como texto
            resultado[k] = Object.entries(v)
                .map(([ik, iv]) => `${ik}: ${iv}`)
                .join('; ');
        } else {
            resultado[k] = String(v);
        }
    }
    return resultado;
}

// FASE 1 (MD): Lê GDD → retorna Markdown com visão geral + lista de sub-áreas
async function mdPhase1_Subareas(gddText, genreCtx, apiKey) {
    // Extrair duração do GDD para usar no prompt
    const duracaoMatch = gddText.match(/dura[çc][aã]o[^:]*:\s*(\d+)/i);
    const duracaoMeses = duracaoMatch ? parseInt(duracaoMatch[1]) : 24;

    const prompt = `Você é um produtor de jogos sênior. Analise o GDD abaixo e gere um documento Markdown estruturado com a visão geral do projeto e todas as sub-áreas de desenvolvimento.

Gênero detectado: ${genreCtx.label}
Áreas típicas do gênero: ${genreCtx.objectives.slice(0, 5).join(', ')}

INSTRUÇÕES:
Gere de 20 a 35 sub-áreas cobrindo TODO o desenvolvimento. Use o formato exato abaixo.

IMPORTANTE — DISTRIBUIÇÃO TEMPORAL:
O projeto tem duração de ${duracaoMeses} meses. Você DEVE distribuir as sub-áreas ao longo de TODOS os ${duracaoMeses} meses.
NÃO concentre tudo nos primeiros 12 meses. As sub-áreas de produção final, polish, QA e lançamento devem estar nos meses finais (próximos do mês ${duracaoMeses}).
Exemplo de distribuição para ${duracaoMeses} meses:
- Pré-produção e prototipagem: meses 1 a ${Math.round(duracaoMeses * 0.15)}
- Produção principal (core systems, arte, design): meses ${Math.round(duracaoMeses * 0.1)} a ${Math.round(duracaoMeses * 0.65)}
- Produção avançada (conteúdo, polish): meses ${Math.round(duracaoMeses * 0.6)} a ${Math.round(duracaoMeses * 0.85)}
- QA, certificação e lançamento: meses ${Math.round(duracaoMeses * 0.82)} a ${duracaoMeses}

IMPORTANTE — ESPECIFICIDADE:
Crie sub-áreas ESPECÍFICAS para este jogo. Use os nomes reais do projeto (personagens, mecânicas, ambientes) — não use nomes genéricos como "Personagem Principal" se o GDD diz "Aria".

GDD NORMALIZADO DO PROJETO:
${gddText}

Retorne APENAS o Markdown abaixo, sem texto antes ou depois:

# VISÃO GERAL
- Título: [nome do jogo]
- Gênero: [gênero]
- Plataforma: [plataformas]
- Equipe: [estimativa]
- Engine: [engine inferida ou "agnóstico"]
- Duração: ${duracaoMeses} meses
- Descrição: [2-3 frases sobre o jogo]

# SUB-ÁREAS
## [id: sa_prog_core] Programação — Arquitetura Core
- Área: programming
- Período: mês 1 a ${Math.round(duracaoMeses * 0.2)}
- Descrição: [o que cobre]
- Keywords: arquitetura, core, sistemas, entidades

## [id: sa_art_concept] Arte — Concept Art e Pré-Produção
- Área: art
- Período: mês 1 a ${Math.round(duracaoMeses * 0.12)}
- Descrição: [o que cobre]
- Keywords: concept, estilo, referências, mood board`;

    return await callAIAPI(prompt, apiKey);
}

// Extrai lista de sub-áreas do MD da Fase 1
function extractSubareasFromMD(md) {
    const subareas = [];
    const overviewMatch = md.match(/# VISÃO GERAL\n([\s\S]*?)(?=\n# SUB-ÁREAS)/);
    const overview = {};
    if (overviewMatch) {
        const lines = overviewMatch[1].split('\n').filter(l => l.trim());
        for (const line of lines) {
            const m = line.match(/^-\s+(.+?):\s+(.+)$/);
            if (!m) continue;
            const key = m[1].trim().toLowerCase();
            const val = m[2].trim();
            if (key === 'título' || key === 'titulo') overview.title = val;
            else if (key === 'gênero' || key === 'genero') overview.genre = val;
            else if (key === 'plataforma') overview.platform = val;
            else if (key === 'equipe') overview.teamSize = val;
            else if (key === 'engine') overview.engine = val;
            else if (key === 'duração' || key === 'duracao') overview.totalDurationMonths = parseInt(val) || 24;
            else if (key === 'descrição' || key === 'descricao') overview.description = val;
        }
    }

    // Extrair cada sub-área
    const saBlocks = md.split(/\n## /);
    for (const block of saBlocks.slice(1)) {
        const lines = block.split('\n').filter(l => l.trim());
        if (!lines.length) continue;

        const header = lines[0];
        const idMatch = header.match(/\[id:\s*([^\]]+)\]/);
        const titleMatch = header.replace(/\[id:[^\]]+\]\s*/, '').trim();

        const sa = {
            id: idMatch ? idMatch[1].trim() : `sa_${subareas.length + 1}`,
            title: titleMatch,
            area: 'programming',
            startMonth: 1,
            endMonth: 3,
            description: '',
            keywords: [],
            overview
        };

        for (const line of lines.slice(1)) {
            const m = line.match(/^-\s+(.+?):\s+(.+)$/);
            if (!m) continue;
            const key = m[1].trim().toLowerCase();
            const val = m[2].trim();
            if (key === 'área' || key === 'area') sa.area = val.toLowerCase();
            else if (key === 'período' || key === 'periodo') {
                const months = val.match(/(\d+)\s*a\s*(\d+)/);
                if (months) { sa.startMonth = parseInt(months[1]); sa.endMonth = parseInt(months[2]); }
            }
            else if (key === 'descrição' || key === 'descricao') sa.description = val;
            else if (key === 'keywords') sa.keywords = val.split(',').map(k => k.trim());
        }

        // Inferir subarea slug do id ou título
        sa.subarea = sa.id.replace(/^sa_[a-z]+_/, '').replace(/_/g, '-') || sa.title.toLowerCase().replace(/\s+/g, '-');
        subareas.push(sa);
    }

    return subareas;
}

// FASE 2 (MD): Para cada sub-área, gera Markdown com Key Results
async function mdPhase2_KRs(subareaList, genreCtx, gddNormalizado, apiKey, onProgress) {
    const results = {}; // id → md string

    for (let i = 0; i < subareaList.length; i++) {
        const sa = subareaList[i];

        // Pipeline relevante para esta sub-área
        const areaPipeline = AREA_PIPELINES[sa.area];
        let pipelineHint = '';
        if (areaPipeline) {
            const relevant = areaPipeline.phases.filter(p => {
                const txt = (p.phase + ' ' + (p.okrs || []).join(' ')).toLowerCase();
                return (sa.keywords || []).some(k => txt.includes(k.toLowerCase()))
                    || txt.includes((sa.subarea || '').replace(/-/g, ' '));
            });
            const phases = relevant.length > 0 ? relevant : areaPipeline.phases.slice(0, 3);
            pipelineHint = phases.map(p =>
                `**${p.phase}**: ${(p.okrs || []).slice(0, 6).join(' | ')}`
            ).join('\n');
        }

        const overview = sa.overview || {};
        // Seções do GDD relevantes para esta área específica
        const gddContext = gddSecoesPorArea(gddNormalizado, sa.area);
        const prompt = `Você é um produtor de jogos sênior especialista em ${genreCtx.label}.

Projeto: ${gddNormalizado.titulo || overview.title || 'jogo'} | Engine: ${gddNormalizado.engine || 'agnóstico'} | Duração: ${gddNormalizado.duracao_desenvolvimento || overview.totalDurationMonths || '?'} meses

GDD DO PROJETO — informações relevantes para ${sa.area}:
${gddContext}

SUB-ÁREA: ${sa.title}
Área: ${sa.area} | Período: mês ${sa.startMonth} a ${sa.endMonth}
Descrição: ${sa.description}

Referência de pipeline para esta área:
${pipelineHint || '(use boas práticas da indústria)'}

Gere os Key Results (KRs) desta sub-área. OBRIGATÓRIO: use nomes e elementos reais do GDD acima (personagens, mecânicas, ambientes). KRs genéricos são inaceitáveis. Regras:
- Entre 6 e 12 KRs concretos e verificáveis
- ARTE: cada etapa do pipeline separada (concept, high poly, retopo, UV, textura, rig, cada grupo de anims)
- PROGRAMAÇÃO: implementação, integração, testes e polish como KRs separados
- DESIGN: rascunho, revisão, aprovação e iteração pós-playtesting separados
- ÁUDIO: criação, edição, implementação e QA separados
- Cada KR: 1-4 semanas de trabalho de 1 pessoa

Retorne APENAS o Markdown abaixo:

## ${sa.title}
### KR 1: [nome concreto do KR]
- Estimativa: [N] semanas
- Descrição: [o que será entregue e como saberemos que está pronto]

### KR 2: [nome concreto do KR]
- Estimativa: [N] semanas
- Descrição: [entrega verificável]`;

        try {
            const md = await callAIAPI(prompt, apiKey);
            results[sa.id] = md;
        } catch (e) {
            console.warn(`Erro KRs MD ${sa.title}:`, e);
            results[sa.id] = `## ${sa.title}\n### KR 1: [erro ao gerar]\n- Estimativa: 2 semanas\n- Descrição: Erro ao processar esta sub-área.`;
        }

        if (onProgress) onProgress(i + 1, subareaList.length);

        // Pequena pausa entre chamadas para não sobrecarregar a API
        if (i < subareaList.length - 1) await sleep(500);
    }
    return results;
}

// FASE 3 (MD): Para cada sub-área, gera Markdown com tarefas de sprint
async function mdPhase3_Sprints(subareaList, phase2mds, genreCtx, gddNormalizado, apiKey, onProgress) {
    const results = {}; // id → md string

    for (let i = 0; i < subareaList.length; i++) {
        const sa = subareaList[i];
        const krsMd = phase2mds[sa.id] || `## ${sa.title}\n(sem KRs)`;

        // Exemplos de sprint do pipeline
        const areaPipeline = AREA_PIPELINES[sa.area];
        let sprintExamples = '';
        if (areaPipeline) {
            const relevant = areaPipeline.phases.filter(p => {
                const txt = (p.phase + ' ' + (p.okrs || []).join(' ')).toLowerCase();
                return (sa.keywords || []).some(k => txt.includes(k.toLowerCase()));
            });
            const phases = relevant.length > 0 ? relevant : areaPipeline.phases.slice(0, 2);
            const examples = phases.flatMap(p => p.sprint_examples || []).slice(0, 8);
            if (examples.length) sprintExamples = `Exemplos:\n${examples.map(e => `- ${e}`).join('\n')}`;
        }

        const overview = sa.overview || {};
        const gddContext = gddSecoesPorArea(gddNormalizado, sa.area);
        const prompt = `Você é um produtor de jogos sênior especialista em ${genreCtx.label}, área: ${sa.title}.

Projeto: ${gddNormalizado.titulo || overview.title || 'jogo'} | Engine: ${gddNormalizado.engine || 'agnóstico'}

GDD DO PROJETO — use estes dados para nomear as tarefas com elementos reais do jogo:
${gddContext}

${sprintExamples}

Key Results desta sub-área:
${krsMd}

Para CADA KR, crie as tarefas que compõem esse KR. OBRIGATÓRIO: mencione elementos reais do GDD (nomes de personagens, mecânicas específicas, ambientes). Nunca escreva "personagem principal" se o GDD diz o nome dele.

Conceito de sprint: cada sprint dura 2 semanas (10 dias úteis). Cada tarefa deve ter estimativa de 1, 2 ou 3 dias de trabalho, que representa o esforço real daquela entrega específica dentro de uma sprint. Um KR pode ter múltiplas sprints.

Regras:
- Verbos precisos: Implementar, Modelar, Texturizar, Riger, Animar, Testar, Compor, Escrever, Projetar, Revisar
- ULTRA-ESPECÍFICO: "Modelar high poly do personagem no ZBrush (tronco, membros, cabeça)" NÃO "Modelar personagem"
- Arte: modelagem/UV/textura/rig/anims em tarefas separadas
- Programação: lógica core / testes / integração / feedback visual separados
- Design: rascunho / revisão / aprovação / iteração separados
- 3-10 tarefas por KR | 1, 2 ou 3 dias por tarefa (esforço individual, não duração total)
- Prioridade: critical (blocker), high (core), medium (conteúdo), low (polish)
- Tipo: feature, art, design, audio, test, fix, config, doc

Retorne APENAS o Markdown abaixo:

## ${sa.title}
### KR 1: [nome do KR]
- [ ] Tarefa específica | 2d | high | feature
- [ ] Outra tarefa | 3d | high | art
- [ ] Tarefa de revisão | 1d | medium | doc

### KR 2: [nome do KR]
- [ ] Tarefa específica | 2d | critical | feature`;

        try {
            const md = await callAIAPI(prompt, apiKey);
            results[sa.id] = md;
        } catch (e) {
            console.warn(`Erro sprints MD ${sa.title}:`, e);
            results[sa.id] = `## ${sa.title}\n### KR 1: [erro]\n- [ ] Tarefa não gerada | 2d | medium | feature`;
        }

        if (onProgress) onProgress(i + 1, subareaList.length);

        // Pequena pausa entre chamadas
        if (i < subareaList.length - 1) await sleep(500);
    }
    return results;
}

// FASE 4 (MD): Milestones em Markdown
async function mdPhase4_Milestones(phase1md, subareaList, genreCtx, gddNormalizado, apiKey) {
    const areasSummary = subareaList.map(sa => `- ${sa.title} (mês ${sa.startMonth}–${sa.endMonth})`).join('\n');
    const duration = gddNormalizado.duracao_desenvolvimento || '24';

    const prompt = `Você é um produtor de jogos sênior especialista em captação de recursos (ProAC, BNDES, Rouanet).

Projeto: ${gddNormalizado.titulo || genreCtx.label} | Gênero: ${gddNormalizado.genero} | Duração: ${duration} meses
Plataforma: ${gddNormalizado.plataformas} | Engine: ${gddNormalizado.engine}
Sinopse: ${gddNormalizado.sinopse}

Sub-áreas do projeto:
${areasSummary}

Defina 5 a 8 marcos verificáveis. Os nomes dos marcos devem refletir o projeto real (ex: "Vertical Slice de [nome do jogo]", não "Vertical Slice").

Retorne APENAS o Markdown:

# MILESTONES

## Marco 1: [nome]
- Mês: [N]
- Tipo: prototype | alpha | beta | gold | release | vertical_slice | demo
- Descrição: [o que foi construído até este ponto]
- Entregáveis: item 1 | item 2 | item 3
- Critérios de aceite: critério 1 | critério 2
- Relevância para captação: [por que importa para financiadores]`;

    return await callAIAPI(prompt, apiKey);
}

// Consolida todos os MDs em um único documento para a fase de conversão JSON
function buildConsolidatedMD(phase1md, subareaList, phase3mds, phase4md) {
    const sprintSections = subareaList
        .map(sa => phase3mds[sa.id] || `## ${sa.title}\n(sem tarefas geradas)`)
        .join('\n\n');

    return `${phase1md}\n\n# ROADMAP DETALHADO\n\n${sprintSections}\n\n${phase4md}`;
}

// FASE FINAL: Converte o MD consolidado em JSON estruturado para a UI
async function mdToJSON(consolidatedMD, genreCtx, detectedGenre, apiKey, gddNormalizado) {
    // Parsear overview do MD (gerado pela IA na Fase 1)
    const overviewFromMD = parseMDOverview(consolidatedMD);

    // GDD normalizado é a fonte de verdade — sobrepõe o MD onde disponível
    const overview = {
        ...overviewFromMD,
        title:      (gddNormalizado?.titulo        && gddNormalizado.titulo !== 'não especificado')  ? gddNormalizado.titulo        : (overviewFromMD.title || 'Projeto'),
        genre:      (gddNormalizado?.genero        && gddNormalizado.genero !== 'não especificado')  ? gddNormalizado.genero        : (overviewFromMD.genre || 'Jogo'),
        platform:   (gddNormalizado?.plataformas   && gddNormalizado.plataformas !== 'não especificado') ? gddNormalizado.plataformas : (overviewFromMD.platform || ''),
        engine:     (gddNormalizado?.engine        && gddNormalizado.engine !== 'não especificado')  ? gddNormalizado.engine        : (overviewFromMD.engine || ''),
        teamSize:   (gddNormalizado?.tamanho_equipe && gddNormalizado.tamanho_equipe !== 'não especificado') ? gddNormalizado.tamanho_equipe : (overviewFromMD.teamSize || ''),
        totalDurationMonths: overviewFromMD.totalDurationMonths || parseInt(gddNormalizado?.duracao_desenvolvimento) || 12,
        description: overviewFromMD.description || gddNormalizado?.sinopse || '',
    };

    const subareasFromMD = extractSubareasFromMD(consolidatedMD);
    const milestones = parseMDMilestones(consolidatedMD);

    // Parsear objetivos + KRs + tarefas do MD de sprints
    const objectives = parseMDSprints(consolidatedMD, subareasFromMD);

    // Calcular pontos de sprint e recalcular duração real dos objetivos
    assignSprintPoints(objectives, overview.totalDurationMonths);

    // Gerar edital summary via API
    let editalSummary = null;
    try {
        editalSummary = await generateEditalSummary(
            { overview, objectives, totalDurationMonths: overview.totalDurationMonths },
            { milestones },
            genreCtx,
            apiKey,
            gddNormalizado
        );
    } catch (e) {
        console.warn('Erro ao gerar edital summary:', e);
    }

    return {
        genre: detectedGenre,
        genreLabel: genreCtx.label,
        overview,
        objectives,
        milestones,
        editalSummary,
        totalDurationMonths: overview.totalDurationMonths,
        generatedAt: new Date().toISOString()
    };
}

// ============================================================
// SISTEMA DE PONTOS DE SPRINT
// Cada sprint dura 2 semanas (10 dias úteis = 10 pontos de capacidade).
// Cada tarefa vale pontos = estimatedDays.
// Agrupa as tasks em sprints e atribui sprintNumber.
// Recalcula startMonth/endMonth dos objetivos a partir da carga real.
// ============================================================
const SPRINT_CAPACITY_POINTS = 10; // pontos por sprint (10 dias úteis = 2 semanas)
const SPRINT_DURATION_WEEKS = 2;

function assignSprintPoints(objectives, totalMonths) {
    const tMonths = totalMonths || 24;

    // ── Fase 1: calcular carga real de cada objetivo ─────────────
    objectives.forEach(obj => {
        (obj.keyResults || []).forEach(kr => {
            (kr.tasks || []).forEach(task => {
                task.points = task.estimatedDays || 2;
            });
            kr.totalPoints  = (kr.tasks || []).reduce((s, t) => s + t.points, 0);
            kr.sprintCount  = Math.max(1, Math.ceil(kr.totalPoints / SPRINT_CAPACITY_POINTS));
            kr.estimatedWeeks = kr.sprintCount * SPRINT_DURATION_WEEKS;
        });

        const totalWeeks   = (obj.keyResults || []).reduce((s, kr) => s + kr.estimatedWeeks, 0);
        obj._durationMonths = Math.max(1, Math.ceil(totalWeeks / 4.33));
    });

    // ── Fase 2: redistribuir objetivos ao longo de tMonths ───────
    // Se todos os endMonth ficaram ≤ 12 mas o projeto tem mais meses,
    // redistribuímos os objetivos proporcionalmente pela duração real.
    const maxEndMonth = Math.max(...objectives.map(o => o.endMonth || 1));

    if (maxEndMonth <= 12 && tMonths > 12) {
        // Calcular duração total real somando todos os objetivos em sequência
        const totalRealMonths = objectives.reduce((s, o) => s + o._durationMonths, 0);
        const scale = tMonths / Math.max(totalRealMonths, tMonths);

        let cursor = 1;
        objectives.forEach(obj => {
            const dur = Math.max(1, Math.round(obj._durationMonths * scale));
            obj.startMonth = cursor;
            obj.endMonth   = Math.min(cursor + dur - 1, tMonths);
            cursor = obj.endMonth + 1;
        });
    } else {
        // Apenas ajusta endMonth se a carga real exigir mais que o previsto
        objectives.forEach(obj => {
            if (obj.startMonth && obj.endMonth) {
                const minEnd = obj.startMonth + obj._durationMonths - 1;
                if (minEnd > obj.endMonth) obj.endMonth = Math.min(minEnd, tMonths);
            }
        });
    }
}

// ============================================================
// MOTOR DE SCHEDULING POR EQUIPE
// Distribui KRs ao longo do tempo com base no tamanho da equipe
// por área. Cada área tem N trabalhadores; KRs da mesma área
// rodam sequencialmente por pessoa (earliest-free); áreas
// diferentes rodam em paralelo.
//
// teamConfig = { programming: 1, art: 1, design: 1, audio: 1, qa: 1, production: 1 }
// Retorna clone de objectives com startMonth/endMonth recalculados.
// ============================================================

const DEFAULT_TEAM_CONFIG = {
    programming: 1,
    art:         1,
    design:      1,
    audio:       1,
    qa:          1,
    production:  1,
};

// Área → label amigável para o painel
const AREA_LABELS = {
    programming: 'Programação',
    art:         'Arte',
    design:      'Design',
    audio:       'Áudio',
    qa:          'QA',
    production:  'Produção',
};

// Área → cor (igual ao areaColors da timeline)
const AREA_COLORS = {
    programming: '#3b82f6',
    art:         '#8b5cf6',
    design:      '#10b981',
    audio:       '#f59e0b',
    qa:          '#ef4444',
    production:  '#6366f1',
};

/**
 * Agenda os KRs de cada objetivo usando earliest-free worker por área.
 * Retorna { objectives: [...], totalWeeks, totalMonths }
 */
function scheduleRoadmap(objectives, teamConfig) {
    const cfg = { ...DEFAULT_TEAM_CONFIG, ...teamConfig };

    // Pool de trabalhadores por área: array de freeAtWeek (semana em que ficam livres)
    const workers = {};
    for (const [area, count] of Object.entries(cfg)) {
        workers[area] = Array(Math.max(1, count)).fill(0);
    }

    // Clonar objetivos profundamente para não mutar o original
    const scheduled = objectives.map(obj => ({
        ...obj,
        keyResults: (obj.keyResults || []).map(kr => ({ ...kr, tasks: (kr.tasks || []).map(t => ({ ...t })) }))
    }));

    // Para cada objetivo, agendar seus KRs
    scheduled.forEach(obj => {
        const area = obj.area || 'programming';
        const pool = workers[area] || workers.programming;

        (obj.keyResults || []).forEach(kr => {
            // Pega o trabalhador mais livre desta área
            const workerIdx = pool.indexOf(Math.min(...pool));
            const startWeek = pool[workerIdx]; // semana 0-indexed
            const durationWeeks = kr.estimatedWeeks || 2;
            const endWeek = startWeek + durationWeeks;

            kr.scheduledStartWeek = startWeek;
            kr.scheduledEndWeek   = endWeek;

            // Avança o trabalhador
            pool[workerIdx] = endWeek;
        });

        // startMonth/endMonth do objetivo = envelope de todos os seus KRs
        const krStarts = obj.keyResults.map(kr => kr.scheduledStartWeek ?? 0);
        const krEnds   = obj.keyResults.map(kr => kr.scheduledEndWeek   ?? 2);
        const startWeek = Math.min(...krStarts);
        const endWeek   = Math.max(...krEnds);

        obj.startMonth = Math.floor(startWeek / 4.33) + 1;
        obj.endMonth   = Math.ceil(endWeek / 4.33);
    });

    // Duração total do projeto = semana mais tardia de qualquer trabalhador
    const allFreeWeeks = Object.values(workers).flat();
    const totalWeeks  = Math.max(...allFreeWeeks, 1);
    const totalMonths = Math.ceil(totalWeeks / 4.33);

    return { objectives: scheduled, totalWeeks, totalMonths };
}

/**
 * Agrega os objectives do scheduledResult por área.
 * Retorna array de { area, label, color, startMonth, endMonth, taskCount, krCount, objCount }
 * — uma entrada por área presente no roadmap, ordenada por startMonth.
 */
function buildSimpleRows(objectives) {
    const map = {};

    (objectives || []).forEach(obj => {
        const area = obj.area || 'programming';
        if (!map[area]) {
            map[area] = {
                area,
                label:      AREA_LABELS[area]    || area,
                color:      AREA_COLORS[area]     || '#6b7280',
                startMonth: Infinity,
                endMonth:   0,
                taskCount:  0,
                krCount:    0,
                objCount:   0,
            };
        }
        const row = map[area];
        row.objCount++;
        row.startMonth = Math.min(row.startMonth, obj.startMonth || 1);
        row.endMonth   = Math.max(row.endMonth,   obj.endMonth   || 1);
        (obj.keyResults || []).forEach(kr => {
            row.krCount++;
            row.taskCount += (kr.tasks || []).length;
        });
    });

    return Object.values(map)
        .map(r => ({ ...r, startMonth: r.startMonth === Infinity ? 1 : r.startMonth }))
        .sort((a, b) => a.startMonth - b.startMonth);
}

// ---- Parsers MD → estruturas JS ----

function parseMDOverview(md) {
    const overview = { totalDurationMonths: 24 };
    const section = md.match(/# VISÃO GERAL\n([\s\S]*?)(?=\n#)/);
    if (!section) return overview;
    for (const line of section[1].split('\n')) {
        const m = line.match(/^-\s+(.+?):\s+(.+)$/);
        if (!m) continue;
        const key = m[1].trim().toLowerCase().replace(/[êé]/g, 'e').replace(/[ção]/g, 'ca');
        const val = m[2].trim();
        if (key.includes('titul') || key.includes('nome')) overview.title = val;
        else if (key.includes('genero') || key.includes('genre')) overview.genre = val;
        else if (key.includes('plataforma')) overview.platform = val;
        else if (key.includes('equipe') || key.includes('team')) overview.teamSize = val;
        else if (key.includes('engine')) overview.engine = val;
        else if (key.includes('dura')) overview.totalDurationMonths = parseInt(val) || 24;
        else if (key.includes('descri')) overview.description = val;
    }
    return overview;
}

function parseMDMilestones(md) {
    const milestones = [];
    const section = md.match(/# MILESTONES\n([\s\S]*?)(?=\n# |$)/);
    if (!section) return milestones;

    const blocks = section[1].split(/\n## /);
    let idx = 1;
    for (const block of blocks.slice(1)) {
        const lines = block.split('\n').filter(l => l.trim());
        if (!lines.length) continue;

        const titleMatch = lines[0].match(/Marco\s+\d+:\s+(.+)/i);
        const m = {
            id: `m${idx}`,
            title: titleMatch ? titleMatch[1].trim() : lines[0].trim(),
            month: 3 * idx,
            type: 'prototype',
            description: '',
            deliverables: [],
            acceptanceCriteria: [],
            fundingRelevance: ''
        };

        for (const line of lines.slice(1)) {
            const match = line.match(/^-\s+(.+?):\s+(.+)$/);
            if (!match) continue;
            const key = match[1].trim().toLowerCase();
            const val = match[2].trim();
            if (key === 'mês' || key === 'mes') m.month = parseInt(val) || m.month;
            else if (key === 'tipo') m.type = val;
            else if (key === 'descrição' || key === 'descricao') m.description = val;
            else if (key === 'entregáveis' || key === 'entregaveis') m.deliverables = val.split('|').map(s => s.trim());
            else if (key.includes('critério') || key.includes('criterio')) m.acceptanceCriteria = val.split('|').map(s => s.trim());
            else if (key.includes('relevância') || key.includes('relevancia') || key.includes('captação')) m.fundingRelevance = val;
        }

        milestones.push(m);
        idx++;
    }
    return milestones;
}

function parseMDSprints(md, subareaList) {
    const objectives = [];
    const roadmapSection = md.match(/# ROADMAP DETALHADO\n([\s\S]*?)(?=\n# MILESTONES|$)/);
    if (!roadmapSection) return objectives;

    const saBlocks = roadmapSection[1].split(/\n## /);
    let objIdx = 0;

    for (const block of saBlocks.slice(1)) {
        const lines = block.split('\n');
        if (!lines.length) continue;

        const saTitle = lines[0].replace(/\[id:[^\]]+\]\s*/,'').trim();
        // Encontrar a sub-área correspondente pelo título
        const sa = subareaList.find(s => s.title === saTitle || block.includes(s.title)) || {
            id: `sa_${objIdx}`,
            title: saTitle,
            area: inferArea(saTitle),
            subarea: saTitle.toLowerCase().replace(/\s+/g, '-'),
            startMonth: 1,
            endMonth: 3,
            description: saTitle
        };

        const objective = {
            id: sa.id || `sa_${objIdx}`,
            title: sa.title,
            description: sa.description || sa.title,
            area: sa.area || inferArea(saTitle),
            subarea: sa.subarea || '',
            startMonth: sa.startMonth || 1,
            endMonth: sa.endMonth || 3,
            priority: 'high',
            keyResults: []
        };

        // Parsear KRs e tarefas dentro deste bloco
        const krBlocks = block.split(/\n### /);
        let krIdx = 0;
        for (const krBlock of krBlocks.slice(1)) {
            const krLines = krBlock.split('\n');
            const krTitleRaw = krLines[0].trim();
            const krTitleMatch = krTitleRaw.match(/^KR\s*\d+:\s*(.+)/i);
            const krTitle = krTitleMatch ? krTitleMatch[1].trim() : krTitleRaw;

            const kr = {
                id: `${objective.id}_kr${krIdx + 1}`,
                title: krTitle,
                description: krTitle,
                estimatedWeeks: 2,
                dependencies: [],
                tasks: []
            };

            let taskIdx = 0;
            for (const line of krLines.slice(1)) {
                // Tarefas: "- [ ] Título | 2d | high | feature"
                const taskMatch = line.match(/^-\s+\[[ x]\]\s+(.+?)\s*\|\s*(\d+)d\s*\|\s*(\w+)\s*\|\s*(\w+)/);
                if (taskMatch) {
                    kr.tasks.push({
                        id: `${kr.id}_t${taskIdx + 1}`,
                        title: taskMatch[1].trim(),
                        estimatedDays: Math.min(3, Math.max(1, parseInt(taskMatch[2]))),
                        priority: taskMatch[3].trim(),
                        type: taskMatch[4].trim()
                    });
                    taskIdx++;
                }
                // Estimativa do KR
                const estimMatch = line.match(/Estimativa:\s*(\d+)/i);
                if (estimMatch) kr.estimatedWeeks = parseInt(estimMatch[1]);
            }

            // Se não parseou nenhuma tarefa (formato ligeiramente diferente), tentar formato alternativo
            if (kr.tasks.length === 0) {
                for (const line of krLines.slice(1)) {
                    const altTask = line.match(/^[-*]\s+(.{10,})/);
                    if (altTask && !altTask[1].startsWith('Estimativa') && !altTask[1].startsWith('Descrição')) {
                        kr.tasks.push({
                            id: `${kr.id}_t${kr.tasks.length + 1}`,
                            title: altTask[1].trim().replace(/\s*\|\s*\d+d.*$/, ''),
                            estimatedDays: 2,
                            priority: 'medium',
                            type: 'feature'
                        });
                    }
                }
            }

            if (krTitle && krTitle.length > 2) {
                objective.keyResults.push(kr);
                krIdx++;
            }
        }

        objectives.push(objective);
        objIdx++;
    }

    return objectives;
}

// Infere área pela presença de palavras no título
function inferArea(title) {
    const t = title.toLowerCase();
    if (t.includes('program') || t.includes('código') || t.includes('sistema') || t.includes('engine')) return 'programming';
    if (t.includes('arte') || t.includes('art') || t.includes('model') || t.includes('animaç') || t.includes('vfx')) return 'art';
    if (t.includes('design') || t.includes('narrat') || t.includes('level') || t.includes('quest') || t.includes('roteiro')) return 'design';
    if (t.includes('áudio') || t.includes('audio') || t.includes('som') || t.includes('música') || t.includes('sfx')) return 'audio';
    if (t.includes('qa') || t.includes('teste') || t.includes('qualidade')) return 'qa';
    return 'production';
}

// ============================================================
// FASE 4: MILESTONES E MARCOS DO PROJETO
// Define entregas verificáveis a cada fase — essenciais para editais
// ============================================================
async function analyzeMilestones(sprintResult, genreCtx, apiKey) {
    const objectivesSummary = sprintResult.objectives
        .map(o => {
            const taskCount = (o.keyResults || []).reduce((t, kr) => t + (kr.tasks || []).length, 0);
            return `- ${o.title} (meses ${o.startMonth}-${o.endMonth}, ${taskCount} tarefas, ${o.area})`;
        })
        .join('\n');

    const prompt = `Você é um produtor de jogos sênior e especialista em captação de recursos para jogos (editais, incentivos, investidores).

Projeto: ${sprintResult.overview.title} (${sprintResult.overview.genre})
Duração: ${sprintResult.totalDurationMonths} meses
Gênero: ${genreCtx.label}

Objetivos de desenvolvimento:
${objectivesSummary}

Com base nesse plano, defina 5-8 MARCOS (milestones) verificáveis do projeto.
Marcos são momentos chave onde há uma entrega concreta e demonstrável — como uma build jogável, alpha, beta, etc.
Devem ser distribuídos ao longo de todo o desenvolvimento.

Cada marco deve ter:
- Nome claro (ex: "Prototype Jogável", "Alpha Interna", "Beta Fechada", "Gold Master")
- Mês em que acontece
- O que está pronto naquele ponto (entregáveis concretos)
- Critérios de aceite objetivos (como saber que está pronto)
- Relevância para captação/edital (por que esse marco importa para financiadores)

Retorne APENAS JSON válido:
{
  "milestones": [
    {
      "id": "m1",
      "title": "Nome do Marco",
      "month": 3,
      "type": "prototype|alpha|beta|gold|release|vertical_slice|demo",
      "description": "O que foi construído até aqui",
      "deliverables": ["Entregável 1", "Entregável 2", "Entregável 3"],
      "acceptanceCriteria": ["Critério 1", "Critério 2"],
      "fundingRelevance": "Por que este marco importa para editais e financiadores"
    }
  ]
}`;

    const response = await callAIAPI(prompt, apiKey);
    return parseJSONResponse(response, 'Fase 4 (Milestones)');
}

// ============================================================
// FASE 5: RESUMO PARA EDITAL / PROPOSTA
// Gera texto formatado para uso em editais, pitches e propostas
// ============================================================
async function generateEditalSummary(sprintResult, milestoneResult, genreCtx, apiKey, gddNormalizado) {
    const totalTasks = sprintResult.objectives.reduce((total, obj) =>
        total + (obj.keyResults || []).reduce((t, kr) => t + (kr.tasks || []).length, 0), 0);

    const totalManDays = sprintResult.objectives.reduce((total, obj) =>
        total + (obj.keyResults || []).reduce((t, kr) =>
            t + (kr.tasks || []).reduce((tt, task) => tt + (task.estimatedDays || 2), 0), 0), 0);

    const milestonesSummary = (milestoneResult.milestones || [])
        .map(m => `  - Marco ${m.month}º mês: "${m.title}" — ${m.description}`)
        .join('\n');

    const areaBreakdown = {};
    sprintResult.objectives.forEach(obj => {
        if (!areaBreakdown[obj.area]) areaBreakdown[obj.area] = { objectives: 0, tasks: 0 };
        areaBreakdown[obj.area].objectives++;
        areaBreakdown[obj.area].tasks += (obj.keyResults || []).reduce((t, kr) => t + (kr.tasks || []).length, 0);
    });

    const areaText = Object.entries(areaBreakdown)
        .map(([area, data]) => `${area}: ${data.objectives} objetivos, ${data.tasks} tarefas`)
        .join('; ');

    // Dados reais da equipe do GDD (papéis e engine corretos)
    const engine = gddNormalizado?.engine || sprintResult.overview.engine || 'a engine do projeto';
    const papeis = gddNormalizado?.papeis || sprintResult.overview.teamSize || 'equipe do projeto';
    const teamSize = gddNormalizado?.tamanho_equipe || sprintResult.overview.teamSize || '';

    const prompt = `Você é um produtor de jogos sênior com experiência em captação de recursos via editais (ProAC, Rouanet, BNDES, FINEP, etc.).

Gere um RESUMO EXECUTIVO do projeto para uso em editais e propostas de financiamento.

ATENÇÃO: Use SOMENTE as informações abaixo. NÃO invente dados, NÃO substitua a engine por outra, NÃO invente papéis que não estão listados.

Dados do projeto:
- Título: ${sprintResult.overview.title}
- Gênero: ${sprintResult.overview.genre} (${genreCtx.label})
- Plataforma: ${sprintResult.overview.platform}
- Engine: ${engine}
- Equipe atual: ${teamSize} — papéis: ${papeis}
- Duração total: ${sprintResult.totalDurationMonths} meses
- Total de tarefas planejadas: ${totalTasks}
- Estimativa de esforço: ~${totalManDays} dias-homem de trabalho
- Distribuição por área: ${areaText}
- Sprints de 2 semanas (10 dias úteis cada)

Marcos do projeto:
${milestonesSummary}

Descrição do jogo: ${sprintResult.overview.description}

Gere o seguinte conteúdo estruturado para uso em editais:

Retorne APENAS JSON válido:
{
  "executiveSummary": "Parágrafo de 3-4 frases descrevendo o projeto de forma profissional para financiadores",
  "methodology": "Parágrafo descrevendo a metodologia de desenvolvimento (ágil, sprints de 2 semanas, 3 níveis hierárquicos de tarefas — objetivos, KRs e tarefas de sprint)",
  "teamNeeds": [
    { "role": "Cargo real (use os papéis listados acima)", "dedication": "Período e dedicação", "responsibilities": "Principais responsabilidades" }
  ],
  "budgetJustification": "Texto justificando o orçamento baseado no esforço estimado (~${totalManDays} dias-homem) e nos papéis reais da equipe",
  "risksAndMitigation": [
    { "risk": "Risco", "mitigation": "Mitigação" }
  ],
  "impactStatement": "Parágrafo sobre o impacto cultural/econômico/social do projeto",
  "technicalFeasibility": "Parágrafo demonstrando viabilidade técnica baseado no roadmap e na engine ${engine}"
}`;

    const response = await callAIAPI(prompt, apiKey);
    return parseJSONResponse(response, 'Fase 5 (Resumo para Edital)');
}

// ============================================================
// UTILITÁRIO: PARSE DE JSON DA RESPOSTA DA IA
// ============================================================
function parseJSONResponse(response, phaseName) {
    let cleaned = response.trim();

    // 1. Remover blocos de código markdown se existirem
    if (cleaned.includes('```json')) {
        const start = cleaned.indexOf('```json') + 7;
        const end = cleaned.lastIndexOf('```');
        if (end > start) cleaned = cleaned.substring(start, end).trim();
    } else if (cleaned.includes('```')) {
        const start = cleaned.indexOf('```') + 3;
        const end = cleaned.lastIndexOf('```');
        if (end > start) cleaned = cleaned.substring(start, end).trim();
    }

    // 2. Tentar parse direto
    try {
        return JSON.parse(cleaned);
    } catch (e1) {
        // 3. Extrair o JSON pelo primeiro { ou [ e último } ou ]
        const firstBrace = cleaned.indexOf('{');
        const firstBracket = cleaned.indexOf('[');
        let startIdx = -1;
        if (firstBrace !== -1 && firstBracket !== -1) {
            startIdx = Math.min(firstBrace, firstBracket);
        } else if (firstBrace !== -1) {
            startIdx = firstBrace;
        } else if (firstBracket !== -1) {
            startIdx = firstBracket;
        }

        const lastBrace = cleaned.lastIndexOf('}');
        const lastBracket = cleaned.lastIndexOf(']');
        let endIdx = Math.max(lastBrace, lastBracket);

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const extracted = cleaned.substring(startIdx, endIdx + 1);
            try {
                return JSON.parse(extracted);
            } catch (e2) {
                // 4. Última tentativa: corrigir JSON truncado adicionando fechamentos
                try {
                    const fixed = fixTruncatedJSON(extracted);
                    return JSON.parse(fixed);
                } catch (e3) {
                    // nada funciona
                }
            }
        }

        console.error(`Erro ao parsear ${phaseName}:`, e1);
        console.log('Resposta recebida (primeiros 2000 chars):', response.substring(0, 2000));
        throw new Error(`Erro ao processar resposta da IA na ${phaseName}. Tente novamente.`);
    }
}

// Tenta fechar um JSON truncado contando abre/fecha chaves e colchetes
function fixTruncatedJSON(str) {
    let fixed = str.trim();
    // Remover vírgulas pendentes antes de fechar
    fixed = fixed.replace(/,\s*$/, '');
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Contar chaves e colchetes abertos
    let braces = 0, brackets = 0, inString = false, escape = false;
    for (let i = 0; i < fixed.length; i++) {
        const c = fixed[i];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === '{') braces++;
        else if (c === '}') braces--;
        else if (c === '[') brackets++;
        else if (c === ']') brackets--;
    }

    // Fechar strings abertas
    if (inString) fixed += '"';
    // Fechar colchetes e chaves pendentes
    while (brackets > 0) { fixed += ']'; brackets--; }
    while (braces > 0) { fixed += '}'; braces--; }

    return fixed;
}

// ============================================================
// UI DE LOADING COM PROGRESSO DAS FASES
// ============================================================
function showLoadingScreen() {
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    setLoadingPhase(0, 'Iniciando análise...');
}

function setLoadingMessage(message) {
    const el = document.getElementById('loadingMessage');
    if (el) el.textContent = message;
}

function setLoadingPhase(phase, message) {
    // step0 = Normalizando GDD, step1 = Sub-áreas, step2 = KRs, step3 = Sprints, step4 = Milestones, step5 = Finalizando
    const stepIds = ['step0', 'step1', 'step2', 'step3', 'step4', 'step5'];

    stepIds.forEach((id, index) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active', 'done');
        if (index < phase) el.classList.add('done');
        else if (index === phase) el.classList.add('active');
    });

    const loadingMsg = document.getElementById('loadingMessage');
    if (loadingMsg) loadingMsg.textContent = message;
}

// ============================================================
// EXIBIÇÃO DE RESULTADOS — HIERARQUIA Objetivo > OKR > Sprint
// ============================================================
function showResults() {
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'block';

    recomputeSchedule();   // calcula scheduledResult antes de renderizar
    populateResults();
    saveApplicationState();
    // Atualiza botão salvar para refletir se há projeto ativo
    if (typeof updateSaveBtn === 'function') updateSaveBtn();
}

/**
 * Roda o motor de scheduling com teamConfig atual e atualiza scheduledResult.
 * Chamado na abertura da tela de resultados e toda vez que um slider muda.
 */
function recomputeSchedule() {
    if (!analysisResult) return;
    scheduledResult = scheduleRoadmap(analysisResult.objectives || [], teamConfig);
}

/**
 * Chamado pelos sliders de equipe — recalcula e re-renderiza só a timeline e as tasks.
 */
function onTeamConfigChange() {
    recomputeSchedule();
    updateTeamConfigUI();
    try {
        populateTimeline();
        populateHierarchicalTasks();
    } catch (e) {
        console.error('Erro ao re-renderizar após mudança de equipe:', e);
    }
}

/**
 * Atualiza o indicador de duração total no painel de equipe.
 */
function updateTeamConfigUI() {
    if (!scheduledResult) return;
    const el = document.getElementById('teamTotalDuration');
    if (el) {
        const m = scheduledResult.totalMonths;
        const years = Math.floor(m / 12);
        const months = m % 12;
        const label = years > 0
            ? `${years} ano${years > 1 ? 's' : ''}${months > 0 ? ` e ${months} mês${months > 1 ? 'es' : ''}` : ''}`
            : `${m} mês${m > 1 ? 'es' : ''}`;
        el.textContent = label;
    }
}

function populateResults() {
    if (!analysisResult) return;

    // Resetar modo de agrupamento para o padrão ao carregar novos resultados
    currentTaskGroupMode = 'area';
    currentTaskAreaFilter = 'all';
    // Sincronizar UI dos toggles
    setTimeout(() => {
        const ga = document.getElementById('groupByArea');
        const gm = document.getElementById('groupByMilestone');
        if (ga) ga.classList.add('active');
        if (gm) gm.classList.remove('active');
        const filterRow = document.getElementById('tasksFilter');
        if (filterRow) filterRow.style.opacity = '1';
        document.querySelectorAll('.filter-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === 0);
        });
    }, 0);

    try {
        populateOverview();
        populateTeamConfigPanel();
        populateTimeline();
        populateMilestones();
        populateEditalSummary();
        populateHierarchicalTasks();
    } catch (error) {
        console.error('Erro ao popular resultados:', error);
        alert('Erro ao exibir os resultados.');
    }
}

// ============================================================
// PAINEL DE CONFIGURAÇÃO DE EQUIPE
// ============================================================

function populateTeamConfigPanel() {
    const panel = document.getElementById('teamConfigPanel');
    if (!panel) return;

    const areas = Object.keys(AREA_LABELS);
    const usedAreas = new Set((analysisResult.objectives || []).map(o => o.area));
    const activeAreas = areas.filter(a => usedAreas.has(a));

    // Sumário: dots com nome e contagem para cada área ativa
    const summaryHTML = activeAreas.map(area => {
        const count = teamConfig[area] || 1;
        const color = AREA_COLORS[area] || '#6b7280';
        return `
        <div class="team-summary-item" id="team-summary-${area}">
            <span class="team-area-dot" style="background:${color}"></span>
            <span class="team-summary-label">${AREA_LABELS[area]}</span>
            <span class="team-summary-count" id="team-summary-count-${area}">${count}</span>
        </div>`;
    }).join('');

    // Sliders (todas as áreas, inativas desabilitadas)
    const slidersHTML = areas.map(area => {
        const count = teamConfig[area] || 1;
        const color = AREA_COLORS[area] || '#6b7280';
        const inactive = !usedAreas.has(area) ? 'team-slider-row--inactive' : '';
        return `
        <div class="team-slider-row ${inactive}" data-area="${area}">
            <div class="team-slider-label">
                <span class="team-area-dot" style="background:${color}"></span>
                <span class="team-area-name">${AREA_LABELS[area]}</span>
            </div>
            <input type="range" class="team-slider" min="1" max="5" value="${count}"
                oninput="handleTeamSlider('${area}', this.value)"
                ${!usedAreas.has(area) ? 'disabled' : ''}
            >
            <span class="team-slider-value" id="team-val-${area}">${count}
                <small>${count === 1 ? 'pessoa' : 'pessoas'}</small>
            </span>
        </div>`;
    }).join('');

    panel.innerHTML = `
        <div class="team-config-summary">
            <div class="team-summary-items">${summaryHTML}</div>
            <button class="team-customize-btn" onclick="toggleTeamSliders(this)" title="Personalizar equipe">
                <i class="fas fa-sliders-h"></i> Personalizar
            </button>
        </div>
        <div class="team-config-sliders" id="teamSlidersPanel" style="display:none">
            <div class="team-config-sliders-inner">
                ${slidersHTML}
            </div>
            <div class="team-config-duration-row">
                Duração estimada: <strong id="teamTotalDuration">—</strong>
            </div>
        </div>
    `;

    updateTeamConfigUI();
}

function toggleTeamSliders(btn) {
    const panel = document.getElementById('teamSlidersPanel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    btn.classList.toggle('active', !isOpen);
}

function handleTeamSlider(area, rawValue) {
    const value = parseInt(rawValue);
    teamConfig[area] = value;

    // Atualizar label do slider
    const valEl = document.getElementById(`team-val-${area}`);
    if (valEl) valEl.innerHTML = `${value}<small>${value === 1 ? ' pessoa' : ' pessoas'}</small>`;

    // Atualizar contagem no sumário
    const summaryCount = document.getElementById(`team-summary-count-${area}`);
    if (summaryCount) summaryCount.textContent = value;

    // Recalcular scheduling e re-renderizar
    onTeamConfigChange();
}

function populateOverview() {
    const overviewContent = document.getElementById('overviewContent');
    const overview = analysisResult.overview;
    if (!overview) { overviewContent.innerHTML = ''; return; }

    const totalTasks = countTotalTasks();

    // Atualiza título no header da seção
    const titleEl = document.getElementById('resultsProjectTitle');
    if (titleEl && overview.title) titleEl.textContent = overview.title;

    const genre   = overview.genre ? `${overview.genre} <span class="genre-badge">${analysisResult.genreLabel}</span>` : '—';
    const platform = overview.platform || '—';
    const totalObjs = analysisResult.objectives ? analysisResult.objectives.length : 0;

    overviewContent.innerHTML = `
        <div class="overview-row">
            <div class="overview-line">
                <span class="overview-line-label">Gênero</span>
                <span class="overview-line-value">${genre}</span>
            </div>
            <div class="overview-line">
                <span class="overview-line-label">Plataforma</span>
                <span class="overview-line-value">${platform}</span>
            </div>
        </div>
        <div class="overview-desc-row">
            ${overview.description || ''}
        </div>
        <div class="overview-row">
            <div class="overview-line">
                <span class="overview-line-label">Tarefas</span>
                <span class="overview-line-value">${totalTasks} tarefas · ${totalObjs} objetivos</span>
            </div>
            <div class="overview-line">
                <span class="overview-line-label">Duração</span>
                <span class="overview-line-value">${analysisResult.totalDurationMonths} meses</span>
            </div>
        </div>
    `;
}

function countTotalTasks() {
    if (!analysisResult.objectives) return 0;
    return analysisResult.objectives.reduce((total, obj) => {
        return total + (obj.keyResults || []).reduce((t, kr) => t + (kr.tasks || []).length, 0);
    }, 0);
}

// ============================================================
// TIMELINE — funções de renderização
// ============================================================

function setTimelineMode(mode) {
    timelineMode = mode;
    // Botões antigos (dentro da timeline, se ainda renderizados)
    document.querySelectorAll('.tl-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    // Botões novos (no header do roadmap-card)
    const btnSimple   = document.getElementById('btnSimple');
    const btnDetailed = document.getElementById('btnDetailed');
    if (btnSimple)   btnSimple.classList.toggle('active',   mode === 'simple');
    if (btnDetailed) btnDetailed.classList.toggle('active', mode === 'detailed');
    populateTimeline();
}

function populateTimeline() {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    timeline.innerHTML = '';

    // ── Tabs de modo ─────────────────────────────────────────────
    // Os botões de modo agora ficam no header do roadmap-card (não mais dentro da timeline)

    // ── Fonte de dados ───────────────────────────────────────────
    const src = scheduledResult || { objectives: analysisResult.objectives || [], totalMonths: analysisResult.totalDurationMonths || 12 };
    const totalMonths = src.totalMonths || analysisResult.totalDurationMonths || 12;

    // ── Constantes de layout ─────────────────────────────────────
    const WEEKS_PER_SPRINT  = 2;
    const SPRINTS_PER_MONTH = 2;
    const WEEK_COL_PX       = 28;
    const SPRINT_PX         = WEEKS_PER_SPRINT * WEEK_COL_PX;   // 56px
    const totalSprints      = totalMonths * SPRINTS_PER_MONTH;
    const totalWeeksAll     = totalSprints * WEEKS_PER_SPRINT;
    const totalPx           = totalWeeksAll * WEEK_COL_PX;

    // ── Cabeçalho (compartilhado entre os dois modos) ────────────
    const totalYears    = Math.ceil(totalMonths / 12);
    const totalQuarters = Math.ceil(totalMonths / 3);

    let yearCells = '';
    for (let y = 1; y <= totalYears; y++) {
        const mo = Math.min(12, totalMonths - (y - 1) * 12);
        yearCells += `<div class="tl-header-year" style="width:${mo * SPRINTS_PER_MONTH * WEEKS_PER_SPRINT * WEEK_COL_PX}px">Ano ${y}</div>`;
    }
    let quarterCells = '';
    for (let q = 1; q <= totalQuarters; q++) {
        const mo = Math.min(3, totalMonths - (q - 1) * 3);
        quarterCells += `<div class="tl-header-quarter" style="width:${mo * SPRINTS_PER_MONTH * WEEKS_PER_SPRINT * WEEK_COL_PX}px">Q${((q-1)%4)+1}</div>`;
    }
    let sprintCells = '';
    for (let s = 1; s <= totalSprints; s++) {
        sprintCells += `<div class="tl-header-sprint" style="width:${SPRINT_PX}px">Sprint ${s}</div>`;
    }
    let weekCells = '';
    for (let s = 1; s <= totalSprints; s++) {
        weekCells += `<div class="tl-header-week" style="width:${WEEK_COL_PX}px">S1</div>`;
        weekCells += `<div class="tl-header-week tl-week-last" style="width:${WEEK_COL_PX}px">S2</div>`;
    }

    // ── Divisores nas barras ─────────────────────────────────────
    let dividersHTML = '';
    for (let q = 1; q < totalQuarters; q++)
        dividersHTML += `<div class="quarter-divider" style="left:${q * 3 * SPRINTS_PER_MONTH * SPRINT_PX}px"></div>`;
    for (let s = 1; s < totalSprints; s++)
        dividersHTML += `<div class="sprint-divider" style="left:${s * SPRINT_PX}px"></div>`;
    for (let w = 1; w < totalWeeksAll; w++)
        if (w % WEEKS_PER_SPRINT !== 0)
            dividersHTML += `<div class="week-divider" style="left:${w * WEEK_COL_PX}px"></div>`;

    // ── Montar estrutura base ────────────────────────────────────
    const labelsCol = document.createElement('div');
    labelsCol.className = 'timeline-labels';

    const labelHeader = document.createElement('div');
    labelHeader.className = 'timeline-label-header';
    labelHeader.textContent = `${totalMonths}m`;
    labelsCol.appendChild(labelHeader);

    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'timeline-bars-scroll';

    const barsInner = document.createElement('div');
    barsInner.className = 'timeline-bars-inner';
    barsInner.style.width = `${totalPx}px`;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'timeline-header';
    headerDiv.innerHTML = `
        <div class="tl-header-row tl-row-years">${yearCells}</div>
        <div class="tl-header-row tl-row-quarters">${quarterCells}</div>
        <div class="tl-header-row tl-row-sprints">${sprintCells}</div>
        <div class="tl-header-row tl-row-weeks">${weekCells}</div>
    `;
    barsInner.appendChild(headerDiv);

    // ── Renderizar linhas conforme o modo ────────────────────────
    if (timelineMode === 'simple') {
        renderSimpleRows(src.objectives, labelsCol, barsInner, dividersHTML, totalPx, SPRINTS_PER_MONTH, SPRINT_PX);
    } else {
        renderDetailedRows(src.objectives, labelsCol, barsInner, dividersHTML, totalPx, SPRINTS_PER_MONTH, SPRINT_PX);
    }

    scrollWrapper.appendChild(barsInner);

    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-scroll-wrapper';
    wrapper.appendChild(labelsCol);
    wrapper.appendChild(scrollWrapper);

    timeline.appendChild(wrapper);
}

/** Visão SIMPLIFICADA: uma linha por área */
function renderSimpleRows(objectives, labelsCol, barsInner, dividersHTML, totalPx, SPM, SPRINT_PX) {
    const rows = buildSimpleRows(objectives);

    rows.forEach(row => {
        const startPx = (row.startMonth - 1) * SPM * SPRINT_PX;
        const rawPx   = (row.endMonth - row.startMonth + 1) * SPM * SPRINT_PX;
        const widthPx = Math.max(rawPx, SPRINT_PX);
        const dur     = row.endMonth - row.startMonth + 1;

        // Label
        const labelEl = document.createElement('div');
        labelEl.className = 'category-label category-label--simple';
        labelEl.title = `${row.label} · mês ${row.startMonth}–${row.endMonth}`;
        labelEl.innerHTML = `
            <span class="area-dot" style="background:${row.color}"></span>
            <span class="category-label-text">${row.label}</span>
        `;
        labelsCol.appendChild(labelEl);

        // Barra (mais alta no modo simples)
        const trackEl = document.createElement('div');
        trackEl.className = 'timeline-category timeline-category--simple';
        trackEl.innerHTML = `
            <div class="timeline-track timeline-track--simple" style="width:${totalPx}px">
                ${dividersHTML}
                <div class="timeline-bar timeline-bar--simple"
                     style="left:${startPx}px; width:${widthPx}px; background:${row.color};"
                     title="${row.label} · mês ${row.startMonth}–${row.endMonth} · ${row.taskCount} tarefas · ${row.objCount} sub-áreas">
                    <span class="bar-label-simple">
                        <strong>${row.label}</strong>
                        <span>${row.taskCount} tarefas · ${row.objCount} sub-área${row.objCount !== 1 ? 's' : ''} · ${dur} mês${dur !== 1 ? 'es' : ''}</span>
                    </span>
                </div>
            </div>
        `;
        barsInner.appendChild(trackEl);
    });
}

/** Visão DETALHADA: uma linha por objetivo/sub-área */
function renderDetailedRows(objectives, labelsCol, barsInner, dividersHTML, totalPx, SPM, SPRINT_PX) {
    (objectives || []).forEach(obj => {
        const color     = AREA_COLORS[obj.area] || '#6b7280';
        const startPx   = (obj.startMonth - 1) * SPM * SPRINT_PX;
        const rawPx     = (obj.endMonth - obj.startMonth + 1) * SPM * SPRINT_PX;
        const widthPx   = Math.max(rawPx, SPRINT_PX);
        const taskCount = (obj.keyResults || []).reduce((t, kr) => t + (kr.tasks || []).length, 0);
        const sprintCount = (obj.keyResults || []).reduce((s, kr) => s + (kr.sprintCount || 1), 0);
        const durationLabel = `${sprintCount} sprint${sprintCount !== 1 ? 's' : ''}`;

        const labelEl = document.createElement('div');
        labelEl.className = 'category-label';
        labelEl.title = `${obj.title} · mês ${obj.startMonth}–${obj.endMonth}`;
        labelEl.innerHTML = `
            <span class="area-dot" style="background:${color}"></span>
            <span class="category-label-text">${obj.title}</span>
        `;
        labelsCol.appendChild(labelEl);

        const row = document.createElement('div');
        row.className = 'timeline-category';
        row.innerHTML = `
            <div class="timeline-track" style="width:${totalPx}px">
                ${dividersHTML}
                <div class="timeline-bar"
                     style="left:${startPx}px; width:${widthPx}px; background:${color};"
                     title="${obj.title} · mês ${obj.startMonth}–${obj.endMonth} · ${taskCount} tarefas · ${durationLabel}">
                    <span class="bar-label">${taskCount}t · ${durationLabel}</span>
                </div>
            </div>
        `;
        barsInner.appendChild(row);
    });
}

function populateHierarchicalTasks() {
    const tasksGrid = document.getElementById('tasksGrid');
    if (!tasksGrid) return;
    tasksGrid.innerHTML = '';

    // Usa objetivos do scheduling (com datas recalculadas pela equipe)
    const objList = (scheduledResult || { objectives: analysisResult.objectives || [] }).objectives;

    if (!objList || objList.length === 0) {
        tasksGrid.innerHTML = '<p>Nenhum objetivo gerado.</p>';
        return;
    }

    const areaIcons = {
        programming: '💻', art: '🎨', design: '📋',
        audio: '🎵', qa: '🧪', production: '📊'
    };
    const areaColors = {
        programming: '#3b82f6', art: '#8b5cf6', design: '#10b981',
        audio: '#f59e0b', qa: '#ef4444', production: '#6366f1'
    };
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const typeIcons = {
        feature: '⚙️', fix: '🐛', art: '🎨', design: '📐',
        audio: '🔊', test: '🧪', config: '🔧'
    };

    objList.forEach((obj, objIndex) => {
        const color = areaColors[obj.area] || '#6b7280';
        const icon = areaIcons[obj.area] || '📌';
        const krCount = (obj.keyResults || []).length;
        const taskCount = (obj.keyResults || []).reduce((t, kr) => t + (kr.tasks || []).length, 0);

        const objEl = document.createElement('div');
        objEl.className = 'objective-card';
        objEl.dataset.objId = obj.id;

        // Header do Objetivo
        objEl.innerHTML = `
            <div class="objective-header" onclick="toggleObjective('${obj.id}')">
                <div class="objective-icon" style="background:${color}">${icon}</div>
                <div class="objective-info">
                    <div class="objective-title">${obj.title}</div>
                    <div class="objective-meta">
                        <span class="meta-badge priority-${obj.priority}">${obj.priority}</span>
                        <span class="meta-badge area-badge">${obj.area}</span>
                        <span class="meta-stat">Meses ${obj.startMonth}–${obj.endMonth}</span>
                        <span class="meta-stat">${krCount} KRs · ${taskCount} tarefas</span>
                    </div>
                </div>
                <div class="objective-toggle">▼</div>
            </div>
            <div class="objective-body" id="body_${obj.id}">
                <div class="okr-list" id="okrs_${obj.id}"></div>
            </div>
        `;

        tasksGrid.appendChild(objEl);

        // Popular KRs dentro do objetivo
        const okrList = objEl.querySelector(`#okrs_${obj.id}`);
        (obj.keyResults || []).forEach((kr, krIndex) => {
            const krEl = document.createElement('div');
            krEl.className = 'kr-card';
            krEl.dataset.krId = kr.id;

            const tasks = kr.tasks || [];
            const totalDays = tasks.reduce((t, task) => t + (task.estimatedDays || 2), 0);
            const totalPoints = tasks.reduce((t, task) => t + (task.points || task.estimatedDays || 2), 0);
            const sprintCount = kr.sprintCount || Math.max(1, Math.ceil(totalPoints / SPRINT_CAPACITY_POINTS));
            const weeksLabel = `${sprintCount} sprint${sprintCount > 1 ? 's' : ''} · ${sprintCount * 2} semanas`;

            krEl.innerHTML = `
                <div class="kr-header" onclick="toggleKR('${kr.id}')">
                    <div class="kr-icon">🎯</div>
                    <div class="kr-info">
                        <div class="kr-title">${kr.title}</div>
                        <div class="kr-meta">
                            <span class="meta-badge" style="background:rgba(99,102,241,0.1);color:#4f46e5;">${weeksLabel}</span>
                            <span class="meta-stat">${tasks.length} tarefas · ${totalPoints} pts</span>
                            ${kr.dependencies && kr.dependencies.length > 0
                                ? `<span class="meta-badge dep-badge">deps: ${kr.dependencies.join(', ')}</span>`
                                : ''}
                        </div>
                    </div>
                    <div class="kr-toggle">▼</div>
                </div>
                <div class="kr-body" id="krbody_${kr.id}">
                    <div class="task-list sprint-tasks" id="tasks_${kr.id}"></div>
                </div>
            `;

            okrList.appendChild(krEl);

            // Popular tarefas de sprint
            const taskList = krEl.querySelector(`#tasks_${kr.id}`);
            const sortedTasks = [...tasks].sort((a, b) =>
                (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
            );

            sortedTasks.forEach((task, taskIndex) => {
                const taskEl = document.createElement('div');
                taskEl.className = 'sprint-task';
                taskEl.dataset.taskId = task.id;
                const tIcon = typeIcons[task.type] || '📌';

                taskEl.innerHTML = `
                    <div class="task-checkbox sprint-checkbox"
                         data-obj="${obj.id}" data-kr="${kr.id}" data-task="${task.id}"
                         onclick="toggleSprintTask(this)">
                    </div>
                    <div class="task-body">
                        <div class="task-title-row">
                            <span class="type-icon" title="${task.type}">${tIcon}</span>
                            <span class="task-title">${task.title}</span>
                        </div>
                        <div class="task-meta-row">
                            <span class="meta-badge priority-${task.priority}">${task.priority}</span>
                            <span class="days-badge" title="${task.estimatedDays || 2} dias · ${task.points || task.estimatedDays || 2} pts">⏱ ${task.estimatedDays || 2}d · ${task.points || task.estimatedDays || 2}pts</span>
                            <span class="type-badge">${task.type || 'feature'}</span>
                        </div>
                    </div>
                `;
                taskList.appendChild(taskEl);
            });
        });
    });

    loadTaskStates();
}

// ============================================================
// MILESTONES — MARCOS DO PROJETO
// ============================================================
function populateMilestones() {
    const grid = document.getElementById('milestonesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const milestones = analysisResult.milestones || [];
    if (milestones.length === 0) {
        grid.innerHTML = '<p>Marcos não disponíveis.</p>';
        return;
    }

    const typeIcons = {
        prototype: '🔬', alpha: '⚗️', beta: '🧩', gold: '🏆',
        release: '🚀', vertical_slice: '🎮', demo: '🎬'
    };
    const typeColors = {
        prototype: '#6366f1', alpha: '#3b82f6', beta: '#10b981',
        gold: '#f59e0b', release: '#ef4444', vertical_slice: '#8b5cf6', demo: '#06b6d4'
    };

    // Data base = hoje, avança mês a mês
    const baseDate = new Date();
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    function monthLabel(offsetMonths) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
        return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    }

    milestones.sort((a, b) => a.month - b.month).forEach((m, idx) => {
        const color = typeColors[m.type] || '#6b7280';
        const icon = typeIcons[m.type] || '🏁';
        const dateLabel = monthLabel(m.month);

        const el = document.createElement('div');
        el.className = 'milestone-row';

        el.innerHTML = `
            <div class="milestone-row-header">
                <div class="milestone-row-left">
                    <span class="milestone-row-icon" style="background:${color}">${icon}</span>
                    <span class="milestone-row-title">${m.title}</span>
                    <span class="milestone-row-type meta-badge" style="background:${color}18;color:${color}">${m.type}</span>
                </div>
                <div class="milestone-row-right">
                    <span class="milestone-row-date"><i class="fas fa-calendar-alt"></i> ${dateLabel}</span>
                    <i class="fas fa-chevron-down milestone-chevron"></i>
                </div>
            </div>
            <div class="milestone-body">
                <p class="milestone-description">${m.description}</p>
                <div class="milestone-body-cols">
                    <div class="milestone-deliverables">
                        <strong>Entregáveis</strong>
                        <ul>${(m.deliverables || []).map(d => `<li>${d}</li>`).join('')}</ul>
                    </div>
                    <div class="milestone-criteria">
                        <strong>Critérios de aceite</strong>
                        <ul>${(m.acceptanceCriteria || []).map(c => `<li>${c}</li>`).join('')}</ul>
                    </div>
                </div>
                ${m.fundingRelevance ? `<div class="milestone-funding">
                    <i class="fas fa-coins"></i> ${m.fundingRelevance}
                </div>` : ''}
            </div>
        `;

        el.querySelector('.milestone-row-header').addEventListener('click', () => {
            // Fecha os outros, abre só este
            grid.querySelectorAll('.milestone-row.open').forEach(r => {
                if (r !== el) r.classList.remove('open');
            });
            el.classList.toggle('open');
        });

        grid.appendChild(el);
    });
}

// ============================================================
// RESUMO PARA EDITAL
// ============================================================
function populateEditalSummary() {
    const content = document.getElementById('editalContent');
    if (!content) return;

    const s = analysisResult.editalSummary;
    if (!s) {
        content.innerHTML = '<p>Resumo para edital não disponível.</p>';
        return;
    }

    const teamHTML = (s.teamNeeds || []).map(t =>
        `<tr><td><strong>${t.role}</strong></td><td>${t.dedication}</td><td>${t.responsibilities}</td></tr>`
    ).join('');

    const risksHTML = (s.risksAndMitigation || []).map(r =>
        `<tr><td>⚠️ ${r.risk}</td><td>✅ ${r.mitigation}</td></tr>`
    ).join('');

    content.innerHTML = `
        <div class="edital-section">
            <h4>📝 Resumo Executivo</h4>
            <p>${s.executiveSummary || ''}</p>
        </div>
        <div class="edital-section">
            <h4>🔧 Metodologia</h4>
            <p>${s.methodology || ''}</p>
        </div>
        <div class="edital-section">
            <h4>👥 Necessidades de Equipe</h4>
            <table class="edital-table">
                <thead><tr><th>Cargo</th><th>Dedicação</th><th>Responsabilidades</th></tr></thead>
                <tbody>${teamHTML}</tbody>
            </table>
        </div>
        <div class="edital-section">
            <h4>💰 Justificativa de Orçamento</h4>
            <p>${s.budgetJustification || ''}</p>
        </div>
        <div class="edital-section">
            <h4>⚠️ Riscos e Mitigação</h4>
            <table class="edital-table">
                <thead><tr><th>Risco</th><th>Mitigação</th></tr></thead>
                <tbody>${risksHTML}</tbody>
            </table>
        </div>
        <div class="edital-section">
            <h4>🌟 Impacto</h4>
            <p>${s.impactStatement || ''}</p>
        </div>
        <div class="edital-section">
            <h4>⚙️ Viabilidade Técnica</h4>
            <p>${s.technicalFeasibility || ''}</p>
        </div>
    `;
}

function exportEditalText() {
    const s = analysisResult?.editalSummary;
    if (!s) return;

    const text = [
        `PROPOSTA DE PROJETO: ${analysisResult.overview?.title}`,
        `Gênero: ${analysisResult.overview?.genre} | Plataforma: ${analysisResult.overview?.platform}`,
        `Duração: ${analysisResult.totalDurationMonths} meses | Equipe: ${analysisResult.overview?.teamSize}`,
        '',
        '== RESUMO EXECUTIVO ==',
        s.executiveSummary,
        '',
        '== METODOLOGIA ==',
        s.methodology,
        '',
        '== EQUIPE ==',
        ...(s.teamNeeds || []).map(t => `• ${t.role}: ${t.dedication} — ${t.responsibilities}`),
        '',
        '== JUSTIFICATIVA DE ORÇAMENTO ==',
        s.budgetJustification,
        '',
        '== RISCOS E MITIGAÇÃO ==',
        ...(s.risksAndMitigation || []).map(r => `• Risco: ${r.risk}\n  Mitigação: ${r.mitigation}`),
        '',
        '== IMPACTO ==',
        s.impactStatement,
        '',
        '== VIABILIDADE TÉCNICA ==',
        s.technicalFeasibility,
        '',
        '== MARCOS DO PROJETO ==',
        ...(analysisResult.milestones || []).map(m =>
            `• Mês ${m.month} — ${m.title}: ${m.description}`
        )
    ].join('\n');

    navigator.clipboard.writeText(text)
        .then(() => showNotification('Texto copiado para a área de transferência!', 'success'))
        .catch(() => {
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proposta_${(analysisResult.overview?.title || 'projeto').replace(/\s+/g, '_')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });
}

// ============================================================
// FILTRO DE TAREFAS POR ÁREA + AGRUPAMENTO POR MARCO
// ============================================================

let currentTaskGroupMode = 'area'; // 'area' | 'milestone'
let currentTaskAreaFilter = 'all';

function setTaskGroupMode(mode) {
    currentTaskGroupMode = mode;
    document.getElementById('groupByArea').classList.toggle('active', mode === 'area');
    document.getElementById('groupByMilestone').classList.toggle('active', mode === 'milestone');

    // Filtro por área fica esmaecido no modo marco
    const filterRow = document.getElementById('tasksFilter');
    if (filterRow) filterRow.style.opacity = mode === 'milestone' ? '0.4' : '1';

    if (mode === 'milestone') {
        populateTasksByMilestone();
    } else {
        populateHierarchicalTasks();
        applyAreaFilter(currentTaskAreaFilter);
    }
}

function filterTasks(area) {
    currentTaskAreaFilter = area;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (currentTaskGroupMode === 'milestone') return; // filtro de área inativo no modo marco

    applyAreaFilter(area);
}

function applyAreaFilter(area) {
    document.querySelectorAll('.objective-card').forEach(card => {
        if (area === 'all') {
            card.style.display = 'block';
        } else {
            const objArea = card.querySelector('.area-badge')?.textContent?.trim();
            card.style.display = objArea === area ? 'block' : 'none';
        }
    });
}

function populateTasksByMilestone() {
    const tasksGrid = document.getElementById('tasksGrid');
    if (!tasksGrid) return;
    tasksGrid.innerHTML = '';

    const objList = (scheduledResult || { objectives: analysisResult.objectives || [] }).objectives;
    const milestones = (analysisResult.milestones || []).slice().sort((a, b) => a.month - b.month);

    if (!objList || objList.length === 0) {
        tasksGrid.innerHTML = '<p>Nenhum objetivo gerado.</p>';
        return;
    }

    const milestoneColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    const milestoneIcons = { vertical_slice: '🎮', alpha: '🔬', beta: '🧪', gold: '🏆', launch: '🚀' };
    const areaIcons = { programming: '💻', art: '🎨', design: '📋', audio: '🎵', qa: '🧪', production: '📊' };
    const areaColors = { programming: '#3b82f6', art: '#8b5cf6', design: '#10b981', audio: '#f59e0b', qa: '#ef4444', production: '#6366f1' };
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const typeIcons = { feature: '⚙️', fix: '🐛', art: '🎨', design: '📐', audio: '🔊', test: '🧪', config: '🔧' };

    // Associar objetivo ao menor marco cujo mês >= startMonth do objetivo
    function getMilestoneForObj(obj) {
        const start = obj.startMonth || obj.timeline?.startMonth || 1;
        let match = milestones.find(m => m.month >= start);
        if (!match) match = milestones[milestones.length - 1];
        return match;
    }

    // Agrupar objetivos por marco
    const groups = new Map();
    milestones.forEach(m => groups.set(m.id, { milestone: m, objectives: [] }));
    groups.set('__none__', { milestone: null, objectives: [] });

    objList.forEach(obj => {
        const m = getMilestoneForObj(obj);
        const key = m ? m.id : '__none__';
        if (!groups.has(key)) groups.set(key, { milestone: m, objectives: [] });
        groups.get(key).objectives.push(obj);
    });

    let colorIdx = 0;
    groups.forEach(({ milestone, objectives }) => {
        if (!milestone && objectives.length === 0) return;

        const color = milestone ? milestoneColors[colorIdx % milestoneColors.length] : '#9ca3af';
        const icon = milestone ? (milestoneIcons[milestone.type] || '🏁') : '📌';
        const label = milestone ? milestone.title : 'Sem Marco';
        const monthLabel = milestone ? `até mês ${milestone.month}` : '';

        const groupHeader = document.createElement('div');
        groupHeader.className = 'milestone-group-header';
        groupHeader.style.background = color;
        groupHeader.innerHTML = `
            <span class="mg-icon">${icon}</span>
            <span>${label}</span>
            ${monthLabel ? `<span class="mg-month">${monthLabel}</span>` : ''}
        `;
        tasksGrid.appendChild(groupHeader);
        colorIdx++;

        if (objectives.length === 0) {
            const empty = document.createElement('p');
            empty.style.cssText = 'color:var(--gray-400);font-size:0.85rem;margin:0 0 0.75rem 1rem;';
            empty.textContent = 'Nenhuma tarefa associada a este marco.';
            tasksGrid.appendChild(empty);
            return;
        }

        objectives.forEach(obj => {
            const objColor = areaColors[obj.area] || '#6b7280';
            const objIcon = areaIcons[obj.area] || '📌';
            const krCount = (obj.keyResults || []).length;
            const taskCount = (obj.keyResults || []).reduce((t, kr) => t + (kr.tasks || []).length, 0);
            const msPrefix = `ms_${obj.id}`;

            const objEl = document.createElement('div');
            objEl.className = 'objective-card';
            objEl.dataset.objId = obj.id;
            objEl.innerHTML = `
                <div class="objective-header">
                    <div class="objective-icon" style="background:${objColor}">${objIcon}</div>
                    <div class="objective-info">
                        <div class="objective-title">${obj.title}</div>
                        <div class="objective-meta">
                            <span class="meta-badge priority-${obj.priority}">${obj.priority}</span>
                            <span class="meta-badge area-badge">${obj.area}</span>
                            <span class="meta-stat">Meses ${obj.startMonth || obj.timeline?.startMonth || '?'}–${obj.endMonth || obj.timeline?.endMonth || '?'}</span>
                            <span class="meta-stat">${krCount} KRs · ${taskCount} tarefas</span>
                        </div>
                    </div>
                    <div class="objective-toggle">▼</div>
                </div>
                <div class="objective-body" id="body_${msPrefix}">
                    <div class="okr-list" id="okrs_${msPrefix}"></div>
                </div>
            `;
            tasksGrid.appendChild(objEl);

            objEl.querySelector('.objective-header').addEventListener('click', function() {
                const body = document.getElementById(`body_${msPrefix}`);
                const card = body?.closest('.objective-card');
                if (!body || !card) return;
                const isOpen = body.classList.toggle('open');
                const toggle = card.querySelector('.objective-toggle');
                if (toggle) toggle.textContent = isOpen ? '▲' : '▼';
            });

            const okrList = objEl.querySelector(`#okrs_${msPrefix}`);
            (obj.keyResults || []).forEach(kr => {
                const tasks = kr.tasks || [];
                const totalPoints = tasks.reduce((t, task) => t + (task.points || task.estimatedDays || 2), 0);
                const sprintCount = kr.sprintCount || Math.max(1, Math.ceil(totalPoints / SPRINT_CAPACITY_POINTS));
                const weeksLabel = `${sprintCount} sprint${sprintCount > 1 ? 's' : ''} · ${sprintCount * 2} semanas`;
                const krPrefix = `ms_${kr.id}`;

                const krEl = document.createElement('div');
                krEl.className = 'kr-card';
                krEl.innerHTML = `
                    <div class="kr-header">
                        <div class="kr-icon">🎯</div>
                        <div class="kr-info">
                            <div class="kr-title">${kr.title}</div>
                            <div class="kr-meta">
                                <span class="meta-badge" style="background:rgba(99,102,241,0.1);color:#4f46e5;">${weeksLabel}</span>
                                <span class="meta-stat">${tasks.length} tarefas · ${totalPoints} pts</span>
                            </div>
                        </div>
                        <div class="kr-toggle">▼</div>
                    </div>
                    <div class="kr-body" id="krbody_${krPrefix}">
                        <div class="task-list sprint-tasks" id="tasks_${krPrefix}"></div>
                    </div>
                `;
                okrList.appendChild(krEl);

                krEl.querySelector('.kr-header').addEventListener('click', function() {
                    const body = document.getElementById(`krbody_${krPrefix}`);
                    const card = body?.closest('.kr-card');
                    if (!body || !card) return;
                    const isOpen = body.classList.toggle('open');
                    const toggle = card.querySelector('.kr-toggle');
                    if (toggle) toggle.textContent = isOpen ? '▲' : '▼';
                });

                const taskList = krEl.querySelector(`#tasks_${krPrefix}`);
                const sortedTasks = [...tasks].sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
                sortedTasks.forEach(task => {
                    const taskEl = document.createElement('div');
                    taskEl.className = 'sprint-task';
                    taskEl.dataset.taskId = task.id;
                    const tIcon = typeIcons[task.type] || '📌';
                    taskEl.innerHTML = `
                        <div class="task-checkbox sprint-checkbox"
                             data-obj="${obj.id}" data-kr="${kr.id}" data-task="${task.id}"
                             onclick="toggleSprintTask(this)">
                        </div>
                        <div class="task-body">
                            <div class="task-title-row">
                                <span class="type-icon" title="${task.type}">${tIcon}</span>
                                <span class="task-title">${task.title}</span>
                            </div>
                            <div class="task-meta-row">
                                <span class="meta-badge priority-${task.priority}">${task.priority}</span>
                                <span class="days-badge">⏱ ${task.estimatedDays || 2}d · ${task.points || task.estimatedDays || 2}pts</span>
                                <span class="type-badge">${task.type || 'feature'}</span>
                            </div>
                        </div>
                    `;
                    taskList.appendChild(taskEl);
                });
            });
        });
    });

    loadTaskStates();
}

// ============================================================
// TOGGLE DE OBJETIVOS E KRS
// ============================================================
function toggleObjective(objId) {
    const body = document.getElementById(`body_${objId}`);
    const card = body ? body.closest('.objective-card') : null;
    if (!body || !card) return;
    const isOpen = body.classList.toggle('open');
    const toggle = card.querySelector('.objective-toggle');
    if (toggle) toggle.textContent = isOpen ? '▲' : '▼';
}

function toggleKR(krId) {
    const body = document.getElementById(`krbody_${krId}`);
    const card = body ? body.closest('.kr-card') : null;
    if (!body || !card) return;
    const isOpen = body.classList.toggle('open');
    const toggle = card.querySelector('.kr-toggle');
    if (toggle) toggle.textContent = isOpen ? '▲' : '▼';
}

// ============================================================
// GERENCIAMENTO DE TAREFAS (CHECK/UNCHECK)
// ============================================================
function toggleSprintTask(checkbox) {
    const objId = checkbox.dataset.obj;
    const krId = checkbox.dataset.kr;
    const taskId = checkbox.dataset.task;

    checkbox.classList.toggle('checked');
    const taskTitle = checkbox.closest('.sprint-task').querySelector('.task-title');
    if (taskTitle) taskTitle.classList.toggle('completed');

    saveTaskState(objId, krId, taskId, checkbox.classList.contains('checked'));
    updateKRProgress(krId);
}

function updateKRProgress(krId) {
    const krBody = document.getElementById(`krbody_${krId}`);
    if (!krBody) return;
    const all = krBody.querySelectorAll('.sprint-checkbox');
    const done = krBody.querySelectorAll('.sprint-checkbox.checked');
    const krCard = krBody.closest('.kr-card');
    if (!krCard) return;
    const stat = krCard.querySelector('.meta-stat:last-child');
    if (stat) {
        const pct = all.length > 0 ? Math.round((done.length / all.length) * 100) : 0;
        stat.textContent = `${done.length}/${all.length} tasks · ${pct}%`;
        if (pct === 100) krCard.classList.add('kr-complete');
        else krCard.classList.remove('kr-complete');
    }
}

function saveTaskState(objId, krId, taskId, completed) {
    const key = `task_${objId}_${krId}_${taskId}`;
    try { (window.localStorage || window.sessionStorage).setItem(key, completed.toString()); } catch {}
}

function loadTaskStates() {
    const checkboxes = document.querySelectorAll('.sprint-checkbox');
    checkboxes.forEach(cb => {
        const { obj, kr, task } = cb.dataset;
        const key = `task_${obj}_${kr}_${task}`;
        const val = (() => { try { return (window.localStorage || window.sessionStorage).getItem(key); } catch { return null; } })();
        if (val === 'true') {
            cb.classList.add('checked');
            const title = cb.closest('.sprint-task')?.querySelector('.task-title');
            if (title) title.classList.add('completed');
        }
    });
    // Atualizar progresso de todos os KRs
    document.querySelectorAll('.kr-card').forEach(kr => {
        const krId = kr.dataset.krId;
        if (krId) updateKRProgress(krId);
    });
}

// ============================================================
// EXPORTAÇÃO JSON HIERÁRQUICA
// ============================================================
function exportResults() {
    if (!analysisResult) return;

    const exportData = {
        metadata: {
            title: analysisResult.overview?.title || 'Projeto',
            genre: analysisResult.genreLabel,
            exportDate: new Date().toISOString(),
            totalMonths: analysisResult.totalDurationMonths,
            totalObjectives: analysisResult.objectives?.length || 0,
            totalTasks: countTotalTasks()
        },
        overview: analysisResult.overview,
        milestones: analysisResult.milestones || [],
        editalSummary: analysisResult.editalSummary || null,
        objectives: (analysisResult.objectives || []).map(obj => ({
            id: obj.id,
            title: obj.title,
            description: obj.description,
            area: obj.area,
            priority: obj.priority,
            timeline: { startMonth: obj.startMonth, endMonth: obj.endMonth },
            keyResults: (obj.keyResults || []).map(kr => ({
                id: kr.id,
                title: kr.title,
                description: kr.description,
                estimatedWeeks: kr.estimatedWeeks,
                dependencies: kr.dependencies || [],
                tasks: (kr.tasks || []).map(t => ({
                    id: t.id,
                    title: t.title,
                    estimatedDays: t.estimatedDays,
                    priority: t.priority,
                    type: t.type
                }))
            }))
        }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (analysisResult.overview?.title || 'roadmap').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    a.download = `roadmap_${safeTitle}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Roadmap exportado com sucesso!', 'success');
}

// ============================================================
// RESET E NAVEGAÇÃO
// ============================================================
function resetToUpload() {
    currentFile = null;
    analysisResult = null;
    clearFile();
    clearApplicationState();
    // Ao voltar para upload sem projeto ativo, limpa referência do projeto ativo
    // (não deletamos o projeto, só desviculamos o contexto atual)
    if (typeof setActiveProjectId === 'function') setActiveProjectId(null);
    if (typeof updateSaveBtn === 'function') updateSaveBtn();

    uploadSection.style.display = 'block';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    document.getElementById('reviewSection').style.display = 'none';
    document.getElementById('resumeSection').style.display = 'none';

    clearGenerationLog();

    ['step0', 'step1', 'step2', 'step3', 'step4', 'step5'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active', 'done');
        if (i === 0) el.classList.add('active');
    });
}

// ============================================================
// STORAGE RESILIENTE (funciona em file://, http:// e https://)
// Tenta localStorage primeiro, cai para sessionStorage se bloqueado
// ============================================================
const store = (() => {
    const KEY = 'ai_api_key';
    const STATE_KEY = 'producer_app_state';

    function tryStorage(storage) {
        try {
            storage.setItem('__test__', '1');
            storage.removeItem('__test__');
            return storage;
        } catch { return null; }
    }

    // localStorage preferido; se bloqueado (file:// em alguns browsers), usa sessionStorage
    const local = tryStorage(window.localStorage) || tryStorage(window.sessionStorage);
    const session = tryStorage(window.sessionStorage);

    // Para a chave de API, prefere local (persiste entre sessões)
    // Para estado da análise, idem
    const PROGRESS_KEY = 'producer_progress';

    return {
        getKey:    ()      => (local  && local.getItem(KEY))       || null,
        setKey:    (v)     =>  local  && local.setItem(KEY, v),
        removeKey: ()      =>  local  && local.removeItem(KEY),
        hasKey:    ()      => !!(local && local.getItem(KEY)),

        getState:    ()    => (local  && local.getItem(STATE_KEY)) || null,
        setState:    (v)   =>  local  && local.setItem(STATE_KEY, v),
        removeState: ()    =>  local  && local.removeItem(STATE_KEY),
        hasState:    ()    => !!(local && local.getItem(STATE_KEY)),

        // Cache de progresso de geração — persiste entre reloads
        getProgress:    ()  => { try { const r = local && local.getItem(PROGRESS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
        setProgress:    (v) => { try { local && local.setItem(PROGRESS_KEY, JSON.stringify(v)); } catch {} },
        removeProgress: ()  => { try { local && local.removeItem(PROGRESS_KEY); } catch {} },
        hasProgress:    ()  => !!(local && local.getItem(PROGRESS_KEY)),
    };
})();

// ============================================================
// API DO DEEPSEEK
// ============================================================
function getApiKey() {
    return store.getKey();
}

function configureApiKey() {
    const newKey = prompt('Digite sua nova chave de API do DeepSeek:');
    if (newKey && newKey.trim()) {
        store.setKey(newKey.trim());
        showNotification('Chave de API configurada!', 'success');
        return true;
    }
    return false;
}

function clearApiKey() {
    store.removeKey();
    showApiSetup();
}

function hasApiKey() {
    return store.hasKey();
}

// Espera N ms — usado no backoff de retry
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Detecta se o erro é temporário (alta demanda, rate limit) — vale tentar de novo
function isRetryableError(status, message) {
    if (status === 429 || status === 503 || status === 529) return true;
    if (!message) return false;
    return message.includes('high demand') ||
           message.includes('overloaded') ||
           message.includes('quota') ||
           message.includes('rate limit') ||
           message.includes('try again') ||
           message.includes('temporarily');
}

async function callAIAPI(prompt, apiKey) {
    // Modelos DeepSeek em ordem de preferência
    const models = [
        'deepseek-chat',       // DeepSeek-V3: rápido e eficiente
        'deepseek-reasoner'    // DeepSeek-R1: mais poderoso, raciocínio avançado
    ];

    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [5000, 15000, 30000];

    let lastError = null;

    for (const model of models) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = RETRY_DELAYS[attempt - 1] || 30000;
                    setLoadingMessage(`⏳ Alta demanda na API — aguardando ${delay / 1000}s antes de tentar novamente (tentativa ${attempt}/${MAX_RETRIES})...`);
                    await sleep(delay);
                }

                const response = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            {
                                role: 'system',
                                content: 'Você é um especialista em produção de jogos e game design. Responda sempre em português brasileiro. Gere respostas estruturadas e detalhadas no formato JSON quando solicitado.'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 8192
                    })
                });

                if (!response.ok) {
                    let errMsg = `Erro ${response.status}`;
                    let rawMsg = '';
                    try {
                        const errData = await response.json();
                        rawMsg = errData.error?.message || '';
                        errMsg = rawMsg || errMsg;
                    } catch {}

                    // Modelo não encontrado — tenta o próximo
                    if (response.status === 404 || errMsg.includes('not found') || errMsg.includes('not supported')) {
                        lastError = new Error(errMsg);
                        break; // sai do loop de retry, vai pro próximo modelo
                    }

                    // Erro temporário — retry com backoff
                    if (isRetryableError(response.status, rawMsg)) {
                        lastError = new Error(errMsg);
                        continue; // próxima tentativa
                    }

                    // Erro permanente
                    if (response.status === 401) throw new Error('Chave de API inválida ou sem permissão. Verifique sua chave do DeepSeek.');
                    if (response.status === 402) throw new Error('Saldo insuficiente na conta DeepSeek. Adicione créditos em platform.deepseek.com.');
                    throw new Error(errMsg);
                }

                const result = await response.json();

                if (result.error) {
                    if (isRetryableError(0, result.error.message)) {
                        lastError = new Error(result.error.message);
                        continue;
                    }
                    throw new Error(result.error.message);
                }

                const text = result.choices?.[0]?.message?.content;
                if (!text) {
                    throw new Error('Resposta inválida da API DeepSeek.');
                }

                return text;

            } catch (error) {
                // Erro permanente de autenticação — não adianta tentar de novo
                if (error.message?.includes('inválida') || error.message?.includes('Saldo')) {
                    throw error;
                }
                // Erro temporário e ainda temos tentativas
                if (isRetryableError(0, error.message) && attempt < MAX_RETRIES) {
                    lastError = error;
                    continue;
                }
                // Modelo não disponível — tenta o próximo
                if (error.message?.includes('not found') || error.message?.includes('not supported')) {
                    lastError = error;
                    break;
                }
                throw error;
            }
        }
    }

    throw lastError || new Error('Nenhum modelo disponível. Verifique sua chave de API do DeepSeek em platform.deepseek.com.');
}

// ============================================================
// PERSISTÊNCIA DO ESTADO
// ============================================================
function saveApplicationState() {
    if (!analysisResult) return;
    try {
        const state = {
            analysisResult,
            currentFile: currentFile ? {
                name: currentFile.name,
                size: currentFile.size,
                type: currentFile.type
            } : null,
            timestamp: Date.now(),
            version: '2.0'
        };
        store.setState(JSON.stringify(state));
    } catch (e) {
        console.error('Erro ao salvar estado:', e);
    }
}

function restoreApplicationState() {
    try {
        const saved = store.getState();
        if (!saved) return;
        const state = JSON.parse(saved);
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - state.timestamp > oneWeek) {
            clearApplicationState();
            return;
        }
        if (state.analysisResult) {
            analysisResult = state.analysisResult;
            if (state.currentFile) displayFileInfo(state.currentFile);
            showResults();
            showNotification('Análise anterior restaurada!', 'success');
        }
    } catch (e) {
        console.error('Erro ao restaurar estado:', e);
        clearApplicationState();
    }
}

function clearApplicationState() {
    try { store.removeState(); } catch {}
}

function hasSavedState() {
    return store.hasState();
}

// ============================================================
// MODAL DE CONFIGURAÇÕES
// ============================================================
function openConfigModal() {
    document.getElementById('configModal').style.display = 'block';
    updateApiStatus();
    updateStateStatus();
}

function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

function updateApiStatus() {
    const el = document.getElementById('apiStatus');
    if (!el) return;
    el.innerHTML = hasApiKey()
        ? `<div class="status-item status-success"><i class="fas fa-check-circle"></i><span>Chave de API configurada</span></div>`
        : `<div class="status-item status-warning"><i class="fas fa-exclamation-triangle"></i><span>Nenhuma chave configurada</span></div>`;
}

function updateStateStatus() {
    const el = document.getElementById('stateStatus');
    if (!el) return;
    if (hasSavedState()) {
        const state = JSON.parse(store.getState());
        const date = new Date(state.timestamp).toLocaleString('pt-BR');
        const title = state.analysisResult?.overview?.title || 'Projeto';
        el.innerHTML = `<div class="status-item status-success"><i class="fas fa-save"></i><span>Salvo: "${title}" (${date})</span></div>`;
    } else {
        el.innerHTML = `<div class="status-item status-info"><i class="fas fa-info-circle"></i><span>Nenhum estado salvo</span></div>`;
    }
}

function handleClearState() {
    if (confirm('Limpar análise salva?')) {
        clearApplicationState();
        updateStateStatus();
        showNotification('Estado removido!', 'success');
    }
}

// ============================================================
// NOTIFICAÇÕES
// ============================================================
function showNotification(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `notification notification-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// Estilos de notificação
const notifStyle = document.createElement('style');
notifStyle.textContent = `
    .notification {
        position: fixed; top: 20px; right: 20px;
        padding: 15px 20px; border-radius: 8px;
        color: white; font-weight: 500; z-index: 1000;
        animation: slideIn 0.3s ease;
    }
    .notification-info { background: var(--info-color); }
    .notification-success { background: var(--success-color); }
    .notification-error { background: var(--danger-color); }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(notifStyle);

// ============================================================
// SISTEMA DE MÚLTIPLOS PROJETOS
// ============================================================

const PROJECTS_KEY = 'producer_projects_v1';
const ACTIVE_PROJECT_KEY = 'producer_active_project';

// Retorna todos os projetos salvos
function getAllProjects() {
    try {
        const raw = localStorage.getItem(PROJECTS_KEY) || sessionStorage.getItem(PROJECTS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

// Persiste todos os projetos
function saveAllProjects(projects) {
    try {
        const json = JSON.stringify(projects);
        try { localStorage.setItem(PROJECTS_KEY, json); } catch { sessionStorage.setItem(PROJECTS_KEY, json); }
    } catch (e) { console.error('Erro ao salvar projetos:', e); }
}

// ID do projeto ativo
function getActiveProjectId() {
    try { return localStorage.getItem(ACTIVE_PROJECT_KEY) || sessionStorage.getItem(ACTIVE_PROJECT_KEY) || null; } catch { return null; }
}

function setActiveProjectId(id) {
    try {
        if (id) { try { localStorage.setItem(ACTIVE_PROJECT_KEY, id); } catch { sessionStorage.setItem(ACTIVE_PROJECT_KEY, id); } }
        else { try { localStorage.removeItem(ACTIVE_PROJECT_KEY); } catch {} try { sessionStorage.removeItem(ACTIVE_PROJECT_KEY); } catch {} }
    } catch {}
}

// Gera ID único
function genProjectId() {
    return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// Conta tarefas concluídas e total usando o taskProgress salvo
function countTasks(analysis, taskProgress) {
    let total = 0, done = 0;
    if (!analysis || !analysis.objectives) return { total: 0, done: 0 };
    for (const obj of analysis.objectives) {
        for (const kr of (obj.keyResults || [])) {
            for (const task of (kr.tasks || [])) {
                total++;
                // Usa taskProgress se disponível (mais confiável que _completed)
                if (taskProgress) {
                    const key = `task_${obj.id}_${kr.id}_${task.id}`;
                    if (taskProgress[key] === true) done++;
                } else if (task._completed) {
                    done++;
                }
            }
        }
    }
    return { total, done };
}

// Salva o projeto atual (análise + equipe + scheduled)
function saveCurrentProject() {
    if (!analysisResult) {
        showNotification('Nenhum roadmap para salvar.', 'error');
        return;
    }

    const projects = getAllProjects();
    const existingId = getActiveProjectId();

    // Captura o progresso de tarefas marcadas pelo usuário
    const taskProgress = captureTaskProgress();

    const projectData = {
        analysisResult: JSON.parse(JSON.stringify(analysisResult)), // deep clone
        teamConfig: { ...teamConfig },
        scheduledResult: scheduledResult ? JSON.parse(JSON.stringify(scheduledResult)) : null,
        taskProgress,
        savedAt: Date.now(),
        version: '1.0'
    };

    let projectId = existingId;

    if (projectId && projects[projectId]) {
        // Atualiza projeto existente
        projects[projectId].data = projectData;
        projects[projectId].savedAt = Date.now();
        showNotification(`"${projects[projectId].name}" atualizado!`, 'success');
    } else {
        // Cria novo projeto
        projectId = genProjectId();
        const title = analysisResult.overview?.title || 'Projeto sem nome';
        projects[projectId] = {
            id: projectId,
            name: title,
            genre: analysisResult.overview?.genre || '',
            createdAt: Date.now(),
            savedAt: Date.now(),
            data: projectData
        };
        setActiveProjectId(projectId);
        showNotification(`"${title}" salvo!`, 'success');
    }

    saveAllProjects(projects);
    renderSidebar();
    updateSaveBtn();
}

// Carrega um projeto e exibe o roadmap
function loadProject(projectId) {
    const projects = getAllProjects();
    const project = projects[projectId];
    if (!project) { showNotification('Projeto não encontrado.', 'error'); return; }

    const data = project.data;

    // Restaura estado
    analysisResult = data.analysisResult;
    if (data.teamConfig) {
        Object.assign(teamConfig, data.teamConfig);
    }

    // Restaura progresso de tarefas
    if (data.taskProgress) {
        restoreTaskProgress(data.taskProgress);
    }

    // Mostra resultados
    setActiveProjectId(projectId);
    showResults();
    renderSidebar();
    updateSaveBtn();
    closeSidebar();
    showNotification(`"${project.name}" carregado!`, 'success');
}

// Renomeia um projeto
function renameProject(projectId, event) {
    event.stopPropagation();
    const projects = getAllProjects();
    if (!projects[projectId]) return;

    const currentName = projects[projectId].name;
    const newName = prompt('Nome do projeto:', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
        projects[projectId].name = newName.trim();
        saveAllProjects(projects);
        renderSidebar();
        showNotification('Projeto renomeado!', 'success');
    }
}

// Deleta um projeto
function deleteProject(projectId, event) {
    event.stopPropagation();
    const projects = getAllProjects();
    const name = projects[projectId]?.name || 'este projeto';

    if (!confirm(`Deletar "${name}"? Esta ação não pode ser desfeita.`)) return;

    delete projects[projectId];
    saveAllProjects(projects);

    // Se era o ativo, limpa
    if (getActiveProjectId() === projectId) {
        setActiveProjectId(null);
        updateSaveBtn();
    }

    renderSidebar();
    showNotification(`"${name}" deletado.`, 'success');
}

// Captura o estado de conclusão de todas as tarefas da UI
// Usa o mesmo esquema de chave que saveTaskState: task_${obj}_${kr}_${task}
function captureTaskProgress() {
    const progress = {};
    const checkboxes = document.querySelectorAll('.sprint-checkbox[data-obj][data-kr][data-task]');
    checkboxes.forEach(cb => {
        const key = `task_${cb.dataset.obj}_${cb.dataset.kr}_${cb.dataset.task}`;
        progress[key] = cb.classList.contains('checked');
    });
    return progress;
}

// Aplica o progresso de tarefas salvo restaurando no localStorage (loadTaskStates() vai buscar de lá)
function restoreTaskProgress(progress) {
    if (!progress) return;
    // Salva cada entrada no localStorage para que loadTaskStates() restaure a UI
    for (const [key, completed] of Object.entries(progress)) {
        try { (window.localStorage || window.sessionStorage).setItem(key, completed.toString()); } catch {}
    }
}

// Gera uma chave estável para uma tarefa (não usada internamente, mas mantida para compatibilidade)
function taskKeyFor(obj, kr, task) {
    return `task_${obj.id}_${kr.id}_${task.id}`;
}

// Atualiza aparência do botão Salvar
function updateSaveBtn() {
    const btn = document.getElementById('saveProjectBtn');
    const label = document.getElementById('saveProjectBtnLabel');
    if (!btn) return;

    const projects = getAllProjects();
    const activeId = getActiveProjectId();

    if (activeId && projects[activeId]) {
        btn.classList.add('saved');
        if (label) label.textContent = 'Atualizar Projeto';
    } else {
        btn.classList.remove('saved');
        if (label) label.textContent = 'Salvar Projeto';
    }
}

// Renderiza a lista de projetos na sidebar
function renderSidebar() {
    const list = document.getElementById('projectsList');
    const countBadge = document.getElementById('sidebarProjectCount');
    if (!list) return;

    const projects = getAllProjects();
    const ids = Object.keys(projects).sort((a, b) => (projects[b].savedAt || 0) - (projects[a].savedAt || 0));
    const activeId = getActiveProjectId();

    // Atualiza badge
    if (countBadge) {
        if (ids.length > 0) {
            countBadge.textContent = ids.length;
            countBadge.style.display = 'inline-block';
        } else {
            countBadge.style.display = 'none';
        }
    }

    if (ids.length === 0) {
        list.innerHTML = `
            <div class="sidebar-empty">
                <i class="fas fa-folder-open"></i>
                <p>Nenhum projeto salvo ainda.</p>
                <p>Gere um roadmap e clique em <strong>Salvar Projeto</strong>.</p>
            </div>`;
        return;
    }

    list.innerHTML = ids.map(id => {
        const p = projects[id];
        const { total, done } = countTasks(p.data?.analysisResult, p.data?.taskProgress);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const date = new Date(p.savedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const isActive = id === activeId;

        return `
            <div class="project-item ${isActive ? 'active' : ''}" onclick="loadProject('${id}')">
                <div class="project-item-header">
                    <i class="fas fa-gamepad project-item-icon"></i>
                    <span class="project-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
                    <div class="project-item-actions">
                        <button class="project-item-btn" onclick="renameProject('${id}', event)" title="Renomear">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="project-item-btn delete" onclick="deleteProject('${id}', event)" title="Deletar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="project-item-meta">
                    <span class="project-item-genre">${escapeHtml(p.genre || 'Sem gênero')} · ${date}</span>
                    ${total > 0 ? `<span class="project-item-progress">${done}/${total}</span>` : ''}
                </div>
                ${total > 0 ? `<div class="project-item-bar"><div class="project-item-bar-fill" style="width:${pct}%"></div></div>` : ''}
            </div>`;
    }).join('');
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Abre/fecha sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('projectsSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
        closeSidebar();
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        renderSidebar();
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('projectsSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

// Botão "Novo Projeto" na sidebar: limpa estado e vai para upload
document.addEventListener('DOMContentLoaded', () => {
    const newBtn = document.getElementById('newProjectBtn');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            if (analysisResult && !confirm('Abrir novo projeto? O roadmap atual não salvo será perdido.')) return;
            setActiveProjectId(null);
            analysisResult = null;
            scheduledResult = null;
            Object.assign(teamConfig, { programming: 1, art: 1, design: 1, audio: 1, qa: 1, production: 1 });
            resetToUpload();
            closeSidebar();
            updateSaveBtn();
        });
    }

    // Inicializa sidebar e badge ao entrar no app
    const origShowApp = window._origShowApp;
    renderSidebar();
});

// Hook: auto-salva progresso de tarefas no projeto ativo ao marcar/desmarcar
// sprint-checkbox usa onclick, não change — interceptamos via MutationObserver após toggleSprintTask
const _origToggleSprintTask = window.toggleSprintTask;
// Substituímos toggleSprintTask para incluir auto-save ao final
window.toggleSprintTask = function(checkbox) {
    // Chama o comportamento original
    if (typeof _origToggleSprintTask === 'function') {
        _origToggleSprintTask(checkbox);
    } else {
        // fallback inline se a função ainda não existia no momento do load
        const objId = checkbox.dataset.obj;
        const krId = checkbox.dataset.kr;
        const taskId = checkbox.dataset.task;
        checkbox.classList.toggle('checked');
        const taskTitle = checkbox.closest('.sprint-task')?.querySelector('.task-title');
        if (taskTitle) taskTitle.classList.toggle('completed');
        try { (window.localStorage || window.sessionStorage).setItem(`task_${objId}_${krId}_${taskId}`, checkbox.classList.contains('checked').toString()); } catch {}
        updateKRProgress(krId);
    }

    // Auto-salva no projeto ativo
    const activeId = getActiveProjectId();
    if (!activeId) return;
    const projects = getAllProjects();
    if (!projects[activeId]) return;
    projects[activeId].data.taskProgress = captureTaskProgress();
    saveAllProjects(projects);

    // Atualiza barra de progresso na sidebar se estiver aberta
    const sidebar = document.getElementById('projectsSidebar');
    if (sidebar && sidebar.classList.contains('open')) renderSidebar();
};

// Renderiza sidebar ao abrir app
(function initProjectsSidebar() {
    const orig = typeof showApp === 'function' ? showApp : null;
})();
