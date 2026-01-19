use time::OffsetDateTime;
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::FormatTime;
use tracing_subscriber::{fmt, EnvFilter};

/// 自定义时间格式化器：yyyy-MM-dd HH:mm:ss.SSS
struct LocalTime;

impl FormatTime for LocalTime {
    fn format_time(&self, w: &mut Writer<'_>) -> std::fmt::Result {
        let now = OffsetDateTime::now_local().unwrap_or(OffsetDateTime::now_utc());

        // 手动格式化为 yyyy-MM-dd HH:mm:ss.SSS
        write!(
            w,
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
            now.year(),
            now.month() as u8,
            now.day(),
            now.hour(),
            now.minute(),
            now.second(),
            now.millisecond()
        )
    }
}

/// 初始化日志系统
///
/// # 环境变量配置
/// - `RUST_LOG`: 控制日志级别，例如：
///   - `RUST_LOG=info` - 全局 info 级别
///   - `RUST_LOG=debug` - 全局 debug 级别
///   - `RUST_LOG=sc=trace` - 仅本项目 trace 级别
///   - `RUST_LOG=sc=debug,russh=info` - 多模块不同级别
pub fn init() {
    // Windows 下禁用颜色输出，避免终端显示 ANSI 转义序列
    #[cfg(windows)]
    let use_ansi = false;
    
    #[cfg(not(windows))]
    let use_ansi = true;

    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_timer(LocalTime)
        .with_ansi(use_ansi)
        .init();
}
