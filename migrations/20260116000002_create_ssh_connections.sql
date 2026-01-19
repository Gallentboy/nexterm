-- 创建 SSH 连接记录表
CREATE TABLE IF NOT EXISTS ssh_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT NOT NULL,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    disconnected_at DATETIME,
    status TEXT NOT NULL DEFAULT 'active'
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ssh_connections_user_id ON ssh_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_ssh_connections_status ON ssh_connections(status);
