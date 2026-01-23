use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone)]
pub struct Worktree {
    pub path: PathBuf,
    pub branch: String,
    pub commit: String,
}

pub struct WorktreeManager;

impl WorktreeManager {
    pub fn new() -> Self {
        Self
    }

    /// Create a new git worktree for the given task
    pub fn create_worktree(
        &self,
        project_path: &Path,
        task_id: &str,
        branch_name: &str,
    ) -> Result<PathBuf> {
        // Create worktree directory path
        let worktree_path = project_path
            .join(".worktrees")
            .join(task_id);

        // Ensure parent directory exists
        if let Some(parent) = worktree_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create worktrees directory: {}", parent.display()))?;
        }

        // Create the worktree
        let output = Command::new("git")
            .current_dir(project_path)
            .args(["worktree", "add", "-b", branch_name, worktree_path.to_str().unwrap(), "HEAD"])
            .output()
            .with_context(|| "Failed to execute git worktree add")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to create worktree: {}", stderr);
        }

        Ok(worktree_path)
    }

    /// Remove a worktree
    pub fn remove_worktree(&self, worktree_path: &Path) -> Result<()> {
        // Get the project root (parent of .worktrees)
        let project_path = worktree_path
            .parent()
            .and_then(|p| p.parent())
            .context("Invalid worktree path")?;

        // Remove the worktree using git
        let output = Command::new("git")
            .current_dir(project_path)
            .args(["worktree", "remove", worktree_path.to_str().unwrap()])
            .output()
            .with_context(|| "Failed to execute git worktree remove")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to remove worktree: {}", stderr);
        }

        Ok(())
    }

    /// List all worktrees for a project
    pub fn list_worktrees(&self, project_path: &Path) -> Result<Vec<Worktree>> {
        let output = Command::new("git")
            .current_dir(project_path)
            .args(["worktree", "list", "--porcelain"])
            .output()
            .with_context(|| "Failed to execute git worktree list")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to list worktrees: {}", stderr);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut worktrees = Vec::new();
        let mut current_path = None;
        let mut current_branch = None;
        let mut current_commit = None;

        for line in stdout.lines() {
            if line.starts_with("worktree ") {
                current_path = Some(line.strip_prefix("worktree ").unwrap().to_string());
            } else if line.starts_with("branch ") {
                current_branch = Some(
                    line.strip_prefix("branch ")
                        .unwrap()
                        .strip_prefix("refs/heads/")
                        .unwrap_or(line.strip_prefix("branch ").unwrap())
                        .to_string(),
                );
            } else if line.starts_with("HEAD ") {
                current_commit = Some(line.strip_prefix("HEAD ").unwrap().to_string());
            } else if line.is_empty() {
                if let (Some(path), Some(branch), Some(commit)) =
                    (current_path.take(), current_branch.take(), current_commit.take())
                {
                    worktrees.push(Worktree {
                        path: PathBuf::from(path),
                        branch,
                        commit,
                    });
                }
            }
        }

        // Handle last worktree if file doesn't end with blank line
        if let (Some(path), Some(branch), Some(commit)) =
            (current_path, current_branch, current_commit)
        {
            worktrees.push(Worktree {
                path: PathBuf::from(path),
                branch,
                commit,
            });
        }

        Ok(worktrees)
    }
}

impl Default for WorktreeManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup_git_repo() -> TempDir {
        let dir = TempDir::new().unwrap();
        Command::new("git")
            .current_dir(dir.path())
            .args(["init"])
            .output()
            .unwrap();
        Command::new("git")
            .current_dir(dir.path())
            .args(["config", "user.email", "test@example.com"])
            .output()
            .unwrap();
        Command::new("git")
            .current_dir(dir.path())
            .args(["config", "user.name", "Test User"])
            .output()
            .unwrap();

        // Create initial commit
        fs::write(dir.path().join("README.md"), "# Test").unwrap();
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "."])
            .output()
            .unwrap();
        Command::new("git")
            .current_dir(dir.path())
            .args(["commit", "-m", "Initial commit"])
            .output()
            .unwrap();

        dir
    }

    #[test]
    fn test_create_and_remove_worktree() {
        let repo = setup_git_repo();
        let manager = WorktreeManager::new();

        let worktree_path = manager
            .create_worktree(repo.path(), "task-123", "feature/test-branch")
            .unwrap();

        assert!(worktree_path.exists());
        assert!(worktree_path.join(".git").exists());

        manager.remove_worktree(&worktree_path).unwrap();
        assert!(!worktree_path.exists());
    }

    #[test]
    fn test_list_worktrees() {
        let repo = setup_git_repo();
        let manager = WorktreeManager::new();

        let worktrees = manager.list_worktrees(repo.path()).unwrap();
        assert_eq!(worktrees.len(), 1); // Main worktree

        let _worktree1 = manager
            .create_worktree(repo.path(), "task-1", "feature/task-1")
            .unwrap();
        let _worktree2 = manager
            .create_worktree(repo.path(), "task-2", "feature/task-2")
            .unwrap();

        let worktrees = manager.list_worktrees(repo.path()).unwrap();
        assert_eq!(worktrees.len(), 3);
    }
}
