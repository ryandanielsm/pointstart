import React from 'react';
import { getBrasiliaTodayStr, parseBrasiliaDate } from '../lib/dateUtils';

export default function KpiCards({
  client,
  stages = [],
  tasks = [],
}) {
  // Identifica as etapas do quadro Kanban
  const stageAFazer = stages.find(
    (s) => s.position === 1 || s.title?.toLowerCase().includes('a fazer')
  );
  const stageEmAndamento = stages.find(
    (s) => s.position === 2 || s.title?.toLowerCase().includes('em andamento')
  );
  const stageAguardando = stages.find(
    (s) => s.position === 3 || s.title?.toLowerCase().includes('aguardando')
  );
  const stageAgendado = stages.find(
    (s) => s.position === 4 || s.title?.toLowerCase().includes('agendado')
  );
  const stageConcluido = stages.find(
    (s) => s.position === 5 || s.title?.toLowerCase().includes('conclu')
  );

  const isConcluido = (t) =>
    t.status === 'Concluído' || (stageConcluido && t.stage_id === stageConcluido.id);

  // Tarefas ativas (não concluídas)
  const activeTasks = tasks.filter((t) => !isConcluido(t));

  // ==========================================
  // CARD 1: "Progresso"
  // ==========================================
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(isConcluido).length;
  const progressPercent =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ==========================================
  // CARD 2: "Em Execução"
  // ==========================================
  const isEmAndamento = (t) =>
    (stageEmAndamento && t.stage_id === stageEmAndamento.id) ||
    t.status === 'Em Andamento';

  const isAFazer = (t) =>
    !isEmAndamento(t) &&
    ((stageAFazer && t.stage_id === stageAFazer.id) ||
      t.status === 'A Fazer' ||
      t.status === 'Não Iniciado' ||
      (!t.stage_id && !t.status));

  const qtdEmAndamento = activeTasks.filter(isEmAndamento).length;
  const qtdAFazer = activeTasks.filter(isAFazer).length;
  const totalEmExecucao = qtdEmAndamento + qtdAFazer;

  // ==========================================
  // CARD 3: "Pendências"
  // ==========================================
  const todayStr = getBrasiliaTodayStr();

  const isOverdue = (t) => {
    if (!t.due_date || isConcluido(t)) return false;
    const dueStr = t.due_date.split('T')[0];
    return dueStr < todayStr;
  };

  const isAguardandoCliente = (t) =>
    (stageAguardando && t.stage_id === stageAguardando.id) ||
    t.status === 'Aguardando Cliente';

  const qtdAguardandoCliente = activeTasks.filter(isAguardandoCliente).length;
  const qtdAtrasadas = activeTasks.filter(isOverdue).length;

  // Total de tarefas únicas que exigem atenção imediata
  const pendenciasSet = new Set();
  activeTasks.forEach((t) => {
    if (isAguardandoCliente(t) || isOverdue(t)) {
      pendenciasSet.add(t.id);
    }
  });
  const totalPendencias = pendenciasSet.size;

  const subtituloPendencias =
    totalPendencias === 0
      ? 'Nenhuma pendência'
      : `${qtdAguardandoCliente} do cliente · ${qtdAtrasadas} vencidas`;

  // ==========================================
  // CARD 4: "Reuniões"
  // ==========================================
  const isMeeting = (t) => {
    if (isConcluido(t)) return false;
    const inAgendadoStage = stageAgendado && t.stage_id === stageAgendado.id;
    const hasMeetLink = Boolean(t.meet_link && t.meet_link.trim());
    const isStatusAgendado =
      t.status === 'Agendado' || t.status === 'Agendado / Validação';
    return inAgendadoStage || (hasMeetLink && t.is_meeting) || (t.is_meeting && isStatusAgendado);
  };

  const meetingTasks = activeTasks.filter(isMeeting);
  const totalReunioes = meetingTasks.length;

  const formatNextMeeting = () => {
    if (totalReunioes === 0) return 'Nenhum Meet agendado';

    const validDates = meetingTasks
      .map((t) => {
        const rawDate = t.meeting_start || t.due_date;
        if (!rawDate) return null;

        const dateObj = parseBrasiliaDate(rawDate);
        if (!dateObj) return null;
        const hasTime = Boolean(t.meeting_start);

        return { task: t, date: dateObj, hasTime };
      })
      .filter(Boolean);

    if (validDates.length === 0) {
      return `${totalReunioes} ${totalReunioes === 1 ? 'reunião agendada' : 'reuniões agendadas'}`;
    }

    validDates.sort((a, b) => a.date - b.date);
    const next = validDates[0];
    const dd = String(next.date.getDate()).padStart(2, '0');
    const mm = String(next.date.getMonth() + 1).padStart(2, '0');

    if (next.hasTime) {
      const hh = String(next.date.getHours()).padStart(2, '0');
      const min = String(next.date.getMinutes()).padStart(2, '0');
      return `Próximo: ${dd}/${mm} às ${hh}:${min}`;
    }

    return `Próximo: ${dd}/${mm}`;
  };

  const subtituloReunioes = formatNextMeeting();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 shrink-0 animate-fade-in">
      {/* KPI 1: Progresso */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3 sm:p-3.5 shadow-xs transition-all hover:shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-[#71717A]">Progresso</span>
          <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-[#18181B] tracking-tight">
          {progressPercent}%
        </div>
        {/* Barra de progresso na paleta lilás da marca (#6366F1) */}
        <div className="mt-2 w-full h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#6366F1] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#71717A] truncate">
          {completedTasks} de {totalTasks} concluídas
        </p>
      </div>

      {/* KPI 2: Em Execução */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3 sm:p-3.5 shadow-xs transition-all hover:shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-[#71717A]">Em Execução</span>
          <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-[#18181B] tracking-tight">
          {totalEmExecucao}
        </div>
        <p className="mt-2 text-xs text-[#71717A] truncate">
          {qtdEmAndamento} em andamento · {qtdAFazer} na fila
        </p>
      </div>

      {/* KPI 3: Pendências */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3 sm:p-3.5 shadow-xs transition-all hover:shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-[#71717A]">Pendências</span>
          <span
            className={`w-2 h-2 rounded-full ${
              totalPendencias > 0 ? 'bg-[#F59E0B]' : 'bg-[#6366F1]/30'
            }`}
          />
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-[#18181B] tracking-tight">
          {totalPendencias}
        </div>
        <p className="mt-2 text-xs text-[#71717A] truncate">
          {subtituloPendencias}
        </p>
      </div>

      {/* KPI 4: Reuniões */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3 sm:p-3.5 shadow-xs transition-all hover:shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-[#71717A]">Reuniões</span>
          <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
        </div>
        <div className="text-xl sm:text-2xl font-extrabold text-[#18181B] tracking-tight">
          {totalReunioes}
        </div>
        <p className="mt-2 text-xs text-[#71717A] truncate">
          {subtituloReunioes}
        </p>
      </div>
    </div>
  );
}
