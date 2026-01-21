use leptos::prelude::*;
use leptos_router::hooks::use_params_map;

/// Project detail view component
#[component]
pub fn ProjectView() -> impl IntoView {
    let params = use_params_map();
    let project_id = move || params.read().get("id").unwrap_or_default();

    view! {
        <div class="container mx-auto px-4 py-8">
            <header class="mb-8">
                <div class="flex items-center gap-4 mb-4">
                    <a href="/" class="text-gray-500 hover:text-gray-700">"← Back to Projects"</a>
                </div>
                <h1 class="text-3xl font-bold text-gray-900">"Project Details"</h1>
                <p class="text-gray-600 mt-2">"Project ID: " {project_id}</p>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold mb-4">"Project Info"</h2>
                    <p class="text-gray-500">"Project details will be displayed here."</p>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold mb-4">"Quick Actions"</h2>
                    <div class="space-y-2">
                        <a
                            href=move || format!("/projects/{}/board", project_id())
                            class="btn btn-primary w-full"
                        >
                            "Open Board"
                        </a>
                    </div>
                </div>
            </div>
        </div>
    }
}
