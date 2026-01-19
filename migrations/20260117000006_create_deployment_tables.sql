-- 创建执行计划表
CREATE TABLE IF NOT EXISTS execution_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps TEXT NOT NULL,  -- JSON 格式存储步骤
    version TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
);

-- 创建部署任务表
CREATE TABLE IF NOT EXISTS deployment_tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    server_groups TEXT NOT NULL,  -- JSON 格式存储服务器组
    strategy TEXT NOT NULL,  -- SEQUENTIAL 或 PARALLEL
    status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, RUNNING, COMPLETED, FAILED, PARTIAL
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (plan_id) REFERENCES execution_plans(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_execution_plans_created_at ON execution_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_deployment_tasks_created_at ON deployment_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_deployment_tasks_plan_id ON deployment_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_deployment_tasks_status ON deployment_tasks(status);
