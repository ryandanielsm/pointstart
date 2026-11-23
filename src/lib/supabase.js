import { createClient } from '@supabase/supabase-js';
import { getBrasiliaTodayStr, addBusinessDays } from './dateUtils';

export { addBusinessDays };

export const SUPABASE_URL = 'https://auimuxfkdqxjzgnecpez.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_ISWgTZiGGmXijUtNOCEW2w_7cJJrnAX';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Carrega todos os clientes ordenados pelos mais recentes com deduplicação estrita
 */
export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar clientes:', error);
    throw error;
  }

  // Deduplicação estrita por id e por nome normalizado (mantendo o mais recente/completo)
  const unique = [];
  const seenIds = new Set();
  const seenNames = new Set();
  for (const c of data || []) {
    const norm = c.name?.toLowerCase().trim();
    if (!seenIds.has(c.id) && !seenNames.has(norm)) {
      seenIds.add(c.id);
      seenNames.add(norm);
      unique.push(c);
    }
  }

  return unique;
}

/**
 * Carrega as etapas do cliente
 */
export async function getStagesByClient(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('client_id', clientId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Erro ao buscar etapas:', error);
    throw error;
  }
  return data || [];
}

/**
 * Carrega as tarefas do cliente
 */
export async function getTasksByClient(clientId) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('client_id', clientId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Erro ao buscar tarefas:', error);
    throw error;
  }
  return data || [];
}

/**
 * Carrega os logs de automação do cliente ou globais
 */
export async function getAutomationLogs(clientId = null) {
  let query = supabase
    .from('automation_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao buscar logs:', error);
    throw error;
  }
  return data || [];
}

/**
 * Atualiza status e/ou etapa da tarefa
 */
export async function updateTask(taskId, updates = {}) {
  if (!taskId) return null;

  try {
    // 1. Monta objeto limpo cleanPayload contendo apenas chaves definidas (!== undefined)
    // dentre as colunas válidas da tabela tasks (title, status, responsible, start_date, due_date, checklist, meet_link, meet_date, meeting_at, description, order_index)
    // removendo id, client_id, created_at e propriedades extras de UI
    const cleanPayload = {};

    if (updates.title !== undefined) cleanPayload.title = String(updates.title).trim();
    if (updates.status !== undefined) cleanPayload.status = updates.status;
    if (updates.stage_id !== undefined) cleanPayload.stage_id = updates.stage_id;
    if (updates.start_date !== undefined) cleanPayload.start_date = updates.start_date;
    if (updates.due_date !== undefined) cleanPayload.due_date = updates.due_date;
    if (updates.description !== undefined) cleanPayload.description = updates.description;

    // order_index / position
    if (updates.order_index !== undefined) cleanPayload.position = updates.order_index;
    else if (updates.position !== undefined) cleanPayload.position = updates.position;

    // responsible / owner
    if (updates.owner !== undefined) cleanPayload.owner = updates.owner;
    else if (updates.responsible !== undefined) cleanPayload.owner = updates.responsible;

    // Checklist sanitizado (apenas id, text, done)
    if (updates.checklist !== undefined) {
      cleanPayload.checklist = Array.isArray(updates.checklist)
        ? updates.checklist.map((item) => ({
            id: String(item.id || ''),
            text: String(item.text || ''),
            done: Boolean(item.done),
          }))
        : [];
    }

    // Google Meet e Data da Reunião (aceita meet_date, meeting_at ou meeting_start)
    if (updates.is_meeting !== undefined) cleanPayload.is_meeting = Boolean(updates.is_meeting);
    if (updates.meet_link !== undefined) cleanPayload.meet_link = updates.meet_link;
    if (updates.meeting_start !== undefined) cleanPayload.meeting_start = updates.meeting_start;
    else if (updates.meet_date !== undefined) cleanPayload.meeting_start = updates.meet_date;
    else if (updates.meeting_at !== undefined) cleanPayload.meeting_start = updates.meeting_at;

    if (updates.meeting_end !== undefined) cleanPayload.meeting_end = updates.meeting_end;

    // Remove estritamente id, client_id, created_at e qualquer chave undefined
    delete cleanPayload.id;
    delete cleanPayload.client_id;
    delete cleanPayload.created_at;

    Object.keys(cleanPayload).forEach((k) => {
      if (cleanPayload[k] === undefined) delete cleanPayload[k];
    });

    cleanPayload.updated_at = new Date().toISOString();

    let { data, error } = await supabase
      .from('tasks')
      .update(cleanPayload)
      .eq('id', taskId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Supabase update task error:', error);

      // Se o erro for de coluna inexistente no schema cache do Supabase (ex: start_date, responsible, etc.)
      const matchCol = error.message?.match(/Could not find the '([^']+)' column/i);
      if (matchCol && matchCol[1]) {
        const badCol = matchCol[1];
        delete cleanPayload[badCol];
        const retry = await supabase
          .from('tasks')
          .update(cleanPayload)
          .eq('id', taskId)
          .select()
          .maybeSingle();

        if (!retry.error) {
          return { ...(retry.data || {}), ...updates };
        }
        console.error('Supabase update task error:', retry.error);
        throw retry.error;
      }
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Supabase update task error:', err);
    throw err;
  }
}

