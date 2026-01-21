use bytes::BytesMut;
use deadpool::managed;
use log::info;

#[derive(Clone)]
pub(crate) struct BufferManager {
    size: usize,
}

impl BufferManager {
    /// 创建一个新的缓冲区管理器
    ///
    /// # 参数
    /// <ul>
    ///     <li>`size` - 每个缓冲区的容量(字节)</li>
    /// </ul>
    ///
    /// # 作者
    /// zhangyue
    ///
    /// # 日期
    /// 2026-01-21】
    #[inline(always)]
    pub(crate) fn new(size: usize) -> Self {
        Self { size }
    }
}

impl managed::Manager for BufferManager {
    type Type = BytesMut;
    type Error = std::convert::Infallible;

    #[inline(always)]
    async fn create(&self) -> Result<Self::Type, Self::Error> {
        Ok(BytesMut::zeroed(self.size))
    }

    #[inline(always)]
    async fn recycle(
        &self,
        obj: &mut Self::Type,
        _metrics: &managed::Metrics,
    ) -> managed::RecycleResult<Self::Error> {
        obj.resize(self.size, 0); // 清空数据
        Ok(())
    }
}
