#!/usr/bin/env bash
set -e

export MSYS_NO_PATHCONV=1
PROJECT_NAME=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')

echo "=================================================="
echo "1. MEMULAI PENGUJIAN BASELINE (SEBELUM OPTIMASI)"
echo "=================================================="
docker compose down --remove-orphans >/dev/null 2>&1 || true
docker compose up -d --build
IMG_BASE=$(docker images "${PROJECT_NAME}-app" --format "{{.Size}}")
echo "Menunggu 12 detik agar Prometheus mengumpulkan data awal..."
sleep 12
RES_BASE=$(docker compose --profile test run --rm benchmark python /benchmark/load_test.py baseline)
echo "Hasil Baseline : $RES_BASE"
echo "Ukuran Image   : $IMG_BASE"

echo ""
echo "=================================================="
echo "2. MEMULAI PENGUJIAN OPTIMIZED (SESUDAH OPTIMASI)"
echo "=================================================="
docker compose down --remove-orphans >/dev/null 2>&1 || true
docker compose -f docker-compose.optimized.yml up -d --build
IMG_OPT=$(docker images "${PROJECT_NAME}-app" --format "{{.Size}}")
echo "Menunggu 12 detik agar Prometheus mengumpulkan data awal..."
sleep 12
RES_OPT=$(docker compose -f docker-compose.optimized.yml --profile test run --rm benchmark python /benchmark/load_test.py optimized)
echo "Hasil Optimized: $RES_OPT"
echo "Ukuran Image   : $IMG_OPT"

echo ""
echo "=================================================="
echo "3. RINGKASAN PERBANDINGAN (GREEN CLOUD COMPUTING)"
echo "=================================================="
docker compose -f docker-compose.optimized.yml --profile test run --rm \
  -e RES_BASE="$RES_BASE" \
  -e RES_OPT="$RES_OPT" \
  -e IMG_BASE="$IMG_BASE" \
  -e IMG_OPT="$IMG_OPT" \
  benchmark python -c '
import json, os

b = json.loads(os.environ["RES_BASE"])
o = json.loads(os.environ["RES_OPT"])
img_b = os.environ["IMG_BASE"]
img_o = os.environ["IMG_OPT"]

def diff(v1, v2):
    return f"{((v1 - v2) / v1 * 100):+.2f}%" if v1 else "0%"

print("Image Size  :", img_b, "->", img_o)
print("RAM Idle    :", b["ram_idle_mb"], "MB ->", o["ram_idle_mb"], "MB (Hemat:", diff(b["ram_idle_mb"], o["ram_idle_mb"]), ")")
print("RAM Peak    :", b["ram_peak_mb"], "MB ->", o["ram_peak_mb"], "MB (Hemat:", diff(b["ram_peak_mb"], o["ram_peak_mb"]), ")")
print("CPU Rate    :", b["cpu_cores"], "cores ->", o["cpu_cores"], "cores (Hemat:", diff(b["cpu_cores"], o["cpu_cores"]), ")")
print("Avg Latency :", b["avg_latency"], "s ->", o["avg_latency"], "s (Selisih:", diff(b["avg_latency"], o["avg_latency"]), ")")
print("Sukses Req  : Baseline", b["success"], "| Optimized", o["success"])
'