/**
 * Atualiza o checklist de uma tarefa
 */
export async function updateTaskChecklist(taskId, checklist) {
  return updateTask(taskId, { checklist });
}

/**
 * Move a tarefa para outra etapa
 */
export async function moveTaskStage(taskId, stageId) {
  return updateTask(taskId, { stage_id: stageId });
}

/**
 * Chama a RPC clone_client_template para criar um novo cliente com modelo pré-configurado
 */
export async function createClientWithTemplate({
  name,
  contact_name,
  contact_phone,
  start_date,
  drive_folder_url = '',
  sheets_url = '',
}) {
  const { data, error } = await supabase.rpc('clone_client_template', {
    p_name: name,
    p_contact_name: contact_name || '',
    p_contact_phone: contact_phone ? contact_phone.replace(/\D/g, '') : '',
    p_start_date: start_date || new Date().toISOString().split('T')[0],
    p_drive_url: drive_folder_url || '',
    p_sheets_url: sheets_url || '',
  });

  if (error) {
    console.error('Erro ao clonar modelo de cliente:', error);
    throw error;
  }

  // Registra um log de automação para registrar o evento
  try {
    await supabase.from('automation_logs').insert({
      client_id: data,
      rule_name: 'Novo Cliente Manual',
      message: `Cliente "${name}" criado via modelo padrão POINT. Start com etapas e tarefas configuradas.`,
      integration: 'Painel Web + RPC',
    });
  } catch (logErr) {
    console.warn('Não foi possível gravar log automático:', logErr);
  }

  return data; // retorna o id do novo cliente
}

/**
 * Insere um novo cliente diretamente na tabela 'clients' do Supabase e retorna o registro criado (.select().single())
 */
export async function createClientRecord(clientData) {
  if (!clientData || !clientData.name) {
    throw new Error('Nome da empresa é obrigatório');
  }

  const insertPayload = {
    name: clientData.name.trim(),
    contact_name: clientData.contact_name?.trim() || clientData.responsible?.trim() || '',
    contact_phone: clientData.contact_phone ? String(clientData.contact_phone).replace(/\D/g, '') : '',
    start_date: clientData.start_date || new Date().toISOString().split('T')[0],
    cnpj: clientData.cnpj || '',
    city_state: clientData.city_state || clientData.city || '',
    segment: clientData.segment || '',
    status: clientData.status || 'Ativo',
  };

  // Remove qualquer chave undefined
  Object.keys(insertPayload).forEach((k) => {
    if (insertPayload[k] === undefined) delete insertPayload[k];
  });

  const { data, error } = await supabase
    .from('clients')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('Supabase create client error:', error.message || error);
    throw error;
  }

  // Cria imediatamente as 5 etapas e 8 tarefas padrão para o novo cliente persistido
  try {
    await applyDefaultStagesAndTasks(data.id);
  } catch (stageErr) {
    console.warn('Aviso ao aplicar modelo de etapas/tarefas ao novo cliente:', stageErr);
  }

  return data;
}

/**
 * Registra um evento de atividade na tabela activity_logs
 */
export async function logActivity({
  clientId = null,
  clientName = '',
  actionType = 'INFO',
  description = '',
  source = 'Plataforma',
}) {
  try {
    const payload = {
      client_id: clientId || null,
      client_name: clientName || '',
      action_type: actionType,
      description,
      source: source || 'Plataforma',
    };
    const { data, error } = await supabase
      .from('activity_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn('Erro ao registrar log de atividade:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Exceção ao registrar log de atividade:', err);
    return null;
  }
}

/**
 * Carrega o histórico de atividades da tabela activity_logs
 */
export async function getActivityLogs(clientId = null, limit = 100) {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao buscar histórico de atividades:', error);
    throw error;
  }
  return data || [];
}

