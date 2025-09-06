pub const LAYER_PER_BUCKET_BIT: usize = 6;
pub const LAYER_PER_BUCKET: usize = 1 << LAYER_PER_BUCKET_BIT;
pub const LAYER_PER_BUCKET_MASK: usize = LAYER_PER_BUCKET - 1;
pub const MAX_LAYER_PER_BUCKET: usize =
  (usize::MAX.checked_ilog2().unwrap() as usize).div_ceil(LAYER_PER_BUCKET_BIT);

pub const MIN_DELAY: i64 = 1;
pub const MAX_DELAY: i64 = u32::MAX as i64;
