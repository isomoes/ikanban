use crate::db::models::Task;

pub struct TaskCard;

impl TaskCard {
    pub fn new() -> Self {
        Self
    }

    pub fn show(&mut self, ui: &mut egui::Ui, task: &Task, is_selected: bool) -> Option<String> {
        let stroke = if is_selected {
            egui::Stroke::new(2.0, egui::Color32::from_rgb(100, 150, 255))
        } else {
            ui.visuals().window_stroke()
        };

        let fill = if is_selected {
            egui::Color32::from_rgb(40, 50, 70)
        } else {
            ui.visuals().window_fill()
        };

        let mut clicked = false;

        egui::Frame::none()
            .fill(fill)
            .stroke(stroke)
            .rounding(4.0)
            .inner_margin(8.0)
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    ui.heading(&task.title);

                    if let Some(desc) = &task.description {
                        ui.label(desc);
                    }

                    ui.horizontal(|ui| {
                        ui.label(format!("Status: {:?}", task.status));
                        ui.label(format!("Created: {}", task.created_at.format("%Y-%m-%d")));
                    });

                    if ui
                        .interact(ui.min_rect(), ui.id().with(&task.id), egui::Sense::click())
                        .clicked()
                    {
                        clicked = true;
                    }
                });
            });

        if clicked {
            Some(task.id.clone())
        } else {
            None
        }
    }
}

impl Default for TaskCard {
    fn default() -> Self {
        Self::new()
    }
}
