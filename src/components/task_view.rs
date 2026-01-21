use leptos::prelude::*;
use leptos_router::hooks::use_params_map;

/// Task detail view component
#[component]
pub fn TaskView() -> impl IntoView {
    let params = use_params_map();
    let task_id = move || params.read().get("id").unwrap_or_default();

    view! {
        <div class="container mx-auto px-4 py-8">
            <header class="mb-8">
                <div class="flex items-center gap-4 mb-4">
                    <a href="/" class="text-gray-500 hover:text-gray-700">"← Back"</a>
                </div>
                <h1 class="text-3xl font-bold text-gray-900">"Task Details"</h1>
                <p class="text-gray-600 mt-2">"Task ID: " {task_id}</p>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 space-y-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">"Description"</h2>
                        <p class="text-gray-500">"Task description will be displayed here."</p>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">"Sessions"</h2>
                        <p class="text-gray-500">"Agent sessions will be listed here."</p>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">"Status"</h2>
                        <span class="status-badge status-running">"Todo"</span>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">"Actions"</h2>
                        <div class="space-y-2">
                            <button class="btn btn-success w-full">"Start Agent Session"</button>
                            <button class="btn btn-secondary w-full">"Edit Task"</button>
                            <button class="btn btn-danger w-full">"Delete Task"</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    }
}
