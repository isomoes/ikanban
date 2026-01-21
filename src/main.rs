#[cfg(feature = "ssr")]
#[tokio::main]
async fn main() {
    use axum::Router;
    use ikanban::app::App;
    use ikanban::server::db;
    use leptos::prelude::*;
    use leptos_axum::{generate_route_list, LeptosRoutes};
    use tower_http::compression::CompressionLayer;
    use tower_http::cors::{Any, CorsLayer};

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ikanban=debug,tower_http=debug".into()),
        )
        .init();

    // Initialize database
    let pool = db::init_pool()
        .await
        .expect("Failed to initialize database");

    // Run migrations
    db::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    // Get Leptos configuration
    let conf = get_configuration(None).unwrap();
    let leptos_options = conf.leptos_options;
    let addr = leptos_options.site_addr;

    // Generate routes
    let routes = generate_route_list(App);

    // Shell function for leptos_routes (takes no arguments)
    let app_shell = {
        let leptos_options = leptos_options.clone();
        move || {
            let options = leptos_options.clone();
            view! {
                <!DOCTYPE html>
                <html lang="en">
                    <head>
                        <meta charset="utf-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        <AutoReload options=options.clone() />
                        <HydrationScripts options=options.clone() />
                        <leptos_meta::MetaTags />
                    </head>
                    <body>
                        <App />
                    </body>
                </html>
            }
        }
    };

    // Shell function for file_and_error_handler (takes LeptosOptions)
    let error_shell = |options: LeptosOptions| {
        view! {
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <AutoReload options=options.clone() />
                    <HydrationScripts options=options.clone() />
                    <leptos_meta::MetaTags />
                </head>
                <body>
                    <App />
                </body>
            </html>
        }
    };

    // Build the Axum router
    let app = Router::new()
        .leptos_routes(&leptos_options, routes, app_shell)
        .fallback(leptos_axum::file_and_error_handler(error_shell))
        .layer(CompressionLayer::new())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(leptos_options);

    // Start the server
    tracing::info!("listening on http://{}", &addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

#[cfg(not(feature = "ssr"))]
fn main() {
    // This main function is only used when building for WASM
    // The actual hydration happens in lib.rs
}
