import React from 'react';
import { X, CheckCircle, HelpCircle, FileText, ArrowRight, ShieldCheck } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 sm:p-8 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#818CF8] flex items-center justify-center font-bold">
                ?
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#18181B]">
                  Guia de Migração Secullum &rarr; POINT. Start
                </h2>
                <p className="text-xs text-[#71717A]">
                  Metodologia de 6 etapas para virada sem perda de dados
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs text-[#3F3F46] max-h-[460px] overflow-y-auto pr-2">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <h4 className="font-bold text-[#18181B] mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                1. Kick-off e Diagnóstico
              </h4>
              <p>
                Alinhamento com diretoria e RH, definição de cronograma de 30 dias e mapeamento das particularidades da empresa no Secullum (ex: tolerâncias, escalas 12x36 ou 6x1).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <h4 className="font-bold text-[#18181B] mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#818CF8]" />
                2. Coleta e Parametrização (Migração AFD)
              </h4>
              <p>
                Exportação do arquivo AFD (Arquivo de Fonte de Dados - Portaria 671) do Secullum. O n8n importa para a POINT., garantindo integridade de batidas e saldos de banco de horas anteriores.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <h4 className="font-bold text-[#18181B] mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                3. Fluxos e Governança
              </h4>
              <p>
                Parametrização das regras de horas extras, adicional noturno, DSR, banco de horas e vinculação de EPIs obrigatórios por departamento/cargo.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <h4 className="font-bold text-[#18181B] mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6366F1]" />
                4. Homologação em Paralelo
              </h4>
              <p>
                Simulação de fechamento do espelho de ponto em paralelo (Secullum vs POINT.) para validar divergência zero antes do Go-Live oficial.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <h4 className="font-bold text-[#18181B] mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                5. Treinamento e Go-Live
              </h4>
              <p>
                Treinamento prático dos gestores e RH no painel web, liberação de acessos dos colaboradores no aplicativo mobile e virada de chave definitiva dos relógios REP.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <h4 className="font-bold text-[#18181B] mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#64748B]" />
                6. Operação Assistida (30 dias)
              </h4>
              <p>
                Acompanhamento contínuo da equipe técnica POINT. durante o primeiro fechamento de folha real, emissão de termo de homologação e aplicação de pesquisa CSAT.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#F4F4F5] flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#18181B] text-white text-xs font-semibold hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

