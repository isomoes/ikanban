use super::Column;
use crate::db::models::{Task, TaskStatus};

pub struct Board {
    todo_column: Column,
    in_progress_column: Column,
    in_review_column: Column,
    done_column: Column,
}

impl Board {
    pub fn new() -> Self {
        Self {
            todo_column: Column::new(TaskStatus::Todo),
            in_progress_column: Column::new(TaskStatus::InProgress),
            in_review_column: Column::new(TaskStatus::InReview),
            done_column: Column::new(TaskStatus::Done),
        }
    }

    pub fn show(&mut self, ui: &mut egui::Ui, tasks: &[Task]) {
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.set_min_width(250.0);
                self.todo_column.show(ui, tasks);
            });

            ui.separator();

            ui.vertical(|ui| {
                ui.set_min_width(250.0);
                self.in_progress_column.show(ui, tasks);
            });

            ui.separator();

            ui.vertical(|ui| {
                ui.set_min_width(250.0);
                self.in_review_column.show(ui, tasks);
            });

            ui.separator();

            ui.vertical(|ui| {
                ui.set_min_width(250.0);
                self.done_column.show(ui, tasks);
            });
        });
    }
}

impl Default for Board {
    fn default() -> Self {
        Self::new()
    }
}
