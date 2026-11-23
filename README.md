# POINT. Start ⏱️🚀

Plataforma inteligente de gestão operacional, onboarding e implantação de ponto eletrônico (Portaria 671 / MTP).

---

## 📌 Visão Geral

O **POINT. Start** centraliza e automatiza a jornada de implantação de novos clientes, desde a leitura do arquivo AFD até a virada de chave (Go-Live) e operação assistida. A plataforma integra gestão visual via Kanban, cálculo automatizado de prazos úteis, agendamento de reuniões online (Google Meet) e automações de provisionamento com n8n e Supabase.

---

## 🚀 Principais Funcionalidades

- **Onboarding Inteligente com Leitor AFD:**
  - Importação de arquivo `.afd` / `.txt` com parser automático da Portaria 671 (Razão Social, CNPJ, quantidade de colaboradores).
  - Opção de cadastro manual de empresa, responsável, WhatsApp, cidade e segmento.

- **Quadro Kanban de 5 Etapas:**
  - Colunas dinâmicas: `A Fazer`, `Em Andamento`, `Aguardando Cliente`, `Agendado` e `Concluído`.
  - Drag-and-drop livre e persistente entre colunas.
  - Edição inline dos títulos das colunas.

- **8 Cards Oficiais com Prazos em Dias Úteis:**
  - Instanciação automática dos 8 marcos sequenciais de implantação com prazos calculados automaticamente a partir da data de início:
    1. *Alinhamento Inicial e Cronograma* (+2 dias úteis)
    2. *Coleta de Dados e Colaboradores* (+4 dias úteis)
    3. *Migração de Histórico (AFD)* (+6 dias úteis)
    4. *Configuração de Jornadas e Regras* (+8 dias úteis)
    5. *Fluxos de Aprovação e EPIs* (+10 dias úteis)
    6. *Homologação e Testes Práticos* (+12 dias úteis)
    7. *Treinamento e Virada (Go-Live)* (+15 dias úteis)
    8. *Operação Assistida e Fechamento* (+35 dias úteis)

- **Gestão de Tarefas e Reuniões Online:**
  - Modal completo de edição de card com checklists interativos e barra de progresso.
  - Seletor customizado de Data e Horário (sem restrição nativa azulada) com bloqueio de datas passadas.
  - Geração automática de link do **Google Meet** via integração n8n / Google Calendar (move automaticamente para a coluna `Agendado`).
  - Botão de cobrança direta via **WhatsApp** com texto pré-formatado.

- **KPIs em Tempo Real e Sino de Notificações:**
  - 4 métricas ao vivo: *Progresso (%)*, *Em Execução*, *Pendências* e *Reuniões Agendadas*.
  - Notificações automáticas para reuniões prestes a iniciar (<60 min), tarefas vencendo hoje, vencendo amanhã e atrasadas.
  - Alerta sonoro configurável e animação de confetes ao atingir 100% de conclusão.

- **Integração de Arquivos em Nuvem:**
  - Acesso direto com um clique à pasta do **Google Drive** e planilha do **Google Sheets** vinculada a cada cliente.
  - Sincronização em tempo real via Supabase Realtime e polling inteligente.

---

## 🛠️ Stack Tecnológica

- **Front-end:** React 18, Vite, Tailwind CSS, Lucide React, Canvas Confetti.
- **Banco de Dados & BaaS:** Supabase (PostgreSQL 15+, PostgREST, Realtime WebSockets).
- **Automação & Integrações:** n8n (Webhooks para Google Drive, Google Sheets e Google Calendar).

---

## 💻 Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18 ou superior)
- Gerenciador de pacotes `npm` ou `yarn`

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/SEU-USUARIO/point-start.git
cd point-start
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

4. Acesse no navegador:
```
http://localhost:5173
```

---

## 📄 Scripts Disponíveis

- `npm run dev`: Inicia o servidor local de desenvolvimento (Vite).
- `npm run build`: Compila a aplicação para produção na pasta `/dist`.
- `npm run preview`: Visualiza localmente o build de produção.
