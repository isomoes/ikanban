use super::TaskCard;
use crate::db::models::{Task, TaskStatus};

pub struct Column {
    status: TaskStatus,
    card: TaskCard,
}

impl Column {
    pub fn new(status: TaskStatus) -> Self {
        Self {
            status,
            card: TaskCard::new(),
        }
    }

    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        tasks: &[Task],
        is_selected_column: bool,
        selected_row: usize,
    ) -> Option<String> {
        let mut clicked_task_id = None;

        ui.vertical(|ui| {
            let heading_color = if is_selected_column {
                egui::Color32::from_rgb(100, 150, 255)
            } else {
                ui.style().visuals.text_color()
            };

            ui.colored_label(heading_color, format!("{:?}", self.status));

            ui.separator();

            egui::ScrollArea::vertical()
                .id_salt(format!("column_{:?}", self.status))
                .auto_shrink([false; 2])
                .show(ui, |ui| {
                    let mut row_index = 0;
                    for task in tasks.iter().filter(|t| t.status == self.status) {
                        let is_selected = is_selected_column && row_index == selected_row;
                        if let Some(task_id) = self.card.show(ui, task, is_selected) {
                            clicked_task_id = Some(task_id);
                        }
                        ui.add_space(8.0);
                        row_index += 1;
                    }
                });
        });

        clicked_task_id
    }
}
