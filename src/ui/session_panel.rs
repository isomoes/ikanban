use crate::db::models::{LogEntry, Session};

pub struct SessionPanel;

impl SessionPanel {
    pub fn new() -> Self {
        Self
    }

    pub fn show(&mut self, ui: &mut egui::Ui, session: Option<&Session>, logs: &[LogEntry]) {
        ui.vertical(|ui| {
            ui.heading("Session Panel");

            if let Some(session) = session {
                ui.separator();

                ui.label(format!("Session ID: {}", session.id));
                ui.label(format!("Status: {:?}", session.status));
                ui.label(format!("Executor: {}", session.executor_type));

                if let Some(branch) = &session.branch_name {
                    ui.label(format!("Branch: {}", branch));
                }

                if let Some(path) = &session.worktree_path {
                    ui.label(format!("Worktree: {}", path.display()));
                }

                if let Some(started) = session.started_at {
                    ui.label(format!("Started: {}", started.format("%Y-%m-%d %H:%M:%S")));
                }

                if let Some(finished) = session.finished_at {
                    ui.label(format!(
                        "Finished: {}",
                        finished.format("%Y-%m-%d %H:%M:%S")
                    ));
                }

                ui.separator();
                ui.heading("Logs");

                egui::ScrollArea::vertical()
                    .auto_shrink([false; 2])
                    .stick_to_bottom(true)
                    .show(ui, |ui| {
                        for log in logs {
                            ui.horizontal(|ui| {
                                ui.label(log.timestamp.format("%H:%M:%S").to_string());
                                ui.label(format!("[{:?}]", log.log_type));
                                ui.label(&log.content);
                            });
                        }
                    });
            } else {
                ui.label("No active session");
            }
        });
    }
}

impl Default for SessionPanel {
    fn default() -> Self {
        Self::new()
    }
}
