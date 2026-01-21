use crate::util::buffer_pool::BufferManager;
use deadpool::managed;

pub(crate) mod buffer_pool;

pub(crate) type BufferPool = managed::Pool<BufferManager>;
