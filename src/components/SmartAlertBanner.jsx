import React, { useState } from 'react';
import { Video, Clock, ExternalLink, X, AlertTriangle, ArrowRight } from 'lucide-react';
import {
  isMeetingTodayInBrasilia,
  getMinutesUntilMeeting,
  formatBrasiliaDateTime,
} from '../lib/dateUtils';

export default function SmartAlertBanner({
  client,
  tasks = [],
  stages = [],
  onSelectTask,
}) {
  const [dismissedAlerts, setDismissedAlerts] = useState({});

  if (!client || !tasks || tasks.length === 0) return null;

  const now = new Date();
  const aguardandoStage = stages.find(
    (s) =>
      s.title?.toLowerCase().includes('aguardando') ||
      s.position === 3
  );

  // 1. Alerta de Reunião Google Meet (Hoje ou nas próximas 2 horas)
  const meetingTask = tasks.find((t) => {
    if (!t.meet_link || !t.meeting_start || t.status === 'Concluído') return false;
    if (dismissedAlerts[`meet_${t.id}`]) return false;

    const isToday = isMeetingTodayInBrasilia(t.meeting_start);
    const diffMin = getMinutesUntilMeeting(t.meeting_start);

    // Reunião hoje ou nas próximas 2 horas (ou iniciada há menos de 1 hora)
    return isToday || (diffMin !== null && diffMin >= -60 && diffMin <= 120);
  });

  // 2. Alerta de Tarefa travada em "Aguardando Cliente" há mais de 48h
  const stuckTask = tasks.find((t) => {
    if (!aguardandoStage || t.stage_id !== aguardandoStage.id || t.status === 'Concluído') return false;
    if (dismissedAlerts[`stuck_${t.id}`]) return false;

    const lastUpdated = new Date(t.updated_at || t.created_at || now);
    const hoursElapsed = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    return hoursElapsed >= 48;
  });

  if (!meetingTask && !stuckTask) return null;

  const handleDismiss = (id) => {
    setDismissedAlerts((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex flex-col gap-2 mb-3 shrink-0 animate-fade-in">
      {/* Alerta de Reunião Google Meet */}
      {meetingTask && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 rounded-xl bg-gradient-to-r from-indigo-50/90 to-purple-50/90 border border-indigo-200/80 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded-lg bg-indigo-600 text-white shrink-0">
              <Video className="w-3.5 h-3.5" />
            </span>
            <div className="text-xs text-indigo-950 font-medium truncate">
              <span className="font-bold text-indigo-900">Reunião Agendada:</span>{' '}
              <span>"{meetingTask.title}"</span>
              {meetingTask.meeting_start && (
                <span className="text-indigo-700 font-semibold ml-1.5">
                  às {formatBrasiliaDateTime(meetingTask.meeting_start, true).split(' às ')[1] || new Date(meetingTask.meeting_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={meetingTask.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold shadow-2xs transition-colors"
            >
              <span>Entrar no Meet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={() => handleDismiss(`meet_${meetingTask.id}`)}
              className="p-1 text-indigo-400 hover:text-indigo-700 rounded-md transition-colors cursor-pointer"
              title="Fechar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Alerta de Pendência Cliente há mais de 48h */}
      {stuckTask && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 rounded-xl bg-amber-50/90 border border-amber-200 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1 rounded-lg bg-amber-500 text-white shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </span>
            <div className="text-xs text-amber-950 font-medium truncate">
              <span className="font-bold text-amber-900">Atenção Prioritária:</span>{' '}
              <span>A etapa "{stuckTask.title}" está aguardando retorno do cliente há mais de 48 horas.</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSelectTask && (
              <button
                type="button"
                onClick={() => onSelectTask(stuckTask)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Ver Tarefa</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDismiss(`stuck_${stuckTask.id}`)}
              className="p-1 text-amber-400 hover:text-amber-700 rounded-md transition-colors cursor-pointer"
              title="Fechar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