/**
 * Cria uma nova tarefa na etapa
 */
export async function createTask({
  clientId,
  stageId,
  title,
  owner = 'POINT.',
  status = 'A Fazer',
  dueDate = null,
  startDate = null,
  checklist = [],
  description = '',
  position = 1,
  isMeeting = false,
  meetLink = null,
  meetingStart = null,
  meetingEnd = null,
}) {
  const insertPayload = {
    client_id: clientId,
    stage_id: stageId,
    title,
    owner,
    status,
    due_date: dueDate || new Date().toISOString().split('T')[0],
    checklist: checklist || [],
    description: description || '',
    position,
    is_meeting: isMeeting,
    meet_link: meetLink,
    meeting_start: meetingStart,
    meeting_end: meetingEnd,
    updated_at: new Date().toISOString(),
  };

  if (startDate) {
    insertPayload.start_date = startDate;
  }

  let { data, error } = await supabase
    .from('tasks')
    .insert(insertPayload)
    .select()
    .maybeSingle();

  if (error) {
    const matchCol = error.message?.match(/Could not find the '([^']+)' column/i);
    if (matchCol && matchCol[1]) {
      delete insertPayload[matchCol[1]];
      const retry = await supabase.from('tasks').insert(insertPayload).select().maybeSingle();
      if (!retry.error) return { ...retry.data, start_date: startDate };
      error = retry.error;
    }
  }

  if (error) {
    console.error('[Supabase createTask] error.message:', error.message || error);
    throw error;
  }
  return data;
}

/**
 * Exclui uma tarefa
 */
export async function deleteTask(taskId) {
  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Erro ao excluir tarefa:', error);
    throw error;
  }
  return data;
}

/**
 * Atualiza uma etapa (ex: renomear título)
 */
export async function updateStage(stageId, updates) {
  const { data, error } = await supabase
    .from('stages')
    .update(updates)
    .eq('id', stageId)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar etapa:', error);
    throw error;
  }
  return data;
}

/**
 * 5 Colunas Padrão no Estilo Trello de Implantação
 */
export const TRELLO_STAGES = [
  { position: 1, title: 'A Fazer', color: '#818CF8' },
  { position: 2, title: 'Em Andamento', color: '#3B82F6' },
  { position: 3, title: 'Aguardando Cliente', color: '#F59E0B' },
  { position: 4, title: 'Agendado', color: '#A855F7' },
  { position: 5, title: 'Concluído', color: '#10B981' },
];

// Compatibilidade retroativa
export const NEW_TEMPLATE_STAGES = TRELLO_STAGES;

/**
 * 8 Cards Padrão de Implantação na Sequência Cronológica Exata (1 a 8):
 * 1. Alinhamento Inicial e Cronograma (POINT. | Meet)
 * 2. Coleta de Dados e Colaboradores (Cliente)
 * 3. Migração de Histórico (AFD) (POINT.)
 * 4. Configuração de Jornadas e Regras (POINT.)
 * 5. Simulação e Validação (POINT.)
 * 6. Treinamento da Equipe e Gestores (POINT. | Meet)
 * 7. Go-Live (Início da Operação Oficial) (POINT.)
 * 8. Acompanhamento Assistido (30 dias) (POINT.)
 * Todos nascem zerados (0% de progresso) na coluna "A Fazer"
 */
