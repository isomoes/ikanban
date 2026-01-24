use egui::Key;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Left,
    Right,
    Up,
    Down,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ViewLevel {
    Project,
    Task,
    Session,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    None,
    MoveSelection(Direction),
    MoveTask(Direction),
    SelectTask,
    CreateProject,
    CreateTask,
    DeleteTask,
    EditTask,
    StartSession,
    StopSession,
    JumpToTop,
    JumpToBottom,
    JumpToColumn(usize),
    Search,
    Quit,
    DrillDown,
    GoBack,
    ToggleHelp,
}

pub struct KeyboardState {
    pub view_level: ViewLevel,
    pub selected_column: usize,
    pub selected_row: usize,
    pub selected_project_index: usize,
    pub selected_session_index: usize,
    pub pending_key: Option<Key>,
    pub last_action: Action,
}

impl Default for KeyboardState {
    fn default() -> Self {
        Self {
            view_level: ViewLevel::Project,
            selected_column: 0,
            selected_row: 0,
            selected_project_index: 0,
            selected_session_index: 0,
            pending_key: None,
            last_action: Action::None,
        }
    }
}

impl KeyboardState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn handle_key(&mut self, key: Key, modifiers: &egui::Modifiers) -> Action {
        self.handle_normal_mode(key, modifiers)
    }

    fn handle_normal_mode(&mut self, key: Key, modifiers: &egui::Modifiers) -> Action {
        if modifiers.ctrl {
            return self.handle_ctrl_keys(key);
        }

        if let Some(pending) = self.pending_key {
            let action = self.handle_two_key_combo(pending, key);
            self.pending_key = None;
            return action;
        }

        match key {
            Key::H => Action::MoveSelection(Direction::Left),
            Key::J => Action::MoveSelection(Direction::Down),
            Key::K => Action::MoveSelection(Direction::Up),
            Key::L => Action::MoveSelection(Direction::Right),

            Key::ArrowLeft => Action::MoveSelection(Direction::Left),
            Key::ArrowDown => Action::MoveSelection(Direction::Down),
            Key::ArrowUp => Action::MoveSelection(Direction::Up),
            Key::ArrowRight => Action::MoveSelection(Direction::Right),

            Key::G => {
                self.pending_key = Some(Key::G);
                Action::None
            }

            Key::D => {
                self.pending_key = Some(Key::D);
                Action::None
            }

            Key::Num1 => Action::JumpToColumn(0),
            Key::Num2 => Action::JumpToColumn(1),
            Key::Num3 => Action::JumpToColumn(2),
            Key::Num4 => Action::JumpToColumn(3),

            Key::Enter => Action::DrillDown,
            Key::N => match self.view_level {
                ViewLevel::Project => Action::CreateProject,
                ViewLevel::Task => Action::CreateTask,
                ViewLevel::Session => Action::None,
            },
            Key::E => Action::EditTask,
            Key::S => Action::StartSession,
            Key::X => Action::StopSession,

            Key::Slash => Action::Search,
            Key::Q => Action::Quit,
            Key::Questionmark => Action::ToggleHelp,
            Key::Escape => Action::GoBack,

            _ => Action::None,
        }
    }

    fn handle_two_key_combo(&mut self, first: Key, second: Key) -> Action {
        match (first, second) {
            (Key::G, Key::G) => Action::JumpToTop,
            (Key::D, Key::D) => Action::DeleteTask,
            _ => Action::None,
        }
    }

    fn handle_ctrl_keys(&mut self, key: Key) -> Action {
        match key {
            Key::H => Action::MoveTask(Direction::Left),
            Key::J => Action::MoveTask(Direction::Down),
            Key::K => Action::MoveTask(Direction::Up),
            Key::L => Action::MoveTask(Direction::Right),
            Key::C => Action::Quit,
            _ => Action::None,
        }
    }

    pub fn move_selection(
        &mut self,
        direction: Direction,
        max_columns: usize,
        column_sizes: &[usize],
    ) {
        match direction {
            Direction::Left => {
                if self.selected_column > 0 {
                    self.selected_column -= 1;
                    self.selected_row = self
                        .selected_row
                        .min(column_sizes[self.selected_column].saturating_sub(1));
                }
            }
            Direction::Right => {
                if self.selected_column < max_columns.saturating_sub(1) {
                    self.selected_column += 1;
                    self.selected_row = self
                        .selected_row
                        .min(column_sizes[self.selected_column].saturating_sub(1));
                }
            }
            Direction::Up => {
                if self.selected_row > 0 {
                    self.selected_row -= 1;
                }
            }
            Direction::Down => {
                if self.selected_row < column_sizes[self.selected_column].saturating_sub(1) {
                    self.selected_row += 1;
                }
            }
        }
    }

    pub fn jump_to_top(&mut self) {
        self.selected_row = 0;
    }

    pub fn jump_to_bottom(&mut self, column_size: usize) {
        self.selected_row = column_size.saturating_sub(1);
    }

    pub fn jump_to_column(&mut self, column: usize, max_columns: usize, column_sizes: &[usize]) {
        if column < max_columns {
            self.selected_column = column;
            self.selected_row = self
                .selected_row
                .min(column_sizes[column].saturating_sub(1));
        }
    }

    pub fn get_view_string(&self) -> &str {
        match self.view_level {
            ViewLevel::Project => "PROJECT",
            ViewLevel::Task => "TASK",
            ViewLevel::Session => "SESSION",
        }
    }

    pub fn drill_down(&mut self) -> bool {
        match self.view_level {
            ViewLevel::Project => {
                self.view_level = ViewLevel::Task;
                true
            }
            ViewLevel::Task => {
                self.view_level = ViewLevel::Session;
                true
            }
            ViewLevel::Session => false,
        }
    }

    pub fn go_back(&mut self) -> bool {
        match self.view_level {
            ViewLevel::Project => false,
            ViewLevel::Task => {
                self.view_level = ViewLevel::Project;
                true
            }
            ViewLevel::Session => {
                self.view_level = ViewLevel::Task;
                true
            }
        }
    }

    pub fn move_project_selection(&mut self, direction: Direction, project_count: usize) {
        if project_count == 0 {
            return;
        }
        match direction {
            Direction::Up | Direction::Left => {
                if self.selected_project_index > 0 {
                    self.selected_project_index -= 1;
                }
            }
            Direction::Down | Direction::Right => {
                if self.selected_project_index < project_count.saturating_sub(1) {
                    self.selected_project_index += 1;
                }
            }
        }
    }

    pub fn move_session_selection(&mut self, direction: Direction, session_count: usize) {
        if session_count == 0 {
            return;
        }
        match direction {
            Direction::Up | Direction::Left => {
                if self.selected_session_index > 0 {
                    self.selected_session_index -= 1;
                }
            }
            Direction::Down | Direction::Right => {
                if self.selected_session_index < session_count.saturating_sub(1) {
                    self.selected_session_index += 1;
                }
            }
        }
    }
}
