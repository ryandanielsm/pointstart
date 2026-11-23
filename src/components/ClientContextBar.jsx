import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  ChevronDown,
  Check,
  MapPin,
  Tag,
  User,
  Trash2,
  FolderOpen,
  FileSpreadsheet,
  Plus,
  Users,
  ExternalLink,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ClientContextBar({
  clients = [],
  selectedClient,
  onSelectClient,
  onUpdateClientStatus,
  onOpenImportEmployees,
  onOpenNewClient,
  onOpenDeleteClient,
  onNewTask,
}) {
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [filesMenuOpen, setFilesMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [openingDrive, setOpeningDrive] = useState(false);
  const [openingSheets, setOpeningSheets] = useState(false);

  const clientMenuRef = useRef(null);
  const statusMenuRef = useRef(null);
  const filesMenuRef = useRef(null);
  const addMenuRef = useRef(null);

  // Abertura dinâmica da pasta do Drive com consulta instantânea ao Supabase se não estiver no estado local
  const handleOpenDrive = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    let url = selectedClient.drive_folder_url;
    if (!url && selectedClient.id && !selectedClient.isTemp) {
      setOpeningDrive(true);
      try {
        const { data } = await supabase
          .from('clients')
          .select('id, drive_folder_url, sheets_url')
          .eq('id', selectedClient.id)
          .single();

        if (data?.drive_folder_url) {
          url = data.drive_folder_url;
          onSelectClient?.({ ...selectedClient, ...data });
        }
      } catch (err) {
        console.warn('Erro ao consultar Drive no Supabase:', err);
      } finally {
        setOpeningDrive(false);
      }
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setFilesMenuOpen(false);
    } else {
      alert('A pasta no Google Drive ainda está sendo gerada pelo sistema. Aguarde alguns instantes e tente novamente.');
    }
  };

  // Abertura dinâmica da planilha do Sheets com consulta instantânea ao Supabase se não estiver no estado local
  const handleOpenSheets = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    let url = selectedClient.sheets_url;
    if (!url && selectedClient.id && !selectedClient.isTemp) {
      setOpeningSheets(true);
      try {
        const { data } = await supabase
          .from('clients')
          .select('id, drive_folder_url, sheets_url')
          .eq('id', selectedClient.id)
          .single();

        if (data?.sheets_url) {
          url = data.sheets_url;
          onSelectClient?.({ ...selectedClient, ...data });
        }
      } catch (err) {
        console.warn('Erro ao consultar Sheets no Supabase:', err);
      } finally {
        setOpeningSheets(false);
      }
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setFilesMenuOpen(false);
    } else {
      alert('A planilha de colaboradores ainda está sendo gerada pelo sistema. Aguarde alguns instantes e tente novamente.');
    }
  };

  // Fecha menus ao clicar fora ou ao pressionar 'Escape'
  useEffect(() => {
    function handleClickOutside(event) {
      if (clientMenuRef.current && !clientMenuRef.current.contains(event.target)) {
        setClientMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setStatusMenuOpen(false);
      }
      if (filesMenuRef.current && !filesMenuRef.current.contains(event.target)) {
        setFilesMenuOpen(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setAddMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setClientMenuOpen(false);
        setStatusMenuOpen(false);
        setFilesMenuOpen(false);
        setAddMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Status simplificado: Ativo ou Desativado
  const isDesativado = selectedClient?.status === 'Desativado';
  const currentStatus = isDesativado ? 'Desativado' : 'Ativo';

  return (
    <div className="relative z-30 bg-white rounded-2xl border border-[#E2E8F0] p-3 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-4 transition-all mb-3 sm:mb-3.5 shrink-0">
      {/* Lado Esquerdo: Identificação do Cliente & Metadados */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[#18181B] truncate">
              {selectedClient ? selectedClient.name : 'Nenhuma empresa selecionada'}
            </h2>
          </div>

          {/* Metadados discretos quando preenchidos */}
          {selectedClient && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
              {selectedClient.cnpj && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                  <span className="text-[#64748B] font-semibold">CNPJ:</span>
                  <span className="font-mono">{selectedClient.cnpj}</span>
                </span>
              )}
              {(selectedClient.city_state || selectedClient.city) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                  <MapPin className="w-3 h-3 text-[#818CF8]" />
                  <span>{selectedClient.city_state || selectedClient.city}</span>
                </span>
              )}
              {selectedClient.segment && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded-md border border-[#C7D2FE]">
                  <Tag className="w-3 h-3 text-[#818CF8]" />
                  <span>{selectedClient.segment}</span>
                </span>
              )}
              {(selectedClient.contact_name || selectedClient.responsible) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                  <User className="w-3 h-3 text-[#64748B]" />
                  <span>{selectedClient.contact_name || selectedClient.responsible}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lado Direito: Controles Compactos em 3 Grupos Lógicos */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap">
        {clients.length === 0 ? (
          /* Estado Vazio: Apenas botão compacto "+ Nova Empresa" */
          <button
            type="button"
            onClick={onOpenNewClient}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-medium shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nova Empresa</span>
          </button>
        ) : (
          <>
            {/* GRUPO A: Gestão da Empresa Atual ([Seletor Empresa] + [Status] + [Lixeira]) */}
            <div className="flex items-center gap-1.5">
              {/* 1. Dropdown de Troca de Empresa */}
              <div className="relative" ref={clientMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setClientMenuOpen(!clientMenuOpen);
                    setStatusMenuOpen(false);
                    setFilesMenuOpen(false);
                    setAddMenuOpen(false);
                  }}
                  className="h-9 flex items-center gap-1.5 px-3 rounded-xl text-xs font-medium text-[#18181B] bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] transition-all cursor-pointer max-w-[170px] shadow-2xs"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
                  <span className="truncate max-w-[105px]">
                    {selectedClient ? selectedClient.name : 'Selecionar...'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#64748B] shrink-0 transition-transform duration-200 ${
                      clientMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {clientMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-[#E2E8F0] py-2 z-50 animate-fade-in">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F1F5F9]">
                      Empresas Cadastradas ({clients.length})
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {clients.map((c) => {
                        const isSelected = selectedClient?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              onSelectClient(c);
                              setClientMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-[#F8FAFC] cursor-pointer ${
                              isSelected
                                ? 'bg-[#EEF2FF] font-semibold text-[#18181B]'
                                : 'text-[#334155]'
                            }`}
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="truncate">{c.name}</span>
                              <span className="text-[10px] text-[#64748B] truncate">
                                {[c.segment, c.city_state, c.status || 'Ativo'].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-[#F1F5F9] pt-1 px-2">
                      <button
                        type="button"
                        onClick={() => {
                          setClientMenuOpen(false);
                          onOpenNewClient();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#18181B] hover:text-[#6366F1] hover:bg-[#EEF2FF] rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Criar Nova Empresa...
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Dropdown Compacto de Status */}
              {selectedClient && (
                <div className="relative" ref={statusMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMenuOpen(!statusMenuOpen);
                      setClientMenuOpen(false);
                      setFilesMenuOpen(false);
                      setAddMenuOpen(false);
                    }}
                    title="Alterar status da empresa"
                    className="h-9 flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-medium bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] text-[#18181B] transition-all cursor-pointer shadow-2xs"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isDesativado ? 'bg-[#94A3B8]' : 'bg-[#10B981]'
                      }`}
                    />
                    <span>{currentStatus}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-[#64748B] transition-transform duration-200 ${
                        statusMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {statusMenuOpen && (
                    <div className="absolute right-0 mt-2 w-36 rounded-xl bg-white shadow-xl border border-[#E2E8F0] p-1.5 z-50 animate-fade-in">
                      <div className="px-2 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                        Status
                      </div>
                      {[
                        { label: 'Ativo', dot: 'bg-[#10B981]' },
                        { label: 'Desativado', dot: 'bg-[#94A3B8]' },
                      ].map((opt) => {
                        const isCurrent = currentStatus === opt.label;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              onUpdateClientStatus?.(opt.label);
                              setStatusMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-[#F1F5F9] text-[#18181B] font-semibold'
                                : 'text-[#334155] hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                              <span>{opt.label}</span>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-[#6366F1]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Botão Discreto de Lixeira (Excluir Empresa Selecionada) */}
              <button
                type="button"
                onClick={onOpenDeleteClient}
                disabled={!selectedClient}
                title="Excluir empresa"
                className="h-9 w-9 flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-red-50 border border-transparent hover:border-red-200 rounded-xl transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4 group-hover:scale-105 transition-transform" />
              </button>
            </div>

            {/* Divisor Vertical Sutil */}
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* GRUPO B: Menu Dropdown "Arquivos" */}
            <div className="relative" ref={filesMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setFilesMenuOpen(!filesMenuOpen);
                  setClientMenuOpen(false);
                  setStatusMenuOpen(false);
                  setAddMenuOpen(false);
                }}
                disabled={!selectedClient}
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-medium border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#18181B] transition-all shadow-2xs cursor-pointer ${
                  !selectedClient ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>Arquivos</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 ${
                    filesMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {filesMenuOpen && selectedClient && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-[#E2E8F0] p-1.5 z-50 animate-fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F1F5F9]">
                    Acesso aos Arquivos
                  </div>

                  {/* Opção 1: Pasta no Google Drive */}
                  <button
                    type="button"
                    onClick={handleOpenDrive}
                    disabled={openingDrive}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-[#F8FAFC] text-left transition-colors group cursor-pointer disabled:opacity-60"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0 mt-0.5 text-[#6366F1] group-hover:bg-[#6366F1] group-hover:text-white transition-colors">
                      {openingDrive ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#6366F1]" />
                      ) : (
                        <FolderOpen className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#18181B] flex items-center gap-1">
                        <span>Pasta no Google Drive</span>
                        <ExternalLink className="w-3 h-3 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                        Documentos, atas e arquivos AFD
                      </p>
                    </div>
                  </button>

                  {/* Opção 2: Planilha de Funcionários */}
                  <button
                    type="button"
                    onClick={handleOpenSheets}
                    disabled={openingSheets}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-[#F8FAFC] text-left transition-colors group cursor-pointer mt-0.5 disabled:opacity-60"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5 text-[#10B981] group-hover:bg-[#10B981] group-hover:text-white transition-colors">
                      {openingSheets ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#18181B] flex items-center gap-1">
                        <span>Planilha de Funcionários</span>
                        <ExternalLink className="w-3 h-3 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                        Base de colaboradores e escalas (Sheets)
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Divisor Vertical Sutil */}
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* GRUPO C: Menu Dropdown Único "Adicionar" */}
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(!addMenuOpen);
                  setClientMenuOpen(false);
                  setStatusMenuOpen(false);
                  setFilesMenuOpen(false);
                }}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-medium shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>Adicionar</span>
              </button>

              {addMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-xl border border-[#E2E8F0] p-1.5 z-50 animate-fade-in">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider border-b border-[#F1F5F9]">
                    Ações de Adição
                  </div>

                  {/* 1. Incluir funcionários na empresa atual */}
                  <button
                    type="button"
                    disabled={!selectedClient}
                    onClick={() => {
                      setAddMenuOpen(false);
                      onOpenImportEmployees();
                    }}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-colors group cursor-pointer ${
                      selectedClient
                        ? 'hover:bg-[#F8FAFC]'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center shrink-0 mt-0.5 text-[#6366F1] group-hover:bg-[#6366F1] group-hover:text-white transition-colors">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[#18181B] block truncate">
                        Incluir funcionários {selectedClient ? `em ${selectedClient.name}` : ''}
                      </span>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                        Importar arquivo AFD na planilha deste cliente
                      </p>
                    </div>
                  </button>

                  {/* 2. Nova tarefa (Etapa) */}
                  <button
                    type="button"
                    disabled={!selectedClient}
                    onClick={() => {
                      setAddMenuOpen(false);
                      if (onNewTask) onNewTask();
                    }}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-colors group cursor-pointer ${
                      selectedClient
                        ? 'hover:bg-[#F8FAFC]'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5 text-[#6366F1] group-hover:bg-[#6366F1] group-hover:text-white transition-colors">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[#18181B] block">
                        Nova tarefa (Etapa)
                      </span>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                        Criar card no fluxo de implantação
                      </p>
                    </div>
                  </button>

                  {/* Separador Sutil */}
                  <div className="border-t border-slate-100 my-1" />

                  {/* 2. Nova empresa (Cliente) */}
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false);
                      onOpenNewClient();
                    }}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-[#F8FAFC] text-left transition-colors group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5 text-[#6366F1] group-hover:bg-[#6366F1] group-hover:text-white transition-colors">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[#18181B] block">
                        Nova empresa (Cliente)
                      </span>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                        Criar nova implantação no dashboard
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