export const DEFAULT_TRELLO_CARDS = [
  {
    title: 'Alinhamento Inicial e Cronograma',
    initial_column: 'A Fazer',
    position: 1,
    business_days: 2,
    owner: 'POINT.',
    is_meeting: true,
    description: 'Reunião de boas-vindas e alinhamento de escopo, regras e cronograma oficial da implantação.',
    checklist: [
      { id: '1', text: 'Realizar reunião de boas-vindas', done: false },
      { id: '2', text: 'Definir cronograma oficial', done: false },
    ],
  },
  {
    title: 'Coleta de Dados e Colaboradores',
    initial_column: 'A Fazer',
    position: 2,
    business_days: 4,
    owner: 'Cliente',
    is_meeting: false,
    description: 'Preenchimento da planilha de colaboradores e validação dos dados cadastrais.',
    checklist: [
      { id: '1', text: 'Preencher planilha de colaboradores', done: false },
      { id: '2', text: 'Validar dados cadastrais', done: false },
    ],
  },
  {
    title: 'Migração de Histórico (AFD)',
    initial_column: 'A Fazer',
    position: 3,
    business_days: 6,
    owner: 'POINT.',
    is_meeting: false,
    description: 'Recebimento e importação do arquivo AFD no sistema e conferência de marcações no painel POINT.',
    checklist: [
      { id: '1', text: 'Receber e importar arquivo AFD', done: false },
      { id: '2', text: 'Conferir marcações no painel POINT.', done: false },
    ],
  },
  {
    title: 'Configuração de Jornadas e Regras',
    initial_column: 'A Fazer',
    position: 4,
    business_days: 8,
    owner: 'POINT.',
    is_meeting: false,
    description: 'Cadastro de escalas e horários, perfis de acesso e fluxos de aprovação.',
    checklist: [
      { id: '1', text: 'Cadastrar escalas e horários', done: false },
      { id: '2', text: 'Configurar perfis de acesso e fluxos', done: false },
    ],
  },
  {
    title: 'Fluxos de Aprovação e EPIs',
    initial_column: 'A Fazer',
    position: 5,
    business_days: 10,
    owner: 'POINT.',
    is_meeting: false,
    description: 'Configuração dos fluxos hierárquicos de aprovação e parametrização de entrega de EPIs.',
    checklist: [
      { id: '1', text: 'Configurar fluxos de aprovação', done: false },
      { id: '2', text: 'Parametrizar controle de EPIs', done: false },
    ],
  },
  {
    title: 'Homologação e Testes Práticos',
    initial_column: 'A Fazer',
    position: 6,
    business_days: 12,
    owner: 'POINT.',
    is_meeting: false,
    description: 'Simulação de batidas, testes de regras de apontamento e validação de cenários reais.',
    checklist: [
      { id: '1', text: 'Simular batidas e cenários de ponto', done: false },
      { id: '2', text: 'Validar espelho e relatórios de homologação', done: false },
    ],
  },
  {
    title: 'Treinamento e Virada (Go-Live)',
    initial_column: 'A Fazer',
    position: 7,
    business_days: 15,
    owner: 'POINT.',
    is_meeting: true,
    description: 'Capacitação completa de gestores e RH, ativação oficial do sistema e início da operação.',
    checklist: [
      { id: '1', text: 'Realizar treinamento de gestores e RH', done: false },
      { id: '2', text: 'Confirmar virada de chave e primeiras batidas', done: false },
    ],
  },
  {
    title: 'Operação Assistida e Fechamento',
    initial_column: 'A Fazer',
    position: 8,
    business_days: 35,
    owner: 'POINT.',
    is_meeting: false,
    description: 'Acompanhamento assistido durante o primeiro ciclo e validação do 1º fechamento de folha.',
    checklist: [
      { id: '1', text: 'Acompanhar operação nos primeiros 30 dias', done: false },
      { id: '2', text: 'Validar primeiro fechamento de folha oficial', done: false },
    ],
  },
];

/**
 * Garante que o cliente possua as 5 etapas Trello e os 8 cards padrão,
 * todos zerados (0% de progresso) e na coluna "A Fazer".
 * Se hasAfd for false, garante obrigatoriamente que 100% dos 8 cards fiquem na primeira coluna ("A Fazer").
 * Previne duplicações de tarefas caso o banco já as tenha inserido via trigger/RPC.
 */
