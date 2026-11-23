import React, { useState } from 'react';
import TaskCard from './TaskCard';
import { Plus, Pencil, Check } from 'lucide-react';

export default function KanbanBoard({
  stages = [],
  tasks = [],
  onSelectTask,
  onMoveTask,
  onNewTask,
  onRenameStage,
}) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [activeDropStageId, setActiveDropStageId] = useState(null);

  // Estados para renomear título da coluna
  const [editingStageId, setEditingStageId] = useState(null);
  const [editingStageTitle, setEditingStageTitle] = useState('');

  // Manipulação de Drag & Drop
  const handleDragStart = (e, task) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropStageId !== stageId) {
      setActiveDropStageId(stageId);
    }
  };

  const handleDragLeave = (e, stageId) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (activeDropStageId === stageId) {
      setActiveDropStageId(null);
    }
  };

  const handleDrop = (e, targetStageId) => {
    e.preventDefault();
    setActiveDropStageId(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId && targetStageId) {
      onMoveTask(taskId, targetStageId);
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDropStageId(null);
  };

  // Inicia edição de título da etapa
  const handleStartRename = (stage) => {
    setEditingStageId(stage.id);
    setEditingStageTitle(stage.title || '');
  };

  // Salva renomeação da etapa
  const handleSaveRename = (stageId) => {
    if (!editingStageId) return;
    const trimmed = editingStageTitle.trim();
    if (trimmed && onRenameStage) {
      onRenameStage(stageId, trimmed);
    }
    setEditingStageId(null);
  };

  // Ordena etapas por posição
  const sortedStages = [...stages].sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col">
      {/* Quadro Kanban Horizontal com as 5 Colunas Trello */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 h-full flex-1 min-h-0 overflow-x-auto pb-1">
        {sortedStages.map((stage) => {
          // Filtra tarefas desta etapa e ordena estritamente por position (1 a 8) crescente
          const stageTasks = tasks
            .filter((t) => t.stage_id === stage.id)
            .sort((a, b) => {
              const posA = typeof a.position === 'number' ? a.position : parseInt(a.position, 10) || 999;
              const posB = typeof b.position === 'number' ? b.position : parseInt(b.position, 10) || 999;
              if (posA !== posB) return posA - posB;
              return (a.created_at || '').localeCompare(b.created_at || '');
            });

          const isDropActive = activeDropStageId === stage.id;
          const isEditingTitle = editingStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={(e) => handleDragLeave(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
              onDragEnd={handleDragEnd}
              className={`flex flex-col h-full min-h-0 rounded-2xl p-1.5 transition-all duration-200 min-w-[200px] ${
                isDropActive
                  ? 'bg-[#EEF2FF] ring-2 ring-[#818CF8] ring-dashed'
                  : 'bg-transparent'
              }`}
            >
              {/* Cabeçalho da Coluna com Edição de Título e Botão + de Nova Tarefa */}
              <div className="flex items-center justify-between px-1.5 py-1 mb-1.5 shrink-0 min-h-[34px]">
                {isEditingTitle ? (
                  <div className="flex items-center gap-1 w-full">
                    <input
                      type="text"
                      autoFocus
                      value={editingStageTitle}
                      onChange={(e) => setEditingStageTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(stage.id);
                        if (e.key === 'Escape') setEditingStageId(null);
                      }}
                      onBlur={() => handleSaveRename(stage.id)}
                      className="w-full text-xs font-bold px-2 py-1 rounded-lg border border-[#818CF8] bg-white focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 text-[#18181B]"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSaveRename(stage.id);
                      }}
                      className="p-1 text-[#10B981] hover:bg-[#ECFDF5] rounded-md transition-colors cursor-pointer shrink-0"
                      title="Salvar título"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full gap-1.5">
                    <div
                      onClick={() => handleStartRename(stage)}
                      className="flex items-center gap-1.5 min-w-0 cursor-pointer group/title flex-1"
                      title="Clique para renomear esta etapa"
                    >
                      <h3 className="text-xs font-bold text-[#18181B] truncate group-hover/title:text-[#6366F1] transition-colors">
                        {stage.title}
                      </h3>
                      <Pencil className="w-2.5 h-2.5 text-[#A1A1AA] opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-semibold text-[#71717A] bg-white border border-[#E2E8F0] px-1.5 py-0.2 rounded-full">
                        {stageTasks.length}
                      </span>

                      {/* Botão de ícone + minimalista no cabeçalho da etapa */}
                      <button
                        type="button"
                        onClick={() => onNewTask && onNewTask(stage.id)}
                        title="Nova tarefa nesta etapa"
                        className="w-6 h-6 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de Cards da Etapa com Scroll Vertical Discreto Apenas Aqui */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5 rounded-xl p-0.5">
                {stageTasks.length === 0 ? (
                  <div
                    className={`h-24 rounded-xl border border-dashed border-[#E2E8F0] flex flex-col items-center justify-center p-3 text-center transition-colors ${
                      isDropActive ? 'border-[#818CF8] bg-white/70' : 'bg-white/40'
                    }`}
                  >
                    <span className="text-[11px] text-[#A1A1AA] font-medium">
                      Arraste tarefas para cá
                    </span>
                  </div>
                ) : (
                  stageTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onSelect={onSelectTask}
                      onDragStart={handleDragStart}
                      isDragging={draggedTaskId === task.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
