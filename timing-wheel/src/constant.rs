pub const BUCKET_SIZE_BIT: usize = 6;
pub const BUCKET_SIZE: usize = 1 << BUCKET_SIZE_BIT;
pub const BUCKET_MASK: usize = BUCKET_SIZE - 1;
pub const MAX_BUCKET_INDEX: usize =
  (usize::MAX.checked_ilog2().unwrap() as usize).div_ceil(BUCKET_SIZE_BIT);
