import { supabase } from './supabase.js';

const PENDING_KEY = 'point_pending_client_meta';

/**
 * Salva metadados pendentes no localStorage para garantir que nunca sejam
 * perdidos mesmo com recarregamento da página (F5) ou fechamento do modal.
 */
export function savePendingClientMeta(clientName, meta) {
  if (!clientName) return;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[clientName.toLowerCase().trim()] = {
      ...meta,
      timestamp: Date.now(),
    };
    localStorage.setItem(PENDING_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Erro ao salvar pending client meta:', e);
  }
}

/**
 * Obtém os metadados pendentes de um cliente pelo nome
 */
export function getPendingClientMeta(clientName) {
  if (!clientName) return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[clientName.toLowerCase().trim()] || null;
  } catch {
    return null;
  }
}

/**
 * Remove os metadados pendentes após sincronização confirmada
 */
export function removePendingClientMeta(clientName) {
  if (!clientName) return;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[clientName.toLowerCase().trim()];
    localStorage.setItem(PENDING_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Sincroniza metadados pendentes com a tabela `clients` no Supabase
 * Atualiza `cnpj`, `city_state`, `segment`, `contact_name` e `contact_phone` se estiverem vazios no banco
 */
export async function syncClientMetadata(client) {
  if (!client || !client.id || client.isTemp) return client;

  const meta = getPendingClientMeta(client.name);
  if (!meta) return client;

  const updateData = {};
  if (meta.cnpj && (!client.cnpj || client.cnpj !== meta.cnpj)) {
    updateData.cnpj = meta.cnpj;
  }
  if (meta.city_state && (!client.city_state || client.city_state !== meta.city_state)) {
    updateData.city_state = meta.city_state;
  }
  if (meta.segment && (!client.segment || client.segment !== meta.segment)) {
    updateData.segment = meta.segment;
  }
  if (meta.contact_name && (!client.contact_name || client.contact_name !== meta.contact_name)) {
    updateData.contact_name = meta.contact_name;
  }
  if (meta.contact_phone && (!client.contact_phone || client.contact_phone !== meta.contact_phone)) {
    updateData.contact_phone = meta.contact_phone;
  }

  if (Object.keys(updateData).length > 0) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id)
        .select()
        .single();

      if (!error && data) {
        removePendingClientMeta(client.name);
        return { ...client, ...data };
      }
    } catch (err) {
      console.warn('Erro ao sincronizar metadados do cliente no Supabase:', err);
    }
  } else {
    removePendingClientMeta(client.name);
  }

  return client;
}
