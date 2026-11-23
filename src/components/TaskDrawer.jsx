import React, { useState, useEffect } from 'react';
import {
  X,
  FolderOpen,
  FileSpreadsheet,
  MessageCircle,
  Plus,
  Trash2,
  Check,
  Clock,
  User,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Building2,
  MapPin,
  Tag
} from 'lucide-react';
import { logActivity } from '../lib/supabase';

export default function TaskDrawer({
  task,
  client,
  stages = [],
  isOpen,
  onClose,
  onUpdateStatus,
  onUpdateStage,
  onUpdateChecklist,
}) {
  const [newChecklistText, setNewChecklistText] = useState('');
  const [localChecklist, setLocalChecklist] = useState([]);

  useEffect(() => {
    if (task && Array.isArray(task.checklist)) {
      setLocalChecklist(task.checklist);
    } else {
      setLocalChecklist([]);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  // Encontra a etapa atual
  const currentStage = stages.find((s) => s.id === task.stage_id);

  // Formata hora de atualização
  let updatedTimeFormatted = '14:32';
  if (task.updated_at) {
    try {
      const d = new Date(task.updated_at);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      updatedTimeFormatted = `${hours}:${minutes}`;
    } catch {
      // fallback
    }
  }

  // Alterna item do checklist
  const handleToggleChecklistItem = async (itemId) => {
    const updated = localChecklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setLocalChecklist(updated);
    if (onUpdateChecklist) {
      await onUpdateChecklist(task.id, updated);
    }
  };

  // Adiciona novo item ao checklist
  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      text: newChecklistText.trim(),
      done: false,
    };
    const updated = [...localChecklist, newItem];
    setLocalChecklist(updated);
    setNewChecklistText('');
    if (onUpdateChecklist) {
      await onUpdateChecklist(task.id, updated);
    }
  };

  // Remove item do checklist
  const handleRemoveChecklistItem = async (itemId) => {
    const updated = localChecklist.filter((item) => item.id !== itemId);
    setLocalChecklist(updated);
    if (onUpdateChecklist) {
      await onUpdateChecklist(task.id, updated);
    }
  };

  // Ação WhatsApp: Cobrar Pendência
  const handleOpenWhatsApp = () => {
    const phone = client?.contact_phone ? client.contact_phone.replace(/\D/g, '') : '';
    if (!phone) {
      alert('Telefone do cliente não cadastrado.');
      return;
    }
    const clientName = client?.name || 'sua empresa';
    const contactGreeting = client?.contact_name ? `Olá, ${client.contact_name}!` : 'Olá!';
    const text = `${contactGreeting} Aqui é da equipe de implantação da POINT. Start. Estamos acompanhando a implantação na ${clientName} e gostaríamos de alinhar a pendência: "${task.title}". Podemos apoiar com algum detalhe?`;
    
    // Se não tiver código do país, adiciona 55 (Brasil)
    const fullPhone = phone.length <= 11 ? `55${phone}` : phone;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    logActivity({
      clientId: client?.id,
      clientName: client?.name,
      actionType: 'WHATSAPP_REMINDER',
      description: `Cobrança de pendência da tarefa "${task?.title}" enviada para ${client?.contact_name || client?.name} via WhatsApp.`,
      source: 'Plataforma',
    });
  };

  // Ação WhatsApp: Enviar Planilha
  const handleSendSheetsWhatsApp = () => {
    if (!client?.sheets_url) {
      alert('Planilha ainda não gerada para este cliente.');
      return;
    }

    const rawPhone = client?.contact_phone
      ? String(client.contact_phone).replace(/\D/g, '')
      : '';

    if (!rawPhone) {
      alert('Telefone do cliente não cadastrado.');
      return;
    }

    const phone =
      rawPhone.length <= 11
        ? `55${rawPhone}`
        : rawPhone.startsWith('55')
        ? rawPhone
        : `55${rawPhone}`;

    const contactName = client?.contact_name ? `${client.contact_name}` : '';
    const clientName = client?.name || 'sua empresa';
    const message = contactName
      ? `Olá ${contactName}, tudo bem? Aqui é da equipe POINT.! Segue o link da planilha exclusiva da ${clientName} para preenchimento dos colaboradores: ${client.sheets_url}`
      : `Olá, tudo bem? Aqui é da equipe POINT.! Segue o link da planilha exclusiva da ${clientName} para preenchimento dos colaboradores: ${client.sheets_url}`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    logActivity({
      clientId: client?.id,
      clientName: client?.name,
      actionType: 'WHATSAPP_SHEETS',
      description: `Link da planilha enviado para ${client?.contact_name || client?.name} via WhatsApp.`,
      source: 'Plataforma',
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop suave */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-md bg-white shadow-2xl border-l border-[#E2E8F0] flex flex-col justify-between overflow-y-auto animate-fade-in">
          {/* Header da Gaveta */}
          <div className="p-6 border-b border-[#F4F4F5]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#71717A] tracking-wider uppercase">
                Detalhes da Tarefa
              </span>
              <button
                onClick={onClose}
                className="flex items-center gap-1 text-xs font-semibold text-[#71717A] hover:text-[#18181B] px-2 py-1 rounded-lg hover:bg-[#F4F4F5] transition-colors cursor-pointer"
              >
                <span>Fechar</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Título Principal */}
            <h2 className="text-xl font-bold text-[#18181B] leading-tight mb-3">
              {task.title}
            </h2>

            {/* Subtítulo: Etapa e Status */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Seletor de Etapa */}
              <select
                value={task.stage_id}
                onChange={(e) => onUpdateStage(task.id, e.target.value)}
                className="bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] font-semibold rounded-lg px-2.5 py-1.5 border border-[#E2E8F0] cursor-pointer focus:outline-none"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              {/* Seletor de Status com bolinha indicadora */}
              <div className="relative inline-flex items-center">
                <select
                  value={task.status}
                  onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                  className={`font-semibold rounded-lg pl-6 pr-3 py-1.5 border cursor-pointer focus:outline-none text-xs transition-colors ${
                    task.status === 'Concluído'
                      ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                      : task.status === 'Em Andamento'
                      ? 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]'
                      : task.status === 'Aguardando Cliente'
                      ? 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
                      : task.status === 'Agendado'
                      ? 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]'
                      : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
                  }`}
                >
                  <option value="A Fazer">A Fazer</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Aguardando Cliente">Aguardando Cliente</option>
                  <option value="Agendado">Agendado</option>
                  <option value="Concluído">Concluído</option>
                </select>
                <span
                  className={`absolute left-2.5 w-2 h-2 rounded-full pointer-events-none ${
                    task.status === 'Concluído'
                      ? 'bg-[#10B981]'
                      : task.status === 'Em Andamento'
                      ? 'bg-[#3B82F6]'
                      : task.status === 'Aguardando Cliente'
                      ? 'bg-[#F59E0B]'
                      : task.status === 'Agendado'
                      ? 'bg-[#A855F7]'
                      : 'bg-[#818CF8]'
                  }`}
                />
              </div>

              {/* Badge Responsável */}
              <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[#FAFAFA] border border-[#E4E4E7] text-[#71717A]">
                Resp: <strong className="text-[#18181B]">{task.owner || 'POINT.'}</strong>
              </span>
            </div>
          </div>

          {/* Conteúdo Central */}
          <div className="p-6 space-y-6 flex-1">
            {/* Descrição se houver */}
            {task.description && (
              <div>
                <h4 className="text-xs font-bold text-[#71717A] uppercase tracking-wider mb-1.5">
                  Descrição
                </h4>
                <p className="text-sm text-[#3F3F46] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                  {task.description}
                </p>
              </div>
            )}

            {/* Checklist de Atividades */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">
                  Checklist de Atividades
                </h4>
                <span className="text-xs font-semibold text-[#71717A]">
                  {localChecklist.filter((i) => i.done).length}/{localChecklist.length}
                </span>
              </div>

              <div className="space-y-2 mb-3">
                {localChecklist.length === 0 ? (
                  <p className="text-xs text-[#A1A1AA] italic py-1">
                    Nenhum item adicionado no checklist.
                  </p>
                ) : (
                  localChecklist.map((item) => (
                    <div
                      key={item.id}
                      className="group/item flex items-center justify-between gap-2.5 p-2 rounded-lg hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-colors"
                    >
                      <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleChecklistItem(item.id)}
                          className="w-4 h-4 rounded text-[#818CF8] focus:ring-[#818CF8] focus:ring-offset-0 border-[#D1D5DB] cursor-pointer"
                        />
                        <span
                          className={`text-sm leading-snug transition-all ${
                            item.done
                              ? 'line-through text-[#A1A1AA]'
                              : 'text-[#18181B] font-medium'
                          }`}
                        >
                          {item.text}
                        </span>
                      </label>
                      <button
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="opacity-0 group-hover/item:opacity-100 p-1 text-[#A1A1AA] hover:text-[#EF4444] transition-all cursor-pointer"
                        title="Remover item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Formulário para novo item simples */}
              <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Novo item de checklist..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                />
                <button
                  type="submit"
                  disabled={!newChecklistText.trim()}
                  className="px-3 py-2 bg-[#18181B] hover:bg-[#27272A] disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Critério de Conclusão */}
            <div>
              <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider mb-2">
                Critério de Conclusão
              </h4>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 text-xs text-[#3F3F46] leading-relaxed">
                {task.completion_criteria ||
                  'Arquivo AFD importado sem erros no sistema POINT e dados validados pela equipe.'}
              </div>
            </div>

            {/* Dados da Empresa (se houver CNPJ, Cidade/UF ou Segmento) */}
            {(client?.cnpj || client?.city_state || client?.segment) && (
              <div>
                <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#818CF8]" />
                  <span>Dados da Empresa</span>
                </h4>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 space-y-2 text-xs">
                  {client?.cnpj && (
                    <div className="flex items-center justify-between text-[#71717A]">
                      <span className="font-medium">CNPJ:</span>
                      <span className="font-semibold font-mono text-[#18181B]">{client.cnpj}</span>
                    </div>
                  )}
                  {client?.city_state && (
                    <div className="flex items-center justify-between text-[#71717A]">
                      <span className="font-medium">Cidade/UF:</span>
                      <span className="font-semibold text-[#18181B]">{client.city_state}</span>
                    </div>
                  )}
                  {client?.segment && (
                    <div className="flex items-center justify-between text-[#71717A]">
                      <span className="font-medium">Segmento:</span>
                      <span className="font-semibold text-[#4F46E5]">{client.segment}</span>
                    </div>
                  )}
                  {client?.contact_name && (
                    <div className="flex items-center justify-between text-[#71717A]">
                      <span className="font-medium">Responsável:</span>
                      <span className="font-semibold text-[#18181B]">{client.contact_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ações Rápidas (conectadas aos dados reais do cliente) */}
            <div>
              <h4 className="text-xs font-bold text-[#18181B] uppercase tracking-wider mb-2.5">
                Ações Rápidas
              </h4>
              <div className="space-y-2">
                {/* Botão Abrir Pasta Drive */}
                <button
                  onClick={() => {
                    if (client?.drive_folder_url) {
                      window.open(client.drive_folder_url, '_blank');
                    } else {
                      alert('URL da pasta no Google Drive não informada para este cliente.');
                    }
                  }}
                  disabled={!client?.drive_folder_url}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#18181B] text-[#18181B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:hover:bg-transparent font-semibold text-xs transition-all cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Abrir Pasta Drive</span>
                </button>

                {/* Botão Abrir Planilha Sheets */}
                <button
                  onClick={() => {
                    if (client?.sheets_url) {
                      window.open(client.sheets_url, '_blank');
                    } else {
                      alert('URL da planilha Google Sheets não informada para este cliente.');
                    }
                  }}
                  disabled={!client?.sheets_url}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#18181B] text-[#18181B] hover:bg-[#F4F4F5] disabled:opacity-40 font-semibold text-xs transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
                  <span>Abrir Planilha Sheets</span>
                </button>

                {/* Botão Enviar Planilha no WhatsApp */}
                <button
                  onClick={handleSendSheetsWhatsApp}
                  disabled={!client?.sheets_url}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#10B981] text-[#18181B] hover:bg-[#ECFDF5] disabled:opacity-50 disabled:hover:bg-transparent font-semibold text-xs transition-all cursor-pointer group"
                >
                  <MessageCircle className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform" />
                  <span>
                    {client?.sheets_url
                      ? 'Enviar Planilha no WhatsApp'
                      : 'Planilha ainda não gerada'}
                  </span>
                </button>

                {/* Botão Cobrar via WhatsApp */}
                <button
                  onClick={handleOpenWhatsApp}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2E8F0] hover:border-[#10B981] text-[#18181B] hover:bg-[#ECFDF5] font-semibold text-xs transition-all cursor-pointer group"
                >
                  <MessageCircle className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform" />
                  <span>Cobrar via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rodapé da Gaveta */}
          <div className="p-4 bg-[#FAFAFA] border-t border-[#F4F4F5] text-center">
            <span className="text-[11px] text-[#A1A1AA]">
              Atualizado por <strong>POINT.</strong> às {updatedTimeFormatted}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

