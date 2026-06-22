/**
 * Teste comparativo: Fluxo Antigo (v1) vs Novo Fluxo (v2)
 *
 * Não chama a API — usa dados sintéticos que simulam o output
 * de cada fase, para comparar estrutura, contagens e coerência.
 *
 * Métricas comparadas:
 *   1. Número de tasks geradas
 *   2. Distribuição de tasks por fase (milestone)
 *   3. Tempo atribuído por área (problema central do v1)
 *   4. Coerência temporal (tasks de poc dentro da PoC, etc.)
 */

const assert = require('node:assert/strict');

// ============================================================
// DADOS SINTÉTICOS — simulam output de cada fluxo
// GDD base: "Capivara Rush" — bullet hell boss rush, 12 meses
// ============================================================

// --- Fluxo v1: subáreas com período pré-definido ---
const v1_subareas = [
    { id: 'sa_prog_core', title: 'Programação — Core', area: 'programming', startMonth: 1, endMonth: 4 },
    { id: 'sa_prog_bosses', title: 'Programação — Bosses', area: 'programming', startMonth: 3, endMonth: 10 },
    { id: 'sa_art_concept', title: 'Arte — Concept', area: 'art', startMonth: 1, endMonth: 3 },
    { id: 'sa_art_chars', title: 'Arte — Personagens', area: 'art', startMonth: 2, endMonth: 9 },
    { id: 'sa_design', title: 'Design — Level Design', area: 'design', startMonth: 2, endMonth: 8 },
    { id: 'sa_audio', title: 'Áudio', area: 'audio', startMonth: 4, endMonth: 10 },
    { id: 'sa_qa', title: 'QA e Testes', area: 'qa', startMonth: 8, endMonth: 12 },
];

// KRs por subárea (v1) — com estimativa de semanas (já atribuída pela IA)
const v1_phase2mds = {
    sa_prog_core:   simulateKRs('sa_prog_core',   ['Arquitetura de entidades', 'Sistema de colisão', 'Loop de jogo'], [3, 2, 2]),
    sa_prog_bosses: simulateKRs('sa_prog_bosses',  ['IA Crustáceo', 'IA Sapo', 'IA Arraiá', 'IA Água-viva', 'State machines'], [4, 4, 4, 4, 3]),
    sa_art_concept: simulateKRs('sa_art_concept',  ['Style guide', 'Concept personagem', 'Concept bosses'], [2, 2, 3]),
    sa_art_chars:   simulateKRs('sa_art_chars',    ['Modelar Capivara', 'Animar Capivara', 'Texturizar Capivara', 'Todos os 4 bosses'], [4, 3, 2, 12]),
    sa_design:      simulateKRs('sa_design',       ['Level design fase 1', 'Level design fase 2', 'Balanceamento'], [3, 3, 4]),
    sa_audio:       simulateKRs('sa_audio',        ['Trilha sonora', 'SFX combate', 'SFX UI'], [4, 3, 2]),
    sa_qa:          simulateKRs('sa_qa',           ['Testes de gameplay', 'Bug fixes', 'Certificação'], [3, 4, 2]),
};

// Tasks por KR (v1) — 3-5 tasks de 1-2 dias por KR
const v1_tasks = buildV1Tasks(v1_subareas, v1_phase2mds);

// --- Fluxo v2: milestones primeiro, features por fase ---
const v2_milestones = [
    { id: 'ms_poc',            type: 'poc',            title: 'PoC — Capivara Rush',        areas: ['programming', 'design'] },
    { id: 'ms_prototype',      type: 'prototype',      title: 'Prototipo — Capivara Rush',  areas: ['programming', 'design', 'art'] },
    { id: 'ms_demo',           type: 'demo',           title: 'Demo — Capivara Rush',       areas: ['programming', 'design', 'art', 'audio'] },
    { id: 'ms_vertical_slice', type: 'vertical_slice', title: 'Vertical Slice',             areas: ['programming', 'design', 'art', 'audio', 'qa'] },
    { id: 'ms_alpha',          type: 'alpha',          title: 'Alpha Interna',              areas: ['programming', 'design', 'art', 'audio', 'qa'] },
    { id: 'ms_beta',           type: 'beta',           title: 'Beta Fechada',               areas: ['programming', 'design', 'art', 'audio', 'qa', 'production'] },
    { id: 'ms_gold',           type: 'gold',           title: 'Gold Master',                areas: ['programming', 'qa', 'production'] },
    { id: 'ms_release',        type: 'release',        title: 'Lançamento',                 areas: ['programming', 'production'] },
];

