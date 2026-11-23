import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase,
  getClients,
  getStagesByClient,
  getTasksByClient,
  getAutomationLogs,
  updateTask,
  updateTaskChecklist,
  moveTaskStage,
  createTask,
  deleteTask,
  updateStage,
  logActivity,
  applyDefaultStagesAndTasks,
  executeChainedWorkflowRules,
  deduplicateAndSortTasks,
  createClientRecord,
  TRELLO_STAGES,
  DEFAULT_TRELLO_CARDS,
} from './lib/supabase';
import { syncClientMetadata } from './lib/pendingClientMeta.js';
import {
  isMeetingExpiredInBrasilia,
  isMeetingTodayInBrasilia,
  getBrasiliaTodayStr,
  addBusinessDays,
} from './lib/dateUtils';
import SplashCover from './components/SplashCover';
import Topbar from './components/Topbar';
import ClientContextBar from './components/ClientContextBar';
import SmartAlertBanner from './components/SmartAlertBanner';
import KpiCards from './components/KpiCards';
import KanbanBoard from './components/KanbanBoard';
import TaskDrawer from './components/TaskDrawer';
import TaskModal from './components/TaskModal';
import HistoryTab from './components/HistoryTab';
import NewClientModal from './components/NewClientModal';
import ImportEmployeesModal from './components/ImportEmployeesModal';
import DeleteClientModal from './components/DeleteClientModal';
import HelpModal from './components/HelpModal';
import PatriciaChat from './components/PatriciaChat';
import { Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  // Estado da tela de abertura (Splash Cover)
  const [coverOpen, setCoverOpen] = useState(true);

  // Estados principais
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const selectedClientRef = useRef(selectedClient);
  useEffect(() => {
    selectedClientRef.current = selectedClient;
  }, [selectedClient]);
  const [stages, setStages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);

  // Estados de UI
  const [activeTab, setActiveTab] = useState('fluxo'); // 'fluxo' | 'historico'
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalData, setTaskModalData] = useState(null);
  const [newTaskStageId, setNewTaskStageId] = useState('');
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isImportEmployeesOpen, setIsImportEmployeesOpen] = useState(false);
  const [isDeleteClientOpen, setIsDeleteClientOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Estados de carregamento e erro
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Helper para exibir toast sutil (duração curta e não obstrutiva)
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2200);
  };

  // Carrega lista inicial de clientes com deduplicação estrita
  const loadInitialData = async () => {
    try {
      setLoadingInitial(true);
      const clientsData = await getClients();
      // Sincroniza metadados pendentes com o Supabase caso tenham sido criados recentemente
      const syncedClients = await Promise.all(
        (clientsData || []).map(async (c) => await syncClientMetadata(c))
      );
      // Deduplicação pelo id e pelo nome
      const uniqueClients = [];
      const seenIds = new Set();
      const seenNames = new Set();
      for (const c of syncedClients || []) {
        const norm = c.name?.toLowerCase().trim();
        if (!seenIds.has(c.id) && !seenNames.has(norm)) {
          seenIds.add(c.id);
          seenNames.add(norm);
          uniqueClients.push(c);
        }
      }
      setClients(uniqueClients);

      if (uniqueClients.length > 0) {
        // Seleciona o primeiro cliente por padrão
        const defaultClient = uniqueClients[0];
        setSelectedClient(defaultClient);
      }
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
      showToast('Erro ao conectar ao Supabase.');
    } finally {
      setLoadingInitial(false);
    }
  };

  // Carrega etapas, tarefas e logs para o cliente selecionado
  const loadClientDetails = useCallback(async (client) => {
    if (!client) {
      setStages([]);
      setTasks([]);
      setLogs([]);
      return;
    }

    // Se o cliente for temporário (isTemp: true), renderiza instantaneamente as 5 etapas e 8 cards em memória
    if (client.isTemp) {
      const tempStages = TRELLO_STAGES.map((st) => ({
        id: `temp-stage-${st.position}`,
        position: st.position,
        title: st.title,
        color: st.color,
      }));
      const todayStr = getBrasiliaTodayStr();
      const tempTasks = DEFAULT_TRELLO_CARDS.map((card, idx) => ({
        id: `temp-task-${card.position || idx + 1}`,
        client_id: client.id,
        stage_id: tempStages[0].id,
        title: card.title,
        owner: card.owner,
        status: 'A Fazer',
        position: card.position || idx + 1,
        is_meeting: Boolean(card.is_meeting),
        description: card.description,
        checklist: card.checklist.map((item) => ({ ...item, done: false })),
        start_date: todayStr,
        due_date: addBusinessDays(todayStr, card.business_days || 2),
        created_at: new Date().toISOString(),
      }));
      setStages(tempStages);
      setTasks(tempTasks);
      setLogs([]);
      return;
    }

    try {
      setLoadingTasks(true);
      let [stagesData, tasksData, logsData] = await Promise.all([
        getStagesByClient(client.id),
        getTasksByClient(client.id),
        getAutomationLogs(client.id),
      ]);

      const hasTrelloStages =
        stagesData &&
        stagesData.length === 5 &&
        stagesData[0]?.title === 'A Fazer';

      // 2. Garantir Exatamente 8 Tarefas (Sem Duplicar para 14/16):
      // Verifica se tarefas já existem no banco antes de sincronizar/inserir.
      // Só executa applyDefaultStagesAndTasks se:
      // - Etapas estiverem incompletas
      // - Não houver nenhuma tarefa no banco (tasksData.length === 0)
      // - Houver mais de 8 tarefas (duplicação detectada > 8)
      if (!hasTrelloStages || !tasksData || tasksData.length === 0 || tasksData.length > 8) {
        await applyDefaultStagesAndTasks(client.id);
        [stagesData, tasksData] = await Promise.all([
          getStagesByClient(client.id),
          getTasksByClient(client.id),
        ]);
      }

      setStages(stagesData || []);
      setTasks(deduplicateAndSortTasks(tasksData || []));
      setLogs(logsData || []);

      // Se havia uma tarefa selecionada na gaveta, atualiza-a com dados frescos
      setSelectedTask((prev) => {
        if (!prev) return null;
        return (tasksData || []).find((t) => t.id === prev.id) || prev;
      });
    } catch (err) {
      console.error('Erro ao carregar detalhes do cliente:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  // Executa carga inicial
  useEffect(() => {
    loadInitialData();
  }, []);

  // Recarrega etapas e tarefas ao mudar o cliente selecionado
  useEffect(() => {
    if (selectedClient) {
      loadClientDetails(selectedClient);
    }
  }, [selectedClient, loadClientDetails]);

  // Configura inscrições Real-Time no Supabase para as tabelas `tasks`, `clients` e `automation_logs`
  useEffect(() => {
    console.log('Iniciando inscrições em tempo real do Supabase...');

    // Canal único para as 3 tabelas
    const channel = supabase
      .channel('point-realtime-channel')
      // Tabela TASKS
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('[Realtime] Alteração em tasks:', payload);
          const currentSelected = selectedClientRef.current;
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new;
            setTasks((prev) => {
              if (currentSelected && newTask.client_id !== currentSelected.id) return prev;
              return deduplicateAndSortTasks([...prev, newTask]);
            });
            showToast(`Nova tarefa: "${payload.new.title}"`);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setTasks((prev) =>
              deduplicateAndSortTasks(prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
            );
            setSelectedTask((prev) =>
              prev && prev.id === updated.id ? { ...prev, ...updated } : prev
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            setTasks((prev) => prev.filter((t) => t.id !== deletedId));
            setSelectedTask((prev) => (prev && prev.id === deletedId ? null : prev));
          }
        }
      )
      // Tabela CLIENTS
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        (payload) => {
          console.log('[Realtime] Alteração em clients:', payload);
          if (payload.eventType === 'INSERT') {
            const rawNewClient = payload.new;
            syncClientMetadata(rawNewClient).then((newClient) => {
              setClients((prev) => {
                // 1. Evita duplicata por id
                if (prev.some((c) => c.id === newClient.id)) return prev;

                const normName = newClient.name?.toLowerCase().trim();

                // 2. Se houver item temporário (isTemp: true) com o mesmo nome, substitui pelo cliente real
                const hasTemp = prev.some(
                  (c) => c.isTemp && c.name?.toLowerCase().trim() === normName
                );

                if (hasTemp) {
                  return prev.map((c) =>
                    c.isTemp && c.name?.toLowerCase().trim() === normName
                      ? newClient
                      : c
                  );
                }

                // 3. Remove duplicatas de mesmo nome mantendo o mais recente
                const filtered = prev.filter(
                  (c) => c.name?.toLowerCase().trim() !== normName
                );

                return [newClient, ...filtered];
              });

              // Se o selectedClient atual for o temporário (ou mesmo ID), atualiza para o cliente real
              setSelectedClient((current) => {
                if (
                  current &&
                  (current.id === newClient.id ||
                    (current.isTemp &&
                      current.name?.toLowerCase().trim() ===
                        newClient.name?.toLowerCase().trim()))
                ) {
                  return newClient;
                }
                return current;
              });

              showToast(`Novo cliente adicionado: ${newClient.name}`);
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setClients((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
            setSelectedClient((prev) =>
              prev && prev.id === updated.id ? { ...prev, ...updated } : prev
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setClients((prev) => {
                const remaining = prev.filter((c) => c.id !== deletedId);
                // Se o cliente deletado for o selecionado, troca imediatamente para o próximo disponível
                setSelectedClient((current) => {
                  if (current && current.id === deletedId) {
                    return remaining.length > 0 ? remaining[0] : null;
                  }
                  return current;
                });
                return remaining;
              });
              showToast('Empresa removida no Supabase.');
            }
          }
        }
      )
      // Tabela AUTOMATION_LOGS
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'automation_logs' },
        (payload) => {
          console.log('[Realtime] Novo log de automação:', payload);
          setLogs((prev) => [payload.new, ...prev]);
          showToast(`Automação executada: ${payload.new.rule_name || 'Evento n8n'}`);
        }
      )
      .subscribe((status) => {
        console.log('Status da conexão Realtime:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Polling leve a cada 3 segundos enquanto os links do Drive/Sheets do cliente ativo ainda estiverem vazios
  useEffect(() => {
    if (!selectedClient || selectedClient.isTemp || !selectedClient.id) return;

    // Se ambos os links já estiverem presentes, não é necessário polling frequente
    const hasDrive = Boolean(selectedClient.drive_folder_url);
    const hasSheets = Boolean(selectedClient.sheets_url);
    if (hasDrive && hasSheets) return;

    const interval = setInterval(async () => {
      try {
        const { data: fresh, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', selectedClient.id)
          .single();

        if (!error && fresh) {
          const synced = await syncClientMetadata(fresh);
          const driveUpdated = synced.drive_folder_url && synced.drive_folder_url !== selectedClient.drive_folder_url;
          const sheetsUpdated = synced.sheets_url && synced.sheets_url !== selectedClient.sheets_url;
          const cnpjUpdated = synced.cnpj && synced.cnpj !== selectedClient.cnpj;
          const cityUpdated = synced.city_state && synced.city_state !== selectedClient.city_state;
          const segmentUpdated = synced.segment && synced.segment !== selectedClient.segment;

          if (driveUpdated || sheetsUpdated || cnpjUpdated || cityUpdated || segmentUpdated) {
            setSelectedClient((current) => (current && current.id === synced.id ? { ...current, ...synced } : current));
            setClients((prev) => prev.map((c) => (c.id === synced.id ? { ...c, ...synced } : c)));
          }
        }
      } catch (err) {
        console.warn('Erro no polling leve de links:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedClient?.id, selectedClient?.drive_folder_url, selectedClient?.sheets_url]);

  // Verificação periódica a cada 10 segundos na lista de clientes (sincronização reversa com Google Drive / n8n)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const freshClients = await getClients();
        const syncedList = await Promise.all(
          (freshClients || []).map(async (c) => await syncClientMetadata(c))
        );
        const freshMap = new Map(syncedList.map((c) => [c.id, c]));

        setClients((prev) => {
          // Mantém apenas clientes existentes no Supabase ou clientes temporários em transição (isTemp)
          const valid = prev.filter((c) => c.isTemp || freshMap.has(c.id));

          // Se algum cliente desapareceu do Supabase
          if (valid.length !== prev.length) {
            setSelectedClient((current) => {
              if (current && !current.isTemp && !freshMap.has(current.id)) {
                return valid.length > 0 ? valid[0] : null;
              }
              return current;
            });
            return valid;
          }

          // Atualiza dados complementares se houver alteração (ex: URLs do Drive/Sheets geradas pelo n8n)
          let hasDiff = false;
          const merged = valid.map((c) => {
            if (c.isTemp) return c;
            const fresh = freshMap.get(c.id);
            if (
              fresh &&
              (fresh.name !== c.name ||
                fresh.status !== c.status ||
                fresh.drive_folder_url !== c.drive_folder_url ||
                fresh.sheets_url !== c.sheets_url ||
                fresh.cnpj !== c.cnpj ||
                fresh.city_state !== c.city_state ||
                fresh.segment !== c.segment)
            ) {
              hasDiff = true;
              return { ...c, ...fresh };
            }
            return c;
          });

          return hasDiff ? merged : prev;
        });

        // Garantia adicional: atualiza o cliente ativo se houver mudanças nos dados ou se desapareceu
        setSelectedClient((current) => {
          if (!current || current.isTemp) return current;
          if (!freshMap.has(current.id)) {
            return freshClients.length > 0 ? freshClients[0] : null;
          }
          const fresh = freshMap.get(current.id);
          if (
            fresh &&
            (fresh.drive_folder_url !== current.drive_folder_url ||
              fresh.sheets_url !== current.sheets_url ||
              fresh.status !== current.status ||
              fresh.cnpj !== current.cnpj ||
              fresh.city_state !== current.city_state ||
              fresh.segment !== current.segment)
          ) {
            return { ...current, ...fresh };
          }
          return current;
        });
      } catch (err) {
        console.warn('Erro na verificação periódica de clientes:', err);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  // Verificação periódica de reuniões expiradas utilizando estritamente o fuso de Brasília (America/Sao_Paulo, -03:00)
  // Garante que reuniões agendadas para hoje mais tarde ou para dias futuros NUNCA sejam movidas para Concluído!
  useEffect(() => {
    if (!selectedClient || selectedClient.isTemp || !tasks || tasks.length === 0) return;

    const checkPastMeetings = async () => {
      const agendadoStage = stages.find(
        (s) => s.position === 4 || s.title?.toLowerCase().includes('agendado')
      );
      const concluidoStage = stages.find(
        (s) => s.position === 5 || s.title?.toLowerCase().includes('conclu')
      );

      if (!concluidoStage) return;

      for (const t of tasks) {
        // Apenas avalia cards na coluna Agendado ou marcados como status Agendado com link de reunião
        const inAgendado = agendadoStage && t.stage_id === agendadoStage.id;
        const isStatusAgendado = t.status === 'Agendado';
        if (!inAgendado && !isStatusAgendado) continue;
        if (!t.is_meeting || !t.meet_link) continue;

        // Compara com o horário atual de Brasília:
        // Retorna FALSE para reuniões de hoje mais tarde ou dias futuros!
        const expired = isMeetingExpiredInBrasilia(t.meeting_end, t.meeting_start);
        if (!expired) {
          // Reunião ainda vai acontecer: permanece intacta na coluna "Agendado"
          continue;
        }

        // Se a reunião já terminou (passou do horário final no fuso de Brasília):
        try {
          const updatedChecklist = (Array.isArray(t.checklist) ? t.checklist : []).map(
            (item) => ({ ...item, done: true })
          );

          await updateTask(t.id, {
            stage_id: concluidoStage.id,
            status: 'Concluído',
            checklist: updatedChecklist,
          });

          setTasks((prev) =>
            deduplicateAndSortTasks(
              prev.map((card) =>
                card.id === t.id
                  ? {
                      ...card,
                      stage_id: concluidoStage.id,
                      status: 'Concluído',
                      checklist: updatedChecklist,
                    }
                  : card
              )
            )
          );

          logActivity({
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            actionType: 'reuniao_encerrada',
            description: `Reunião "${t.title}" encerrada no horário programado e movida para Concluído.`,
            source: 'Sistema',
          });
        } catch (e) {
          console.error('[Conclusão Automática] Erro ao mover reunião expirada para Concluído:', e);
        }
      }
    };

    checkPastMeetings();
    const interval = setInterval(checkPastMeetings, 60000);
    return () => clearInterval(interval);
  }, [selectedClient?.id, tasks, stages]);

  // Ações de Tarefa e Modal de Edição/Criação
  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setTaskModalData(task);
    setNewTaskStageId(task.stage_id);
    setIsTaskModalOpen(true);
  };

  const handleNewTask = (stageId) => {
    setTaskModalData(null);
    setNewTaskStageId(stageId);
    setIsTaskModalOpen(true);
  };

  const handleSaveTaskModal = async (taskData, isNew, taskId) => {
    if (!selectedClient) return;

    const concluidoStage = stages.find(
      (s) =>
        s.title?.toLowerCase() === 'concluído' ||
        s.title?.toLowerCase() === 'concluido' ||
        s.position === 5
    );

    const isAllDone =
      Array.isArray(taskData.checklist) &&
      taskData.checklist.length > 0 &&
      taskData.checklist.every((i) => i.done);

    const agendadoStage = stages.find(
      (s) => s.position === 4 || s.title?.toLowerCase().includes('agendado')
    );

    let finalStageId = taskData.stage_id;
    const targetStageObj = stages.find((s) => s.id === finalStageId);
    let finalStatus = taskData.status;

    // Se todos os itens do checklist estão concluídos, move para Concluído automaticamente
    if (isAllDone && concluidoStage) {
      finalStageId = concluidoStage.id;
      finalStatus = 'Concluído';
    } else if (
      agendadoStage &&
      ((taskData.is_meeting && taskData.meet_link) || taskData.status === 'Agendado')
    ) {
      finalStageId = agendadoStage.id;
      finalStatus = 'Agendado';
    } else if (targetStageObj) {
      const pos = targetStageObj.position;
      const sTitle = (targetStageObj.title || '').toLowerCase();
      if (pos === 5 || sTitle.includes('conclu')) finalStatus = 'Concluído';
      else if (pos === 4 || sTitle.includes('agendado')) finalStatus = 'Agendado';
      else if (pos === 3 || sTitle.includes('aguardando')) finalStatus = 'Aguardando Cliente';
      else if (pos === 2 || sTitle.includes('andamento')) finalStatus = 'Em Andamento';
      else finalStatus = 'A Fazer';
    }

    if (isNew) {
      try {
        const created = await createTask({
          clientId: selectedClient.id,
          stageId: finalStageId,
          title: taskData.title,
          owner: taskData.owner,
          status: finalStatus,
          startDate: taskData.start_date,
          dueDate: taskData.due_date,
          checklist: taskData.checklist,
          isMeeting: taskData.is_meeting,
          meetLink: taskData.meet_link,
          meetingStart: taskData.meeting_start,
          meetingEnd: taskData.meeting_end,
        });

        setTasks((prev) => deduplicateAndSortTasks([...prev, created]));
        const targetStage = stages.find((s) => s.id === finalStageId);
        const stageName = targetStage?.title || 'Etapa';

        showToast(`Tarefa "${taskData.title}" criada.`);

        logActivity({
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          actionType: isAllDone ? 'etapa_concluida' : 'TASK_CREATED',
          description: isAllDone
            ? `Etapa "${taskData.title}" criada e concluída com 100% do checklist finalizado!`
            : `Nova tarefa "${taskData.title}" criada na etapa "${stageName}".`,
          source: 'Plataforma',
        });

        // Se nasceu ou foi salva como Concluída, avalia regras encadeadas
        if (finalStatus === 'Concluído') {
          const chained = await executeChainedWorkflowRules({
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            movedTaskTitle: taskData.title,
            targetStageTitle: 'Concluído',
            source: 'Plataforma',
          });
          if (chained && chained.length > 0) {
            setTasks((prev) =>
              prev.map((t) => {
                const found = chained.find((c) => c.id === t.id);
                return found ? { ...t, ...found } : t;
              })
            );
            chained.forEach((c) => {
              showToast(`Regra de workflow: "${c.title}" avançou para Em Andamento!`);
            });
          }
        }
        return created;
      } catch (err) {
        console.error('Erro ao criar tarefa:', err);
        showToast('Falha ao criar tarefa no banco.');
      }
    } else {
      try {
        const updated = await updateTask(taskId, {
          title: taskData.title,
          stage_id: finalStageId,
          owner: taskData.owner,
          status: finalStatus,
          start_date: taskData.start_date,
          due_date: taskData.due_date,
          checklist: taskData.checklist,
          is_meeting: taskData.is_meeting,
          meet_link: taskData.meet_link,
          meeting_start: taskData.meeting_start,
          meeting_end: taskData.meeting_end,
        });

        setTasks((prev) =>
          deduplicateAndSortTasks(prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)))
        );
        showToast(`Tarefa "${taskData.title}" atualizada.`);

        logActivity({
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          actionType: isAllDone ? 'etapa_concluida' : 'TASK_UPDATED',
          description: isAllDone
            ? `Etapa "${taskData.title}" concluída com 100% do checklist finalizado!`
            : `Tarefa "${taskData.title}" atualizada.`,
          source: 'Plataforma',
        });

        // Se foi salva como Concluída, avalia regras encadeadas
        if (finalStatus === 'Concluído') {
          const chained = await executeChainedWorkflowRules({
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            movedTaskTitle: taskData.title,
            targetStageTitle: 'Concluído',
            source: 'Plataforma',
          });
          if (chained && chained.length > 0) {
            setTasks((prev) =>
              prev.map((t) => {
                const found = chained.find((c) => c.id === t.id);
                return found ? { ...t, ...found } : t;
              })
            );
            chained.forEach((c) => {
              showToast(`Regra de workflow: "${c.title}" avançou para Em Andamento!`);
            });
          }
        }
        return updated;
      } catch (err) {
        console.error('Erro ao atualizar tarefa:', err);
        showToast(err?.message ? `Falha ao atualizar tarefa: ${err.message}` : 'Falha ao atualizar tarefa no banco.');
      }
    }
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
      showToast(`Tarefa "${taskTitle}" excluída.`);

      logActivity({
        clientId: selectedClient?.id,
        clientName: selectedClient?.name,
        actionType: 'TASK_DELETED',
        description: `Tarefa "${taskTitle}" excluída do Kanban.`,
        source: 'Plataforma',
      });
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
      showToast('Falha ao excluir tarefa.');
      if (selectedClient) loadClientDetails(selectedClient);
    }
  };

  const handleRenameStage = async (stageId, newTitle) => {
    const oldStage = stages.find((s) => s.id === stageId);
    const oldTitle = oldStage?.title || 'Etapa';

    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, title: newTitle } : s))
    );

    try {
      await updateStage(stageId, { title: newTitle });
      showToast(`Etapa renomeada para "${newTitle}"`);

      logActivity({
        clientId: selectedClient?.id,
        clientName: selectedClient?.name,
        actionType: 'STAGE_RENAMED',
        description: `Etapa "${oldTitle}" renomeada para "${newTitle}".`,
        source: 'Plataforma',
      });
    } catch (err) {
      console.error('Erro ao renomear etapa:', err);
      showToast('Falha ao renomear etapa no banco.');
      if (selectedClient) loadClientDetails(selectedClient);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    // Busca a tarefa para descrição rica
    const task = tasks.find((t) => t.id === taskId);
    const taskTitle = task?.title || 'Tarefa';

    // Atualização otimista
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({ ...prev, status: newStatus }));
    }

    try {
      await updateTask(taskId, { status: newStatus });

      // Gravação na tabela activity_logs
      const logDescription =
        newStatus === 'Concluído'
          ? `Etapa "${taskTitle}" marcada como concluída.`
          : `Etapa "${taskTitle}" reaberta (status: ${newStatus}).`;

      logActivity({
        clientId: selectedClient?.id,
        clientName: selectedClient?.name,
        actionType: newStatus === 'Concluído' ? 'TASK_COMPLETED' : 'TASK_REOPENED',
        description: logDescription,
        source: 'Plataforma',
      });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      showToast('Falha ao atualizar status no Supabase.');
      if (selectedClient) loadClientDetails(selectedClient);
    }
  };

  const handleUpdateTaskStage = async (taskId, newStageId) => {
    const task = tasks.find((t) => t.id === taskId);
    const stage = stages.find((s) => s.id === newStageId);
    if (!task || !stage) return;

    const sTitle = (stage.title || '').toLowerCase();
    const pos = stage.position;

    let updatedStatus = 'A Fazer';
    if (pos === 5 || sTitle.includes('conclu')) {
      updatedStatus = 'Concluído';
    } else if (pos === 4 || sTitle.includes('agendado')) {
      updatedStatus = 'Agendado';
    } else if (pos === 3 || sTitle.includes('aguardando')) {
      updatedStatus = 'Aguardando Cliente';
    } else if (pos === 2 || sTitle.includes('andamento')) {
      updatedStatus = 'Em Andamento';
    } else {
      updatedStatus = 'A Fazer';
    }

    const isTargetConcluido = updatedStatus === 'Concluído';
    const isTargetAgendado = updatedStatus === 'Agendado';

    // Atualização otimista
    setTasks((prev) =>
      deduplicateAndSortTasks(
        prev.map((t) =>
          t.id === taskId ? { ...t, stage_id: newStageId, status: updatedStatus } : t
        )
      )
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({
        ...prev,
        stage_id: newStageId,
        status: updatedStatus,
      }));
    }

    try {
      await updateTask(taskId, {
        stage_id: newStageId,
        status: updatedStatus,
      });

      logActivity({
        clientId: selectedClient?.id,
        clientName: selectedClient?.name,
        actionType: isTargetConcluido ? 'etapa_concluida' : 'TASK_MOVED',
        description: isTargetConcluido
          ? `Etapa "${task.title}" movida para Concluído.`
          : `Tarefa "${task.title}" movida para a coluna "${stage.title}".`,
        source: 'Plataforma',
      });

      // Se a tarefa foi movida para Concluído, dispara regras encadeadas
      if (isTargetConcluido) {
        const chained = await executeChainedWorkflowRules({
          clientId: selectedClient?.id,
          clientName: selectedClient?.name,
          movedTaskTitle: task.title,
          targetStageTitle: 'Concluído',
          source: 'Plataforma',
        });
        if (chained && chained.length > 0) {
          setTasks((prev) =>
            prev.map((t) => {
              const found = chained.find((c) => c.id === t.id);
              return found ? { ...t, ...found } : t;
            })
          );
          chained.forEach((c) => {
            showToast(`Regra de workflow: "${c.title}" avançou para Em Andamento!`);
          });
        }
      }
    } catch (err) {
      console.error('Erro ao mover etapa:', err);
      showToast(err?.message ? `Falha ao mover etapa: ${err.message}` : 'Falha ao mover etapa no banco.');
      if (selectedClient) loadClientDetails(selectedClient);
    }
  };

  const handleUpdateTaskChecklist = async (taskId, newChecklist) => {
    const task = tasks.find((t) => t.id === taskId);
    const oldChecklist = task?.checklist || [];

    const isAllDone =
      Array.isArray(newChecklist) &&
      newChecklist.length > 0 &&
      newChecklist.every((item) => item.done);

    const concluidoStage = stages.find(
      (s) =>
        s.title?.toLowerCase() === 'concluído' ||
        s.title?.toLowerCase() === 'concluido' ||
        s.position === 5
    );

    const shouldAutoMove = isAllDone && concluidoStage && task?.stage_id !== concluidoStage.id;

    const nextStageId = shouldAutoMove ? concluidoStage.id : task?.stage_id;
    const nextStatus = isAllDone ? 'Concluído' : task?.status;

    // Atualização otimista
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, checklist: newChecklist, stage_id: nextStageId, status: nextStatus }
          : t
      )
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({
        ...prev,
        checklist: newChecklist,
        stage_id: nextStageId,
        status: nextStatus,
      }));
    }

    try {
      if (shouldAutoMove) {
        await updateTask(taskId, {
          checklist: newChecklist,
          stage_id: concluidoStage.id,
          status: 'Concluído',
        });
        showToast(`Etapa "${task.title}" concluída e movida para Concluído! 🎉`);
        await logActivity({
          clientId: selectedClient?.id,
          clientName: selectedClient?.name,
          actionType: 'etapa_concluida',
          description: `Etapa "${task.title}" concluída com 100% do checklist finalizado!`,
          source: 'Plataforma',
        });

        // Dispara regras encadeadas quando checklist conclui a tarefa
        const chained = await executeChainedWorkflowRules({
          clientId: selectedClient?.id,
          clientName: selectedClient?.name,
          movedTaskTitle: task.title,
          targetStageTitle: 'Concluído',
          source: 'Plataforma',
        });
        if (chained && chained.length > 0) {
          setTasks((prev) =>
            prev.map((t) => {
              const found = chained.find((c) => c.id === t.id);
              return found ? { ...t, ...found } : t;
            })
          );
          chained.forEach((c) => {
            showToast(`Regra de workflow: "${c.title}" avançou para Em Andamento!`);
          });
        }
      } else {
        await updateTaskChecklist(taskId, newChecklist);

        // Detecta item alternado para log
        const toggled = newChecklist.find((newItem) => {
          const oldItem = oldChecklist.find((o) => o.id === newItem.id);
          return oldItem && oldItem.done !== newItem.done;
        });

        if (toggled && task) {
          const desc = toggled.done
            ? `Item "${toggled.text}" marcado como concluído no checklist da tarefa "${task.title}".`
            : `Item "${toggled.text}" reaberto no checklist da tarefa "${task.title}".`;

          logActivity({
            clientId: selectedClient?.id,
            clientName: selectedClient?.name,
            actionType: 'CHECKLIST_TOGGLED',
            description: desc,
            source: 'Plataforma',
          });
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar checklist:', err);
      showToast(err?.message ? `Falha ao salvar checklist: ${err.message}` : 'Falha ao salvar checklist.');
      if (selectedClient) loadClientDetails(selectedClient);
    }
  };

  // Callback ao criar um novo cliente (Persistência no Supabase antes de atualizar o estado com id real)
  const handleClientCreated = async (newClientId, newClientObj = null) => {
    try {
      let finalClient = newClientObj;

      // Se for temporário ou ainda sem persistência direta no Supabase, insere e aguarda retorno
      if (newClientObj && (newClientObj.isTemp || String(newClientId).startsWith('temp-'))) {
        try {
          const persisted = await createClientRecord(newClientObj);
          if (persisted && persisted.id) {
            finalClient = persisted;
          }
        } catch (insertErr) {
          console.error('Supabase create client error:', insertErr);
          showToast(`Falha ao cadastrar cliente no banco: ${insertErr.message || 'Erro de conexão'}`);
          return;
        }
      }

      if (finalClient) {
        setClients((prev) => {
          const normName = finalClient.name?.toLowerCase().trim();
          // Remove qualquer item temporário isTemp com o mesmo nome, ou duplicata de mesmo id
          const filtered = prev.filter(
            (c) =>
              c.id !== newClientId &&
              c.id !== finalClient.id &&
              !(c.isTemp && c.name?.toLowerCase().trim() === normName)
          );
          return [finalClient, ...filtered];
        });
        setSelectedClient(finalClient);
        await loadClientDetails(finalClient);
      } else {
        const refreshedClients = await getClients();
        setClients(refreshedClients);
        const newlyCreated =
          refreshedClients.find((c) => c.id === newClientId) || refreshedClients[0];
        if (newlyCreated) {
          setSelectedClient(newlyCreated);
          await loadClientDetails(newlyCreated);
        }
      }
      showToast('Cliente cadastrado e salvo no Supabase com sucesso!');
    } catch (err) {
      console.error('Erro ao processar cliente:', err);
      showToast(`Erro ao registrar cliente: ${err.message || 'Falha no banco'}`);
    }
  };

  // Callback ao excluir o cliente selecionado
  const handleClientDeleted = (deletedClientId) => {
    setClients((prev) => {
      const remaining = prev.filter((c) => c.id !== deletedClientId);
      if (selectedClient?.id === deletedClientId) {
        setSelectedClient(remaining.length > 0 ? remaining[0] : null);
      }
      return remaining;
    });
    showToast('Cliente e arquivos do Drive removidos com sucesso.');
  };

  // Callback ao atualizar o status do cliente
  const handleUpdateClientStatus = async (newStatus) => {
    if (!selectedClient) return;

    const clientId = selectedClient.id;
    const clientName = selectedClient.name;
    const oldStatus = selectedClient.status || 'Ativo';

    // 1. Atualização otimista na UI
    const updatedClient = { ...selectedClient, status: newStatus };
    setSelectedClient(updatedClient);
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
    );

    // 2. Toast discreto
    showToast('Status atualizado na plataforma e no Google Sheets');

    // 3. Registro no activity_logs do Supabase
    logActivity({
      clientId,
      clientName,
      actionType: 'STATUS_UPDATED',
      description: `Status alterado de ${oldStatus} para ${newStatus}.`,
      source: 'Plataforma',
    });

    // 4. POST para o webhook do n8n
    try {
      await fetch('http://localhost:5678/webhook/status-cliente-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          name: clientName,
          status: newStatus,
        }),
      });
    } catch (webhookErr) {
      console.warn('Erro ao notificar webhook status-cliente-point:', webhookErr);
    }

    // 5. Persistência no Supabase
    try {
      await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId);
    } catch (dbErr) {
      console.error('Erro ao persistir status no Supabase:', dbErr);
    }
  };

  // Callback de recarregamento para ações da Patrícia IA
  const handleReloadClients = async () => {
    try {
      const refreshedClients = await getClients();
      setClients(refreshedClients);
      if (refreshedClients.length > 0) {
        const stillSelected = selectedClient
          ? refreshedClients.find((c) => c.id === selectedClient.id)
          : null;
        const targetClient = stillSelected || refreshedClients[0];
        setSelectedClient(targetClient);
        await loadClientDetails(targetClient);
      } else {
        setSelectedClient(null);
      }
      showToast('Dados atualizados pela Patrícia IA.');
    } catch (err) {
      console.error('Erro ao recarregar dados do Supabase:', err);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F8FAFC] text-[#18181B] flex flex-col relative font-sans">
      {/* 1. Tela de Entrada Animada (Splash / Cover) */}
      <SplashCover
        isOpen={coverOpen}
        onEnter={() => setCoverOpen(false)}
      />

      {/* 2. Cabeçalho Superior Fixo (Topbar ultra-limpo com sininho de eventos críticos) */}
      <Topbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onShowCover={() => setCoverOpen(true)}
        tasks={tasks}
        client={selectedClient}
        onSelectTask={handleSelectTask}
        pendingCount={tasks.filter((t) => t.status !== 'Concluído').length}
      />

      {/* 3. Conteúdo Principal da Plataforma */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col min-h-0 overflow-hidden">
        {loadingInitial ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-[#818CF8] animate-spin" />
            <span className="text-sm font-semibold text-[#71717A]">
              Carregando dados da POINT. Start...
            </span>
          </div>
        ) : !selectedClient ? (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center max-w-md mx-auto my-12">
            <h3 className="text-lg font-bold text-[#18181B] mb-2">
              Nenhum cliente selecionado
            </h3>
            <p className="text-xs text-[#71717A] mb-5">
              Crie o primeiro cliente para carregar o modelo de implantação de 6 etapas.
            </p>
            <button
              onClick={() => setIsNewClientOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white text-xs font-semibold shadow-sm shadow-[#818CF8]/25 transition-all cursor-pointer active:scale-95"
            >
              + Criar Primeira Implantação
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
            {/* Barra Horizontal de Contexto do Cliente (Identificação + Gestão + Arquivos + Adicionar) */}
            <ClientContextBar
              clients={clients}
              selectedClient={selectedClient}
              onSelectClient={(client) => setSelectedClient(client)}
              onUpdateClientStatus={handleUpdateClientStatus}
              onOpenImportEmployees={() => setIsImportEmployeesOpen(true)}
              onOpenNewClient={() => setIsNewClientOpen(true)}
              onOpenDeleteClient={() => setIsDeleteClientOpen(true)}
              onNewTask={handleNewTask}
            />

            {/* Aba 1: FLUXO (Quadro Kanban com KPIs) */}
            {activeTab === 'fluxo' && (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Faixa de Alertas Inteligentes (Google Meet e Pendência 48h) */}
                <SmartAlertBanner
                  client={selectedClient}
                  tasks={tasks}
                  stages={stages}
                  onSelectTask={handleSelectTask}
                />

                {/* 4 Cards de KPI no Topo */}
                <KpiCards
                  client={selectedClient}
                  stages={stages}
                  tasks={tasks}
                />

                {/* Quadro Kanban Horizontal com 6 Colunas */}
                {loadingTasks ? (
                  <div className="flex items-center justify-center py-20 gap-2">
                    <Loader2 className="w-6 h-6 text-[#818CF8] animate-spin" />
                    <span className="text-xs font-semibold text-[#71717A]">
                      Sincronizando tarefas do cliente...
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <KanbanBoard
                      stages={stages}
                      tasks={tasks}
                      onSelectTask={handleSelectTask}
                      onMoveTask={handleUpdateTaskStage}
                      onNewTask={handleNewTask}
                      onRenameStage={handleRenameStage}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Aba 2: HISTÓRICO (Timeline de Atividades) */}
            {activeTab === 'historico' && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <HistoryTab
                  client={selectedClient}
                  clients={clients}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. Modal Limpo de Criação e Edição de Tarefas do Kanban */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={taskModalData}
        initialStageId={newTaskStageId}
        stages={stages}
        client={selectedClient}
        onSaveTask={handleSaveTaskModal}
        onDeleteTask={handleDeleteTask}
      />

      {/* 5. Modal "+ Novo Cliente" */}
      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        clients={clients}
        onSelectClient={(client) => setSelectedClient(client)}
        onClientCreated={handleClientCreated}
      />

      {/* Modal de Exclusão de Cliente */}
      <DeleteClientModal
        isOpen={isDeleteClientOpen}
        onClose={() => setIsDeleteClientOpen(false)}
        client={selectedClient}
        onClientDeleted={handleClientDeleted}
      />

      {/* Modal de Importação em Massa de Funcionários via AFD */}
      <ImportEmployeesModal
        isOpen={isImportEmployeesOpen}
        onClose={() => setIsImportEmployeesOpen(false)}
        client={selectedClient}
        onSuccess={handleReloadClients}
      />

      {/* 6. Modal de Ajuda & Guia de Migração */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* 7. Assistente Virtual Patrícia IA */}
      <PatriciaChat
        selectedClient={selectedClient}
        tasks={tasks}
        onReloadClients={handleReloadClients}
      />

      {/* Toast flutuante discreto posicionado na parte inferior central para não obstruir drawers, modais ou cards */}
      {toastMessage && (
        <div
          onClick={() => setToastMessage(null)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-[#18181B]/95 backdrop-blur-md text-white text-xs font-medium shadow-xl border border-white/10 animate-fade-in cursor-pointer select-none hover:opacity-90 transition-opacity"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

