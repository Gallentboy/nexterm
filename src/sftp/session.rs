use anyhow::{anyhow, Result};
use russh::client;
use russh_sftp::client::SftpSession;
use std::path::Path;
use tokio::net::ToSocketAddrs;

/// SFTP 会话封装
pub struct SftpConnection {
    pub sftp: SftpSession,
    pub ssh_session: client::Handle<crate::ssh::session::Client>,
}

impl SftpConnection {
    /// 通过密码连接并创建 SFTP 会话
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn connect_by_password(
        username: String,
        password: String,
        addr: String,
        config: client::Config,
    ) -> Result<Self> {
        // 1. 建立 SSH 连接
        let ssh_session =
            crate::ssh::session::Session::connect_by_password(username, password, addr, config)
                .await?;

        // 2. 创建 SFTP 通道
        let channel = ssh_session
            .session
            .channel_open_session()
            .await
            .map_err(|e| anyhow!("打开 SFTP 通道失败: {}", e))?;

        // 3. 请求 SFTP 子系统
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| anyhow!("请求 SFTP 子系统失败: {}", e))?;

        // 4. 创建 SFTP 会话
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| anyhow!("创建 SFTP 会话失败: {}", e))?;

        Ok(Self {
            sftp,
            ssh_session: ssh_session.session,
        })
    }

    /// 通过密钥连接并创建 SFTP 会话
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn connect_by_key<P: AsRef<Path>, A: ToSocketAddrs>(
        key_path: P,
        user: impl Into<String>,
        openssh_cert_path: Option<P>,
        addrs: A,
        cfg: client::Config,
    ) -> Result<Self> {
        // 1. 建立 SSH 连接
        let ssh_session =
            crate::ssh::session::Session::connect_by_key(key_path, user, openssh_cert_path, addrs, cfg)
                .await?;

        // 2. 创建 SFTP 通道
        let channel = ssh_session
            .session
            .channel_open_session()
            .await
            .map_err(|e| anyhow!("打开 SFTP 通道失败: {}", e))?;

        // 3. 请求 SFTP 子系统
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| anyhow!("请求 SFTP 子系统失败: {}", e))?;

        // 4. 创建 SFTP 会话
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| anyhow!("创建 SFTP 会话失败: {}", e))?;

        Ok(Self {
            sftp,
            ssh_session: ssh_session.session,
        })
    }

    /// 关闭连接
    ///
    /// @author zhangyue
    /// @date 2026-01-16
    pub async fn close(self) -> Result<()> {
        // 先关闭SFTP会话
        if let Err(e) = self.sftp.close().await {
            tracing::warn!("关闭 SFTP 会话失败: {}", e);
        }

        // 断开SSH连接
        if let Err(e) = self.ssh_session
            .disconnect(russh::Disconnect::ByApplication, "", "")
            .await
        {
            tracing::warn!("断开 SSH 连接失败: {}", e);
        }

        Ok(())
    }
}