// Features por milestone (v2) — área como label, sem período
const v2_features = [
    // PoC — 7 dias, só o core
    { id: 'ft_poc_0', milestoneId: 'ms_poc', milestoneType: 'poc', area: 'programming', title: 'Loop principal jogável' },
    { id: 'ft_poc_1', milestoneId: 'ms_poc', milestoneType: 'poc', area: 'programming', title: 'Mecânica de arpão (core)' },
    { id: 'ft_poc_2', milestoneId: 'ms_poc', milestoneType: 'poc', area: 'design',      title: 'Arena de teste para PoC' },

    // Prototype — valida diversão
    { id: 'ft_proto_0', milestoneId: 'ms_prototype', milestoneType: 'prototype', area: 'programming', title: 'IA do Crustáceo (1 boss)' },
    { id: 'ft_proto_1', milestoneId: 'ms_prototype', milestoneType: 'prototype', area: 'programming', title: 'Padrões de bullet hell básicos' },
    { id: 'ft_proto_2', milestoneId: 'ms_prototype', milestoneType: 'prototype', area: 'art',         title: 'Direção visual jogável (placeholder)' },
    { id: 'ft_proto_3', milestoneId: 'ms_prototype', milestoneType: 'prototype', area: 'design',      title: 'Balanceamento do Crustáceo' },

    // Demo — vende o jogo
    { id: 'ft_demo_0', milestoneId: 'ms_demo', milestoneType: 'demo', area: 'programming', title: 'IA do Sapo' },
    { id: 'ft_demo_1', milestoneId: 'ms_demo', milestoneType: 'demo', area: 'art',         title: 'Arte final do Crustáceo' },
    { id: 'ft_demo_2', milestoneId: 'ms_demo', milestoneType: 'demo', area: 'audio',       title: 'SFX de combate básicos' },
    { id: 'ft_demo_3', milestoneId: 'ms_demo', milestoneType: 'demo', area: 'design',      title: 'Tutorial curto da demo' },

    // Vertical Slice — fatia polida
    { id: 'ft_vs_0', milestoneId: 'ms_vertical_slice', milestoneType: 'vertical_slice', area: 'programming', title: 'Save/load e troca de fases' },
    { id: 'ft_vs_1', milestoneId: 'ms_vertical_slice', milestoneType: 'vertical_slice', area: 'art',         title: 'Arte final do Sapo' },
    { id: 'ft_vs_2', milestoneId: 'ms_vertical_slice', milestoneType: 'vertical_slice', area: 'audio',       title: 'Trilha sonora do Sapo' },
    { id: 'ft_vs_3', milestoneId: 'ms_vertical_slice', milestoneType: 'vertical_slice', area: 'qa',          title: 'QA do Vertical Slice' },

    // Alpha — conteúdo completo
    { id: 'ft_alpha_0', milestoneId: 'ms_alpha', milestoneType: 'alpha', area: 'programming', title: 'IA do Arraiá e Água-viva' },
    { id: 'ft_alpha_1', milestoneId: 'ms_alpha', milestoneType: 'alpha', area: 'art',         title: 'Arte final Arraiá e Água-viva' },
    { id: 'ft_alpha_2', milestoneId: 'ms_alpha', milestoneType: 'alpha', area: 'audio',       title: 'Trilha sonora completa' },
    { id: 'ft_alpha_3', milestoneId: 'ms_alpha', milestoneType: 'alpha', area: 'design',      title: 'Balanceamento completo' },

    // Beta
    { id: 'ft_beta_0', milestoneId: 'ms_beta', milestoneType: 'beta', area: 'qa',         title: 'QA externo' },
    { id: 'ft_beta_1', milestoneId: 'ms_beta', milestoneType: 'beta', area: 'production', title: 'Localização e acessibilidade' },

    // Gold
    { id: 'ft_gold_0', milestoneId: 'ms_gold', milestoneType: 'gold', area: 'qa',          title: 'Certificação da plataforma' },
    { id: 'ft_gold_1', milestoneId: 'ms_gold', milestoneType: 'gold', area: 'programming', title: 'Build final e otimização' },

    // Release
    { id: 'ft_release_0', milestoneId: 'ms_release', milestoneType: 'release', area: 'production', title: 'Publicação na loja' },
    { id: 'ft_release_1', milestoneId: 'ms_release', milestoneType: 'release', area: 'programming', title: 'Hotfixes pós-lançamento' },
];

