import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Clock, Building2 } from 'lucide-react';
import { supabase, getActivityLogs } from '../lib/supabase';

// Formatação limpa de data/hora (sem emojis)
function formatActivityTime(timestamp) {
  if (!timestamp) return 'Hoje, agora';
  try {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');

    if (isToday) {
      return `Hoje, ${hours}:${minutes}`;
    }
    if (isYesterday) {
      return `Ontem, ${hours}:${minutes}`;
    }
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
}

// Estilização corporativa de tag por origem
function renderSourceBadge(source) {
  const norm = String(source || 'Plataforma').trim().toLowerCase();

  if (norm.includes('sheet')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
        Google Sheets
      </span>
    );
  }
  if (norm.includes('form')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]">
        Google Forms
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
      {source || 'Plataforma'}
    </span>
  );
}

export default function HistoryTab({ client, clients = [] }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtro de Escopo ("current" | "all")
  const [scopeFilter, setScopeFilter] = useState('current');

  // Carrega os logs do Supabase
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getActivityLogs(null, 150);
      setLogs(data);
    } catch (err) {
      console.error('Erro ao carregar histórico de atividades:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Inscrição em tempo real no Supabase para a tabela activity_logs
  useEffect(() => {
    const channel = supabase
      .channel('point-activity-logs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_logs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLogs((prev) => {
              if (prev.some((item) => item.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setLogs((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setLogs((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtragem dos logs por escopo de cliente
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (scopeFilter === 'current') {
        if (!client) return false;
        const matchesId = log.client_id === client.id;
        const matchesName =
          log.client_name &&
          client.name &&
          log.client_name.toLowerCase().trim() === client.name.toLowerCase().trim();
        if (!matchesId && !matchesName) return false;
      }
      return true;
    });
  }, [logs, scopeFilter, client]);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden animate-fade-in">
      {/* 1. Barra Superior Minimalista e Compacta */}
      <div className="px-4 sm:px-6 py-3 border-b border-[#F1F5F9] flex items-center justify-between gap-3">
        {/* Título Limpo */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[#18181B] tracking-tight">
            Linha do Tempo de Atividades
          </h2>
          <span className="text-[11px] text-[#71717A] font-medium">
            ({filteredLogs.length})
          </span>
        </div>

        {/* Seletor de Escopo Exclusivo: Cliente Atual / Todos os Clientes */}
        <div className="inline-flex p-0.5 bg-[#F4F4F5] rounded-lg border border-[#E4E4E7] text-xs shrink-0">
          <button
            type="button"
            onClick={() => setScopeFilter('current')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              scopeFilter === 'current'
                ? 'bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white shadow-2xs'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            {client ? client.name : 'Cliente Atual'}
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              scopeFilter === 'all'
                ? 'bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white shadow-2xs'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <span>Todos os Clientes</span>
          </button>
        </div>
      </div>

      {/* 2. Container da Linha do Tempo */}
      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="py-14 text-center text-xs text-[#71717A]">
            <RefreshCw className="w-5 h-5 mx-auto text-[#6366F1] animate-spin mb-2" />
            Carregando eventos do histórico...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-14 text-center max-w-sm mx-auto">
            <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center text-[#71717A] mx-auto mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#18181B]">
              Nenhum evento registrado
            </h4>
            <p className="text-xs text-[#71717A] mt-1">
              {scopeFilter === 'current' && !client
                ? 'Nenhum cliente selecionado no dropdown superior. Selecione um cliente ou alterne para "Todos os Clientes".'
                : scopeFilter === 'current' && client
                ? `Não foram encontradas atividades registradas para ${client.name}.`
                : 'Nenhuma atividade recente encontrada no sistema.'}
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8">
            {/* Linha vertical contínua da timeline */}
            <div className="absolute left-2 sm:left-3 top-3 bottom-3 w-px bg-[#E2E8F0]" />

            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const timeLabel = formatActivityTime(log.created_at);
                const showClientName =
                  scopeFilter === 'all' && (log.client_name || log.client_id);

                return (
                  <div key={log.id} className="relative group">
                    {/* Marcador do ponto da timeline */}
                    <div className="absolute -left-[19px] sm:-left-[25px] top-2.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#6366F1] ring-2 ring-white group-hover:scale-125 transition-transform" />

                    {/* Conteúdo do Card */}
                    <div className="bg-[#FAFAFA] group-hover:bg-[#F8FAFC] border border-[#E2E8F0] group-hover:border-[#CBD5E1] rounded-xl p-3 sm:p-3.5 transition-all shadow-2xs">
                      {/* Linha Superior: Origem, Cliente e Horário */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {renderSourceBadge(log.source)}

                          {showClientName && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#475569] bg-white px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                              <Building2 className="w-3 h-3 text-[#64748B]" />
                              <span>{log.client_name || 'Cliente'}</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-medium text-[#71717A]">
                          {timeLabel}
                        </span>
                      </div>

                      {/* Descrição Objetiva do Evento */}
                      <p className="text-xs text-[#18181B] font-medium leading-relaxed">
                        {log.description || 'Evento registrado no sistema.'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
