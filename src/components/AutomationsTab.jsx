import React, { useState } from 'react';
import {
  Zap,
  FolderSync,
  FileSpreadsheet,
  MessageCircle,
  Bell,
  CheckCircle2,
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Send,
  Workflow
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Helper para formatar timestamps amigáveis
function formatLogTime(timestamp) {
  if (!timestamp) return 'Hoje, agora';
  try {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    // Ontem
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
    return `${day}/${month}, ${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
}

export default function AutomationsTab({
  client,
  logs = [],
  onRefreshLogs,
}) {
  const [showAllClients, setShowAllClients] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);

  // Estado dos switches de automação
  const [automationsState, setAutomationsState] = useState({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });

  const toggleAutomation = (id) => {
    setAutomationsState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Simular evento em tempo real no Supabase
  const handleSimulateAutomation = async () => {
    if (!client) return;
    setSimulationLoading(true);
    try {
      const sampleEvents = [
        {
          rule_name: 'Alerta SLA 24h',
          integration: 'n8n + WhatsApp',
          message: `[SLA] Notificação automática de prazo enviada ao gestor de RH da ${client.name}.`
        },
        {
          rule_name: 'Checklist 100% -> Avanço',
          integration: 'Supabase Hook + n8n',
          message: `[Etapa] Todas as tarefas da etapa concluídas. Status do projeto atualizado para "No Prazo".`
        },
        {
          rule_name: 'Sincronização AFD',
          integration: 'n8n + Google Drive',
          message: `[Drive] Arquivo AFD Secullum detectado na pasta e processado com sucesso.`
        }
      ];

      const picked = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];

      await supabase.from('automation_logs').insert({
        client_id: client.id,
        rule_name: picked.rule_name,
        message: picked.message,
        integration: picked.integration,
      });

      if (onRefreshLogs) onRefreshLogs();
    } catch (err) {
      console.error('Erro na simulação:', err);
    } finally {
      setSimulationLoading(false);
    }
  };

  // Filtra logs
  const displayLogs = showAllClients
    ? logs
    : logs.filter((log) => !client || log.client_id === client.id);

  return (
    <div className="space-y-6">
      {/* Banner de Arquitetura Ativa */}
      <div className="bg-gradient-to-r from-white via-[#F8FAFC] to-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#18181B] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Workflow className="w-5 h-5 text-[#818CF8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#18181B]">
                Arquitetura Ativa de Onboarding n8n &middot; Secullum &rarr; POINT.
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                Operacional
              </span>
            </div>
            <p className="text-xs text-[#71717A] mt-0.5">
              Google Forms &rarr; Google Drive &amp; Sheets &rarr; Supabase RPC &rarr; WhatsApp Webhook
            </p>
          </div>
        </div>

        <button
          onClick={handleSimulateAutomation}
          disabled={simulationLoading || !client}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] text-xs font-semibold border border-[#E2E8F0] transition-all cursor-pointer disabled:opacity-50"
        >
          <Zap className={`w-3.5 h-3.5 text-[#818CF8] ${simulationLoading ? 'animate-spin' : ''}`} />
          <span>Simular Disparo n8n</span>
        </button>
      </div>

      {/* Grid Principal: 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Automações Ativas (5 regras com toggle) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-[#18181B] flex items-center gap-2">
              <span>Automações Ativas</span>
              <span className="text-xs font-semibold text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                {Object.values(automationsState).filter(Boolean).length}/5 ativas
              </span>
            </h2>
            <button
              onClick={() => alert('Criação de novas regras personalizadas via webhook n8n integrada!')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Automação</span>
            </button>
          </div>

          {/* Cards de Automação */}
          <div className="space-y-3">
            {/* Regra 1 */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4.5 shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#18181B]">
                    1. Novo Cliente &rarr; Clonar Modelo
                  </h4>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Gatilho:</strong> Novo cliente cadastrado no formulário
                  </p>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Ação:</strong> Cria checklist, estrutura de pastas no Drive e planilha
                  </p>
                </div>
                {/* Switch */}
                <button
                  type="button"
                  onClick={() => toggleAutomation(1)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    automationsState[1] ? 'bg-[#10B981]' : 'bg-[#E4E4E7]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      automationsState[1] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F4F5] flex items-center justify-end gap-1.5 text-[11px] text-[#71717A]">
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">n8n</span>
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">Drive</span>
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">Sheets</span>
              </div>
            </div>

            {/* Regra 2 */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4.5 shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#18181B]">
                    2. Pendência 48h &rarr; WhatsApp
                  </h4>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Gatilho:</strong> Tarefa pendente com cliente há mais de 48h
                  </p>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Ação:</strong> Cobra dados (AFD ou colaboradores) via WhatsApp
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAutomation(2)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    automationsState[2] ? 'bg-[#10B981]' : 'bg-[#E4E4E7]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      automationsState[2] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F4F5] flex items-center justify-end gap-1.5 text-[11px] text-[#71717A]">
                <span className="px-2 py-0.5 rounded bg-[#ECFDF5] font-semibold text-[#065F46]">WhatsApp Webhook</span>
              </div>
            </div>

            {/* Regra 3 */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4.5 shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#18181B]">
                    3. Prazo 24h &rarr; Alerta SLA
                  </h4>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Gatilho:</strong> Vencimento de tarefa em 24h
                  </p>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Ação:</strong> Notifica analista responsável da POINT.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAutomation(3)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    automationsState[3] ? 'bg-[#10B981]' : 'bg-[#E4E4E7]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      automationsState[3] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F4F5] flex items-center justify-end gap-1.5 text-[11px] text-[#71717A]">
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">Alerta SLA</span>
              </div>
            </div>

            {/* Regra 4 */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4.5 shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#18181B]">
                    4. Checklist 100% &rarr; Avançar Etapa
                  </h4>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Gatilho:</strong> Todas as tarefas da etapa concluídas
                  </p>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Ação:</strong> Altera status do projeto e notifica stakeholders
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAutomation(4)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    automationsState[4] ? 'bg-[#10B981]' : 'bg-[#E4E4E7]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      automationsState[4] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F4F5] flex items-center justify-end gap-1.5 text-[11px] text-[#71717A]">
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">n8n</span>
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">Sheets</span>
              </div>
            </div>

            {/* Regra 5 */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4.5 shadow-xs hover:border-[#CBD5E1] transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#18181B]">
                    5. Ciclo 30d &rarr; Encerrar &amp; CSAT
                  </h4>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Gatilho:</strong> 30 dias de produção assistida concluídos
                  </p>
                  <p className="text-xs text-[#52525B]">
                    <strong className="text-[#18181B]">Ação:</strong> Envia termo de aceite de homologação e pesquisa de satisfação
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAutomation(5)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    automationsState[5] ? 'bg-[#10B981]' : 'bg-[#E4E4E7]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      automationsState[5] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#F4F4F5] flex items-center justify-end gap-1.5 text-[11px] text-[#71717A]">
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">n8n</span>
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">WhatsApp</span>
                <span className="px-2 py-0.5 rounded bg-[#F4F4F5] font-semibold text-[#52525B]">Sheets</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Atividade em Tempo Real */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#F4F4F5] mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#18181B]">
                Atividade em Tempo Real
              </h3>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" title="Inscrição em tempo real ativa" />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAllClients(!showAllClients)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                  showAllClients
                    ? 'bg-[#18181B] text-white border-[#18181B]'
                    : 'bg-[#F4F4F5] text-[#52525B] border-[#E2E8F0]'
                }`}
              >
                {showAllClients ? 'Todos Clientes' : 'Este Cliente'}
              </button>
              {onRefreshLogs && (
                <button
                  onClick={onRefreshLogs}
                  title="Atualizar Logs"
                  className="p-1 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-md transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Timeline de Logs */}
          <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
            {displayLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#71717A]">
                Nenhum log registrado ainda para este cliente.
              </div>
            ) : (
              displayLogs.map((log) => {
                const formattedTime = formatLogTime(log.created_at);
                return (
                  <div key={log.id} className="flex items-start gap-3 text-xs leading-relaxed group">
                    {/* Ponto verde de status */}
                    <div className="mt-1 shrink-0">
                      <span className="block w-2.5 h-2.5 rounded-full bg-[#10B981] ring-4 ring-[#ECFDF5]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-bold text-[#18181B]">
                          {formattedTime}
                        </span>
                        {log.integration && (
                          <span className="text-[10px] text-[#71717A] bg-[#F4F4F5] px-1.5 py-0.2 rounded font-medium">
                            {log.integration}
                          </span>
                        )}
                      </div>
                      <p className="text-[#3F3F46]">
                        {log.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

