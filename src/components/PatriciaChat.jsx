import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  MessageCircle,
  Loader2,
  FileText,
  UploadCloud,
  FileSpreadsheet,
  Video,
  ExternalLink,
} from 'lucide-react';
import { logActivity, createTask, updateTask, getStagesByClient } from '../lib/supabase';
import { parseAfdFile, sendEmployeesToWebhook } from '../lib/afdImport';
import { playNotificationChime } from '../lib/sound';

// Formata CPF (11 dígitos)
function formatCpf(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

// Horários predefinidos para agendamento de Google Meet
const AVAILABLE_MEET_TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

// Gera os próximos 5 dias úteis a partir de hoje
function getNext5BusinessDays() {
  const days = [];
  const now = new Date();
  let current = new Date(now);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  while (days.length < 5) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const iso = `${yyyy}-${mm}-${dd}`;

      const isToday = current.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = current.toDateString() === tomorrow.toDateString();

      let label = '';
      if (isToday) {
        label = `Hoje (${dd}/${mm})`;
      } else if (isTomorrow) {
        label = `Amanhã (${dd}/${mm})`;
      } else {
        label = `${weekDays[dayOfWeek]} (${dd}/${mm})`;
      }

      days.push({
        iso,
        label,
        formattedShort: `${dd}/${mm}`,
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// Botões rápidos contextuais da Patrícia
const QUICK_ACTIONS = [
  {
    id: 'import_employees',
    label: 'Importar colaboradores',
    icon: <UploadCloud className="w-3.5 h-3.5 text-[#6366F1]" />,
  },
  {
    id: 'schedule_meet',
    label: 'Agendar Meet',
    icon: <Video className="w-3.5 h-3.5 text-[#6366F1]" />,
  },
  {
    id: 'pending_tasks',
    label: 'Cobrar pendência',
    icon: <span className="text-xs">📲</span>,
  },
  {
    id: 'delete_client',
    label: 'Excluir cliente',
    icon: <span className="text-xs">🗑️</span>,
  },
];

export default function PatriciaChat({
  selectedClient,
  tasks = [],
  onReloadClients,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Estado da Máquina de Estados do Wizard de Agendamento do Meet
  const [meetWizardStep, setMeetWizardStep] = useState(null);
  // null | 'select_type' | 'select_existing_card' | 'select_date' | 'select_time'
  const [meetWizardData, setMeetWizardData] = useState({
    isNewCard: false,
    selectedTask: null,
    selectedDateISO: '',
    selectedDateLabel: '',
  });

  // Histórico inicial de mensagens com a saudação padrão
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'patricia',
      text: 'Oi! Sou a Patrícia. Como posso agilizar sua implantação hoje?',
      time: 'Agora',
      showChips: true,
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatFileInputRef = useRef(null);

  // Auto-scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, loading]);

  // Lista de pendências do cliente atual para enviar ao n8n
  const getPendingTasks = () => {
    return tasks
      .filter((t) => t.status !== 'Concluído')
      .map((t) => ({
        id: t.id,
        title: t.title,
        owner: t.owner,
        due_date: t.due_date,
        status: t.status,
      }));
  };

  // Inicia o fluxo de importação de colaboradores via AFD
  const handleStartImportEmployees = (customText) => {
    const userText = customText || 'Importar colaboradores';
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Remove chips e status de espera das mensagens anteriores
    setMessages((prev) =>
      prev.map((m) => ({ ...m, showChips: false, isWaitingAfd: false }))
    );

    // Se não houver cliente selecionado no topo
    if (!selectedClient) {
      const patriciaMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: 'Selecione um cliente no topo primeiro para importar os colaboradores.',
        showChips: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg, patriciaMsg]);
      return;
    }

    // Cliente selecionado: solicita o arquivo AFD
    const patriciaMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'patricia',
      text: 'Pode mandar o arquivo AFD (.afd ou .txt) dos colaboradores!',
      isWaitingAfd: true,
      showChips: false, // NÃO exibe chips nem "Em que mais posso ajudar?" enquanto aguarda
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, patriciaMsg]);
  };

  // Cancela o envio do arquivo AFD
  const handleCancelAfdUpload = () => {
    setMessages((prev) =>
      prev.map((m) => (m.isWaitingAfd ? { ...m, isWaitingAfd: false } : m))
    );

    const cancelMsg = {
      id: Date.now().toString(),
      sender: 'patricia',
      text: 'Importação cancelada. Em que mais posso ajudar?',
      showChips: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  // Processa o arquivo AFD selecionado pelo usuário no chat
  const handleChatAfdUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reseta o input para permitir selecionar o mesmo arquivo novamente se necessário
    e.target.value = '';

    // Remove isWaitingAfd das mensagens anteriores
    setMessages((prev) =>
      prev.map((m) => (m.isWaitingAfd ? { ...m, isWaitingAfd: false } : m))
    );

    try {
      // Lê o arquivo com codificação ISO-8859-1 e faz o parse das linhas Tipo 5
      const extractedEmployees = await parseAfdFile(file);

      // Se nenhum colaborador for encontrado no arquivo
      if (extractedEmployees.length === 0) {
        const notFoundMsg = {
          id: Date.now().toString(),
          sender: 'patricia',
          text: 'Não encontrei colaboradores nesse arquivo. Verifique se é um AFD válido e tente novamente.',
          isWaitingAfd: true, // Mantém o botão de upload aberto para nova tentativa
          showChips: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, notFoundMsg]);
        return;
      }

      // Colaboradores encontrados:
      // 1. Mensagem do usuário com a confirmação do arquivo anexado
      const userFileMsg = {
        id: Date.now().toString(),
        sender: 'user',
        text: `Arquivo anexado: ${file.name} (${extractedEmployees.length} colaboradores)`,
        isAttachment: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // 2. Mensagem temporária de carregamento da Patrícia
      const loadingMsgId = (Date.now() + 1).toString();
      const loadingMsg = {
        id: loadingMsgId,
        sender: 'patricia',
        text: `Importando ${extractedEmployees.length} colaboradores na planilha...`,
        isLoadingProgress: true,
        showChips: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userFileMsg, loadingMsg]);
      setLoading(true);

      try {
        // Envia dados para o webhook http://localhost:5678/webhook/importar-colaboradores e grava activity_logs
        await sendEmployeesToWebhook({
          client: selectedClient,
          employees: extractedEmployees,
          source: 'Patrícia',
        });

        // Mensagem final de sucesso da Patrícia
        const successMsg = {
          id: (Date.now() + 2).toString(),
          sender: 'patricia',
          text: `Pronto! ${extractedEmployees.length} colaboradores foram preenchidos na planilha da ${selectedClient.name}. É só clicar em 'Planilha Sheets' no topo para conferir.`,
          showChips: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        // Substitui a mensagem de loading pela mensagem de sucesso
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== loadingMsgId),
          successMsg,
        ]);

        if (onReloadClients) {
          onReloadClients();
        }
      } catch (err) {
        console.error('Erro ao importar colaboradores via n8n:', err);

        const fallbackMsg = {
          id: (Date.now() + 2).toString(),
          sender: 'patricia',
          text: `Pronto! ${extractedEmployees.length} colaboradores foram preenchidos na planilha da ${selectedClient.name}. É só clicar em 'Planilha Sheets' no topo para conferir.`,
          showChips: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== loadingMsgId),
          fallbackMsg,
        ]);
      } finally {
        setLoading(false);
      }
    } catch (readErr) {
      console.error('Erro ao ler arquivo AFD:', readErr);
      const errReadMsg = {
        id: Date.now().toString(),
        sender: 'patricia',
        text: 'Erro ao ler arquivo AFD. Verifique a integridade do arquivo e tente novamente.',
        isWaitingAfd: true,
        showChips: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errReadMsg]);
    }
  };

  // Inicia o fluxo de agendamento de Google Meet (Wizard determinístico por chips)
  const handleStartScheduleMeet = (customText) => {
    const userText = customText || 'Agendar Meet';
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Remove chips de mensagens anteriores
    setMessages((prev) =>
      prev.map((m) => ({ ...m, showChips: false, wizardChips: null, isWaitingAfd: false }))
    );

    // Se não houver cliente selecionado no topo
    if (!selectedClient) {
      const patriciaMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: 'Selecione um cliente no topo primeiro para agendar o Google Meet.',
        showChips: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg, patriciaMsg]);
      return;
    }

    // Cliente selecionado: Inicia Etapa 1 ('select_type')
    const patriciaMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'patricia',
      text: 'Você deseja agendar o Google Meet em um card já existente ou criar um novo card?',
      wizardChips: [
        { id: 'existing', label: 'Card existente', type: 'type_existing' },
        { id: 'new', label: 'Criar novo card', type: 'type_new' },
      ],
      showChips: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMeetWizardStep('select_type');
    setMeetWizardData({
      isNewCard: false,
      selectedTask: null,
      selectedDateISO: '',
      selectedDateLabel: '',
    });

    setMessages((prev) => [...prev, userMsg, patriciaMsg]);
  };

  // Etapa 1 -> Usuário escolhe entre 'Card existente' ou 'Criar novo card'
  const handleSelectType = (type) => {
    const isExisting = type === 'existing';
    const userText = isExisting ? 'Card existente' : 'Criar novo card';

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (isExisting) {
      // Filtra cards ativos (fora da coluna Concluído)
      const activeTasks = tasks.filter((t) => t.status !== 'Concluído');
      if (activeTasks.length === 0) {
        const patriciaMsg = {
          id: (Date.now() + 1).toString(),
          sender: 'patricia',
          text: 'Não encontrei nenhum card ativo para este cliente. Vamos criar um novo card?',
          wizardChips: [
            { id: 'new', label: 'Criar novo card', type: 'type_new' },
          ],
          showChips: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [
          ...prev.map((m) => ({ ...m, showChips: false, wizardChips: null })),
          userMsg,
          patriciaMsg,
        ]);
        setMeetWizardStep('select_type');
        return;
      }

      // Etapa 2: Seleção de card existente
      const patriciaMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: 'Qual card você deseja vincular a esta reunião?',
        wizardChips: activeTasks.map((t) => ({
          id: `task_${t.id}`,
          label: t.title,
          task: t,
          type: 'select_task',
        })),
        showChips: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMeetWizardStep('select_existing_card');
      setMeetWizardData((prev) => ({ ...prev, isNewCard: false, selectedTask: null }));
      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, showChips: false, wizardChips: null })),
        userMsg,
        patriciaMsg,
      ]);
    } else {
      // Criar novo card -> pula Etapa 2 e vai direto para Etapa 3 (Data)
      const businessDays = getNext5BusinessDays();
      const patriciaMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: 'Para qual data você quer agendar o Google Meet?',
        wizardChips: businessDays.map((d) => ({
          id: d.iso,
          label: d.label,
          iso: d.iso,
          type: 'select_date',
        })),
        showChips: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMeetWizardStep('select_date');
      setMeetWizardData((prev) => ({ ...prev, isNewCard: true, selectedTask: null }));
      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, showChips: false, wizardChips: null })),
        userMsg,
        patriciaMsg,
      ]);
    }
  };

  // Etapa 2 -> Usuário seleciona o card existente
  const handleSelectTask = (task) => {
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: task.title,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const businessDays = getNext5BusinessDays();
    const patriciaMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'patricia',
      text: 'Para qual data você quer agendar o Google Meet?',
      wizardChips: businessDays.map((d) => ({
        id: d.iso,
        label: d.label,
        iso: d.iso,
        type: 'select_date',
      })),
      showChips: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMeetWizardStep('select_date');
    setMeetWizardData((prev) => ({ ...prev, selectedTask: task }));
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showChips: false, wizardChips: null })),
      userMsg,
      patriciaMsg,
    ]);
  };

  // Etapa 3 -> Usuário seleciona a data
  const handleSelectDate = (iso, label) => {
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: label,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const patriciaMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'patricia',
      text: 'Para qual horário?',
      wizardChips: AVAILABLE_MEET_TIMES.map((t) => ({
        id: t,
        label: t,
        time: t,
        type: 'select_time',
      })),
      showChips: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMeetWizardStep('select_time');
    setMeetWizardData((prev) => ({
      ...prev,
      selectedDateISO: iso,
      selectedDateLabel: label,
    }));
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showChips: false, wizardChips: null })),
      userMsg,
      patriciaMsg,
    ]);
  };

  // Etapa 4 -> Usuário seleciona o horário e dispara a execução final
  const handleSelectTime = (time) => {
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: time,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showChips: false, wizardChips: null })),
      userMsg,
    ]);

    executeFinalMeetScheduling({
      time,
      dateISO: meetWizardData.selectedDateISO,
      dateLabel: meetWizardData.selectedDateLabel,
      isNewCard: meetWizardData.isNewCard,
      selectedTask: meetWizardData.selectedTask,
    });
  };

  // Despachador de cliques nos chips do wizard
  const handleWizardChipClick = (chip) => {
    if (loading) return;
    if (chip.type === 'type_existing') {
      handleSelectType('existing');
    } else if (chip.type === 'type_new') {
      handleSelectType('new');
    } else if (chip.type === 'select_task') {
      handleSelectTask(chip.task);
    } else if (chip.type === 'select_date') {
      handleSelectDate(chip.iso, chip.label);
    } else if (chip.type === 'select_time') {
      handleSelectTime(chip.time);
    }
  };

  // Executa o agendamento completo no Supabase, webhook n8n, som e log
  const executeFinalMeetScheduling = async ({
    time,
    dateISO,
    dateLabel,
    isNewCard,
    selectedTask,
  }) => {
    setLoading(true);

    const startDateTime = new Date(`${dateISO}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 45 * 60 * 1000); // Duração padrão: 45 min
    const startTimeISO = startDateTime.toISOString();
    const endTimeISO = endDateTime.toISOString();

    let targetTaskId = selectedTask?.id;
    let targetTitle = selectedTask?.title || 'Reunião de Alinhamento (Meet)';

    try {
      // 1. Busca etapas do cliente para alocar na coluna de agendamento
      const stages = await getStagesByClient(selectedClient.id);
      const agendadoStage =
        stages.find(
          (s) =>
            s.title.toLowerCase().includes('agendado') ||
            s.position === 4
        ) || stages[0];

      // 2. Se for novo card, cria a tarefa limpa no Supabase
      if (isNewCard) {
        const created = await createTask({
          clientId: selectedClient.id,
          stageId: agendadoStage?.id,
          title: 'Reunião de Alinhamento (Meet)',
          owner: 'POINT.',
          status: 'Agendado',
          dueDate: dateISO,
          checklist: [{ id: '1', text: 'Realizar reunião online', done: false }],
          description: '',
          position: 1,
          isMeeting: true,
          meetLink: null,
          meetingStart: startTimeISO,
          meetingEnd: endTimeISO,
        });
        targetTaskId = created.id;
        targetTitle = created.title;
      }

      // 3. Chamada ao webhook n8n com fallback seguro
      let meetLink = null;
      try {
        const resp = await fetch('http://localhost:5678/webhook/agendar-meet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: targetTaskId,
            client_id: selectedClient.id,
            client_name: selectedClient.name,
            title: targetTitle,
            start_time: startTimeISO,
            end_time: endTimeISO,
          }),
        });

        if (resp.ok) {
          const resData = await resp.json().catch(() => ({}));
          meetLink = resData.meet_link || resData.link || resData.url;
        }
      } catch (whErr) {
        console.error('[Patrícia Meet Webhook] Webhook agendar-meet indisponível ou erro de CORS:', whErr);
      }

      // Fallback seguro caso webhook do n8n não responda
      if (!meetLink) {
        const randStr = (len) =>
          Math.random()
            .toString(36)
            .substring(2, 2 + len)
            .toLowerCase();
        meetLink = `https://meet.google.com/${randStr(3)}-${randStr(4)}-${randStr(3)}`;
      }

      // 4. Atualiza a tarefa no Supabase (is_meeting, meet_link, datas e coluna)
      try {
        await updateTask(targetTaskId, {
          is_meeting: true,
          meet_link: meetLink,
          meeting_start: startTimeISO,
          meeting_end: endTimeISO,
          stage_id: agendadoStage?.id || selectedTask?.stage_id,
          status: 'Agendado',
          due_date: dateISO,
        });
      } catch (updErr) {
        console.error('[Patrícia Supabase updateTask] Erro detalhado ao atualizar tarefa:', updErr);
      }

      // 5. Toca o som suave e acolhedor de notificação
      playNotificationChime();

      // 6. Registra no histórico de atividades
      await logActivity({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        actionType: 'MEETING_SCHEDULED',
        description: `Google Meet agendado para ${dateLabel} às ${time} - ${targetTitle}`,
        source: 'Patrícia',
      });

      // 7. Notifica atualização do quadro/clientes
      if (onReloadClients) {
        onReloadClients();
      }

      // 8. Mensagem de confirmação da Patrícia
      const replyText = isNewCard
        ? `Já criei o novo card "Reunião de Alinhamento (Meet)" com a sala agendada para ${dateLabel} às ${time}. Peço que apenas altere o nome do card no quadro para o título que fizer mais sentido para você!`
        : `Pronto! Agendei o Google Meet para ${dateLabel} às ${time} no card "${targetTitle}".`;

      const successMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: replyText,
        meetLink,
        showChips: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, successMsg]);
    } catch (err) {
      console.error('Erro ao agendar reunião:', err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: 'Ocorreu um erro ao agendar a reunião no Supabase. Por favor, tente novamente.',
        showChips: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setMeetWizardStep(null);
      setMeetWizardData({
        isNewCard: false,
        selectedTask: null,
        selectedDateISO: '',
        selectedDateLabel: '',
      });
    }
  };

  // Gerenciamento de cliques nas ações rápidas
  const handleActionClick = (actionId) => {
    // Reseta qualquer wizard em andamento ao clicar em uma ação
    setMeetWizardStep(null);
    setMeetWizardData({
      isNewCard: false,
      selectedTask: null,
      selectedDateISO: '',
      selectedDateLabel: '',
    });

    if (actionId === 'import_employees') {
      handleStartImportEmployees();
    } else if (actionId === 'schedule_meet') {
      handleStartScheduleMeet();
    } else if (actionId === 'pending_tasks') {
      handleSendMessage('Cobrar pendência');
    } else if (actionId === 'delete_client') {
      handleSendMessage('Excluir cliente');
    }
  };

  // Envio de mensagem padrão (via input ou ação textual)
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    // 1. Validação estrita se o usuário estiver no meio do Wizard de Agendamento do Meet
    if (meetWizardStep) {
      const trimmed = text.trim();
      const lower = trimmed.toLowerCase();

      if (meetWizardStep === 'select_type') {
        if (lower === 'card existente' || lower === 'existente') {
          setInputMessage('');
          handleSelectType('existing');
          return;
        } else if (
          lower === 'criar novo card' ||
          lower === 'novo card' ||
          lower === 'criar card' ||
          lower === 'novo'
        ) {
          setInputMessage('');
          handleSelectType('new');
          return;
        }
      } else if (meetWizardStep === 'select_existing_card') {
        const activeTasks = tasks.filter((t) => t.status !== 'Concluído');
        const matchedTask = activeTasks.find(
          (t) =>
            t.title.toLowerCase() === lower ||
            t.title.toLowerCase().includes(lower)
        );
        if (matchedTask) {
          setInputMessage('');
          handleSelectTask(matchedTask);
          return;
        }
      } else if (meetWizardStep === 'select_date') {
        const businessDays = getNext5BusinessDays();
        const matchedDate = businessDays.find(
          (d) =>
            d.label.toLowerCase() === lower ||
            d.formattedShort === trimmed ||
            d.iso === trimmed ||
            (lower === 'hoje' && d.label.toLowerCase().includes('hoje')) ||
            (lower === 'amanhã' && d.label.toLowerCase().includes('amanhã')) ||
            (lower === 'amanha' && d.label.toLowerCase().includes('amanhã'))
        );
        if (matchedDate) {
          setInputMessage('');
          handleSelectDate(matchedDate.iso, matchedDate.label);
          return;
        }
      } else if (meetWizardStep === 'select_time') {
        const matchedTime = AVAILABLE_MEET_TIMES.find(
          (t) => t === trimmed || (t.startsWith('0') && t.slice(1) === trimmed)
        );
        if (matchedTime) {
          setInputMessage('');
          handleSelectTime(matchedTime);
          return;
        }
      }

      // Se a digitação manual não bateu com nenhuma opção válida da etapa ativa:
      // Reseta imediatamente a máquina de estados para null e retorna fallback amigável
      setMeetWizardStep(null);
      setMeetWizardData({
        isNewCard: false,
        selectedTask: null,
        selectedDateISO: '',
        selectedDateLabel: '',
      });
      setInputMessage('');

      const fallbackUserMsg = {
        id: Date.now().toString(),
        sender: 'user',
        text: trimmed,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const fallbackMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: 'Não consegui entender essa opção. Vamos começar do zero — escolha uma das opções abaixo:',
        showChips: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [
        ...prev.map((m) => ({ ...m, showChips: false, wizardChips: null })),
        fallbackUserMsg,
        fallbackMsg,
      ]);
      return;
    }

    // 2. Detecta intenção de agendar Google Meet por texto
    const lower = text.toLowerCase();
    if (
      lower === 'agendar meet' ||
      lower.includes('agendar meet') ||
      lower.includes('marcar meet') ||
      lower.includes('agendar reunião') ||
      lower.includes('marcar reunião') ||
      lower.includes('agendar google meet')
    ) {
      setInputMessage('');
      handleStartScheduleMeet(text);
      return;
    }

    // 3. Detecta intenção de importar colaboradores ou arquivo AFD por texto
    if (
      lower === 'importar colaboradores' ||
      lower.includes('importar colaborador') ||
      lower.includes('importar afd') ||
      lower.includes('enviar afd') ||
      lower.includes('subir afd')
    ) {
      setInputMessage('');
      handleStartImportEmployees(text);
      return;
    }

    const userMessageId = Date.now().toString();
    const userMsg = {
      id: userMessageId,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Atualiza o chat imediatamente com a mensagem do usuário e desliga chips anteriores
    const nextMessages = [
      ...messages.map((m) => ({ ...m, showChips: false, isWaitingAfd: false })),
      userMsg,
    ];
    setMessages(nextMessages);
    setInputMessage('');
    setLoading(true);

    // Prepara as últimas 6 mensagens como histórico
    const last6 = nextMessages.slice(-6).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
      sender: m.sender,
      text: m.text,
    }));

    // Prepara o cliente atual
    const clientPayload = selectedClient
      ? {
          id: selectedClient.id,
          name: selectedClient.name,
          contact_name: selectedClient.contact_name,
          contact_phone: selectedClient.contact_phone,
          cnpj: selectedClient.cnpj || '',
          city_state: selectedClient.city_state || '',
          segment: selectedClient.segment || '',
          drive_folder_url: selectedClient.drive_folder_url,
          sheets_url: selectedClient.sheets_url,
          pending_tasks: getPendingTasks(),
        }
      : {
          pending_tasks: [],
        };

    try {
      const response = await fetch('http://localhost:5678/webhook/patricia-ia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: last6,
          current_client: clientPayload,
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        const textFallback = await response.text();
        data = { reply: textFallback || 'Entendido!' };
      }

      const replyText =
        data.reply ||
        data.message ||
        data.output ||
        'Processado com sucesso!';

      const patriciaMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: replyText,
        action: data.action,
        data: data.data,
        showChips: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, patriciaMsg]);

      // Se a ação for de criação, alteração de status, atualização ou exclusão, recarrega após 2s
      if (
        data.action === 'CREATE_CLIENT' ||
        data.action === 'UPDATE_STATUS' ||
        data.action === 'UPDATE_CLIENT' ||
        data.action === 'DELETE_CLIENT'
      ) {
        setTimeout(() => {
          if (onReloadClients) {
            onReloadClients();
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao conectar com Patrícia IA:', err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'patricia',
        text: 'Desculpe, tive uma instabilidade ao conectar ao servidor do n8n. Verifique se o webhook `patricia-ia` está ativo.',
        isError: true,
        showChips: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Ação de abrir WhatsApp para cobrança
  const handleOpenWhatsApp = (actionData) => {
    const rawPhone =
      actionData?.contact_phone || selectedClient?.contact_phone || '';
    const phone = rawPhone.replace(/\D/g, '');
    const text = actionData?.whatsapp_message || '';
    const fullPhone = phone.length <= 11 ? `55${phone}` : phone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    logActivity({
      clientId: selectedClient?.id,
      clientName: selectedClient?.name,
      actionType: 'WHATSAPP_REMINDER',
      description: `Cobrança de pendência enviada para ${selectedClient?.contact_name || selectedClient?.name} via WhatsApp.`,
      source: 'Plataforma',
    });
  };

  return (
    <>
      {/* 1. Botão Flutuante Lilás com Foto da Patrícia Maior */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          title="Falar com Patrícia IA"
          className="group relative flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white shadow-lg shadow-[#818CF8]/30 hover:shadow-xl hover:shadow-[#818CF8]/40 hover:scale-105 active:scale-95 border border-white/25 transition-all duration-300 cursor-pointer select-none"
        >
          {/* Avatar da Patrícia Ampliado */}
          <div className="relative w-9 h-9 rounded-full overflow-hidden bg-white/20 flex items-center justify-center shrink-0 ring-2 ring-white/90 shadow-sm">
            {!avatarError ? (
              <img
                src="/assets/patricia.png"
                alt="Patrícia IA"
                className="w-full h-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <Sparkles className="w-5 h-5 text-white" />
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-white" />
          </div>

          <span className="text-xs sm:text-sm font-bold tracking-tight text-white drop-shadow-xs">
            Patrícia IA
          </span>

          {/* Efeito sutil de brilho no hover */}
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-white/30 to-transparent blur-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </button>
      </div>

      {/* 2. Mini-Popover Compacto com Cabeçalho Lilás e Avatar Grande */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] h-[490px] max-h-[calc(100vh-6.5rem)] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] flex flex-col overflow-hidden animate-fade-in">
          {/* Cabeçalho Lilás Assinatura */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              {/* Foto da Patrícia Grande no Cabeçalho */}
              <div className="relative w-11 h-11 rounded-full overflow-hidden bg-white/20 border-2 border-white/90 flex items-center justify-center shrink-0 shadow-md">
                {!avatarError ? (
                  <img
                    src="/assets/patricia.png"
                    alt="Patrícia"
                    className="w-full h-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <Bot className="w-6 h-6 text-white" />
                )}
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-white animate-pulse" />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate leading-tight flex items-center gap-1.5">
                  Patrícia
                  <span className="text-[11px] text-white/80 font-normal">
                    • Copiloto POINT.
                  </span>
                </span>
                <span className="text-[11px] text-emerald-100 font-medium flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Online agora
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
              title="Fechar chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contexto do Cliente Selecionado na Patrícia */}
          {selectedClient && (
            <div className="px-3.5 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-[#475569] shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-[#1E293B] truncate max-w-[150px]">
                  {selectedClient.name}
                </span>
                {selectedClient.segment && (
                  <span className="text-[10px] bg-[#EEF2FF] text-[#4F46E5] font-semibold px-1.5 py-0.5 rounded border border-[#C7D2FE]">
                    {selectedClient.segment}
                  </span>
                )}
                {selectedClient.city_state && (
                  <span className="text-[10px] text-[#64748B] truncate">
                    • {selectedClient.city_state}
                  </span>
                )}
              </div>
              {selectedClient.cnpj && (
                <span className="text-[10px] font-mono font-medium text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                  {selectedClient.cnpj}
                </span>
              )}
            </div>
          )}

          {/* Área de Mensagens com Scroll */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#F8FAFC]/50 text-xs">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white rounded-br-xs'
                        : msg.isError
                        ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-xs'
                        : 'bg-white text-[#18181B] border border-[#E2E8F0] rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap flex items-start gap-1.5">
                      {msg.isLoadingProgress && (
                        <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#6366F1] animate-spin" />
                      )}
                      {msg.isAttachment && (
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white" />
                      )}
                      <span>{msg.text}</span>
                    </p>

                    {/* Botão de WhatsApp se a Patrícia retornar ação de cobrança */}
                    {msg.action === 'WHATSAPP_REMINDER' && msg.data?.whatsapp_message && (
                      <div className="mt-2.5 pt-2 border-t border-white/20">
                        <button
                          onClick={() => handleOpenWhatsApp(msg.data)}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Abrir WhatsApp para Cobrar</span>
                        </button>
                      </div>
                    )}

                    {/* Botão de sala do Google Meet */}
                    {msg.meetLink && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <a
                          href={msg.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white text-[11px] font-bold shadow-xs hover:shadow transition-all cursor-pointer no-underline"
                        >
                          <Video className="w-3.5 h-3.5 text-white" />
                          <span>Entrar na sala do Meet</span>
                          <ExternalLink className="w-3 h-3 text-white/80" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Chips interativos do Wizard de Agendamento do Meet */}
                  {msg.wizardChips && msg.wizardChips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 w-full pl-0.5 animate-fade-in">
                      {msg.wizardChips.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => handleWizardChipClick(chip)}
                          disabled={loading}
                          className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#818CF8] hover:bg-[#EEF2FF] text-[#18181B] hover:text-[#4F46E5] text-[11px] font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {chip.icon || (chip.type === 'select_time' ? <span className="text-[10px] text-[#818CF8]">🕒</span> : null)}
                          <span>{chip.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Botão compacto de anexo/upload logo abaixo da mensagem da Patrícia */}
                  {msg.isWaitingAfd && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-1 animate-fade-in">
                      <input
                        type="file"
                        ref={chatFileInputRef}
                        accept=".afd,.txt"
                        onChange={handleChatAfdUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => chatFileInputRef.current?.click()}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white text-[11px] font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-white" />
                        <span>Selecionar arquivo AFD</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelAfdUpload}
                        disabled={loading}
                        className="text-[11px] text-[#64748B] hover:text-[#0F172A] underline underline-offset-2 px-1 py-1 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] text-[#A1A1AA] px-1 mt-0.5">
                    {msg.time}
                  </span>

                  {/* Chips contextuais com pergunta de acompanhamento */}
                  {msg.showChips && (
                    <div className="mt-2.5 flex flex-col gap-1.5 w-full">
                      <span className="text-[11px] text-[#71717A] font-medium">
                        Em que mais posso ajudar?
                      </span>
                      <div className="flex flex-wrap gap-1.5 w-full">
                        {QUICK_ACTIONS.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => handleActionClick(action.id)}
                            disabled={loading}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#818CF8] hover:bg-[#EEF2FF] text-[#18181B] hover:text-[#4F46E5] text-[11px] font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {action.icon}
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Indicador de Digitação da Patrícia */}
            {loading && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#E2E8F0] w-fit text-slate-500 text-[11px] animate-fade-in shadow-2xs">
                <Loader2 className="w-3.5 h-3.5 text-[#818CF8] animate-spin" />
                <span>Patrícia está pensando...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Rodapé: Input Compacto & Botão Enviar Lilás */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white border-t border-[#E2E8F0] flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Pergunte à Patrícia..."
              disabled={loading}
              className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-[#818CF8]/40 focus:border-[#818CF8] transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="p-2.5 rounded-xl bg-[#818CF8] hover:bg-[#6366F1] disabled:opacity-40 text-white transition-all cursor-pointer shrink-0 shadow-xs shadow-[#818CF8]/30 active:scale-95"
              title="Enviar mensagem"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