export async function applyDefaultStagesAndTasks(clientId, hasAfd = false) {
  if (!clientId || String(clientId).startsWith('temp-')) return;
  try {
    let { data: stages } = await supabase
      .from('stages')
      .select('*')
      .eq('client_id', clientId)
      .order('position', { ascending: true });

    if (!stages || stages.length === 0) {
      const toInsert = TRELLO_STAGES.map((st) => ({
        client_id: clientId,
        title: st.title,
        position: st.position,
        color: st.color,
      }));
      const { data: createdStages } = await supabase
        .from('stages')
        .insert(toInsert)
        .select()
        .order('position', { ascending: true });
      stages = createdStages || [];
    } else {
      // Sincroniza as 5 etapas padrão
      for (const stDef of TRELLO_STAGES) {
        const matchingStage = stages.find((s) => s.position === stDef.position);
        if (matchingStage) {
          if (matchingStage.title !== stDef.title || matchingStage.color !== stDef.color) {
            await supabase
              .from('stages')
              .update({ title: stDef.title, color: stDef.color })
              .eq('id', matchingStage.id);
            matchingStage.title = stDef.title;
            matchingStage.color = stDef.color;
          }
        } else {
          const { data: created } = await supabase
            .from('stages')
            .insert({
              client_id: clientId,
              title: stDef.title,
              position: stDef.position,
              color: stDef.color,
            })
            .select()
            .single();
          if (created) stages.push(created);
        }
      }

      // Se houver etapas extras (ex: posição > 5), reatribui tarefas para a etapa 1 e remove
      const extraStages = stages.filter((s) => s.position > 5);
      const firstStage = stages.find((s) => s.position === 1);
      for (const extra of extraStages) {
        if (firstStage) {
          await supabase
            .from('tasks')
            .update({ stage_id: firstStage.id })
            .eq('stage_id', extra.id);
        }
        await supabase.from('stages').delete().eq('id', extra.id);
      }
      stages = stages.filter((s) => s.position <= 5).sort((a, b) => a.position - b.position);
    }

    const firstStage = stages.find((s) => s.position === 1) || stages[0];
    if (!firstStage) return;

    // 1. Busca se JÁ EXISTEM tarefas para este cliente no banco de dados
    let { data: existingTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .order('position', { ascending: true });

    // Pequena espera e re-checagem para evitar race conditions com trigger ou RPC clone_client_template
    if (!existingTasks || existingTasks.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const { data: recheck } = await supabase
        .from('tasks')
        .select('*')
        .eq('client_id', clientId)
        .order('position', { ascending: true });
      if (recheck && recheck.length > 0) {
        existingTasks = recheck;
      }
    }

    const normalize = (t) =>
      t
        ? t
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
        : '';

    // Lista de títulos legados/mockados que devem ser sempre removidos
    const legacyTitlesToPurge = [
      'alinhamento inicial e escopo',
      'dados de colaboradores (40)',
      'configuracao de escalas e epis',
      'configuração de escalas e epis',
      'testes de fechamento simulado',
      'treinamento do time e go-live',
    ];

    if (existingTasks && existingTasks.length > 0) {
      // 1. Remove qualquer tarefa legada obsoleta
      const obsoleteTasks = existingTasks.filter((t) =>
        legacyTitlesToPurge.includes(normalize(t.title))
      );
      for (const obs of obsoleteTasks) {
        await supabase.from('tasks').delete().eq('id', obs.id);
      }

      let activeTasks = existingTasks.filter(
        (t) => !legacyTitlesToPurge.includes(normalize(t.title))
      );

      // 2. Deduplicação estrita: mapeia 1 única tarefa para cada uma das 8 posições (1 a 8)
      // Se houver mais de uma tarefa para o mesmo slot, exclui duplicatas excedentes (previne 14/16 tarefas)
      const slotMap = new Map();
      const duplicateIdsToDelete = [];

      for (const t of activeTasks) {
        let pos = typeof t.position === 'number' ? t.position : parseInt(t.position, 10);
        if (!pos || pos < 1 || pos > 8) {
          const norm = normalize(t.title);
          const matchIdx = DEFAULT_TRELLO_CARDS.findIndex(
            (c) =>
              normalize(c.title) === norm ||
              (normalize(c.title).includes('coleta de dados') && norm.includes('dados de colaboradores'))
          );
          if (matchIdx !== -1) {
            pos = matchIdx + 1;
          }
        }

        if (pos && pos >= 1 && pos <= 8) {
          if (slotMap.has(pos)) {
            // Duplicata encontrada para a posição pos: marca para exclusão
            duplicateIdsToDelete.push(t.id);
          } else {
            slotMap.set(pos, t);
          }
        }
      }

      if (duplicateIdsToDelete.length > 0) {
        for (const dupId of duplicateIdsToDelete) {
          await supabase.from('tasks').delete().eq('id', dupId);
        }
        activeTasks = activeTasks.filter((t) => !duplicateIdsToDelete.includes(t.id));
      }

      // 3. Atualiza ou completa os 8 cards padrão:
      // Se já existem 8 tarefas, NUNCA insere nenhuma nova tarefa!
      for (let i = 0; i < DEFAULT_TRELLO_CARDS.length; i++) {
        const cardDef = DEFAULT_TRELLO_CARDS[i];
        const pos = cardDef.position || i + 1;
        const matched = slotMap.get(pos);

        if (!matched && activeTasks.length < 8) {
          // Só insere se faltar estritamente um slot dos 8 com prazo em dias úteis
          const todayStr = getBrasiliaTodayStr();
          const taskDueDate = addBusinessDays(todayStr, cardDef.business_days || 2);
          const insertPayload = {
            client_id: clientId,
            stage_id: firstStage.id,
            title: cardDef.title,
            description: cardDef.description,
            owner: cardDef.owner,
            status: 'A Fazer',
            checklist: cardDef.checklist.map((item) => ({ ...item, done: false })),
            position: pos,
            is_meeting: Boolean(cardDef.is_meeting),
            start_date: todayStr,
            due_date: taskDueDate,
            updated_at: new Date().toISOString(),
          };

          try {
            const { error: insErr } = await supabase.from('tasks').insert(insertPayload);
            if (insErr && (insErr.message?.includes('start_date') || insErr.code === 'PGRST204')) {
              delete insertPayload.start_date;
              await supabase.from('tasks').insert(insertPayload);
            }
          } catch {}
        } else if (matched) {
          // Atualiza dados padronizados preservando a etapa, status e checklist caso a tarefa já tenha sido agendada ou movimentada
          const updates = {
            position: pos,
            title: cardDef.title,
            owner: cardDef.owner,
            is_meeting: Boolean(cardDef.is_meeting || matched.is_meeting),
          };

          // Apenas se o card não tiver etapa válida ou estiver nulo, vincula a firstStage
          if (!matched.stage_id) {
            updates.stage_id = firstStage.id;
          }

          // Se não possuir due_date prévia, calcula com base nos dias úteis da documentação
          if (!matched.due_date) {
            const todayStr = getBrasiliaTodayStr();
            updates.due_date = addBusinessDays(todayStr, cardDef.business_days || 2);
            updates.start_date = todayStr;
          }

          try {
            const { error: updErr } = await supabase
              .from('tasks')
              .update({
                ...updates,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matched.id);

            if (updErr && (updErr.message?.includes('start_date') || updErr.code === 'PGRST204')) {
              delete updates.start_date;
              await supabase
                .from('tasks')
                .update({
                  ...updates,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', matched.id);
            }
          } catch {}
        }
      }
    } else {
      // Nenhuma tarefa existente no banco: insere exatamente os 8 cards padrão em batch único
      const todayStr = getBrasiliaTodayStr();
      const initialTasks = DEFAULT_TRELLO_CARDS.map((cardDef, i) => ({
        client_id: clientId,
        stage_id: firstStage.id,
        title: cardDef.title,
        description: cardDef.description,
        owner: cardDef.owner,
        status: 'A Fazer',
        checklist: cardDef.checklist.map((item) => ({ ...item, done: false })),
        position: cardDef.position || i + 1,
        is_meeting: Boolean(cardDef.is_meeting),
        start_date: todayStr,
        due_date: addBusinessDays(todayStr, cardDef.business_days || 2),
        updated_at: new Date().toISOString(),
      }));

      try {
        const { error: batchErr } = await supabase.from('tasks').insert(initialTasks);
        if (batchErr && (batchErr.message?.includes('start_date') || batchErr.code === 'PGRST204')) {
          const stripped = initialTasks.map(({ start_date, ...rest }) => rest);
          await supabase.from('tasks').insert(stripped);
        }
      } catch (batchCatch) {
        if (batchCatch?.message?.includes('start_date') || batchCatch?.code === 'PGRST204') {
          const stripped = initialTasks.map(({ start_date, ...rest }) => rest);
          await supabase.from('tasks').insert(stripped);
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao aplicar modelo Trello de etapas e tarefas:', err);
  }
}

/**
 * Deduplica estritamente uma lista de tarefas por título normalizado (title.trim().toLowerCase()),
 * preservando dados de reuniões agendadas, progresso e ordenação por position (1 a 8).
 */
export function deduplicateAndSortTasks(taskList) {
  if (!Array.isArray(taskList)) return [];
  const map = new Map();

  for (const t of taskList) {
    if (!t) continue;
    const raw = (t.title || '').trim();
    if (!raw) continue;

    const norm = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Normalização canônica para evitar duplicação por pequenas variações
    let key = norm;
    if (norm.includes('coleta de dados') || norm.includes('dados de colaboradores')) {
      key = 'coleta de dados e colaboradores';
    } else if (norm.includes('migracao de historico') || norm.includes('arquivo afd')) {
      key = 'migracao de historico (afd)';
    } else if (norm.includes('alinhamento') && norm.includes('cronograma')) {
      key = 'alinhamento inicial e cronograma';
    }

    if (!map.has(key)) {
      map.set(key, t);
    } else {
      const existing = map.get(key);
      // Prioridade 1: quem tem meet_link ou status "Agendado"
      const tHasMeet = Boolean(t.meet_link || t.status === 'Agendado');
      const exHasMeet = Boolean(existing.meet_link || existing.status === 'Agendado');

      if (tHasMeet && !exHasMeet) {
        map.set(key, t);
      } else if (!exHasMeet) {
        // Prioridade 2: registro real vs temporário
        if (existing.isTemp && !t.isTemp) {
          map.set(key, t);
        } else if (!existing.isTemp && !t.isTemp) {
          // Prioridade 3: card com checklist mais avançado
          const tDone = Array.isArray(t.checklist) ? t.checklist.filter((i) => i.done).length : 0;
          const exDone = Array.isArray(existing.checklist) ? existing.checklist.filter((i) => i.done).length : 0;
          if (tDone > exDone) {
            map.set(key, t);
          } else {
            // Prioridade 4: mais recentemente atualizado
            const tTime = new Date(t.updated_at || t.created_at || 0).getTime();
            const exTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
            if (tTime > exTime) {
              map.set(key, t);
            }
          }
        }
      }
    }
  }

  // Ordena pelo campo position (1 a 8) de forma estritamente crescente
  return Array.from(map.values()).sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
}

/**
 * Conclui automaticamente a tarefa "Dados de Colaboradores" (ou "Migração de Histórico (AFD)")
 * movendo-a para a coluna "Concluído", marcando todos os itens do checklist e registrando no log.
 * Em seguida, dispara a Regra A encadeada!
 */
export async function completeAfdTaskForClient(clientId, source = 'Plataforma') {
  if (!clientId) return null;
  try {
    const { data: stages } = await supabase
      .from('stages')
      .select('*')
      .eq('client_id', clientId)
      .order('position', { ascending: true });

    const completedStage =
      stages?.find((s) => s.title === 'Concluído' || s.position === 5) ||
      stages?.[stages.length - 1];

    if (!completedStage) return null;

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId);

    const afdTask = tasks?.find(
      (t) =>
        t.title.toLowerCase().includes('coleta de dados') ||
        t.title.toLowerCase().includes('dados de colaboradores') ||
        t.title.toLowerCase().includes('planilha e arquivo afd') ||
        t.title.toLowerCase().includes('migração de histórico') ||
        t.title.toLowerCase().includes('migracao de historico') ||
        (t.title.toLowerCase().includes('afd') && t.title.toLowerCase().includes('envio'))
    );

    if (!afdTask) return null;

    const updatedChecklist = (Array.isArray(afdTask.checklist) ? afdTask.checklist : []).map(
      (item) => ({ ...item, done: true })
    );

    const { data: updated } = await supabase
      .from('tasks')
      .update({
        stage_id: completedStage.id,
        status: 'Concluído',
        checklist: updatedChecklist,
        updated_at: new Date().toISOString(),
      })
      .eq('id', afdTask.id)
      .select()
      .single();

    // Registra no activity_logs
    await logActivity({
      clientId,
      actionType: 'etapa_concluida',
      description: `Etapa "${afdTask.title}" concluída automaticamente via importação AFD.`,
      source: source || 'Plataforma',
    });

    // Dispara a Regra A (avança Configuração de Jornadas e Migração AFD para "Em Andamento")
    await executeChainedWorkflowRules({
      clientId,
      movedTaskTitle: afdTask.title,
      targetStageTitle: 'Concluído',
      source: source || 'Plataforma',
    });

    return updated;
  } catch (err) {
    console.warn('Erro ao concluir automaticamente tarefa AFD:', err);
    return null;
  }
}

/**
 * Executa as regras encadeadas de movimentação entre etapas e grava no activity_logs:
 * - Regra A: Quando "Dados de Colaboradores" (ou "Envio da Planilha e Arquivo AFD") vai para Concluído ->
 *   Avança "Configuração de Jornadas e Regras" e "Migração de Histórico (AFD)" de "A Fazer" para "Em Andamento".
 * - Regra B: Quando "Simulação e Validação" vai para Concluído ->
 *   Avança "Treinamento da Equipe e Gestores" de "A Fazer" para "Em Andamento".
 * - Regra C: Quando "Treinamento da Equipe e Gestores" vai para Concluído ->
 *   Avança "Go-Live (Início da Operação Oficial)" de "A Fazer" para "Em Andamento".
 * - Regra D: Quando "Go-Live (Início da Operação Oficial)" vai para Concluído ->
 *   Avança "Acompanhamento Assistido (30 dias)" de "A Fazer" para "Em Andamento".
 */
export async function executeChainedWorkflowRules({
  clientId,
  clientName = '',
  movedTaskTitle = '',
  targetStageTitle = '',
  source = 'Plataforma',
}) {
  if (!clientId || !targetStageTitle) return [];
  const isConcluido =
    targetStageTitle.toLowerCase() === 'concluído' ||
    targetStageTitle.toLowerCase() === 'concluido';

  if (!isConcluido) return [];

  try {
    const { data: stages } = await supabase
      .from('stages')
      .select('*')
      .eq('client_id', clientId)
      .order('position', { ascending: true });

    const aFazerStage = stages?.find((s) => s.position === 1 || s.title === 'A Fazer');
    const emAndamentoStage = stages?.find((s) => s.position === 2 || s.title === 'Em Andamento');

    if (!emAndamentoStage) return [];

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId);

    if (!tasks || tasks.length === 0) return [];

    const lowerMoved = movedTaskTitle.toLowerCase();
    const updatedTasks = [];

    // Função auxiliar para avançar tarefa de "A Fazer" para "Em Andamento"
    const advanceTaskToEmAndamento = async (taskMatcher, ruleName, targetTitle) => {
      const task = tasks.find(
        (t) =>
          taskMatcher(t.title.toLowerCase()) &&
          (aFazerStage ? t.stage_id === aFazerStage.id : t.status !== 'Concluído')
      );
      if (task) {
        const { data: updated } = await supabase
          .from('tasks')
          .update({
            stage_id: emAndamentoStage.id,
            status: 'Em Andamento',
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id)
          .select()
          .single();

        if (updated) {
          updatedTasks.push(updated);
          await logActivity({
            clientId,
            clientName,
            actionType: 'regra_workflow',
            description: `${ruleName}: Tarefa "${updated.title}" avançada automaticamente para "Em Andamento".`,
            source,
          });
        }
      }
    };

    // Regra A: Coleta de Dados / AFD -> Configuração de Jornadas e Regras + Migração de Histórico (AFD)
    if (
      lowerMoved.includes('coleta de dados') ||
      lowerMoved.includes('dados de colaboradores') ||
      lowerMoved.includes('planilha e arquivo afd') ||
      lowerMoved.includes('envio da planilha')
    ) {
      await advanceTaskToEmAndamento(
        (t) => t.includes('jornadas e regras') || t.includes('fluxos de aprovação') || t.includes('fluxos de aprovacao'),
        'Regra A',
        'Configuração de Jornadas e Regras'
      );
      await advanceTaskToEmAndamento(
        (t) => t.includes('migração de histórico') || t.includes('migracao de historico'),
        'Regra A',
        'Migração de Histórico (AFD)'
      );
    }

    // Regra B: Simulação e Validação / Homologação -> Treinamento
    if (
      lowerMoved.includes('simulação e validação') ||
      lowerMoved.includes('simulacao e validacao') ||
      lowerMoved.includes('homologação') ||
      lowerMoved.includes('homologacao') ||
      lowerMoved.includes('fluxos de aprovação')
    ) {
      await advanceTaskToEmAndamento(
        (t) => t.includes('treinamento') || t.includes('homologação') || t.includes('homologacao'),
        'Regra B',
        'Treinamento e Virada (Go-Live)'
      );
    }

    // Regra C: Treinamento e Virada -> Go-Live
    if (lowerMoved.includes('treinamento') || lowerMoved.includes('virada')) {
      await advanceTaskToEmAndamento(
        (t) => t.includes('go-live') || t.includes('inicio da operacao') || t.includes('início da operação') || t.includes('operação assistida') || t.includes('operacao assistida'),
        'Regra C',
        'Treinamento e Virada (Go-Live)'
      );
    }

    // Regra D: Go-Live -> Operação Assistida e Fechamento
    if (
      lowerMoved.includes('go-live') ||
      lowerMoved.includes('virada') ||
      lowerMoved.includes('inicio da operacao') ||
      lowerMoved.includes('início da operação')
    ) {
      await advanceTaskToEmAndamento(
        (t) => t.includes('operacao assistida') || t.includes('operação assistida') || t.includes('fechamento') || t.includes('acompanhamento assistido') || t.includes('30 dias'),
        'Regra D',
        'Operação Assistida e Fechamento'
      );
    }

    return updatedTasks;
  } catch (err) {
    console.warn('Erro ao executar regras encadeadas de workflow:', err);
    return [];
  }
}

