import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Clock,
  Video,
  ExternalLink,
  Volume2,
  VolumeX,
  AlertTriangle,
  Calendar,
  ArrowRight,
  CheckCheck,
  CheckCircle2,
} from 'lucide-react';
import { playNotificationChime, isSoundMuted, setSoundMuted } from '../lib/sound';
import {
  getBrasiliaTodayStr,
  getMinutesUntilMeeting,
  isMeetingTodayInBrasilia,
} from '../lib/dateUtils';

/**
 * Formata data no padrão curto: '24 Nov', '12 Dez'
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

/**
 * Formata data e hora para reunião: 'Hoje às 14:00' ou '24 Nov às 14:00'
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
      return `Hoje às ${hours}:${mins}`;
    }
    const day = d.getDate();
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${day} ${months[d.getMonth()]} às ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

export default function NotificationBell({
  tasks = [],
  client = null,
  onSelectTask = null,
  onNavigateToHistory = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [muted, setMuted] = useState(isSoundMuted());
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const containerRef = useRef(null);
  const notifiedKeysRef = useRef(new Set());
  const initialLoadRef = useRef(true);

  // Gera a lista de notificações estritamente críticas de gestão
  const generateCriticalNotifications = useCallback(() => {
    const list = [];
    const todayStr = getBrasiliaTodayStr();

    for (const t of tasks) {
      // Ignora tarefas que já foram concluídas
      const isConcluido = t.status === 'Concluído';
      if (isConcluido) continue;

      // 1. Reuniões Google Meet (urgente se <= 60 min, ou agendada para hoje)
      if (t.meet_link && t.meeting_start) {
        try {
          const diffMin = getMinutesUntilMeeting(t.meeting_start);
          const isToday = isMeetingTodayInBrasilia(t.meeting_start);

          if (diffMin !== null && diffMin <= 60 && diffMin >= -30) {
            // Urgente: começa em menos de 1 hora ou acabou de começar
            list.push({
              id: `meet-urgent-${t.id}`,
              taskId: t.id,
              type: 'MEET_URGENT',
              priority: 'urgent',
              title: `Reunião em menos de 1h: ${t.title}`,
              description: diffMin > 0 ? `Começa em ${diffMin} minutos` : 'Reunião em andamento agora!',
              timeDisplay: formatMeetingTime(t.meeting_start),
              meetLink: t.meet_link,
              task: t,
            });
          } else if (isToday && diffMin !== null && diffMin > 0) {
            // Agendada para hoje mais tarde
            list.push({
              id: `meet-today-${t.id}`,
              taskId: t.id,
              type: 'MEET_SCHEDULED',
              priority: 'high',
              title: `Google Meet agendado: ${t.title}`,
              description: `Agendado para ${formatMeetingTime(t.meeting_start)}`,
              timeDisplay: formatMeetingTime(t.meeting_start),
              meetLink: t.meet_link,
              task: t,
            });
          }
        } catch (e) {
          console.warn('Erro ao avaliar reunião para notificação:', e);
        }
      }

      // 2. Datas de Vencimento dos Cards (due_date)
      if (t.due_date) {
        try {
          const taskDueStr = t.due_date.split('T')[0];
          // Calcula data de amanhã no fuso de Brasília
          const [y, m, d] = todayStr.split('-').map(Number);
          const tomDate = new Date(y, m - 1, d + 1);
          const tomorrowStr = `${tomDate.getFullYear()}-${String(tomDate.getMonth() + 1).padStart(2, '0')}-${String(tomDate.getDate()).padStart(2, '0')}`;

          if (taskDueStr === todayStr) {
            list.push({
              id: `due-today-${t.id}`,
              taskId: t.id,
              type: 'DUE_TODAY',
              priority: 'high',
              title: `Vence hoje: ${t.title}`,
              description: `Prazo limite de entrega programado para hoje`,
              timeDisplay: 'Hoje',
              task: t,
            });
          } else if (taskDueStr === tomorrowStr) {
            list.push({
              id: `due-tomorrow-${t.id}`,
              taskId: t.id,
              type: 'DUE_TOMORROW',
              priority: 'normal',
              title: `Vence amanhã: ${t.title}`,
              description: `Prazo limite de entrega programado para amanhã`,
              timeDisplay: 'Amanhã',
              task: t,
            });
          } else if (taskDueStr < todayStr) {
            list.push({
              id: `overdue-${t.id}`,
              taskId: t.id,
              type: 'OVERDUE',
              priority: 'urgent',
              title: `Atrasada: ${t.title}`,
              description: `Deveria ter sido concluído em ${formatDateShort(t.due_date)}`,
              timeDisplay: `Venceu ${formatDateShort(t.due_date)}`,
              task: t,
            });
          }
        } catch (e) {
          console.warn('Erro ao avaliar prazo para notificação:', e);
        }
      }
    }

    // Ordena: urgentes primeiro (meet em <1h e vencidos)
    return list.sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      return 0;
    });
  }, [tasks]);

  const allCriticalNotifications = generateCriticalNotifications();
  const activeNotifications = allCriticalNotifications.filter(
    (item) => !dismissedIds.has(item.id)
  );

  // Monitora novos alertas e dispara o som fofinho (sem repetir para o mesmo alerta na sessão)
  useEffect(() => {
    let hasNewCritical = false;

    for (const item of allCriticalNotifications) {
      if (!notifiedKeysRef.current.has(item.id)) {
        notifiedKeysRef.current.add(item.id);
        hasNewCritical = true;
      }
    }

    // Se detectou novo alerta crítico após o carregamento inicial, toca o som
    if (hasNewCritical && !initialLoadRef.current) {
      playNotificationChime();
    }
    initialLoadRef.current = false;
  }, [allCriticalNotifications]);

  // Intervalo a cada 30s para atualizar o relógio das reuniões e detectar janela de 60 min
  useEffect(() => {
    const timer = setInterval(() => {
      const current = generateCriticalNotifications();
      let hasNew = false;
      for (const item of current) {
        if (!notifiedKeysRef.current.has(item.id)) {
          notifiedKeysRef.current.add(item.id);
          hasNew = true;
        }
      }
      if (hasNew) {
        playNotificationChime();
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [generateCriticalNotifications]);

  // Fecha o popover ao clicar fora ou pressionar 'Escape'
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Alterna som mutado / ativado
  const handleToggleMute = (e) => {
    e.stopPropagation();
    const nextMuted = !muted;
    setMuted(nextMuted);
    setSoundMuted(nextMuted);
    if (!nextMuted) {
      playNotificationChime();
    }
  };

  // Limpa todos os alertas visuais ativos
  const handleDismissAll = (e) => {
    e.stopPropagation();
    setDismissedIds(new Set(allCriticalNotifications.map((n) => n.id)));
  };

  // Clica no card de notificação para abrir a tarefa diretamente
  const handleNotificationClick = (item) => {
    if (item.task && onSelectTask) {
      onSelectTask(item.task);
      setIsOpen(false);
    }
  };

  const count = activeNotifications.length;

  return (
    <div className="relative" ref={containerRef}>
      {/* Botão do Sino Roxinho */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Alertas Críticos de Gestão"
        className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 border ${
          isOpen
            ? 'bg-[#EEF2FF] text-[#6366F1] border-[#818CF8]'
            : 'bg-white hover:bg-[#F8FAFC] text-[#6366F1] border-[#E2E8F0] hover:border-[#818CF8]'
        }`}
      >
        <Bell className="w-4 h-4" />

        {/* Badge Lilás exclusivo para eventos críticos de gestão */}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#6366F1] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Popover de Notificações Críticas */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-[#E2E8F0] overflow-hidden z-50 animate-fade-in">
          {/* Header do Popover com Botão de Som Mute/Unmute */}
          <div className="px-4 py-3 bg-[#FAFAFA] border-b border-[#F1F5F9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] flex items-center justify-center text-[#6366F1]">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#18181B] tracking-tight">
                  Alertas Críticos de Gestão
                </h3>
                <p className="text-[10px] text-[#64748B]">
                  Reuniões e prazos prioritários
                </p>
              </div>
            </div>

            {/* Ações do Header: Mute/Unmute e Limpar */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleMute}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#6366F1] hover:bg-[#EEF2FF] transition-colors cursor-pointer"
                title={muted ? 'Reativar som de notificações' : 'Silenciar som de notificações'}
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#6366F1]" />
                )}
              </button>

              {count > 0 && (
                <button
                  type="button"
                  onClick={handleDismissAll}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6366F1] hover:text-[#4F46E5] px-1.5 py-1 rounded-md hover:bg-[#EEF2FF] transition-colors cursor-pointer"
                  title="Dispensar alertas visualizados"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>

          {/* Lista de Alertas Críticos */}
          <div className="max-h-84 overflow-y-auto divide-y divide-[#F1F5F9]">
            {activeNotifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-[#18181B]">
                  Tudo em dia!
                </p>
                <p className="text-[11px] text-[#64748B] mt-0.5 max-w-xs mx-auto">
                  Nenhuma reunião próxima ou card com prazo pendente precisando da sua atenção no momento.
                </p>
              </div>
            ) : (
              activeNotifications.map((item) => {
                const isMeet = item.type === 'MEET_URGENT' || item.type === 'MEET_SCHEDULED';
                const isOverdue = item.type === 'OVERDUE';
                const isDueToday = item.type === 'DUE_TODAY';
                const isDueTomorrow = item.type === 'DUE_TOMORROW';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 transition-all flex items-start gap-3 cursor-pointer group hover:bg-[#F8FAFC] ${
                      item.priority === 'urgent' ? 'bg-indigo-50/25' : ''
                    }`}
                  >
                    {/* Ícone Contextual */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs border ${
                        isMeet
                          ? 'bg-indigo-50 border-indigo-200 text-[#6366F1]'
                          : isOverdue
                          ? 'bg-rose-50 border-rose-200 text-rose-600'
                          : isDueToday
                          ? 'bg-amber-50 border-amber-200 text-amber-600'
                          : 'bg-blue-50 border-blue-200 text-blue-600'
                      }`}
                    >
                      {isMeet ? (
                        <Video className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>

                    {/* Conteúdo do Alerta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`text-xs font-bold leading-snug group-hover:text-[#6366F1] transition-colors ${
                            isOverdue
                              ? 'text-rose-950'
                              : isDueToday
                              ? 'text-amber-950'
                              : isDueTomorrow
                              ? 'text-blue-950'
                              : 'text-indigo-950'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] shrink-0 font-medium ml-1">
                          {item.timeDisplay}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#475569] mt-0.5 leading-snug">
                        {item.description}
                      </p>

                      {/* Botão de Ação Rápida para Reuniões Google Meet */}
                      {item.meetLink && (
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={item.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[11px] font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
                          >
                            <Video className="w-3 h-3" />
                            <span>Entrar na sala</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Clique para editar card
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé com link para ver o Histórico Completo de Auditoria */}
          <div className="p-2.5 bg-[#FAFAFA] border-t border-[#F1F5F9] flex items-center justify-between">
            <span className="text-[11px] text-[#64748B] pl-1.5">
              {activeNotifications.length > 0
                ? `${activeNotifications.length} alerta${activeNotifications.length > 1 ? 's' : ''} crítico${activeNotifications.length > 1 ? 's' : ''}`
                : 'Painel em dia'}
            </span>

            {onNavigateToHistory && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToHistory();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#6366F1] hover:text-[#4F46E5] hover:bg-[#EEF2FF] rounded-lg transition-colors cursor-pointer"
              >
                <span>Ver histórico completo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
