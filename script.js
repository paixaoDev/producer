// Estado da aplicação
let currentFile = null;
let analysisResult = null;

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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    restoreApplicationState();
});

function initializeEventListeners() {
    // Upload de arquivo
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    
    // Remoção de arquivo
    removeFile.addEventListener('click', clearFile);
    
    // Análise
    analyzeBtn.addEventListener('click', analyzeDocument);
    
    // Ações
    exportBtn.addEventListener('click', exportResults);
    newAnalysisBtn.addEventListener('click', resetToUpload);
    
    // Configurações
    const configBtn = document.getElementById('configBtn');
    const configModal = document.getElementById('configModal');
    const modalClose = document.getElementById('modalClose');
    const setApiKeyBtn = document.getElementById('setApiKeyBtn');
    const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
    const clearStateBtn = document.getElementById('clearStateBtn');
    
    configBtn.addEventListener('click', openConfigModal);
    modalClose.addEventListener('click', closeConfigModal);
    setApiKeyBtn.addEventListener('click', configureApiKey);
    clearApiKeyBtn.addEventListener('click', clearApiKey);
    clearStateBtn.addEventListener('click', handleClearState);
    
    // Fechar modal clicando fora dele
    configModal.addEventListener('click', (e) => {
        if (e.target === configModal) {
            closeConfigModal();
        }
    });
    
    // Atualizar status da API
    updateApiStatus();
}

// Manipulação de arquivos
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

function processFile(file) {
    // Validar tipo de arquivo
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
    
    // Validar tamanho (máximo 10MB)
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

// Análise do documento
async function analyzeDocument() {
    if (!currentFile) {
        alert('Por favor, selecione um arquivo primeiro.');
        return;
    }
    
    // Mostrar loading
    showLoadingScreen();
    
    try {
        // Iniciar animação dos steps
        updateLoadingSteps();
        
        // Ler o arquivo
        const fileContent = await readFileContent(currentFile);
        
        // Análise por IA real
        const aiResponse = await analyzeWithRealAI(fileContent);
        
        // Tentar extrair JSON da resposta
        let cleanedResponse = aiResponse;
        
        // Remover blocos de código se existirem
        if (aiResponse.includes('```json')) {
            const startIndex = aiResponse.indexOf('```json') + 7;
            const endIndex = aiResponse.lastIndexOf('```');
            if (endIndex > startIndex) {
                cleanedResponse = aiResponse.substring(startIndex, endIndex);
            }
        } else if (aiResponse.includes('```')) {
            const startIndex = aiResponse.indexOf('```') + 3;
            const endIndex = aiResponse.lastIndexOf('```');
            if (endIndex > startIndex) {
                cleanedResponse = aiResponse.substring(startIndex, endIndex);
            }
        }
        
        // Tentar fazer parse do JSON
        try {
            analysisResult = JSON.parse(cleanedResponse.trim());
        } catch (parseError) {
            console.error('Erro ao fazer parse do JSON:', parseError);
            console.log('Resposta da IA:', aiResponse);
            throw new Error('A resposta da IA não está em formato JSON válido. Tente novamente.');
        }
        
        // Mostrar resultados
        showResults();
        
    } catch (error) {
        console.error('Erro na análise:', error);
        alert('Ocorreu um erro durante a análise. Verifique sua conexão com a internet e tente novamente.');
        resetToUpload();
    }
}

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            resolve(event.target.result);
        };
        
        reader.onerror = function(error) {
            reject(error);
        };
        
        if (file.type === 'text/plain') {
            reader.readAsText(file);
        } else {
            // Para PDF, DOC, DOCX - em uma implementação real, você usaria
            // bibliotecas específicas para extrair texto
            reader.readAsArrayBuffer(file);
        }
    });
}

async function updateLoadingSteps() {
    const steps = ['step1', 'step2', 'step3', 'step4'];
    
    for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Remover classe active do step anterior
        if (i > 0) {
            document.getElementById(steps[i - 1]).classList.remove('active');
        }
        
        // Adicionar classe active ao step atual
        document.getElementById(steps[i]).classList.add('active');
    }
}



// Interface de resultados
function showLoadingScreen() {
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';
}

function showResults() {
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    populateResults();
    
    // Salvar estado automaticamente
    saveApplicationState();
}

