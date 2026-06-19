(function (root) {
    function partitionSprintSections(sections) {
        return sections.reduce((result, section) => {
            const target = section.percentComplete === 100 ? result.completed : result.active;
            target.push(section);
            return result;
        }, { active: [], completed: [] });
    }

    function partitionBacklogItems(items) {
        return partitionSprintSections(items);
    }

    const PHASE_ORDER = ['poc', 'prototype', 'demo', 'vertical_slice', 'alpha', 'beta', 'gold', 'release'];

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function normalizeMilestoneType(type) {
        const t = normalizeText(type).replace(/[\s-]+/g, '_');
        if (t === 'launch' || t === 'lancamento') return 'release';
        if (t === 'vertical' || t === 'verticalslice' || t === 'slice') return 'vertical_slice';
        if (t === 'proto' || t === 'prototipo') return 'prototype';
        if (t === 'proof_of_concept' || t === 'prova_de_conceito' || t === 'proof-of-concept') return 'poc';
        return PHASE_ORDER.includes(t) ? t : t;
    }

    function milestoneByType(milestones, type) {
        const normalized = normalizeMilestoneType(type);
        return (milestones || []).find(m => normalizeMilestoneType(m.type) === normalized);
    }

    function fallbackMilestoneForProgress(milestones, progress) {
        const sorted = (milestones || []).slice().sort((a, b) => (a.month || 0) - (b.month || 0));
        if (!sorted.length) return null;

        const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
        const phaseByProgress = [
            [0.06, 'poc'],
            [0.18, 'prototype'],
            [0.34, 'demo'],
            [0.5, 'vertical_slice'],
            [0.66, 'alpha'],
            [0.84, 'beta'],
            [0.95, 'gold'],
            [1, 'release'],
        ].find(([limit]) => p <= limit)?.[1] || 'release';

        return milestoneByType(sorted, phaseByProgress) || sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    }

    function selectMilestoneIdForTask(task, kr, objective, milestones, progress) {
        if (!milestones || milestones.length === 0) return null;

        const haystack = normalizeText([
            objective?.area,
            objective?.title,
            objective?.description,
            kr?.title,
            kr?.description,
            task?.title,
            task?.description,
            task?.type,
        ].join(' '));

        const pick = type => (milestoneByType(milestones, type) || fallbackMilestoneForProgress(milestones, progress))?.id || null;

        if (/\b(release|lancamento|publicar|deploy|loja|steam page|press kit|pos[- ]?lancamento)\b/.test(haystack)) return pick('release');
        if (/\b(gold|master|certificacao|certificar|submission|build final|zero bugs criticos)\b/.test(haystack)) return pick('gold');
        if (/\b(beta|qa externo|teste externo|balanceamento|polimento avancado|localizacao|compatibilidade)\b/.test(haystack)) return pick('beta');

        if (/\b(todos|todas|completo|completa|finalizad[oa]s?|100%|cinco|5 bosses|5 chefes|todos os bosses|todas as fases|todos os biomas|todas as areas|campanha inteira|conteudo completo|pipeline completo)\b/.test(haystack)) {
            return pick('alpha');
        }

        if (/\bart\b/.test(haystack) && /\b(style guide|guia visual|direcao visual|direcao de arte|mood ?board|referencias visuais|paleta|shape language|guia de materiais|limites tecnicos|poly budget|texture budget|nomenclatura|assets? temporarios?|arte temporaria|placeholder visual|sprites? temporarios?|proxy art|blockout|ui temporaria|vfx simples)\b/.test(haystack)) {
            return pick('prototype');
        }

        if (/\b(vertical slice|fatia vertical|hub|dois bosses|2 bosses|duas personagens|itens para pegar|representativa|recorte polido)\b/.test(haystack)) {
            return pick('vertical_slice');
        }

        if (/\b(demo|publica|publico|steam next|evento|trailer|wishlist|caminho curto|personagem para interagir|loop completo|vender)\b/.test(haystack)) {
            return pick('demo');
        }

        if (/\b(poc|proof of concept|prova de conceito|risco tecnico|validacao tecnica|spike tecnico|sistema isolado|teste isolado|validar tecnica|mecanica isolada|viabilidade tecnica)\b/.test(haystack)) {
            return pick('poc');
        }

        if (/\b(prototipo|prototype|mecanica chave|mecanicas chave|spike|arena cinza|ambiente de teste|placeholder|primeiro boss|um boss|1 boss|boss inicial)\b/.test(haystack)) {
            return pick('prototype');
        }

        return fallbackMilestoneForProgress(milestones, progress)?.id || null;
    }

    function createCostBucket() {
        return { tasks: 0, days: 0, hours: 0, cost: 0 };
    }

    function addTaskCost(bucket, task, area, hourlyRates, hoursPerDay) {
        const days = Number(task?.estimatedDays) > 0 ? Number(task.estimatedDays) : 2;
        const hours = days * hoursPerDay;
        const rate = Number(hourlyRates?.[area]) || 0;
        bucket.tasks += 1;
        bucket.days += days;
        bucket.hours += hours;
        bucket.cost += hours * rate;
    }

    function calculatePhaseCosts({ objectives = [], milestones = [], hourlyRates = {}, hoursPerDay = 6 } = {}) {
        const phaseMap = new Map((milestones || []).map(m => [m.id, {
            id: m.id,
            title: m.title || m.type || m.id,
            type: normalizeMilestoneType(m.type || ''),
            month: m.month,
            ...createCostBucket(),
            areas: {},
        }]));

        const fallback = milestones?.[0]?.id || 'unassigned';
        if (!phaseMap.has(fallback)) {
            phaseMap.set(fallback, {
                id: fallback,
                title: 'Sem fase',
                type: 'unassigned',
                month: 0,
                ...createCostBucket(),
                areas: {},
            });
        }

        const total = createCostBucket();
        const areas = {};
        const hpd = Number(hoursPerDay) > 0 ? Number(hoursPerDay) : 6;

        (objectives || []).forEach(objective => {
            const area = objective?.area || 'production';
            (objective?.keyResults || []).forEach(kr => {
                (kr?.tasks || []).forEach(task => {
                    const milestoneId = task?.milestoneId && phaseMap.has(task.milestoneId) ? task.milestoneId : fallback;
                    const phase = phaseMap.get(milestoneId);
                    if (!phase.areas[area]) phase.areas[area] = createCostBucket();
                    if (!areas[area]) areas[area] = createCostBucket();

                    addTaskCost(phase, task, area, hourlyRates, hpd);
                    addTaskCost(phase.areas[area], task, area, hourlyRates, hpd);
                    addTaskCost(areas[area], task, area, hourlyRates, hpd);
                    addTaskCost(total, task, area, hourlyRates, hpd);
                });
            });
        });

        const phases = Array.from(phaseMap.values())
            .filter(phase => phase.tasks > 0 || phase.id !== 'unassigned')
            .sort((a, b) => (a.month || 0) - (b.month || 0));

        return { phases, areas, total, hoursPerDay: hpd, hourlyRates: { ...hourlyRates } };
    }

    const api = {
        partitionSprintSections,
        partitionBacklogItems,
        normalizeMilestoneType,
        selectMilestoneIdForTask,
        calculatePhaseCosts,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.WorkBacklogHelpers = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
