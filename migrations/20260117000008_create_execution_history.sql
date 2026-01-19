-- 创建执行历史表
CREATE TABLE IF NOT EXISTS execution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    task_name TEXT NOT NULL,
    plan_id INTEGER NOT NULL,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL,  -- COMPLETED, FAILED, PARTIAL
    total_steps INTEGER NOT NULL,
    progress INTEGER NOT NULL,  -- 0-100
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration INTEGER,  -- 执行时长(秒)
    server_groups TEXT NOT NULL,  -- JSON 格式存储服务器组信息
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES deployment_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES execution_plans(id) ON DELETE CASCADE
);

-- 创建执行日志表
CREATE TABLE IF NOT EXISTS execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    history_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,  -- info, success, warning, error
    message TEXT NOT NULL,
    server_id INTEGER,
    server_name TEXT,
    step_id TEXT,
    step_name TEXT,
    FOREIGN KEY (history_id) REFERENCES execution_history(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_execution_history_task_id ON execution_history(task_id);
CREATE INDEX IF NOT EXISTS idx_execution_history_status ON execution_history(status);
CREATE INDEX IF NOT EXISTS idx_execution_history_start_time ON execution_history(start_time);
CREATE INDEX IF NOT EXISTS idx_execution_logs_history_id ON execution_logs(history_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp);
