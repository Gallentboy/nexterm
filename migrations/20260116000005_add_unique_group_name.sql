-- 为 server_groups 表添加唯一索引 (保证每个用户的分组名不重复)
CREATE UNIQUE INDEX IF NOT EXISTS idx_server_groups_user_name ON server_groups(user_id, name);
