# 数据库迁移说明

## 📁 迁移文件

迁移文件位于 `migrations/` 目录下,按照执行顺序命名:

1. `20260116000001_create_users.sql` - 创建用户表
2. `20260116000002_create_ssh_connections.sql` - 创建 SSH 连接记录表

## 🔢 命名规则

迁移文件必须遵循以下命名格式:
```
<版本号>_<描述>.sql
```

**版本号规则:**
- 必须是唯一的数字
- 通常使用时间戳格式: `YYYYMMDDHHmmss`
- 例如: `20260116000001`, `20260116000002`

**重要:** 每个迁移文件的版本号必须唯一,否则会导致 `UNIQUE constraint failed` 错误。

## ✅ 正确示例

```
migrations/
├── 20260116000001_create_users.sql
├── 20260116000002_create_ssh_connections.sql
└── 20260116000003_add_user_roles.sql
```

## ❌ 错误示例

```
migrations/
├── 20260116_create_users.sql          # ❌ 版本号重复
├── 20260116_create_ssh_connections.sql # ❌ 版本号重复
```

## 🚀 运行迁移

迁移会在程序启动时自动执行:

```rust
sqlx::migrate!("./migrations")
    .run(&pool)
    .await?;
```

## 🔄 重置数据库

如果需要重置数据库(开发环境):

```bash
# 删除数据库文件
rm -f app.db app.db-shm app.db-wal

# 重新运行程序,迁移会自动执行
cargo run
```

## 📝 创建新迁移

创建新迁移文件时,使用当前时间戳:

```bash
# 生成时间戳
date +%Y%m%d%H%M%S

# 创建迁移文件
touch migrations/$(date +%Y%m%d%H%M%S)_your_migration_name.sql
```

## 🔍 查看迁移状态

SQLx 会在数据库中创建 `_sqlx_migrations` 表来跟踪已执行的迁移:

```sql
SELECT * FROM _sqlx_migrations;
```

## ⚠️ 注意事项

1. **不要修改已执行的迁移文件** - 这会导致校验和不匹配
2. **不要删除已执行的迁移文件** - 这会导致迁移历史不一致
3. **版本号必须唯一** - 使用时间戳确保唯一性
4. **迁移是单向的** - SQLx 不支持回滚,需要创建新的迁移来撤销更改

## 🛠️ 生产环境建议

1. **备份数据库** - 在运行迁移前备份
2. **测试迁移** - 在开发/测试环境先验证
3. **版本控制** - 将迁移文件提交到 Git
4. **文档记录** - 为每个迁移添加清晰的注释
