import polars as pl
import time
import os

PARQUET_PATH = "s3://your-bucket/your-file.parquet"  # change only this

print("Polars version:", pl.__version__)
print("CPU count:", os.cpu_count())
print("Thread pool size:", pl.threadpool_size())

print("\n--- 1️⃣ Lazy scan only (no collect) ---")
start = time.time()
lazy_df = pl.scan_parquet(PARQUET_PATH)
print("Scan creation time:", time.time() - start)

print("\n--- 2️⃣ Lazy count().collect() ---")
start = time.time()
row_count = lazy_df.select(pl.count()).collect()
print("Row count:", row_count)
print("Lazy count collect time:", time.time() - start)

print("\n--- 3️⃣ Lazy simple select().collect() ---")
start = time.time()
lazy_df.select(pl.all().first()).collect()
print("Lazy simple select time:", time.time() - start)

print("\n--- 4️⃣ Full lazy collect() ---")
start = time.time()
lazy_df.collect()
print("Full lazy collect time:", time.time() - start)

print("\n--- 5️⃣ Eager read_parquet() ---")
start = time.time()
df = pl.read_parquet(PARQUET_PATH)
print("Eager read time:", time.time() - start)

print("\n--- 6️⃣ Eager df.head() ---")
start = time.time()
df.head(1000)
print("Eager head time:", time.time() - start)