function populateResults() {
    if (!analysisResult) {
        console.error('Nenhum resultado de análise disponível');
        return;
    }
    
    try {
    // Popular visão geral
    populateOverview();
    
    // Popular timeline
    populateTimeline();
    
    // Popular tarefas
    populateTasks();
        
    } catch (error) {
        console.error('Erro ao popular resultados:', error);
        alert('Erro ao exibir os resultados. O formato da resposta pode estar incorreto.');
    }
}

function populateOverview() {
    const overviewContent = document.getElementById('overviewContent');
    const overview = analysisResult.overview;
    
    if (!overview) {
        overviewContent.innerHTML = '<p>Dados de visão geral não disponíveis.</p>';
        return;
    }
    
    overviewContent.innerHTML = `
        <div class="overview-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px;">
            <div class="overview-item">
                <strong>Título:</strong><br>
                <span>${overview.title || 'Não especificado'}</span>
            </div>
            <div class="overview-item">
                <strong>Gênero:</strong><br>
                <span>${overview.genre || 'Não especificado'}</span>
            </div>
            <div class="overview-item">
                <strong>Plataforma:</strong><br>
                <span>${overview.platform || 'Não especificado'}</span>
            </div>
            <div class="overview-item">
                <strong>Equipe:</strong><br>
                <span>${overview.teamSize || 'Não especificado'}</span>
            </div>
            <div class="overview-item">
                <strong>Duração:</strong><br>
                <span>${overview.estimatedDuration || 'Não especificado'}</span>
            </div>
        </div>
        <div class="overview-description">
            <strong>Descrição:</strong><br>
            <p style="margin-top: 10px;">${overview.description || 'Descrição não disponível.'}</p>
        </div>
    `;
}

function populateTimeline() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';
    
    // Obter duração estimada do projeto
    const projectDuration = getProjectDuration();
    
    // Calcular número total de quarters baseado na duração
    const totalQuarters = Math.ceil(projectDuration / 3); // 3 meses por quarter
    
    // Adicionar header da timeline com quarters dinâmicos
    const timelineHeader = document.createElement('div');
    timelineHeader.className = 'timeline-header';
    
    let quartersHTML = '';
    for (let i = 1; i <= totalQuarters; i++) {
        const year = Math.floor((i - 1) / 4) + 1;
        const quarter = ((i - 1) % 4) + 1;
        quartersHTML += `<div class="quarter">Y${year}Q${quarter}</div>`;
    }
    
    timelineHeader.innerHTML = `
        <div class="timeline-header-label">Timeline (${totalQuarters} Quarters)</div>
        <div class="timeline-quarters">
            ${quartersHTML}
        </div>
    `;
    timeline.appendChild(timelineHeader);
    
    // Se temos dados das tarefas, vamos usar elas para criar o roadmap
    if (analysisResult.tasks && typeof analysisResult.tasks === 'object') {
        const categories = Object.keys(analysisResult.tasks);
        
        categories.forEach((categoryKey, index) => {
            const category = analysisResult.tasks[categoryKey];
            const categoryName = getCategoryTitle(categoryKey);
            
            const timelineCategory = document.createElement('div');
            timelineCategory.className = 'timeline-category';
            
            // Calcular posição e largura baseada nos dados da IA ou fallback
            const categoryTiming = calculateCategoryTimingFromAI(category, totalQuarters) || 
                                 calculateCategoryTiming(categoryKey, projectDuration, index);
            
                        // Criar divisores dos quarters
            let dividersHTML = '';
            for (let i = 1; i < totalQuarters; i++) {
                const dividerPos = (i / totalQuarters) * 100;
                dividersHTML += `<div class="quarter-divider" style="left: ${dividerPos}%;"></div>`;
            }
            
            timelineCategory.innerHTML = `
                <div class="category-label">${categoryName}</div>
                <div class="timeline-track">
                    ${dividersHTML}
                    <div class="timeline-bar" style="left: ${categoryTiming.start}%; width: ${categoryTiming.width}%;">
                        ${categoryName}
                    </div>
                </div>
            `;
            
            timeline.appendChild(timelineCategory);
        });
    } 
    // Fallback para roadmap tradicional se não tiver tasks
    else if (analysisResult.roadmap && Array.isArray(analysisResult.roadmap)) {
        analysisResult.roadmap.forEach((phase, index) => {
            const timelineCategory = document.createElement('div');
            timelineCategory.className = 'timeline-category';
            
            // Distribuir fases uniformemente pelos quarters
            const quarterWidth = 25;
            const startPos = index * quarterWidth;
            const width = quarterWidth - 2; // Pequeno gap entre fases
            
            timelineCategory.innerHTML = `
                <div class="category-label">${phase.phase || 'Fase'}</div>
                <div class="timeline-track">
                    <div class="quarter-divider" style="left: 75%;"></div>
                    <div class="timeline-bar" style="left: ${startPos}%; width: ${width}%;">
                        ${phase.duration || 'N/A'}
                    </div>
                </div>
            `;
            
            timeline.appendChild(timelineCategory);
        });
    } else {
        timeline.innerHTML = '<p>Dados de roadmap não disponíveis.</p>';
    }
}

