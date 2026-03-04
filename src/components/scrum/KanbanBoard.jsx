import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, User, Calendar } from "lucide-react";
import TaskFormModal from "@/components/scrum/TaskFormModal";
import { format } from "date-fns";

const COLUMNS = [
  { id: "backlog", title: "Backlog", color: "bg-slate-100" },
  { id: "todo", title: "À faire", color: "bg-blue-100" },
  { id: "in_progress", title: "En cours", color: "bg-yellow-100" },
  { id: "review", title: "Revue", color: "bg-purple-100" },
  { id: "done", title: "Terminé", color: "bg-green-100" }
];

const PRIORITY_COLORS = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500"
};

export default function KanbanBoard({ project, tasks }) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("backlog");
  const [selectedTask, setSelectedTask] = useState(null);
  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["tasks"]);
    }
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;

    updateTaskMutation.mutate({
      id: taskId,
      data: { status: newStatus }
    });
  };

  const handleAddTask = (status) => {
    setSelectedStatus(status);
    setSelectedTask(null);
    setShowTaskForm(true);
  };

  const TaskCard = ({ task, index }) => (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card
            className={`p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow ${
              snapshot.isDragging ? "shadow-lg ring-2 ring-blue-500" : ""
            }`}
            onClick={() => {
              setSelectedTask(task);
              setShowTaskForm(true);
            }}
          >
            {/* Priority indicator */}
            <div className={`h-1 w-full ${PRIORITY_COLORS[task.priority]} rounded-full mb-3`} />

            <h4 className="font-semibold text-slate-900 mb-2">{task.title}</h4>
            
            {task.description && (
              <p className="text-sm text-slate-600 mb-3 line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {task.assigned_to && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <User className="w-3 h-3" />
                    <span>{task.assigned_to}</span>
                  </div>
                )}
                {task.story_points > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {task.story_points} pts
                  </Badge>
                )}
              </div>
              
              {task.due_date && (
                <div className="flex items-center gap-1 text-slate-500">
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(task.due_date), "dd/MM")}</span>
                </div>
              )}
            </div>

            {task.blocked && (
              <div className="flex items-center gap-1 mt-2 text-red-600 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>Bloqué</span>
              </div>
            )}
          </Card>
        </div>
      )}
    </Draggable>
  );

  return (
    <div className="overflow-x-auto">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 pb-4" style={{ minWidth: "1200px" }}>
          {COLUMNS.map(column => {
            const columnTasks = tasks.filter(t => t.status === column.id);
            const totalPoints = columnTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);

            return (
              <div key={column.id} className="flex-1 min-w-[280px]">
                <div className={`${column.color} rounded-t-lg p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{column.title}</h3>
                    <Badge variant="secondary">{columnTasks.length}</Badge>
                  </div>
                  {totalPoints > 0 && (
                    <p className="text-xs text-slate-600">{totalPoints} points</p>
                  )}
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`bg-slate-50 rounded-b-lg p-4 min-h-[500px] ${
                        snapshot.isDraggingOver ? "bg-blue-50" : ""
                      }`}
                    >
                      {columnTasks.map((task, index) => (
                        <TaskCard key={task.id} task={task} index={index} />
                      ))}
                      {provided.placeholder}

                      <Button
                        variant="ghost"
                        className="w-full mt-2 border-2 border-dashed"
                        onClick={() => handleAddTask(column.id)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter une tâche
                      </Button>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {showTaskForm && (
        <TaskFormModal
          open={showTaskForm}
          onClose={() => {
            setShowTaskForm(false);
            setSelectedTask(null);
          }}
          projectId={project.id}
          initialStatus={selectedStatus}
          task={selectedTask}
        />
      )}
    </div>
  );
}