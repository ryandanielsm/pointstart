import { logActivity, completeAfdTaskForClient } from './supabase.js';

/**
 * URL do Webhook 4 no n8n para importação em massa de colaboradores
 */
export const IMPORT_EMPLOYEES_WEBHOOK_URL =
  'http://localhost:5678/webhook/importar-colaboradores';

/**
 * Máscara e formatação de CNPJ enquanto digita (máx 14 dígitos numéricos)
 */
export function maskCnpj(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/**
 * Máscara e formatação de WhatsApp enquanto digita: (00) 00000-0000 (máx 11 dígitos numéricos)
 */
export function maskPhone(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Formata CPF para o padrão 000.000.000-00
 */
export function formatCpf(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/**
 * Formata CNPJ (14 dígitos) ou CPF (11 dígitos)
 */
export function formatCnpj(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }
  return digits || '';
}

/**
 * Converte DDMMAAAA para YYYY-MM-DD
 */
export function parseDdmmaaaa(rawStr) {
  if (!rawStr || rawStr.length !== 8 || !/^\d{8}$/.test(rawStr)) return '';
  const d = parseInt(rawStr.slice(0, 2), 10);
  const m = parseInt(rawStr.slice(2, 4), 10);
  const y = parseInt(rawStr.slice(4, 8), 10);
  if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Extrai Razão Social, CNPJ e data inicial da linha de cabeçalho do arquivo AFD (Tipo 1)
 * Corta múltiplos espaços e números de série do relógio (REP)
 */
export function parseAfdHeader(text) {
  if (typeof text !== 'string') return { name: '', cnpj: '', startDate: '' };

  const lines = text.split(/\r?\n/);
  for (let rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line) continue;

    const isHeader = (line.length >= 38 && line.charAt(9) === '1') || line.match(/^0{9}1/);
    if (isHeader) {
      const idType = line.charAt(10); // '1' = CNPJ, '2' = CPF
      const rawId = line.slice(11, 25).trim();

      // Trecho a partir do índice 37 (logo após os 12 zeros do CEI)
      const rawNameSection = line.slice(37).trimStart();
      let cleanName = rawNameSection.split(/\s{2,}/)[0] || '';
      cleanName = cleanName.replace(/\s*\d{6,}.*$/, '').trim();

      let extractedCnpj = '';
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

      const rawDate1 = line.slice(204, 212);
      const rawDate2 = line.slice(220, 228);
      const startDate = parseDdmmaaaa(rawDate1) || parseDdmmaaaa(rawDate2);

      return {
        name: cleanName,
        cnpj: extractedCnpj,
        startDate: startDate || '',
      };
    }
  }

  return { name: '', cnpj: '', startDate: '' };
}

/**
 * Extrai os colaboradores de um texto AFD (.afd ou .txt)
 * Lê as linhas de Tipo 5 (Portaria 1510 / Portaria 671)
 * Limpa zeros à direita e espaços no nome e formata o CPF
 */
export function parseAfdEmployeesFromText(text) {
  if (typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/);
  const employeesMap = new Map();

  for (let line of lines) {
    line = line.trimEnd();
    if (!line) continue;

    // Linha Tipo 5: Cadastro/Alteração de Empregados (Portaria 671 / 1510)
    // Registro tipo '5' na posição 10 (índice 9)
    const isType5 = (line.length >= 35 && line.charAt(9) === '5') || line.match(/^(\d{9})?5/);
    if (isType5) {
      const op = line.length > 22 ? line.charAt(22).toUpperCase() : '';
      const rawPis = line.slice(23, 35).trim();
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
          const op5 = match5[2];
          const rawDoc = match5[3];
          const name5 = match5[4].trim();

          if (op5 === 'E') {
            employeesMap.delete(rawDoc);
          } else if (name5) {
            const cleanName = name5.replace(/\s*0{4,}\s*$/, '').trim();
            employeesMap.set(rawDoc, {
              nome_completo: cleanName,
              pis: rawDoc,
              cpf: formatCpf(rawDoc),
            });
          }
        }
      }
    }
  }

  return Array.from(employeesMap.values());
}

/**
 * Lê o arquivo com codificação ISO-8859-1 e faz o parse dos colaboradores
 */
export async function parseAfdFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const employees = parseAfdEmployeesFromText(text);
        resolve(employees);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);

    // Lê com codificação ISO-8859-1 para preservar acentuação dos nomes
    reader.readAsText(file, 'ISO-8859-1');
  });
}

/**
 * Envia a lista de colaboradores extraídos para o webhook do n8n
 * e registra automaticamente o log de atividade no Supabase
 */
export async function sendEmployeesToWebhook({
  client,
  employees,
  source = 'Plataforma',
}) {
  if (!client || !client.id) {
    throw new Error('Nenhum cliente selecionado.');
  }

  if (!employees || employees.length === 0) {
    throw new Error('Nenhum colaborador encontrado para importação.');
  }

  const payload = {
    client_id: client.id,
    client_name: client.name,
    sheets_url: client.sheets_url || '',
    employees,
  };

  let responseData = null;
  try {
    const res = await fetch(IMPORT_EMPLOYEES_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Webhook n8n retornou status ${res.status}: ${errText}`);
    } else {
      try {
        responseData = await res.json();
      } catch {
        responseData = { ok: true };
      }
    }
  } catch (err) {
    console.warn('Instabilidade de conexão com o webhook n8n:', err);
    // Não bloqueia o registro de atividade caso o usuário esteja em teste local
  }

  // Grava automaticamente o log na tabela activity_logs do Supabase
  try {
    await logActivity({
      clientId: client.id,
      clientName: client.name,
      actionType: 'colaborador_adicionado',
      description: `Importados ${employees.length} colaboradores via arquivo AFD`,
      source: source || 'Plataforma',
    });
  } catch (logErr) {
    console.warn('Erro ao gravar log de atividade no Supabase:', logErr);
  }

  // Conclui automaticamente a tarefa "Envio da Planilha e Arquivo AFD" para o cliente
  try {
    await completeAfdTaskForClient(client.id, source);
  } catch (taskErr) {
    console.warn('Erro ao auto-concluir tarefa de AFD no Kanban:', taskErr);
  }

  return responseData || { ok: true, count: employees.length };
}