// Função para obter duração estimada do projeto
function getProjectDuration() {
    if (analysisResult.overview && analysisResult.overview.estimatedDuration) {
        const duration = analysisResult.overview.estimatedDuration.toLowerCase();
        
        // Extrair número de meses da duração
        if (duration.includes('meses') || duration.includes('months')) {
            const months = duration.match(/(\d+)/);
            return months ? parseInt(months[1]) : 12;
        }
        
        // Se mencionou anos, converter para meses
        if (duration.includes('ano') || duration.includes('year')) {
            const years = duration.match(/(\d+)/);
            return years ? parseInt(years[1]) * 12 : 12;
        }
    }
    
    // Default: 12 meses (1 ano)
    return 12;
}

// Função para calcular timing baseado nos dados da IA
function calculateCategoryTimingFromAI(category, totalQuarters) {
    if (category.startQuarter && category.endQuarter) {
        const startQuarter = Math.max(1, category.startQuarter);
        const endQuarter = Math.min(totalQuarters, category.endQuarter);
        
        const quarterWidth = 100 / totalQuarters; // Cada quarter é uma % do total
        const start = (startQuarter - 1) * quarterWidth;
        const width = (endQuarter - startQuarter + 1) * quarterWidth;
        
        return {
            start: start,
            width: width
        };
    }
    return null; // Se não tiver dados da IA, usar fallback
}

// Função para calcular timing de cada categoria baseado no tipo de trabalho (fallback)
function calculateCategoryTiming(categoryKey, projectDuration, index) {
    const totalQuarters = Math.ceil(projectDuration / 3);
    const quarterPercent = 100 / totalQuarters; // Cada quarter é uma % do total
    
    // Definir quando cada categoria normalmente começa e por quanto tempo dura
    const categoryPatterns = {
        'art': { startQuarter: 1, durationQuarters: Math.max(2, totalQuarters - 1) },
        'programming': { startQuarter: 1, durationQuarters: Math.max(3, totalQuarters) },
        'design': { startQuarter: 1, durationQuarters: Math.max(2, Math.ceil(totalQuarters * 0.75)) },
        'audio': { startQuarter: Math.max(2, Math.ceil(totalQuarters * 0.4)), durationQuarters: Math.max(2, Math.ceil(totalQuarters * 0.6)) },
        'music': { startQuarter: Math.max(2, Math.ceil(totalQuarters * 0.4)), durationQuarters: Math.max(2, Math.ceil(totalQuarters * 0.6)) },
        'qa': { startQuarter: Math.max(2, Math.ceil(totalQuarters * 0.6)), durationQuarters: Math.max(2, Math.ceil(totalQuarters * 0.4)) }
    };
    
    const pattern = categoryPatterns[categoryKey] || { 
        startQuarter: Math.max(1, index), 
        durationQuarters: Math.max(2, Math.ceil(totalQuarters * 0.5)) 
    };
    
    const start = (pattern.startQuarter - 1) * quarterPercent;
    const width = Math.min(pattern.durationQuarters * quarterPercent, 100 - start);
    
    return {
        start: start,
        width: width
    };
}

