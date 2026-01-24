use super::Column;
use crate::db::models::{Task, TaskStatus};
use crate::keyboard::KeyboardState;

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

    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        tasks: &[Task],
        keyboard_state: &KeyboardState,
    ) -> Option<String> {
        let mut selected_task_id = None;

        ui.heading("Task Manager");
        ui.separator();

        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.set_min_width(120.0);
                let is_selected = keyboard_state.selected_column == 0;
                if let Some(task_id) =
                    self.todo_column
                        .show(ui, tasks, is_selected, keyboard_state.selected_row)
                {
                    selected_task_id = Some(task_id);
                }
            });

            ui.separator();

            ui.vertical(|ui| {
                ui.set_min_width(120.0);
                let is_selected = keyboard_state.selected_column == 1;
                if let Some(task_id) = self.in_progress_column.show(
                    ui,
                    tasks,
                    is_selected,
                    keyboard_state.selected_row,
                ) {
                    selected_task_id = Some(task_id);
                }
            });

            ui.separator();

            ui.vertical(|ui| {
                ui.set_min_width(120.0);
                let is_selected = keyboard_state.selected_column == 2;
                if let Some(task_id) =
                    self.in_review_column
                        .show(ui, tasks, is_selected, keyboard_state.selected_row)
                {
                    selected_task_id = Some(task_id);
                }
            });

            ui.separator();

            ui.vertical(|ui| {
                ui.set_min_width(120.0);
                let is_selected = keyboard_state.selected_column == 3;
                if let Some(task_id) =
                    self.done_column
                        .show(ui, tasks, is_selected, keyboard_state.selected_row)
                {
                    selected_task_id = Some(task_id);
                }
            });
        });

        selected_task_id
    }
}

impl Default for Board {
    fn default() -> Self {
        Self::new()
    }
}
