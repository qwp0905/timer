pub const BUCKET_COUNT_BIT: usize = 6;
pub const BUCKET_COUNT: usize = 1 << BUCKET_COUNT_BIT;
pub const BUCKET_MASK: usize = BUCKET_COUNT - 1;
pub const MAX_BUCKET_COUNT: usize =
  (usize::MAX.checked_ilog2().unwrap() as usize).div_ceil(BUCKET_COUNT_BIT);

pub const MIN_DELAY: i64 = 1;
pub const MAX_DELAY: i64 = 0xffff_ffff;
