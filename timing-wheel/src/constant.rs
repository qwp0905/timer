pub const BUCKET_SIZE_BIT: usize = 6;
pub const BUCKET_SIZE: usize = 1 << BUCKET_SIZE_BIT;
pub const BUCKET_MASK: usize = BUCKET_SIZE - 1;
