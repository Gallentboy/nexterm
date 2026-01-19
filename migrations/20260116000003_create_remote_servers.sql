-- 创建远程服务器管理表
CREATE TABLE IF NOT EXISTS remote_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'password',  -- password, key
    password TEXT,
    private_key TEXT,
    description TEXT,
    tags TEXT,  -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_connected_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_remote_servers_user_id ON remote_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_remote_servers_host ON remote_servers(host);
CREATE INDEX IF NOT EXISTS idx_remote_servers_is_active ON remote_servers(is_active);

-- 创建服务器分组表
CREATE TABLE IF NOT EXISTS server_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建服务器与分组的关联表
CREATE TABLE IF NOT EXISTS server_group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES remote_servers(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE CASCADE,
    UNIQUE(server_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_server_group_members_server_id ON server_group_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_group_members_group_id ON server_group_members(group_id);
