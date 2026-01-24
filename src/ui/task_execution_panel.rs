use crate::db::models::{LogEntry, LogType, Session, Task};
use egui;

pub struct TaskExecutionPanel {}

impl TaskExecutionPanel {
    pub fn new() -> Self {
        Self {}
    }

    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        task: Option<&Task>,
        session: Option<&Session>,
        logs: &[LogEntry],
    ) {
        ui.heading("Task Execution");
        ui.separator();

        if let Some(task) = task {
            ui.vertical(|ui| {
                ui.label(egui::RichText::new(&task.title).strong().size(18.0));
                ui.add_space(4.0);

                if let Some(desc) = &task.description {
                    ui.label(
                        egui::RichText::new(desc)
                            .size(14.0)
                            .color(egui::Color32::from_rgb(180, 180, 180)),
                    );
                    ui.add_space(8.0);
                }

                ui.horizontal(|ui| {
                    ui.label("Status:");
                    let status_color = match task.status {
                        crate::db::models::TaskStatus::Todo => {
                            egui::Color32::from_rgb(150, 150, 150)
                        }
                        crate::db::models::TaskStatus::InProgress => {
                            egui::Color32::from_rgb(100, 150, 255)
                        }
                        crate::db::models::TaskStatus::InReview => {
                            egui::Color32::from_rgb(255, 200, 100)
                        }
                        crate::db::models::TaskStatus::Done => {
                            egui::Color32::from_rgb(100, 255, 150)
                        }
                    };
                    ui.colored_label(status_color, task.status.to_string());
                });

                ui.add_space(8.0);
                ui.separator();
                ui.add_space(8.0);

                if let Some(session) = session {
                    self.show_session_info(ui, session);
                    ui.add_space(8.0);
                    ui.separator();
                    ui.add_space(8.0);
                    self.show_logs(ui, logs);
                } else {
                    ui.label("No active session");
                    ui.label("Press 's' to start a new session");
                }
            });
        } else {
            ui.vertical_centered(|ui| {
                ui.add_space(100.0);
                ui.label(
                    egui::RichText::new("No task selected")
                        .size(16.0)
                        .color(egui::Color32::from_rgb(120, 120, 120)),
                );
                ui.label("Select a task from the task manager to view details");
            });
        }
    }

    fn show_session_info(&self, ui: &mut egui::Ui, session: &Session) {
        ui.label(
            egui::RichText::new("Session Information")
                .strong()
                .size(16.0),
        );
        ui.add_space(4.0);

        egui::Grid::new("session_info_grid")
            .num_columns(2)
            .spacing([10.0, 6.0])
            .show(ui, |ui| {
                ui.label("Session ID:");
                ui.label(&session.id);
                ui.end_row();

                ui.label("Status:");
                let status_color = match session.status {
                    crate::db::models::SessionStatus::Running => {
                        egui::Color32::from_rgb(100, 255, 150)
                    }
                    crate::db::models::SessionStatus::Completed => {
                        egui::Color32::from_rgb(100, 150, 255)
                    }
                    crate::db::models::SessionStatus::Failed => {
                        egui::Color32::from_rgb(255, 100, 100)
                    }
                    crate::db::models::SessionStatus::Killed => {
                        egui::Color32::from_rgb(200, 100, 100)
                    }
                };
                ui.colored_label(status_color, session.status.to_string());
                ui.end_row();

                ui.label("Executor:");
                ui.label(&session.executor_type);
                ui.end_row();

                if let Some(branch) = &session.branch_name {
                    ui.label("Branch:");
                    ui.label(branch);
                    ui.end_row();
                }

                if let Some(worktree) = &session.worktree_path {
                    ui.label("Worktree:");
                    ui.label(worktree.display().to_string());
                    ui.end_row();
                }

                ui.label("Started:");
                ui.label(session.created_at.format("%Y-%m-%d %H:%M:%S").to_string());
                ui.end_row();

                if let Some(finished) = session.finished_at {
                    ui.label("Finished:");
                    ui.label(finished.format("%Y-%m-%d %H:%M:%S").to_string());
                    ui.end_row();
                }
            });
    }

    fn show_logs(&self, ui: &mut egui::Ui, logs: &[LogEntry]) {
        ui.label(egui::RichText::new("Execution Logs").strong().size(16.0));
        ui.add_space(4.0);

        egui::ScrollArea::vertical()
            .id_salt("execution_logs")
            .auto_shrink([false, false])
            .stick_to_bottom(true)
            .show(ui, |ui| {
                if logs.is_empty() {
                    ui.label("No logs yet");
                    return;
                }

                for log in logs {
                    let (icon, color) = match log.log_type {
                        LogType::Stdout => ("▶", egui::Color32::from_rgb(100, 150, 255)),
                        LogType::Stderr => ("✖", egui::Color32::from_rgb(255, 100, 100)),
                        LogType::Event => ("⚙", egui::Color32::from_rgb(150, 150, 150)),
                    };

                    ui.horizontal(|ui| {
                        ui.colored_label(color, icon);
                        ui.label(
                            egui::RichText::new(log.timestamp.format("%H:%M:%S").to_string())
                                .size(11.0)
                                .color(egui::Color32::from_rgb(120, 120, 120)),
                        );
                        ui.label(&log.content);
                    });
                    ui.add_space(4.0);
                }
            });
    }
}

impl Default for TaskExecutionPanel {
    fn default() -> Self {
        Self::new()
    }
}
