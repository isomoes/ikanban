use leptos::prelude::*;

/// 404 Not Found page component
#[component]
pub fn NotFound() -> impl IntoView {
    view! {
        <div class="min-h-screen flex items-center justify-center">
            <div class="text-center">
                <h1 class="text-6xl font-bold text-gray-300">"404"</h1>
                <p class="text-xl text-gray-600 mt-4">"Page not found"</p>
                <a href="/" class="btn btn-primary mt-6 inline-block">
                    "Go Home"
                </a>
            </div>
        </div>
    }
}
