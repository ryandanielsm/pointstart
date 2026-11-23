import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Loader2,
  Check,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { parseAfdFile, sendEmployeesToWebhook } from '../lib/afdImport';

export default function ImportEmployeesModal({
  isOpen,
  onClose,
  client,
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setEmployees([]);
      setIsParsing(false);
      setLoading(false);
      setIsSuccess(false);
      setErrorMsg('');
      setDragActive(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcessFile = async (selectedFile) => {
    if (!selectedFile) return;

    const ext = selectedFile.name.toLowerCase();
    if (!ext.endsWith('.afd') && !ext.endsWith('.txt')) {
      setErrorMsg('Por favor, selecione um arquivo válido com extensão .afd ou .txt');
      return;
    }

    setErrorMsg('');
    setIsParsing(true);
    setFile(selectedFile);

    try {
      const extracted = await parseAfdFile(selectedFile);
      setEmployees(extracted);
      if (extracted.length === 0) {
        setErrorMsg(
          'Nenhum colaborador encontrado no arquivo. Verifique se é um arquivo AFD válido.'
        );
      }
    } catch (err) {
      console.error('Erro ao ler arquivo AFD:', err);
      setErrorMsg('Falha ao processar o arquivo. Verifique se o formato está correto.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      handleProcessFile(selected);
    }
    e.target.value = '';
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSend = async () => {
    if (!client || employees.length === 0 || loading) return;

    setLoading(true);
    setErrorMsg('');

    try {
      await sendEmployeesToWebhook({
        client,
        employees,
        source: 'Plataforma',
      });

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Erro ao enviar colaboradores:', err);
      setErrorMsg('Não foi possível enviar os colaboradores para a planilha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 sm:p-7 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-[#F4F4F5]">
            <div>
              <h2 className="text-lg font-bold text-[#18181B] tracking-tight">
                Incluir Funcionários
              </h2>
              <p className="text-xs text-[#71717A] mt-0.5">
                Importação em massa para <span className="font-semibold text-[#18181B]">{client?.name || 'Cliente'}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo: Estado de Sucesso */}
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center mb-4">
                <Check className="w-7 h-7 text-[#6366F1]" strokeWidth={2.5} />
              </div>

              <h3 className="text-base font-bold text-[#18181B] tracking-tight">
                Concluído!
              </h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-xs">
                Colaboradores enviados para a planilha do cliente.
              </p>

              <div className="mt-4 px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#475569]">
                {employees.length} colaborador{employees.length > 1 ? 'es' : ''} processado{employees.length > 1 ? 's' : ''} com sucesso.
              </div>

              <div className="mt-6 w-full flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            /* Conteúdo: Seleção de Arquivo e Envio */
            <div className="mt-5 space-y-4">
              {/* Área de Seleção do Arquivo */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#6366F1] bg-[#EEF2FF]/40'
                    : file
                    ? 'border-[#818CF8]/60 bg-[#F8FAFC]'
                    : 'border-[#E2E8F0] hover:border-[#818CF8] hover:bg-[#F8FAFC]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".afd,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center text-[#6366F1]">
                    {isParsing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>

                  {file ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#18181B]">
                        <FileText className="w-3.5 h-3.5 text-[#6366F1]" />
                        <span className="truncate max-w-[260px]">{file.name}</span>
                      </div>
                      {employees.length > 0 && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{employees.length} colaboradores identificados</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-[#18181B]">
                        Clique para selecionar ou arraste o arquivo AFD
                      </p>
                      <p className="text-[11px] text-[#71717A] mt-0.5">
                        Formatos aceitos: .afd ou .txt
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensagem de Erro se houver */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed animate-fade-in">
                  {errorMsg}
                </div>
              )}

              {/* Rodapé de Ações */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#F4F4F5]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading || employees.length === 0 || isParsing}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] disabled:opacity-40 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer active:scale-95 min-w-[150px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Enviando para Planilha...</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5 text-white" />
                      <span>Enviar para Planilha</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