// Tasks por feature (v2) — 3-5 tasks de 1-2 dias por feature
const v2_tasks = buildV2Tasks(v2_features);

// ============================================================
// HELPERS
// ============================================================

function simulateKRs(saId, krNames, weekEstimates) {
    return krNames.map((name, i) => ({
        id: `${saId}_kr${i+1}`,
        title: name,
        estimatedWeeks: weekEstimates[i] || 2,
    }));
}

function buildV1Tasks(subareas, phase2mds) {
    const tasks = [];
    for (const sa of subareas) {
        const krs = phase2mds[sa.id] || [];
        for (const kr of krs) {
            // 4 tasks por KR em média
            const taskCount = Math.max(3, Math.min(6, Math.round(kr.estimatedWeeks * 2)));
            for (let t = 0; t < taskCount; t++) {
                tasks.push({
                    id: `${kr.id}_t${t+1}`,
                    title: `Task ${t+1} de ${kr.title}`,
                    estimatedDays: t % 2 === 0 ? 2 : 1,
                    area: sa.area,
                    subareaId: sa.id,
                    krId: kr.id,
                    // v1 NÃO tem milestoneType garantido — é atribuído depois por heurística
                    milestoneType: null, // será inferido pelo selectMilestoneIdForTask
                    periodStart: sa.startMonth,
                    periodEnd: sa.endMonth,
                });
            }
        }
    }
    return tasks;
}

function buildV2Tasks(features) {
    const tasks = [];
    for (const ft of features) {
        // 4 tasks por feature em média (PoC tem menos por ser limitado a 7 dias)
        const taskCount = ft.milestoneType === 'poc' ? 3 : 4;
        for (let t = 0; t < taskCount; t++) {
            tasks.push({
                id: `${ft.id}_t${t+1}`,
                title: `Task ${t+1} de ${ft.title}`,
                estimatedDays: t % 2 === 0 ? 2 : 1,
                area: ft.area,
                featureId: ft.id,
                // v2 TEM milestoneType garantido — vem da feature que vem do milestone
                milestoneType: ft.milestoneType,
                milestoneId: ft.milestoneId,
                periodStart: null, // NÃO existe — calculado depois das tasks
                periodEnd: null,
            });
        }
    }
    return tasks;
}

// ============================================================
// MÉTRICAS
// ============================================================

