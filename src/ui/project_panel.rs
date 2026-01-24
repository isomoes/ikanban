use crate::db::models::Project;
use egui;

pub struct ProjectPanel {
    selected_index: usize,
}

impl ProjectPanel {
    pub fn new() -> Self {
        Self { selected_index: 0 }
    }

    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        projects: &[Project],
        selected_project_id: Option<&String>,
    ) -> Option<String> {
        let mut new_selection = None;

        ui.heading("Projects");
        ui.separator();

        egui::ScrollArea::vertical()
            .id_salt("project_scroll")
            .show(ui, |ui| {
                if projects.is_empty() {
                    ui.label("No projects yet");
                    ui.label("Press 'n' to create a new project");
                    return;
                }

                for (idx, project) in projects.iter().enumerate() {
                    let is_selected = selected_project_id.map_or(false, |id| id == &project.id);

                    let frame = if is_selected {
                        egui::Frame::default()
                            .fill(egui::Color32::from_rgb(40, 50, 70))
                            .stroke(egui::Stroke::new(
                                2.0,
                                egui::Color32::from_rgb(100, 150, 255),
                            ))
                            .rounding(4.0)
                            .inner_margin(8.0)
                    } else {
                        egui::Frame::default()
                            .fill(egui::Color32::from_rgb(30, 30, 35))
                            .stroke(egui::Stroke::new(1.0, egui::Color32::from_rgb(60, 60, 65)))
                            .rounding(4.0)
                            .inner_margin(8.0)
                    };

                    frame.show(ui, |ui| {
                        ui.vertical(|ui| {
                            ui.horizontal(|ui| {
                                ui.label(egui::RichText::new(&project.name).strong().size(16.0));
                            });

                            ui.add_space(4.0);

                            ui.label(
                                egui::RichText::new(format!("Path: {}", project.path.display()))
                                    .size(12.0)
                                    .color(egui::Color32::from_rgb(150, 150, 150)),
                            );

                            ui.label(
                                egui::RichText::new(format!(
                                    "Created: {}",
                                    project.created_at.format("%Y-%m-%d %H:%M")
                                ))
                                .size(11.0)
                                .color(egui::Color32::from_rgb(120, 120, 120)),
                            );
                        });

                        if ui
                            .interact(ui.min_rect(), ui.id().with(idx), egui::Sense::click())
                            .clicked()
                        {
                            new_selection = Some(project.id.clone());
                        }
                    });

                    ui.add_space(8.0);
                }
            });

        new_selection
    }

    pub fn get_selected_index(&self) -> usize {
        self.selected_index
    }

    pub fn set_selected_index(&mut self, index: usize) {
        self.selected_index = index;
    }
}

impl Default for ProjectPanel {
    fn default() -> Self {
        Self::new()
    }
}
