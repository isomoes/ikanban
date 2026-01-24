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

    pub fn show(&mut self, ui: &mut egui::Ui, tasks: &[Task]) {
        ui.vertical(|ui| {
            ui.heading(format!("{:?}", self.status));

            ui.separator();

            egui::ScrollArea::vertical()
                .auto_shrink([false; 2])
                .show(ui, |ui| {
                    for task in tasks.iter().filter(|t| t.status == self.status) {
                        self.card.show(ui, task);
                        ui.add_space(8.0);
                    }
                });
        });
    }
}
