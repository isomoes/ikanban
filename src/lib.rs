pub mod db;

#[cfg(feature = "ssr")]
pub mod executor;

#[cfg(feature = "ssr")]
pub mod worktree;

#[cfg(feature = "ssr")]
pub mod session;

#[cfg(feature = "hydrate")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn hydrate() {
    console_error_panic_hook::set_once();
}
