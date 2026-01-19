#!/usr/bin/env python3
import re

# 处理 user/handlers.rs
with open('src/user/handlers.rs', 'r') as f:
    content = f.read()

# 在每个使用 app_state 的函数中添加 user_service 提取
# 匹配模式: State(app_state): State<crate::AppState> 后面跟着 ) -> impl IntoResponse {
pattern = r'(State\(app_state\): State<crate::AppState>.*?\) -> impl IntoResponse \{)'
replacement = r'\1\n    let user_service = &app_state.user_service;\n'

content = re.sub(pattern, replacement, content)

with open('src/user/handlers.rs', 'w') as f:
    f.write(content)

print("Updated user/handlers.rs")

# 处理 server/handlers.rs
with open('src/server/handlers.rs', 'r') as f:
    content = f.read()

pattern = r'(State\(app_state\): State<crate::AppState>.*?\) -> impl IntoResponse \{)'
replacement = r'\1\n    let server_service = &app_state.server_service;\n'

content = re.sub(pattern, replacement, content)

with open('src/server/handlers.rs', 'w') as f:
    f.write(content)

print("Updated server/handlers.rs")
