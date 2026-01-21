use leptos::prelude::*;

/// Home page component - displays project list
#[component]
pub fn Home() -> impl IntoView {
    view! {
        <div class="container mx-auto px-4 py-8">
            <header class="mb-8">
                <h1 class="text-3xl font-bold text-gray-900">"iKanban"</h1>
                <p class="text-gray-600 mt-2">
                    "Multi-agent task management with git worktree isolation"
                </p>
            </header>

            <section>
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-semibold text-gray-800">"Projects"</h2>
                    <button class="btn btn-primary">"New Project"</button>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-gray-500 text-center py-8">
                        "No projects yet. Create your first project to get started."
                    </p>
                </div>
            </section>
        </div>
    }
}
