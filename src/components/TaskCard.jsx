import React from 'react';
import { CheckSquare, Calendar, ChevronRight, Pencil, Video, ExternalLink, Clock } from 'lucide-react';
import { getBrasiliaTodayStr } from '../lib/dateUtils';

/**
 * Formata data e hora para reunião: 'Hoje, 14:00' ou '24 Nov, 14:00'
 */
function formatMeetingTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    if (isToday) {
      return `Hoje, ${hours}:${mins}`;
    }
    const day = d.getDate();
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${day} ${months[d.getMonth()]}, ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formata data no padrão '12 Out', '23 Nov'
 */
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${parseInt(day, 10)} ${months[monthIndex] || ''}`;
    }
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${day} ${months[d.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

export default function TaskCard({
  task,
  onSelect,
  onDragStart,
  isDragging = false,
}) {
  const isPointOwner = task.owner === 'POINT.' || task.owner?.toLowerCase() === 'point';
  const formattedDate =
    task.start_date && task.due_date && task.start_date.split('T')[0] !== task.due_date.split('T')[0]
      ? `${formatDateShort(task.start_date)} - ${formatDateShort(task.due_date)}`
      : formatDateShort(task.due_date);

  // Checagem de vencimento para cards fora de 'Concluído'
  const isConcluido = task.status === 'Concluído';
  let dueDateStatus = 'normal'; // 'normal' | 'today' | 'overdue'

  if (!isConcluido && task.due_date) {
    try {
      const todayStr = getBrasiliaTodayStr();
      const taskDueStr = task.due_date.split('T')[0];
      if (taskDueStr === todayStr) {
        dueDateStatus = 'today';
      } else if (taskDueStr < todayStr) {
        dueDateStatus = 'overdue';
      }
    } catch {}
  }

  // Calcula itens do checklist
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const totalItems = checklist.length;
  const doneItems = checklist.filter((item) => item.done).length;
  const checklistPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, task)}
      onClick={() => onSelect(task)}
      className={`group relative bg-white rounded-xl border border-[#E2E8F0] p-3.5 shadow-xs hover:shadow-md hover:border-[#CBD5E1] transition-all duration-200 cursor-pointer select-none active:scale-[0.99] ${
        isDragging ? 'opacity-40 scale-95' : 'opacity-100'
      } ${
        task.status === 'Concluído' ? 'border-l-4 border-l-[#10B981]' : ''
      }`}
    >
      {/* Título da Tarefa e Botão Editar Lápis */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <h4 className="text-sm font-semibold text-[#18181B] leading-snug group-hover:text-[#6366F1] transition-colors">
          {task.title}
        </h4>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(task);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-[#71717A] hover:text-[#6366F1] hover:bg-[#F4F4F5] rounded-md transition-all shrink-0 cursor-pointer"
          title="Editar tarefa"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Linha de Metadados: Badge Responsável + Data */}
      <div className="flex items-center justify-between gap-2 text-xs">
        {/* Badge de Responsável */}
        {isPointOwner ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#18181B] text-white text-[11px] font-bold tracking-tight">
            <span>POINT</span>
            <span className="text-[#818CF8] font-black">.</span>
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F4F4F5] text-[#52525B] text-[11px] font-semibold border border-[#E4E4E7]/60">
            Cliente
          </span>
        )}

        {/* Data formatada com indicador visual discreto */}
        {formattedDate && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md shrink-0 transition-colors ${
              dueDateStatus === 'overdue'
                ? 'bg-rose-50 text-rose-700 border border-rose-200/80 font-semibold'
                : dueDateStatus === 'today'
                ? 'bg-amber-50 text-amber-700 border border-amber-200/80 font-semibold'
                : 'text-[#71717A] font-medium'
            }`}
            title={
              dueDateStatus === 'overdue'
                ? 'Prazo vencido'
                : dueDateStatus === 'today'
                ? 'Vence hoje'
                : 'Data de vencimento'
            }
          >
            {dueDateStatus === 'overdue' && <Clock className="w-3 h-3 text-rose-600 shrink-0" />}
            {dueDateStatus === 'today' && <Clock className="w-3 h-3 text-amber-600 shrink-0" />}
            <span>{formattedDate}</span>
          </span>
        )}
      </div>

      {/* Badge e Ação Rápida de Reunião Google Meet */}
      {task.meet_link && (
        <div className="mt-2.5 pt-2 border-t border-[#F4F4F5] flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 min-w-0 text-[11px] font-medium text-indigo-700 truncate">
            <Video className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">
              {task.meeting_start ? formatMeetingTime(task.meeting_start) : 'Meet agendado'}
            </span>
          </div>
          <a
            href={task.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] shadow-2xs transition-colors shrink-0"
            title="Entrar na reunião do Google Meet"
          >
            <span>Entrar no Meet</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

      {/* Mini barra de progresso caso possua itens no checklist */}
      {totalItems > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#F4F4F5]">
          <div className="flex items-center justify-between text-[11px] text-[#71717A] mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-[#818CF8]" />
              <span>{doneItems}/{totalItems}</span>
            </span>
            <span className="font-semibold text-[#52525B]">{checklistPercent}%</span>
          </div>
          <div className="w-full h-1 bg-[#F4F4F5] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                checklistPercent === 100
                  ? 'bg-[#10B981]'
                  : 'bg-gradient-to-r from-[#818CF8] to-[#10B981]'
              }`}
              style={{ width: `${checklistPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

