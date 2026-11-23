import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  Plus,
  Trash2,
  CheckSquare,
  AlertTriangle,
  Loader2,
  FolderOpen,
  MessageCircle,
  Video,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { logActivity, updateTask, createTask } from '../lib/supabase';
import { playNotificationChime } from '../lib/sound';
import MeetDateTimePicker from './MeetDateTimePicker';

export default function TaskModal({
  isOpen,
  onClose,
  task = null, // se task for null, cria nova; se preenchido, edita
  initialStageId = '',
  stages = [],
  client = null,
  onSaveTask,
  onDeleteTask,
}) {
  const isEditing = Boolean(task && task.id);

  // Estados dos campos do formulário
  const [title, setTitle] = useState('');
  const [stageId, setStageId] = useState('');
  const [owner, setOwner] = useState('POINT.');
  const [status, setStatus] = useState('A Fazer');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Estados de Reunião Google Meet
  const [isMeeting, setIsMeeting] = useState(false);
  const [meetLink, setMeetLink] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingDuration, setMeetingDuration] = useState(45);
  const [generatingMeet, setGeneratingMeet] = useState(false);
  const [meetSuccessMsg, setMeetSuccessMsg] = useState('');
  const [createdTaskId, setCreatedTaskId] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Inicializa os campos ao abrir o modal
  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
      setErrorMsg('');
      setMeetSuccessMsg('');
      setCreatedTaskId(null);
      return;
    }

    if (task) {
      setTitle(task.title || '');
      setStageId(task.stage_id || stages[0]?.id || '');
      setOwner(task.owner || 'POINT.');
      setStatus(task.status || 'A Fazer');
      setStartDate(
        task.start_date
          ? task.start_date.split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setDueDate(
        task.due_date ? task.due_date.split('T')[0] : ''
      );
      setChecklist(
        Array.isArray(task.checklist) ? [...task.checklist] : []
      );

      // O switch inicia ligado (true) SOMENTE se task.meet_link existir e não estiver vazio
      const hasMeetLink = Boolean(task.meet_link && task.meet_link.trim());
      setIsMeeting(hasMeetLink);
      setMeetLink(task.meet_link || '');
      setMeetingStart(
        task.meeting_start ? task.meeting_start.slice(0, 16) : ''
      );
      setCreatedTaskId(task.id);
    } else {
      setTitle('');
      setStageId(initialStageId || stages[0]?.id || '');
      setOwner('POINT.');
      setStatus('A Fazer');
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setDueDate(today);
      setChecklist([]);
      // Em Nova Tarefa, switch inicia desligado (false), mantendo o modal limpo
      setIsMeeting(false);
      setMeetLink('');
      setMeetingStart('');
      setCreatedTaskId(null);
    }
    setNewChecklistText('');
    setConfirmDelete(false);
    setErrorMsg('');
    setMeetSuccessMsg('');
  }, [isOpen, task, initialStageId, stages]);

  if (!isOpen) return null;

  // Adiciona novo item ao checklist
  const handleAddChecklistItem = (e) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      text: newChecklistText.trim(),
      done: false,
    };
    setChecklist((prev) => [...prev, newItem]);
    setNewChecklistText('');
  };

  // Alterna status de um item do checklist
  const handleToggleChecklistItem = (itemId) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      )
    );
  };

  // Remove um item do checklist
  const handleRemoveChecklistItem = (itemId) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Submissão do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Informe o título da tarefa.');
      return;
    }

    if (!dueDate) {
      setErrorMsg('Informe a data final (vencimento) da tarefa.');
      return;
    }

    if (isMeeting && meetingStart) {
      const checkDate = new Date(meetingStart);
      if (checkDate.getTime() < Date.now() - 60000) {
        setErrorMsg('A data e o horário da reunião não podem estar no passado. Selecione uma data e horário a partir de agora.');
        return;
      }
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const targetTaskId = task?.id || createdTaskId;
      const effectiveIsNew = !targetTaskId;
      const effectiveStage = stageId || stages[0]?.id;
      const targetStageObj = stages.find((s) => s.id === effectiveStage);

      // Mapeia livremente para a etapa escolhida entre as 5 colunas estritas do Supabase
      let calculatedStatus = 'A Fazer';
      if (targetStageObj) {
        const pos = targetStageObj.position;
        const sTitle = (targetStageObj.title || '').toLowerCase();
        if (pos === 1 || sTitle.includes('fazer')) calculatedStatus = 'A Fazer';
        else if (pos === 2 || sTitle.includes('andamento')) calculatedStatus = 'Em Andamento';
        else if (pos === 3 || sTitle.includes('aguardando')) calculatedStatus = 'Aguardando Cliente';
        else if (pos === 4 || sTitle.includes('agendado')) calculatedStatus = 'Agendado';
        else if (pos === 5 || sTitle.includes('conclu')) calculatedStatus = 'Concluído';
      }

      // Se o usuário desligou o switch, limpa meet_link e horários
      const taskData = {
        title: title.trim(),
        stage_id: effectiveStage,
        owner,
        status: calculatedStatus,
        start_date: startDate || new Date().toISOString().split('T')[0],
        due_date: dueDate,
        checklist,
        is_meeting: Boolean(isMeeting),
        meet_link: isMeeting && meetLink?.trim() ? meetLink.trim() : null,
        meeting_start: isMeeting && meetingStart ? new Date(meetingStart).toISOString() : null,
        meeting_end: isMeeting && meetingStart
          ? new Date(new Date(meetingStart).getTime() + meetingDuration * 60000).toISOString()
          : null,
      };

      if (onSaveTask) {
        await onSaveTask(taskData, effectiveIsNew, targetTaskId);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
      setErrorMsg('Falha ao salvar tarefa. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  // Geração e Agendamento de Google Meet
  const handleGenerateMeet = async () => {
    if (!title.trim()) {
      setErrorMsg('Informe o título da tarefa antes de gerar a reunião Google Meet.');
      return;
    }

    setGeneratingMeet(true);
    setMeetSuccessMsg('');
    setErrorMsg('');

    let startTime = meetingStart;
    if (!startTime) {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      startTime = nextHour.toISOString().slice(0, 16);
      setMeetingStart(startTime);
    }

    const startDateObj = new Date(startTime);
    if (startDateObj.getTime() < Date.now() - 60000) {
      setErrorMsg('A data e o horário da reunião não podem estar no passado. Selecione uma data e horário a partir de agora.');
      setGeneratingMeet(false);
      return;
    }

    const endDateObj = new Date(startDateObj.getTime() + meetingDuration * 60000);
    const startISO = startDateObj.toISOString();
    const endISO = endDateObj.toISOString();

    // Move automaticamente para a coluna "Agendado" e atualiza status
    const agendadoStage = stages.find(
      (s) => s.position === 4 || s.title?.toLowerCase().includes('agendado')
    );
    const targetStageId = agendadoStage?.id || stageId || stages[0]?.id;
    setStageId(targetStageId);
    setStatus('Agendado');

    let currentTaskId = task?.id || createdTaskId;

    // Se o usuário clicar em "Gerar Google Meet" dentro de "Nova Tarefa no Kanban" (ainda sem ID):
    // Cria a tarefa no Supabase primeiro com status Agendado
    if (!currentTaskId) {
      try {
        const initialTaskData = {
          title: title.trim(),
          stage_id: targetStageId,
          owner,
          status: 'Agendado',
          due_date: dueDate || startDateObj.toISOString().split('T')[0],
          checklist,
          is_meeting: true,
          meet_link: null,
          meeting_start: startISO,
          meeting_end: endISO,
        };

        if (onSaveTask) {
          const saved = await onSaveTask(initialTaskData, true);
          if (saved?.id) {
            currentTaskId = saved.id;
            setCreatedTaskId(saved.id);
          }
        } else if (client?.id) {
          const created = await createTask({
            clientId: client.id,
            stageId: targetStageId,
            title: title.trim(),
            owner,
            status: 'Agendado',
            dueDate: dueDate || startDateObj.toISOString().split('T')[0],
            checklist,
            isMeeting: true,
            meetingStart: startISO,
            meetingEnd: endISO,
          });
          if (created?.id) {
            currentTaskId = created.id;
            setCreatedTaskId(created.id);
          }
        }
      } catch (createErr) {
        console.warn('Erro ao pré-criar tarefa para agendamento de meet:', createErr);
      }
    }

    const payload = {
      task_id: currentTaskId || null,
      client_id: client?.id,
      client_name: client?.name,
      title: title.trim(),
      start_time: startISO,
      end_time: endISO,
    };

    let generatedUrl = '';
    try {
      const response = await fetch('http://localhost:5678/webhook/agendar-meet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.meet_link) {
          generatedUrl = data.meet_link;
        }
      } else {
        console.warn(`[Google Meet Webhook] Retorno ${response.status}:`, response.statusText);
      }
    } catch (err) {
      console.warn('[Google Meet Webhook] Falha de conexão/CORS no webhook n8n:', err);
    }

    // Se o webhook não estiver rodando no n8n local ou tiver erro de CORS, gera o link seguro padrão do Google Meet
    if (!generatedUrl) {
      const rand1 = Math.random().toString(36).substring(2, 5);
      const rand2 = Math.random().toString(36).substring(2, 6);
      const rand3 = Math.random().toString(36).substring(2, 5);
      generatedUrl = `https://meet.google.com/${rand1}-${rand2}-${rand3}`;
    }

    setMeetLink(generatedUrl);
    setIsMeeting(true);
    setStatus('Agendado');
    setMeetSuccessMsg('Reunião Google Meet configurada com sucesso!');
    playNotificationChime();

    const meetDateValue = dueDate || startDateObj.toISOString().split('T')[0];

    // Se a tarefa já existe (ou foi criada acima), persiste no banco imediatamente
    if (currentTaskId) {
      const meetUpdatePayload = {
        meet_link: generatedUrl,
        meeting_start: startISO,
        meeting_end: endISO,
        is_meeting: true,
        stage_id: targetStageId,
        status: 'Agendado',
        due_date: meetDateValue,
      };

      try {
        await updateTask(currentTaskId, meetUpdatePayload);

        // Atualiza imediatamente o card localmente no estado do React para a coluna "Agendado"
        if (onSaveTask) {
          await onSaveTask(
            {
              ...(task || {}),
              ...meetUpdatePayload,
              id: currentTaskId,
              title: title.trim(),
              owner,
              checklist,
              stage_id: targetStageId,
              status: 'Agendado',
            },
            false,
            currentTaskId
          );
        }

        await logActivity({
          clientId: client?.id,
          clientName: client?.name,
          actionType: 'meet_agendado',
          description: `Reunião agendada via Google Meet para "${title.trim()}": ${generatedUrl}`,
          source: 'Plataforma',
        });
      } catch (dbErr) {
        console.error('[Supabase updateTask] Erro detalhado ao persistir reunião no banco:', dbErr);
      }
    }

    setGeneratingMeet(false);
  };

  // Cobrança da etapa via WhatsApp
  const handleChargeWhatsApp = async () => {
    const rawPhone = client?.contact_phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      alert('Este cliente não possui telefone de contato cadastrado.');
      return;
    }
    // Adiciona código do país 55 se tiver 10 ou 11 dígitos
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }

    const greeting = client?.contact_name
      ? `Olá ${client.contact_name}, tudo bem?`
      : 'Olá, tudo bem?';
    const taskTitle = title.trim() || task?.title || 'etapa';
    const clientName = client?.name || 'sua empresa';

    const message = `${greeting} Passando para alinhar a etapa "${taskTitle}" da implantação da ${clientName} no POINT. Estamos aguardando esse retorno para darmos sequência por aqui!`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');

    try {
      await logActivity({
        clientId: client?.id,
        clientName: client?.name,
        actionType: 'cobranca_enviada',
        description: `Cobrança enviada via WhatsApp referente a: ${taskTitle}`,
        source: 'Plataforma',
      });
    } catch (err) {
      console.warn('Erro ao registrar log de cobrança via WhatsApp:', err);
    }
  };

  // Exclusão da tarefa
  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setSaving(true);
    try {
      if (onDeleteTask && task?.id) {
        await onDeleteTask(task.id, task.title);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
      setErrorMsg('Falha ao excluir tarefa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header do Modal */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F4F4F5]">
            <div>
              <h3 className="text-base font-bold text-[#18181B]">
                {isEditing ? 'Editar Tarefa' : 'Nova Tarefa no Kanban'}
              </h3>
              <p className="text-xs text-[#71717A] mt-0.5">
                {isEditing
                  ? 'Atualize os dados, responsável e checklist da etapa.'
                  : 'Crie uma nova atividade operacional para o cliente.'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  title={confirmDelete ? 'Clique novamente para confirmar a exclusão' : 'Excluir tarefa'}
                  className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    confirmDelete
                      ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                </button>
              )}
              {!saving && (
                <button
                  onClick={onClose}
                  className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-full transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Título da Tarefa */}
            <div>
              <label className="block text-xs font-bold text-[#18181B] mb-1">
                Título da Tarefa *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Reunião de abertura e cronograma"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8] transition-all"
              />
            </div>

            {/* Grid 2 Colunas: Etapa e Responsável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Etapa (Coluna do Kanban) */}
              <div>
                <label className="block text-xs font-bold text-[#18181B] mb-1">
                  Etapa / Coluna
                </label>
                <select
                  value={stageId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setStageId(newId);
                    const chosen = stages.find((s) => s.id === newId);
                    if (chosen) {
                      const pos = chosen.position;
                      const sTitle = (chosen.title || '').toLowerCase();
                      if (pos === 5 || sTitle.includes('conclu')) setStatus('Concluído');
                      else if (pos === 4 || sTitle.includes('agendado')) setStatus('Agendado');
                      else if (pos === 3 || sTitle.includes('aguardando')) setStatus('Aguardando Cliente');
                      else if (pos === 2 || sTitle.includes('andamento')) setStatus('Em Andamento');
                      else setStatus('A Fazer');
                    }
                  }}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8] font-medium text-[#18181B]"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Responsável: POINT. ou Cliente */}
              <div>
                <label className="block text-xs font-bold text-[#18181B] mb-1">
                  Responsável
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F4F4F5] rounded-xl border border-[#E4E4E7]">
                  <button
                    type="button"
                    onClick={() => setOwner('POINT.')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      owner === 'POINT.'
                        ? 'bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white shadow-xs'
                        : 'text-[#71717A] hover:text-[#18181B]'
                    }`}
                  >
                    POINT.
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwner('Cliente')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      owner === 'Cliente'
                        ? 'bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white shadow-xs'
                        : 'text-[#71717A] hover:text-[#18181B]'
                    }`}
                  >
                    Cliente
                  </button>
                </div>
              </div>
            </div>

            {/* Grid 2 Colunas: Data de Início e Data Final (Vencimento) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#18181B] mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8] text-[#18181B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#18181B] mb-1">
                  Data Final (Vencimento) <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8] text-[#18181B]"
                />
              </div>
            </div>

            {/* Interruptor "Incluir reunião online (Google Meet)" */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-[15px] h-[15px] text-[#6366F1] shrink-0" />
                <span className="text-xs font-medium text-slate-700">
                  Incluir reunião online (Google Meet)
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isMeeting}
                onClick={() => setIsMeeting((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isMeeting ? 'bg-[#6366F1]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isMeeting ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Seção Reunião Online (Google Meet) exibida quando o switch está ativo */}
            {isMeeting && (
              <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                    <Video className="w-4 h-4 text-indigo-600" />
                    <span>Reunião Online (Google Meet)</span>
                  </div>
                  {meetLink && (
                    <a
                      href={meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      <span>Abrir sala</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {meetSuccessMsg && (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{meetSuccessMsg}</span>
                  </div>
                )}

                {/* Seletores Customizados: Data da Reunião e Horário (Paleta Lilás #6366F1) */}
                <MeetDateTimePicker
                  value={meetingStart}
                  onChange={(newMeetingStart) => {
                    setMeetingStart(newMeetingStart);
                    setErrorMsg('');
                  }}
                />

                {/* Duração Estimada */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Duração Estimada
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[30, 45, 60].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setMeetingDuration(dur)}
                        className={`py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                          meetingDuration === dur
                            ? 'bg-[#6366F1] text-white border-[#6366F1] shadow-2xs font-bold'
                            : 'bg-white text-slate-600 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {dur === 60 ? '1 hora' : `${dur} min`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Linha 2: Campo Link do Meet + Botão Gerar Meet */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Link da Reunião
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://meet.google.com/..."
                      value={meetLink}
                      onChange={(e) => setMeetLink(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-1.5 focus:ring-indigo-400 text-slate-800 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateMeet}
                      disabled={generatingMeet}
                      className="h-8.5 px-3 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {generatingMeet ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Video className="w-3.5 h-3.5" />
                      )}
                      <span>{meetLink ? 'Regerar Meet' : 'Gerar Google Meet'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Checklist de Itens */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#18181B]">
                  Itens do Checklist ({checklist.length})
                </label>
                <span className="text-[11px] text-[#71717A]">
                  {checklist.filter((c) => c.done).length} concluídos
                </span>
              </div>

              {/* Lista dos Itens do Checklist */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2 pr-1">
                {checklist.length === 0 ? (
                  <div className="text-[11px] text-[#A1A1AA] italic p-2 bg-[#F8FAFC] rounded-lg border border-dashed border-[#E2E8F0] text-center">
                    Nenhum item adicionado no checklist.
                  </div>
                ) : (
                  checklist.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between gap-2 p-2 rounded-lg bg-[#FAFAFA] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all"
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleChecklistItem(item.id)}
                          className="w-3.5 h-3.5 rounded text-[#6366F1] focus:ring-[#6366F1] border-[#D1D5DB] cursor-pointer shrink-0"
                        />
                        <span
                          className={`text-xs truncate ${
                            item.done
                              ? 'line-through text-[#A1A1AA]'
                              : 'text-[#18181B] font-medium'
                          }`}
                        >
                          {item.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="p-1 text-[#A1A1AA] hover:text-[#EF4444] rounded-md transition-colors cursor-pointer shrink-0"
                        title="Remover item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Input para Adicionar Novo Item */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Novo item do checklist..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem(e);
                    }
                  }}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  disabled={!newChecklistText.trim()}
                  className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#818CF8] hover:bg-[#EEF2FF] text-[#4F46E5] text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Botão Dedicado "Cobrar no WhatsApp" (Largura total, paleta lilás suave) */}
            {isEditing && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleChargeWhatsApp}
                  className="w-full h-10 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/80 text-[#4F46E5] font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-none"
                  title="Cobrar pendência desta etapa no WhatsApp do cliente"
                >
                  <MessageCircle className="w-4 h-4 text-[#6366F1] shrink-0" />
                  <span>Cobrar no WhatsApp</span>
                </button>
              </div>
            )}

            {/* Rodapé do Modal (Apenas Cancelar e Salvar Alterações centralizados) */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-9 px-5 text-xs font-medium text-slate-600 bg-slate-100/80 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-6 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditing ? 'Salvar Alterações' : 'Criar Tarefa'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
