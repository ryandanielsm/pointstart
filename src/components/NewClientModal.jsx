import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  Check,
  FileText,
  UploadCloud,
  CheckCircle2,
  PenLine,
  Building2,
  FileCheck2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  supabase,
  getClients,
  logActivity,
  applyDefaultStagesAndTasks,
  completeAfdTaskForClient,
} from '../lib/supabase';
import {
  savePendingClientMeta,
  syncClientMetadata,
} from '../lib/pendingClientMeta';

// Máscara e formatação de CNPJ enquanto digita (máx 14 dígitos numéricos)
export function maskCnpj(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

// Máscara e formatação de WhatsApp enquanto digita: (00) 00000-0000 (máx 11 dígitos numéricos)
export function maskPhone(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Formata CNPJ (14 dígitos) ou CPF (11 dígitos)
function formatCnpj(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }
  return digits || '';
}

// Formata CPF
function formatCpf(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

// Converte DDMMAAAA para YYYY-MM-DD
function parseDdmmaaaa(rawStr) {
  if (!rawStr || rawStr.length !== 8 || !/^\d{8}$/.test(rawStr)) return '';
  const d = parseInt(rawStr.slice(0, 2), 10);
  const m = parseInt(rawStr.slice(2, 4), 10);
  const y = parseInt(rawStr.slice(4, 8), 10);
  if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

// Formata data YYYY-MM-DD para DD/MM/YYYY
function formatDDMMYYYY(dateStr) {
  if (!dateStr) {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }
  return dateStr;
}

export default function NewClientModal({
  isOpen,
  onClose,
  clients = [],
  onSelectClient,
  onClientCreated,
}) {
  // Seletor de Modo: 'afd' (padrão) | 'manual'
  const [creationMode, setCreationMode] = useState('afd');

  // Campos do formulário
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cityState, setCityState] = useState('');
  const [segment, setSegment] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Estados específicos de importação de arquivo AFD
  const [employees, setEmployees] = useState([]);
  const [afdFileName, setAfdFileName] = useState('');
  const [afdSuccessMsg, setAfdSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  // Estados de submissão e controle
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pollingRef = useRef(null);

  // Fecha o modal e limpa todos os dados
  const handleClose = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setLoading(false);
    setIsSuccess(false);
    setPendingName('');
    setCreationMode('afd');
    setName('');
    setContactName('');
    setContactPhone('');
    setCnpj('');
    setCityState('');
    setSegment('');
    setEmployees([]);
    setAfdFileName('');
    setAfdSuccessMsg('');
    setErrorMsg('');
    onClose();
  };

  // Ao abrir ou fechar o modal, reseta erros e estados
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSuccess(false);
      setLoading(false);
      setPendingName('');
      setCreationMode('afd');
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setIsSuccess(false);
      setLoading(false);
      setPendingName('');
      setCreationMode('afd');
      setEmployees([]);
      setAfdFileName('');
      setAfdSuccessMsg('');
      setErrorMsg('');
    }
  }, [isOpen]);

  // Limpa o timer de polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Alterna entre abas AFD e Manual limpando mensagens
  const handleModeChange = (newMode) => {
    setCreationMode(newMode);
    setErrorMsg('');
    if (newMode === 'manual') {
      setEmployees([]);
      setAfdFileName('');
      setAfdSuccessMsg('');
    }
  };

  // Finaliza com sucesso o cadastro do cliente, aplicando atualização complementar no Supabase
  const handleFinish = async (foundClient) => {
    if (!foundClient || foundClient.isTemp) return;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setLoading(false);
    setIsSuccess(true);

    let finalClient = foundClient;

    // Atualização complementar no Supabase salvando cnpj, city_state e segment se não preenchidos
    const updateData = {};
    if (cnpj.trim() && !foundClient.cnpj) {
      updateData.cnpj = cnpj.trim();
    }
    if (cityState.trim() && !foundClient.city_state) {
      updateData.city_state = cityState.trim();
    }
    if (segment.trim() && !foundClient.segment) {
      updateData.segment = segment.trim();
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await supabase
          .from('clients')
          .update(updateData)
          .eq('id', foundClient.id);

        finalClient = { ...foundClient, ...updateData };
      } catch (dbErr) {
        console.warn('Erro ao atualizar dados complementares no Supabase:', dbErr);
      }
    }

    finalClient = await syncClientMetadata(finalClient);

    // Se tiver arquivo AFD com colaboradores, avança a etapa correspondente
    if (creationMode === 'afd' && employees && employees.length > 0) {
      try {
        await completeAfdTaskForClient(finalClient.id, 'Plataforma');
      } catch (afdErr) {
        console.warn('Erro ao concluir tarefa AFD inicial:', afdErr);
      }
    }

    // Recarrega a lista de clientes no estado geral substituindo o cliente temporário pelo cliente real
    if (onClientCreated) {
      await onClientCreated(finalClient.id, finalClient);
    }
    if (onSelectClient) {
      onSelectClient(finalClient);
    }

    // Registra evento no histórico de atividades (activity_logs)
    try {
      const empCount = employees.length;
      const desc =
        creationMode === 'afd' && empCount > 0
          ? `Cliente "${finalClient.name}" criado com ${empCount} colaborador${empCount > 1 ? 'es' : ''} importado${empCount > 1 ? 's' : ''} via AFD.`
          : `Cliente "${finalClient.name}" criado manualmente.`;

      await logActivity({
        clientId: finalClient.id,
        clientName: finalClient.name,
        actionType: 'CLIENT_CREATED',
        description: desc,
        source: 'Plataforma',
      });
    } catch (logErr) {
      console.warn('Erro ao registrar log de criação de cliente:', logErr);
    }
  };

  // Polling na tabela clients a cada 1.2s com timeout máximo de 10s
  const startPolling = (targetClientName) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    const startTime = Date.now();
    const timeoutMs = 10000;
    const intervalMs = 1200;
    const normalizedTarget = targetClientName.toLowerCase().trim();

    // Verificação imediata no Supabase
    getClients()
      .then(async (freshClients) => {
        const found = freshClients.find(
          (c) => !c.isTemp && c.name && c.name.toLowerCase().trim() === normalizedTarget
        );
        if (found) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          await handleFinish(found);
          return;
        }
      })
      .catch((e) => console.warn('Checagem inicial de clientes:', e));

    const timer = setInterval(async () => {
      const elapsed = Date.now() - startTime;

      try {
        const freshClients = await getClients();
        const found = freshClients.find(
          (c) => !c.isTemp && c.name && c.name.toLowerCase().trim() === normalizedTarget
        );

        if (found) {
          clearInterval(timer);
          pollingRef.current = null;
          await handleFinish(found);
          return;
        }

        if (elapsed >= timeoutMs) {
          clearInterval(timer);
          pollingRef.current = null;

          // Fallback seguro caso o webhook do n8n não tenha criado o registro
          const existing = freshClients.find(
            (c) => !c.isTemp && c.name && c.name.toLowerCase().trim() === normalizedTarget
          );
          if (existing) {
            await handleFinish(existing);
            return;
          }

          try {
            const { data: fallbackClient, error: fbErr } = await supabase
              .from('clients')
              .insert({
                name: targetClientName,
                contact_name: contactName.trim(),
                contact_phone: contactPhone.trim(),
                start_date: startDate || new Date().toISOString().split('T')[0],
                cnpj: cnpj.trim(),
                city_state: cityState.trim(),
                segment: segment.trim(),
                status: 'Ativo',
              })
              .select()
              .single();

            if (!fbErr && fallbackClient) {
              await applyDefaultStagesAndTasks(fallbackClient.id, creationMode === 'afd' && employees.length > 0);
              await handleFinish(fallbackClient);
              return;
            }
          } catch (fbCatch) {
            console.warn('Erro no fallback de criação:', fbCatch);
          }
        }
      } catch (err) {
        console.warn('Erro durante polling de clientes:', err);
      }
    }, intervalMs);

    pollingRef.current = timer;
  };

  // Monitora a chegada do novo cliente via Realtime (prop `clients`)
  useEffect(() => {
    if (!pendingName) return;

    const normalizedPending = pendingName.toLowerCase().trim();
    const found = clients.find(
      (c) => !c.isTemp && c.name && c.name.toLowerCase().trim() === normalizedPending
    );

    if (found) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      handleFinish(found);
    }
  }, [clients, pendingName]);

  /**
   * Processamento do arquivo AFD (.afd ou .txt) com layout Portaria 671 / 1510 / REP
   * Codificação ISO-8859-1 para preservar caracteres e acentos
   */
  const handleAfdUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;

      const lines = text.split(/\r?\n/);
      let extractedName = '';
      let extractedCnpj = '';
      let extractedStartDate = '';
      const employeesMap = new Map();

      for (let rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line) continue;

        // 1. Linha Tipo 1: Cabeçalho do AFD (Portaria 671 / 1510)
        // Registro tipo '1' na posição 10 (índice 9)
        const isHeader = (line.length >= 38 && line.charAt(9) === '1') || line.match(/^0{9}1/);
        if (isHeader && !extractedName) {
          const idType = line.charAt(10); // '1' = CNPJ, '2' = CPF
          // Posições 12 a 25 (índices 11 a 25): 14 dígitos do CNPJ
          const rawId = line.slice(11, 25).trim();
          
          // Extrai o trecho a partir do índice 37 (logo após os 12 zeros do CEI):
          // Corta tudo a partir de 2 ou mais espaços consecutivos ou qualquer sequência numérica longa no final (número de série do relógio)
          const rawNameSection = line.slice(37).trimStart();
          let cleanName = rawNameSection.split(/\s{2,}/)[0] || '';
          cleanName = cleanName.replace(/\s*\d{6,}.*$/, '').trim();

          if (cleanName) extractedName = cleanName;
          if (rawId) {
            const digits = rawId.replace(/\D/g, '');
            if (digits.length === 14 || idType === '1') {
              extractedCnpj = formatCnpj(digits.padStart(14, '0'));
            } else if (digits.length === 11 || idType === '2') {
              extractedCnpj = formatCpf(digits);
            } else {
              extractedCnpj = formatCnpj(digits);
            }
          }

          // Extrai data inicial ou de geração se disponível
          const rawDate1 = line.slice(204, 212);
          const rawDate2 = line.slice(220, 228);
          const parsedDate = parseDdmmaaaa(rawDate1) || parseDdmmaaaa(rawDate2);
          if (parsedDate && !extractedStartDate) {
            extractedStartDate = parsedDate;
          }
        }

        // 2. Linha Tipo 5: Cadastro/Alteração de Empregados (Colaboradores)
        // Registro tipo '5' na posição 10 (índice 9)
        const isType5 = (line.length >= 35 && line.charAt(9) === '5') || line.match(/^(\d{9})?5/);
        if (isType5) {
          const op = line.length > 22 ? line.charAt(22).toUpperCase() : '';
          // PIS: índices 23 a 35 (posições 24 a 35)
          const rawPis = line.slice(23, 35).trim();
          // Nome do Colaborador: índices 35 a 87
          const rawEmpName = line.slice(35, 87).trim();

          if (rawPis) {
            if (op === 'E') {
              employeesMap.delete(rawPis);
            } else if (rawEmpName) {
              const cleanName = rawEmpName.replace(/\s*0{4,}\s*$/, '').trim();
              employeesMap.set(rawPis, {
                nome_completo: cleanName,
                pis: rawPis,
                cpf: rawPis.length === 11 ? formatCpf(rawPis) : rawPis,
              });
            }
          } else {
            // Fallback via regex
            const match5 = line.match(/^(\d{9})?5\d{8}\d{4}([IAE])(\d{11,12})\s*(.+)$/);
            if (match5) {
              const rOp = match5[2];
              const rDoc = match5[3];
              const rName = match5[4].trim();
              if (rOp === 'E') {
                employeesMap.delete(rDoc);
              } else if (rName) {
                const cleanName = rName.replace(/\s*0{4,}\s*$/, '').trim();
                employeesMap.set(rDoc, {
                  nome_completo: cleanName,
                  pis: rDoc,
                  cpf: rDoc.length === 11 ? formatCpf(rDoc) : rDoc,
                });
              }
            }
          }
        }
      }

      const extractedEmployees = Array.from(employeesMap.values());

      if (extractedName) setName(extractedName);
      if (extractedCnpj) setCnpj(extractedCnpj);
      if (extractedStartDate) setStartDate(extractedStartDate);

      setEmployees(extractedEmployees);
      setAfdFileName(file.name);
      setAfdSuccessMsg(
        `${extractedEmployees.length} colaboradores identificados`
      );
    };

    reader.onerror = (err) => {
      console.error('Erro ao ler arquivo AFD:', err);
      setErrorMsg('Erro ao ler arquivo AFD. Verifique a integridade do arquivo.');
    };

    // Lê com codificação ISO-8859-1 para preservar acentuação dos nomes
    reader.readAsText(file, 'ISO-8859-1');
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação obrigatória do WhatsApp (exatamente 11 dígitos numéricos com DDD: 2 dígitos DDD + 9 + 8 dígitos)
    const cleanPhone = contactPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      setErrorMsg('O WhatsApp de Contato deve conter exatamente 11 dígitos numéricos com DDD (ex: (79) 99897-9114).');
      return;
    }

    // Validações de acordo com o modo escolhido
    if (creationMode === 'afd') {
      if (!afdFileName || !name.trim()) {
        setErrorMsg('Por favor, selecione um arquivo AFD (.afd ou .txt) para importar a empresa.');
        return;
      }
      const cleanCnpj = cnpj.replace(/\D/g, '');
      if (cleanCnpj.length !== 14) {
        setErrorMsg('O arquivo AFD deve conter um CNPJ válido com 14 dígitos numéricos.');
        return;
      }
    } else {
      if (!name.trim()) {
        setErrorMsg('Por favor, informe o nome da empresa.');
        return;
      }
      const cleanCnpj = cnpj.replace(/\D/g, '');
      if (cleanCnpj.length !== 14) {
        setErrorMsg('O CNPJ deve conter exatamente 14 dígitos numéricos (ex: 00.000.000/0000-00).');
        return;
      }
    }

    setLoading(true);
    setErrorMsg('');
    const targetName = name.trim();
    const formattedCnpj = maskCnpj(cnpj);
    const formattedPhone = maskPhone(contactPhone);
    const targetCityState = cityState.trim();
    const targetSegment = segment.trim();
    const targetContactName = contactName.trim();

    setPendingName(targetName);

    // Salva metadados pendentes no localStorage para garantir que nunca sumam (nem com F5)
    savePendingClientMeta(targetName, {
      cnpj: formattedCnpj,
      city_state: targetCityState,
      segment: targetSegment,
      contact_name: targetContactName,
      contact_phone: cleanPhone,
    });

    const autoStartDate = new Date().toISOString().split('T')[0];
    const formattedStartDate = formatDDMMYYYY(autoStartDate);
    const isAfdMode = creationMode === 'afd';
    const activeEmployees = isAfdMode ? employees : [];
    const hasAfdFile = isAfdMode && activeEmployees.length > 0;

    try {
      // 1. Cria objeto otimista temporário (isTemp: true) para renderização instantânea (0ms de delay)
      const tempId = `temp-${Date.now()}`;
      const tempClient = {
        id: tempId,
        name: targetName,
        contact_name: targetContactName,
        contact_phone: cleanPhone,
        start_date: autoStartDate,
        cnpj: formattedCnpj,
        city_state: targetCityState,
        segment: targetSegment,
        status: 'Ativo',
        isTemp: true,
        created_at: new Date().toISOString(),
      };

      // 2. Atualização otimista imediata na interface com 8 cards na coluna "A Fazer"
      if (onClientCreated) {
        onClientCreated(tempId, tempClient);
      }
      if (onSelectClient) {
        onSelectClient(tempClient);
      }

      // 3. Conclusão instantânea no modal com confetes
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#6366F1', '#818CF8', '#10B981'],
        });
      } catch {}

      setLoading(false);
      setIsSuccess(true);

      // 4. Inicia monitoramento/polling para capturar e substituir pelo registro real do Supabase
      startPolling(targetName);

      // 5. Inicia sincronização autônoma em segundo plano (não é cancelada ao fechar o modal)
      (async () => {
        const normalizedTarget = targetName.toLowerCase().trim();
        for (let i = 0; i < 20; i++) {
          try {
            const { data: found } = await supabase
              .from('clients')
              .select('*')
              .ilike('name', normalizedTarget)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (found && !found.isTemp) {
              await syncClientMetadata(found);
              break;
            }
          } catch (e) {
            console.warn('Sync background loop:', e);
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
      })();

      // 6. Dispara webhook do n8n em segundo plano (100% compatível com a estrutura de campos existente)
      const payload = {
        name: targetName,
        cnpj: formattedCnpj,
        responsible: targetContactName,
        contact_name: targetContactName,
        whatsapp: cleanPhone,
        contact_phone: cleanPhone,
        phone_formatted: formattedPhone,
        city: targetCityState,
        city_state: targetCityState,
        segment: targetSegment,
        start_date: formattedStartDate,
        employees: activeEmployees,
        has_afd: hasAfdFile,
      };

      fetch('http://localhost:5678/webhook/novo-cliente-point', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).catch((whErr) => {
        console.warn('Webhook n8n em segundo plano:', whErr);
      });
    } catch (err) {
      console.error('Erro ao submeter novo cliente:', err);
      setLoading(false);
      setErrorMsg(`Erro: ${err.message || 'Tente novamente.'}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) handleClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-6 sm:p-7 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-start justify-between mb-3.5">
          <div>
            <h2 className="text-xl font-bold text-[#18181B]">
              {isSuccess ? 'Implantação Criada' : 'Nova Implantação'}
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">
              {isSuccess
                ? 'Cliente configurado e integrado com sucesso'
                : 'Cadastre a empresa e inicialize o fluxo operacional'}
            </p>
          </div>
          {!loading && (
            <button
              onClick={handleClose}
              className="p-1.5 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-full transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200 animate-fade-in">
            {errorMsg}
          </div>
        )}

        {/* 1. Estado de Carregamento Minimalista */}
        {loading ? (
          <div className="py-14 px-4 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in">
            <Loader2 className="w-9 h-9 text-[#6366F1] animate-spin" />
            <h4 className="text-sm font-bold text-[#18181B]">
              Criando implantação...
            </h4>
          </div>
        ) : isSuccess ? (
          /* 2. Estado de Conclusão Minimalista */
          <div className="py-10 px-4 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#6366F1] shadow-xs">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-[#18181B]">
                Concluído!
              </h4>
              <p className="text-xs text-[#71717A]">
                A implantação de <strong>{pendingName || name}</strong> foi criada com sucesso.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white text-xs font-semibold shadow-xs shadow-[#818CF8]/25 transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        ) : (
          /* 3. Formulário Principal com Seletor de Modo */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Seletor de Modo no topo do Modal (Segmented Control na paleta lilás) */}
            <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleModeChange('afd')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  creationMode === 'afd'
                    ? 'bg-white text-indigo-600 shadow-xs border border-indigo-100 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Importar via AFD (.afd / .txt)</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('manual')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  creationMode === 'manual'
                    ? 'bg-white text-indigo-600 shadow-xs border border-indigo-100 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenLine className="w-3.5 h-3.5 text-indigo-600" />
                <span>Preencher Manualmente</span>
              </button>
            </div>

            {/* Input de arquivo invisível reutilizável */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".afd,.txt"
              onChange={handleAfdUpload}
              className="hidden"
            />

            {/* ABA 1: FLUXO DE IMPORTAÇÃO VIA AFD */}
            {creationMode === 'afd' && (
              <div className="space-y-3.5 animate-fade-in">
                {!afdFileName ? (
                  /* Antes de selecionar: Área de upload limpa e destacada */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-5 rounded-2xl border-2 border-dashed border-[#818CF8]/60 bg-[#EEF2FF]/40 hover:bg-[#EEF2FF]/70 transition-all cursor-pointer text-center group"
                  >
                    <div className="w-10 h-10 mx-auto mb-2.5 rounded-xl bg-white border border-[#C7D2FE] flex items-center justify-center text-[#6366F1] shadow-2xs group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-[#18181B] block">
                      Clique para selecionar o arquivo AFD (.afd ou .txt)
                    </span>
                    <span className="text-[11px] text-[#71717A] mt-0.5 block">
                      Razão Social, CNPJ e colaboradores são extraídos automaticamente
                    </span>
                  </div>
                ) : (
                  /* Após selecionar: Card de Resumo lilás claro com os dados oficiais extraídos */
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 flex items-start justify-between gap-3 animate-fade-in">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs mt-0.5">
                        <FileCheck2 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                          Dados Oficiais do AFD
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 truncate mt-0.5" title={name}>
                          {name || 'Empresa Identificada'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {cnpj && (
                            <span className="inline-flex items-center text-[11px] font-mono text-slate-700 bg-white/80 px-2 py-0.5 rounded-md border border-indigo-100">
                              CNPJ: {cnpj}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {employees.length} colaboradores
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-white hover:bg-indigo-100/70 border border-indigo-200 rounded-lg shadow-2xs transition-all cursor-pointer shrink-0"
                    >
                      Trocar arquivo
                    </button>
                  </div>
                )}

                {/* Separador de campos complementares */}
                <div className="pt-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Campos Complementares
                  </span>

                  {/* Grid 2 Colunas: Responsável & WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#18181B] mb-1">
                        Nome do Responsável
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Ryan Santos"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#18181B] mb-1">
                        WhatsApp de Contato <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={15}
                        placeholder="Ex: (79) 99897-9114"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(maskPhone(e.target.value))}
                        className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                      />
                    </div>
                  </div>

                  {/* Grid 2 Colunas: Cidade/UF e Segmento (Data de Início é automática hoje) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#18181B] mb-1">
                        Cidade/UF
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Aracaju/SE"
                        value={cityState}
                        onChange={(e) => setCityState(e.target.value)}
                        className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#18181B] mb-1">
                        Segmento
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Restaurante"
                        value={segment}
                        onChange={(e) => setSegment(e.target.value)}
                        className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: FLUXO DE PREENCHIMENTO MANUAL */}
            {creationMode === 'manual' && (
              <div className="space-y-3.5 animate-fade-in">
                {/* Nome da Empresa * */}
                <div>
                  <label className="block text-xs font-bold text-[#18181B] mb-1">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Churrascaria Boi Manso"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                  />
                </div>

                {/* Grid 2 Colunas: Responsável & WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#18181B] mb-1">
                      Nome do Responsável
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Ryan Santos"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#18181B] mb-1">
                      WhatsApp de Contato <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      placeholder="Ex: (79) 99897-9114"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(maskPhone(e.target.value))}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                    />
                  </div>
                </div>

                {/* Grid 3 Colunas: CNPJ *, Cidade/UF, Segmento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#18181B] mb-1">
                      CNPJ <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={18}
                      placeholder="Ex: 00.000.000/0001-00"
                      value={cnpj}
                      onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#18181B] mb-1">
                      Cidade/UF <span className="text-[#A1A1AA] font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Aracaju/SE"
                      value={cityState}
                      onChange={(e) => setCityState(e.target.value)}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#18181B] mb-1">
                      Segmento <span className="text-[#A1A1AA] font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Restaurante"
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                      className="w-full text-sm px-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rodapé com botões Cancelar e Salvar */}
            <div className="pt-3.5 flex items-center justify-end gap-3 border-t border-[#F4F4F5]">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#818CF8] to-[#6366F1] hover:from-[#6366F1] hover:to-[#4F46E5] text-white text-xs font-semibold shadow-sm shadow-[#818CF8]/25 transition-all cursor-pointer active:scale-95"
              >
                <span>Criar Implantação</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
