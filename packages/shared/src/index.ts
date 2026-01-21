export interface Project {
  id: string;
  name: string;
  repo_path: string;
  archived: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStatus extends Project {
  is_running: boolean;
  is_errored: boolean;
  task_count: number;
  active_task_count: number;
}

export type TaskStatus = 'Todo' | 'InProgress' | 'InReview' | 'Done' | 'Cancelled';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  branch?: string;
  working_dir?: string;
  parent_task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskWithSessionStatus extends Task {
  session_count: number;
  has_running_session: boolean;
  last_session_failed: boolean;
}

export type SessionStatus = 'Running' | 'Completed' | 'Failed' | 'Cancelled';

export interface Session {
  id: string;
  task_id: string;
  executor: string;
  status: SessionStatus;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export type ExecutionProcessStatus = 'Running' | 'Completed' | 'Failed' | 'Killed';
export type ExecutionProcessRunReason = 'SetupScript' | 'CleanupScript' | 'CodingAgent' | 'DevServer';

export interface ExecutionProcess {
  id: string;
  session_id: string;
  run_reason: ExecutionProcessRunReason;
  executor_action?: string;
  status: ExecutionProcessStatus;
  exit_code?: number;
  dropped: boolean;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CodingAgentTurn {
  id: string;
  execution_process_id: string;
  agent_session_id?: string;
  prompt: string;
  summary?: string;
  seen: boolean;
  created_at: string;
  updated_at: string;
}

export type MergeStatus = 'Open' | 'Merged' | 'Closed' | 'Unknown';

export interface DirectMerge {
  id: string;
  project_id: string;
  merge_commit?: string;
  target_branch: string;
  created_at: string;
}

export interface PrMerge {
  id: string;
  project_id: string;
  target_branch: string;
  pr_number: number;
  pr_url: string;
  status: MergeStatus;
  merged_at?: string;
  created_at: string;
}

// WebSocket Messages
export type RequestType = 'ListProjects' | 'GetProject' | 'CreateProject' | 'UpdateProject' | 'DeleteProject' |
                          'ListTasks' | 'GetTask' | 'CreateTask' | 'UpdateTask' | 'DeleteTask' |
                          'ListSessions' | 'GetSession' | 'CreateSession' |
                          'ListExecutions' | 'GetExecution' | 'CreateExecution' | 'StopExecution' |
                          'GetExecutionLogs' | 'CreateExecutionLog' |
                          'Subscribe' | 'Unsubscribe';

export interface WsRequest {
  id: string;
  type: 'Request';
  payload: {
    action: RequestType;
    [key: string]: any;
  };
}

export interface WsResponse {
  type: 'Response';
  payload: {
    id: string;
    status: 'Success' | 'Error';
    data?: any;
    error?: string;
  };
}

export interface WsEvent {
  type: 'Event';
  payload: {
    event: string;
    payload: any;
  };
}
