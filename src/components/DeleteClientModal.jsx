import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase, logActivity } from '../lib/supabase';

export default function DeleteClientModal({
  isOpen,
  onClose,
  client,
  onClientDeleted,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !client) return null;

  const handleConfirmDelete = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Envia requisição POST para o webhook do n8n
      const response = await fetch(
        'http://localhost:5678/webhook/excluir-cliente-point',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: client.id,
            name: client.name || '',
            drive_folder_url: client.drive_folder_url || '',
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Webhook retornou status ${response.status}: ${errorText || 'Erro no n8n'}`
        );
      }

      // 2. Garante remoção também no Supabase (caso o n8n não execute diretamente)
      try {
        await supabase.from('clients').delete().eq('id', client.id);
      } catch (dbErr) {
        console.warn('Exclusão direta no Supabase (pode já ter sido feita pelo n8n):', dbErr);
      }

      // 3. Notifica o componente pai para remover da lista e selecionar o próximo
      if (onClientDeleted) {
        onClientDeleted(client.id);
      }

      // 4. Registra no histórico de atividades (activity_logs)
      try {
        await logActivity({
          clientId: client.id,
          clientName: client.name,
          actionType: 'CLIENT_DELETED',
          description: `Cliente "${client.name}" excluído da plataforma.`,
          source: 'Plataforma',
        });
      } catch (logErr) {
        console.warn('Erro ao registrar log de exclusão:', logErr);
      }

      onClose();
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
      setErrorMsg(
        `Falha ao comunicar com o webhook: ${err.message}`
      );
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
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#18181B]">
                  Excluir Cliente
                </h3>
                <p className="text-xs text-[#71717A]">
                  Confirmação de exclusão
                </p>
              </div>
            </div>
            {!loading && (
              <button
                onClick={onClose}
                className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* Estado de Carregamento */}
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in">
              <Loader2 className="w-8 h-8 text-[#EF4444] animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#18181B]">
                  Excluindo cliente e arquivos do Drive...
                </h4>
                <p className="text-xs text-[#71717A]">
                  Aguarde a finalização do processo.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Mensagem de Confirmação */}
              <p className="text-sm text-[#3F3F46] leading-relaxed mb-6">
                Tem certeza que deseja excluir <strong className="text-[#18181B] font-semibold">{client.name}</strong>? Esta ação removerá o registro da plataforma.
              </p>

              {/* Botões Cancelar e Excluir Definitivamente */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F4F4F5]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  Excluir Definitivamente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
