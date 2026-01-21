use leptos::prelude::*;
use leptos_meta::{provide_meta_context, Meta, Stylesheet, Title};
use leptos_router::{
    components::{Route, Router, Routes},
    path,
};

use crate::components::{Board, Home, NotFound, ProjectView, SessionView, TaskView};

#[component]
pub fn App() -> impl IntoView {
    provide_meta_context();

    view! {
        <Stylesheet id="leptos" href="/pkg/ikanban.css" />
        <Title text="iKanban - Multi-Agent Task Management" />
        <Meta name="description" content="Kanban board for managing AI coding agents with git worktree isolation" />

        <Router>
            <main class="min-h-screen bg-gray-50">
                <Routes fallback=|| view! { <NotFound /> }>
                    <Route path=path!("/") view=Home />
                    <Route path=path!("/projects/:id") view=ProjectView />
                    <Route path=path!("/projects/:id/board") view=Board />
                    <Route path=path!("/tasks/:id") view=TaskView />
                    <Route path=path!("/sessions/:id") view=SessionView />
                </Routes>
            </main>
        </Router>
    }
}