function populateTasks() {
    const tasksGrid = document.getElementById('tasksGrid');
    tasksGrid.innerHTML = '';
    
    if (!analysisResult.tasks || typeof analysisResult.tasks !== 'object') {
        tasksGrid.innerHTML = '<p>Dados de tarefas não disponíveis.</p>';
        return;
    }
    
    Object.entries(analysisResult.tasks).forEach(([categoryKey, category]) => {
        if (!category || typeof category !== 'object') {
            return;
        }
        
        const taskCategory = document.createElement('div');
        taskCategory.className = 'task-category';
        
        const tasks = Array.isArray(category.tasks) ? category.tasks : [];
        
        taskCategory.innerHTML = `
            <div class="category-header">
                <div class="category-icon" style="background-color: ${category.color || '#6b7280'};">
                    ${category.icon || '📝'}
                </div>
                <div class="category-title">${getCategoryTitle(categoryKey)}</div>
                <div class="task-count">${tasks.length}</div>
            </div>
            <ul class="task-list">
                ${tasks.length > 0 ? 
                    tasks.map((task, index) => `
                    <li class="task-item">
                            <div class="task-content">
                        <div class="task-checkbox" data-category="${categoryKey}" data-index="${index}"></div>
                                <div class="task-info">
                                    <div class="task-text">${task.text || 'Tarefa não especificada'}</div>
                                    <div class="task-meta">
                                        <div class="task-priority priority-${task.priority || 'medium'}">${task.priority || 'medium'}</div>
                                    </div>
                                </div>
                            </div>
                    </li>
                    `).join('') :
                    '<li class="task-item"><div class="task-content"><div class="task-info"><div class="task-text">Nenhuma tarefa especificada para esta categoria</div></div></div></li>'
                }
            </ul>
        `;
        
        tasksGrid.appendChild(taskCategory);
    });
    
    // Adicionar event listeners para checkboxes
    addTaskEventListeners();
}

function getCategoryTitle(key) {
    const titles = {
        programming: 'Programação',
        art: 'Arte',
        design: 'Design',
        audio: 'Áudio'
    };
    return titles[key] || key;
}

function addTaskEventListeners() {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('click', function() {
            const category = this.dataset.category;
            const index = this.dataset.index;
            
            this.classList.toggle('checked');
            
            const taskItem = this.closest('.task-item');
            const taskText = taskItem.querySelector('.task-text');
            taskText.classList.toggle('completed');
            
            // Salvar estado no localStorage
            saveTaskState(category, index, this.classList.contains('checked'));
        });
    });
    
    // Carregar estados salvos
    loadTaskStates();
}

function saveTaskState(category, index, completed) {
    const key = `task_${category}_${index}`;
    localStorage.setItem(key, completed.toString());
}

function loadTaskStates() {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    
    checkboxes.forEach(checkbox => {
        const category = checkbox.dataset.category;
        const index = checkbox.dataset.index;
        const key = `task_${category}_${index}`;
        const saved = localStorage.getItem(key);
        
        if (saved === 'true') {
            checkbox.classList.add('checked');
            const taskItem = checkbox.closest('.task-item');
            const taskText = taskItem.querySelector('.task-text');
            taskText.classList.add('completed');
        }
    });
}

