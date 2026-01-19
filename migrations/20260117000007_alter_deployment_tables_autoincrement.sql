-- 修改执行计划表使用自增ID
DROP TABLE IF EXISTS deployment_tasks;
DROP TABLE IF EXISTS execution_plans;

-- 重新创建执行计划表(使用自增ID)
CREATE TABLE IF NOT EXISTS execution_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    steps TEXT NOT NULL,  -- JSON 格式存储步骤
    version TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
);

-- 重新创建部署任务表(使用自增ID)
CREATE TABLE IF NOT EXISTS deployment_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    plan_id INTEGER NOT NULL,
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
