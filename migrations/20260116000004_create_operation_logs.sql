-- 创建服务器操作日志表
CREATE TABLE IF NOT EXISTS server_operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    server_id INTEGER,
    server_name TEXT,
    operation_type TEXT NOT NULL,  -- create, update, delete, connect, disconnect
    operation_detail TEXT,  -- JSON格式的详细信息
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (server_id) REFERENCES remote_servers(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_server_operation_logs_user_id ON server_operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_server_operation_logs_server_id ON server_operation_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_server_operation_logs_operation_type ON server_operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_server_operation_logs_created_at ON server_operation_logs(created_at);

-- 为 remote_servers 表添加操作人信息字段
ALTER TABLE remote_servers ADD COLUMN created_by_username TEXT;
ALTER TABLE remote_servers ADD COLUMN updated_by_username TEXT;