// Ações
function exportResults() {
    if (!analysisResult) return;
    
    const exportData = {
        project: analysisResult.overview,
        roadmap: analysisResult.roadmap,
        tasks: analysisResult.tasks,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadmap_${analysisResult.overview.title.replace(/\s+/g, '_')}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

function resetToUpload() {
    // Limpar estado
    currentFile = null;
    analysisResult = null;
    
    // Limpar arquivo
    clearFile();
    
    // Limpar estado salvo
    clearApplicationState();
    
    // Mostrar seção de upload
    uploadSection.style.display = 'block';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    
    // Reset steps
    const steps = ['step1', 'step2', 'step3', 'step4'];
    steps.forEach((stepId, index) => {
        const step = document.getElementById(stepId);
        if (index === 0) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

// Integração com API de IA real
async function analyzeWithRealAI(content) {
    // Verificar se a chave de API está configurada
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('Chave de API não configurada. Configure sua chave de API nas configurações.');
    }
    
    const prompt = `
        Você é um produtor de jogos experiente que sabe como construir um kanban detalhado com tarefas granulares. Analise o seguinte Game Design Document e gere um roadmap e quadro kanban MUITO DETALHADO para desenvolvimento do jogo.

        IMPORTANTE: Crie tarefas PEQUENAS que durem no máximo 1-2 sprints (1-4 semanas cada). Gere pelo menos 8-12 tarefas por categoria para maior granularidade e controle de projeto.
        
        Documento:
        ${content}
        
        Diretrizes para as tarefas:
        - Cada tarefa deve ser específica e acionável
        - Duração máxima: 1-2 sprints (1-2 semanas)
        - Seja granular: divida tarefas grandes em subtarefas menores
        - Use verbos de ação: "Implementar", "Criar", "Desenvolver", "Testar", etc.
        - Inclua tarefas de setup, desenvolvimento, teste e polimento
        
        IMPORTANTE - Timing das categorias:
        Para cada categoria, especifique startQuarter e endQuarter baseado em quando o trabalho deve começar e terminar:
        - Quarters são numerados de 1 até o total (projeto de 1 ano = 4 quarters, 2 anos = 8 quarters)
        - Considere dependências realistas entre categorias
        - Design geralmente começa primeiro, seguido por Arte e Programação em paralelo
        - Audio/Música vem mais tarde no desenvolvimento
        - QA/Testes começam no meio-fim do projeto
        - Algumas categorias podem se sobrepor naturalmente
        
        Retorne APENAS um JSON válido no seguinte formato exato:
        {
            "overview": {
                "title": "Nome do jogo",
                "genre": "Gênero do jogo",
                "platform": "Plataformas alvo",
                "teamSize": "Tamanho da equipe",
                "estimatedDuration": "Duração estimada em meses",
                "description": "Descrição detalhada do projeto"
            },
            "roadmap": [
                {
                    "phase": "Nome da fase",
                    "duration": "Duração em meses"
                }
            ],
            "tasks": {
                "programming": {
                    "icon": "💻",
                    "color": "#3b82f6",
                    "startQuarter": 1,
                    "endQuarter": 6,
                    "tasks": [
                        {"text": "Tarefa de programação", "priority": "high|medium|low"}
                    ]
                },
                "art": {
                    "icon": "🎨",
                    "color": "#8b5cf6",
                    "startQuarter": 1,
                    "endQuarter": 7,
                    "tasks": [
                        {"text": "Tarefa de arte", "priority": "high|medium|low"}
                    ]
                },
                "design": {
                    "icon": "📋",
                    "color": "#10b981",
                    "startQuarter": 1,
                    "endQuarter": 5,
                    "tasks": [
                        {"text": "Tarefa de design", "priority": "high|medium|low"}
                    ]
                },
                "audio": {
                    "icon": "🎵",
                    "color": "#f59e0b",
                    "startQuarter": 3,
                    "endQuarter": 6,
                    "tasks": [
                        {"text": "Tarefa de áudio", "priority": "high|medium|low"}
                    ]
                }
            }
        }
    `;
    
    try {
        const response = await callAIAPI(prompt, apiKey);
        return response;
        
    } catch (error) {
        console.error('Erro na API:', error);
        throw new Error('Falha ao comunicar com a API de IA. Verifique sua chave de API e conexão.');
    }
}

// Função para obter a chave de API (pode ser configurada pelo usuário)
function getApiKey() {
    // Primeiro, verificar se existe uma chave salva no localStorage
    const savedKey = localStorage.getItem('ai_api_key');
    if (savedKey) {
        return savedKey;
    }
    
    // Se não houver chave salva, solicitar ao usuário
    const apiKey = prompt('Digite sua chave de API da IA (será salva localmente para futuras sessões):');
    if (apiKey && apiKey.trim()) {
        localStorage.setItem('ai_api_key', apiKey.trim());
        return apiKey.trim();
    }
    
    return null;
}

// Função para configurar nova chave de API
function configureApiKey() {
    const newKey = prompt('Digite sua nova chave de API:');
    if (newKey && newKey.trim()) {
        localStorage.setItem('ai_api_key', newKey.trim());
        showNotification('Chave de API configurada com sucesso!', 'success');
        updateApiStatus();
        return true;
    }
    return false;
}

// Função para limpar chave de API
function clearApiKey() {
    if (confirm('Tem certeza que deseja remover a chave de API salva?')) {
        localStorage.removeItem('ai_api_key');
        showNotification('Chave de API removida com sucesso!', 'success');
        updateApiStatus();
        return true;
    }
    return false;
}

// Função para verificar se existe chave de API configurada
function hasApiKey() {
    return !!localStorage.getItem('ai_api_key');
}

// ===== SISTEMA DE PERSISTÊNCIA =====

// Salvar estado completo da aplicação
function saveApplicationState() {
    if (analysisResult) {
        const appState = {
            analysisResult: analysisResult,
            currentFile: currentFile ? {
                name: currentFile.name,
                size: currentFile.size,
                type: currentFile.type,
                lastModified: currentFile.lastModified
            } : null,
            timestamp: Date.now(),
            version: '1.0'
        };
        
        try {
            localStorage.setItem('producer_app_state', JSON.stringify(appState));
            console.log('Estado da aplicação salvo com sucesso');
        } catch (error) {
            console.error('Erro ao salvar estado:', error);
        }
    }
}

// Restaurar estado da aplicação
function restoreApplicationState() {
    try {
        const savedState = localStorage.getItem('producer_app_state');
        if (savedState) {
            const appState = JSON.parse(savedState);
            
            // Verificar se o estado não é muito antigo (7 dias)
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - appState.timestamp > oneWeek) {
                console.log('Estado salvo muito antigo, ignorando...');
                clearApplicationState();
                return;
            }
            
            // Restaurar dados de análise
            if (appState.analysisResult) {
                analysisResult = appState.analysisResult;
                
                // Restaurar informações do arquivo
                if (appState.currentFile) {
                    displayFileInfo(appState.currentFile);
                }
                
                // Mostrar resultados diretamente
                showResults();
                
                // Mostrar notificação
                showNotification('Estado anterior restaurado com sucesso!', 'success');
                
                console.log('Estado da aplicação restaurado com sucesso');
            }
        }
    } catch (error) {
        console.error('Erro ao restaurar estado:', error);
        clearApplicationState();
    }
}

// Limpar estado salvo
function clearApplicationState() {
    try {
        localStorage.removeItem('producer_app_state');
        console.log('Estado da aplicação limpo');
    } catch (error) {
        console.error('Erro ao limpar estado:', error);
    }
}

// Verificar se existe estado salvo
function hasSavedState() {
    return !!localStorage.getItem('producer_app_state');
}

// Funções do modal de configuração
function openConfigModal() {
    const configModal = document.getElementById('configModal');
    configModal.style.display = 'block';
    updateApiStatus();
    updateStateStatus();
}

function closeConfigModal() {
    const configModal = document.getElementById('configModal');
    configModal.style.display = 'none';
}

function updateApiStatus() {
    const apiStatus = document.getElementById('apiStatus');
    if (!apiStatus) return;
    
    if (hasApiKey()) {
        apiStatus.innerHTML = `
            <div class="status-item status-success">
                <i class="fas fa-check-circle"></i>
                <span>Chave de API configurada</span>
            </div>
        `;
    } else {
        apiStatus.innerHTML = `
            <div class="status-item status-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Nenhuma chave de API configurada</span>
            </div>
        `;
    }
}

function updateStateStatus() {
    const stateStatus = document.getElementById('stateStatus');
    if (!stateStatus) return;
    
    if (hasSavedState()) {
        const savedState = JSON.parse(localStorage.getItem('producer_app_state'));
        const saveDate = new Date(savedState.timestamp).toLocaleString('pt-BR');
        const projectTitle = savedState.analysisResult?.overview?.title || 'Projeto sem nome';
        
        stateStatus.innerHTML = `
            <div class="status-item status-success">
                <i class="fas fa-save"></i>
                <span>Estado salvo: "${projectTitle}" (${saveDate})</span>
            </div>
        `;
    } else {
        stateStatus.innerHTML = `
            <div class="status-item status-info">
                <i class="fas fa-info-circle"></i>
                <span>Nenhum estado salvo</span>
            </div>
        `;
    }
}

function handleClearState() {
    if (confirm('Tem certeza que deseja limpar o estado salvo? Esta ação não pode ser desfeita.')) {
        clearApplicationState();
        updateStateStatus();
        showNotification('Estado salvo removido com sucesso!', 'success');
    }
}

// Função genérica para chamar APIs de IA
async function callAIAPI(prompt, apiKey) {
    // Esta função pode ser expandida para suportar diferentes APIs
    // Por enquanto, implementaremos para Google Gemini como exemplo
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        }),
    });
    
    if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
        throw new Error('Resposta inválida da API');
    }
    
    return result.candidates[0].content.parts[0].text;
}

// Funções auxiliares
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Adicionar estilos para notificações
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    }
    
    .notification-info {
        background: var(--info-color);
    }
    
    .notification-success {
        background: var(--success-color);
    }
    
    .notification-error {
        background: var(--danger-color);
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;

// Adicionar estilos de notificação ao head
const style = document.createElement('style');
style.textContent = notificationStyles;
document.head.appendChild(style);
