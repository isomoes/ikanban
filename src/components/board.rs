use leptos::prelude::*;
use leptos_router::hooks::use_params_map;

/// Kanban board component with 4 columns
#[component]
pub fn Board() -> impl IntoView {
    let params = use_params_map();
    // Will be used when loading tasks for this project
    let _project_id = move || params.read().get("id").unwrap_or_default();

    view! {
        <div class="h-screen flex flex-col">
            <header class="navbar">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <a href="/" class="text-gray-500 hover:text-gray-700">"← Back"</a>
                        <h1 class="navbar-brand">"Project Board"</h1>
                    </div>
                    <button class="btn btn-primary">"New Task"</button>
                </div>
            </header>

            <div class="kanban-board flex-1">
                <KanbanColumn title="Todo" status="todo" />
                <KanbanColumn title="In Progress" status="in_progress" />
                <KanbanColumn title="In Review" status="in_review" />
                <KanbanColumn title="Done" status="done" />
            </div>
        </div>
    }
}

#[component]
fn KanbanColumn(
    title: &'static str,
    /// The status filter for tasks in this column
    #[prop(into)]
    status: String,
) -> impl IntoView {
    // Status will be used for filtering tasks
    let _ = status;

    view! {
        <div class="kanban-column">
            <div class="kanban-column-header">
                <h3 class="kanban-column-title">{title}</h3>
                <span class="kanban-column-count">"0"</span>
            </div>

            <div class="flex-1 overflow-y-auto">
                <p class="text-gray-400 text-sm text-center py-4">"No tasks"</p>
            </div>
        </div>
    }
}