function countByMilestone(tasks, milestoneField = 'milestoneType') {
    const counts = {};
    for (const t of tasks) {
        const key = t[milestoneField] || 'unknown';
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

function countByArea(tasks) {
    const counts = {};
    for (const t of tasks) {
        const key = t.area || 'unknown';
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

function totalDays(tasks) {
    return tasks.reduce((s, t) => s + (t.estimatedDays || 2), 0);
}

function tasksWithKnownMilestone(tasks) {
    return tasks.filter(t => t.milestoneType && t.milestoneType !== null && t.milestoneType !== 'unknown');
}

function pocTasksOverlappingLaterScope(v1Tasks) {
    // No v1, tasks de subáreas com período > mês 1 podem ser atribuídas ao poc por heurística incorreta
    // Identifica tasks cujo período da subárea é mês 3+ mas que poderiam erroneamente ir para poc
    return v1Tasks.filter(t => t.periodStart >= 3);
}

// ============================================================
// TESTES
// ============================================================

console.log('\n====================================================');
console.log('TESTE COMPARATIVO: Fluxo v1 vs Fluxo v2');
console.log('Projeto: Capivara Rush (bullet hell boss rush, 12m)');
console.log('====================================================\n');

// --- 1. Contagem total de tasks ---
console.log('--- 1. Total de Tasks Geradas ---');
console.log(`  v1: ${v1_tasks.length} tasks`);
console.log(`  v2: ${v2_tasks.length} tasks`);

assert.ok(v1_tasks.length > 0, 'v1 deve gerar tasks');
assert.ok(v2_tasks.length > 0, 'v2 deve gerar tasks');

// v2 tende a gerar menos tasks porque PoC é mais restrito
// mas ambos devem estar em faixa razoável
assert.ok(v1_tasks.length >= 50, `v1 deve ter ao menos 50 tasks (tem ${v1_tasks.length})`);
assert.ok(v2_tasks.length >= 50, `v2 deve ter ao menos 50 tasks (tem ${v2_tasks.length})`);

console.log('  ✓ Ambos geram volume razoável de tasks\n');

// --- 2. Milestone conhecida em cada task ---
console.log('--- 2. Tasks com Milestone Definida ---');
const v1Known = tasksWithKnownMilestone(v1_tasks);
const v2Known = tasksWithKnownMilestone(v2_tasks);
const v1KnownPct = Math.round(v1Known.length / v1_tasks.length * 100);
const v2KnownPct = Math.round(v2Known.length / v2_tasks.length * 100);
console.log(`  v1: ${v1Known.length}/${v1_tasks.length} (${v1KnownPct}%) — milestoneType definido no momento da criação`);
console.log(`  v2: ${v2Known.length}/${v2_tasks.length} (${v2KnownPct}%) — milestoneType garantido pela estrutura`);

assert.equal(v2KnownPct, 100, 'v2: TODAS as tasks devem ter milestoneType definido desde a criação');
assert.equal(v1KnownPct, 0, 'v1: NENHUMA task tem milestoneType no momento da criação (atribuído por heurística depois)');

console.log('  ✓ v2 garante milestone por design, v1 depende de heurística\n');

// --- 3. Distribuição por fase ---
console.log('--- 3. Distribuição de Tasks por Fase ---');
const v2ByMs = countByMilestone(v2_tasks, 'milestoneType');
const phaseOrder = ['poc', 'prototype', 'demo', 'vertical_slice', 'alpha', 'beta', 'gold', 'release'];

console.log('  v2 (por fase, garantido pela estrutura):');
for (const phase of phaseOrder) {
    const count = v2ByMs[phase] || 0;
    console.log(`    ${phase.padEnd(16)}: ${count} tasks`);
}

// PoC deve ter menos tasks que alpha (escopo menor)
assert.ok((v2ByMs['poc'] || 0) < (v2ByMs['alpha'] || 0),
    'poc deve ter menos tasks que alpha — escopo menor');

// Release deve ter poucas tasks (publicação, hotfixes)
assert.ok((v2ByMs['release'] || 0) <= (v2ByMs['prototype'] || 0),
    'release deve ter ≤ tasks que prototype');

console.log('  ✓ Distribuição por fase coerente com escopo\n');

// --- 4. Problema central do v1: tempo nas subáreas ---
console.log('--- 4. Problema Central: Tempo nas Áreas ---');
const v1PeriodsSet = v1_tasks.filter(t => t.periodStart !== null && t.periodEnd !== null);
const v2PeriodsSet = v2_tasks.filter(t => t.periodStart !== null && t.periodEnd !== null);

console.log(`  v1: ${v1PeriodsSet.length}/${v1_tasks.length} tasks têm período pré-definido pela IA`);
console.log(`  v2: ${v2PeriodsSet.length}/${v2_tasks.length} tasks têm período pré-definido pela IA`);

assert.equal(v1PeriodsSet.length, v1_tasks.length,
    'v1: todas as tasks herdam período da subárea (definido pela IA antes das milestones)');
assert.equal(v2PeriodsSet.length, 0,
    'v2: NENHUMA task tem período pré-definido — calculado das tasks, não pela IA');

console.log('  ✓ v1 atribui tempo antes do planejamento (problema identificado)');
console.log('  ✓ v2 deriva cronograma das tasks, não o contrário\n');

// --- 5. Coerência de escopo: tasks de poc não devem conter escopo de alpha ---
console.log('--- 5. Coerência de Escopo por Fase ---');
const v2PocTasks = v2_tasks.filter(t => t.milestoneType === 'poc');
const v2AlphaTasks = v2_tasks.filter(t => t.milestoneType === 'alpha');

// No v2, nenhuma feature de poc tem área de qa (qa só entra no vertical_slice+)
const v2PocQaTasks = v2PocTasks.filter(t => t.area === 'qa');
console.log(`  v2 PoC tasks com área QA: ${v2PocQaTasks.length} (esperado: 0)`);
assert.equal(v2PocQaTasks.length, 0, 'QA não deve aparecer na PoC');

// No v2, features de alpha contêm todos os 4 bosses
const v2AlphaBossFeatures = v2_features.filter(
    ft => ft.milestoneType === 'alpha' && ft.title.toLowerCase().includes('arraiá')
);
console.log(`  v2 features de alpha com Arraiá: ${v2AlphaBossFeatures.length} (esperado: ≥1)`);
assert.ok(v2AlphaBossFeatures.length >= 1,
    'Boss completo (Arraiá) deve estar no alpha, não no prototype');

// No v1, subárea de bosses tem período mês 3-10, o que causa ambiguidade
const v1BossSubarea = v1_subareas.find(sa => sa.id === 'sa_prog_bosses');
assert.equal(v1BossSubarea.startMonth, 3, 'v1: subárea de bosses começa no mês 3 (problema — não diz em qual fase)');
console.log(`  v1 subárea bosses: mês ${v1BossSubarea.startMonth}–${v1BossSubarea.endMonth} (sem distinção poc/proto/alpha)`);
console.log('  ✓ v2 separa bosses por fase; v1 joga tudo numa janela temporal\n');

// --- 6. Distribuição por área ---
console.log('--- 6. Distribuição por Área ---');
const v1ByArea = countByArea(v1_tasks);
const v2ByArea = countByArea(v2_tasks);
const allAreas = new Set([...Object.keys(v1ByArea), ...Object.keys(v2ByArea)]);

console.log('  Área            | v1  | v2');
console.log('  ----------------|-----|-----');
for (const area of [...allAreas].sort()) {
    console.log(`  ${area.padEnd(16)}| ${String(v1ByArea[area] || 0).padEnd(4)}| ${v2ByArea[area] || 0}`);
}
console.log();

// --- 7. Total de dias estimados ---
console.log('--- 7. Total de Dias Estimados ---');
const v1Days = totalDays(v1_tasks);
const v2Days = totalDays(v2_tasks);
console.log(`  v1: ${v1Days} dias-pessoa estimados`);
console.log(`  v2: ${v2Days} dias-pessoa estimados`);
assert.ok(v1Days > 0 && v2Days > 0, 'Ambos devem ter estimativas de tempo');
console.log('  ✓ Ambos produzem estimativas de tempo\n');

// --- 8. Resumo ---
console.log('====================================================');
console.log('RESUMO');
console.log('====================================================');
console.log(`  Tasks geradas       : v1=${v1_tasks.length}  v2=${v2_tasks.length}`);
console.log(`  Dias estimados      : v1=${v1Days}  v2=${v2Days}`);
console.log(`  Milestone garantida : v1=NÃO (heurística)  v2=SIM (por design)`);
console.log(`  Período por área    : v1=SIM (IA define)   v2=NÃO (calculado)`);
console.log(`  Fases distintas     : v1=0  v2=${Object.keys(v2ByMs).length}`);
console.log(`  Tasks na PoC        : v1=? (inferido)  v2=${v2ByMs['poc'] || 0}`);
console.log(`  Tasks no Alpha      : v1=? (inferido)  v2=${v2ByMs['alpha'] || 0}`);
console.log('');
console.log('  PROBLEMA CENTRAL v1: a IA define "mês X a Y" nas subáreas');
console.log('  ANTES de existirem milestones. Isso faz com que a duração');
console.log('  de PoC/Prototipo/etc seja calculada com base num período');
console.log('  inventado, não derivado das tasks reais.');
console.log('');
console.log('  SOLUÇÃO v2: milestones são definidos PRIMEIRO com O QUE');
console.log('  deve existir em cada fase. Features são quebradas POR FASE.');
console.log('  Tasks de sprint derivam das features. Cronograma é calculado');
console.log('  automaticamente — IA nunca inventa período por área.');
console.log('====================================================\n');

console.log('Todos os testes passaram ✓');
