use ikanban::KanbanApp;

fn main() -> eframe::Result<()> {
    let native_options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 720.0])
            .with_min_inner_size([800.0, 600.0])
            .with_title("iKanban - AI-Powered Task Management"),
        ..Default::default()
    };

    eframe::run_native(
        "iKanban",
        native_options,
        Box::new(|_cc| Ok(Box::new(KanbanApp::new()))),
    )
}
