use leptos::prelude::*;
use leptos_router::hooks::use_params_map;

/// Session detail view component with agent output
#[component]
pub fn SessionView() -> impl IntoView {
    let params = use_params_map();
    let session_id = move || params.read().get("id").unwrap_or_default();

    view! {
        <div class="h-screen flex flex-col">
            <header class="navbar">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <a href="/" class="text-gray-500 hover:text-gray-700">"← Back"</a>
                        <h1 class="navbar-brand">"Agent Session"</h1>
                        <span class="status-badge status-running">"Running"</span>
                    </div>
                    <button class="btn btn-danger">"Stop Session"</button>
                </div>
            </header>

            <div class="flex-1 flex overflow-hidden">
                <div class="flex-1 p-4 overflow-auto">
                    <div class="bg-white rounded-lg shadow p-4 mb-4">
                        <h2 class="text-lg font-semibold mb-2">"Session Info"</h2>
                        <dl class="grid grid-cols-2 gap-2 text-sm">
                            <dt class="text-gray-500">"Session ID:"</dt>
                            <dd class="font-mono">{session_id}</dd>
                            <dt class="text-gray-500">"Branch:"</dt>
                            <dd class="font-mono">"task/123-feature"</dd>
                            <dt class="text-gray-500">"Worktree:"</dt>
                            <dd class="font-mono truncate">"~/.ikanban/worktrees/task-123"</dd>
                        </dl>
                    </div>

                    <div class="bg-gray-900 rounded-lg p-4 h-96">
                        <h2 class="text-lg font-semibold text-white mb-2">"Agent Output"</h2>
                        <div class="agent-output h-80 overflow-auto">
                            <p class="text-gray-400">"Waiting for agent output..."</p>
                        </div>
                    </div>
                </div>

                <aside class="w-80 border-l border-gray-200 bg-white p-4 overflow-auto">
                    <h2 class="text-lg font-semibold mb-4">"Turn History"</h2>
                    <div class="space-y-2">
                        <p class="text-gray-500 text-sm">"No turns recorded yet."</p>
                    </div>
                </aside>
            </div>
        </div>
    }
}
