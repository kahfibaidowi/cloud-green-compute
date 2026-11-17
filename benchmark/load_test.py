import http.client
import json
import os
import socket
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

APP_URL = os.getenv("APP_URL", "http://app:5000/work")
PROM_URL = os.getenv("PROM_URL", "http://prometheus:9090/api/v1/query")
TOTAL_REQUESTS = 200
CONCURRENCY = 10


class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, unix_socket_path):
        super().__init__("localhost")
        self.unix_socket_path = unix_socket_path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(self.unix_socket_path)


def get_docker_stats(container_name="green-app"):
    conn = UnixHTTPConnection("/var/run/docker.sock")
    conn.request("GET", f"/containers/{container_name}/stats?stream=false")
    res = conn.getresponse()
    data = json.loads(res.read().decode())
    conn.close()

    # Hitung RAM (MB)
    mem_usage = data.get("memory_stats", {}).get("usage", 0)
    mem_cache = data.get("memory_stats", {}).get("stats", {}).get("inactive_file", 0)
    ram_mb = max(0, mem_usage - mem_cache) / (1024 * 1024)

    # Hitung CPU (Core)
    cpu_stats = data.get("cpu_stats", {})
    precpu_stats = data.get("precpu_stats", {})
    cpu_delta = cpu_stats.get("cpu_usage", {}).get("total_usage", 0) - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
    system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)
    online_cpus = cpu_stats.get("online_cpus") or len(cpu_stats.get("cpu_usage", {}).get("percpu_usage", [1]))

    cpu_cores = 0.0
    if system_delta > 0 and cpu_delta > 0:
        cpu_cores = (cpu_delta / system_delta) * online_cpus

    return round(ram_mb, 2), round(cpu_cores, 4)


def hit_endpoint(i):
    start = time.time()
    try:
        with urllib.request.urlopen(APP_URL, timeout=20) as res:
            res.read()
            return True, time.time() - start
    except Exception:
        return False, time.time() - start


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "test"

    # 1. Ukur kondisi Idle
    ram_idle, _ = get_docker_stats("green-app")

    # 2. Jalankan sampling metrik di background selama beban berjalan
    samples_ram = [ram_idle]
    samples_cpu = []
    stop_sampling = False

    def sampler():
        while not stop_sampling:
            try:
                r, c = get_docker_stats("green-app")
                samples_ram.append(r)
                if c > 0:
                    samples_cpu.append(c)
            except Exception:
                pass
            time.sleep(0.5)

    t_sampler = threading.Thread(target=sampler, daemon=True)
    t_sampler.start()

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        results = list(executor.map(hit_endpoint, range(TOTAL_REQUESTS)))
    total_time = time.time() - t0

    stop_sampling = True
    t_sampler.join(timeout=2)

    ram_peak = max(samples_ram) if samples_ram else ram_idle
    cpu_avg = (sum(samples_cpu) / len(samples_cpu)) if samples_cpu else 0.0
    success = sum(1 for r in results if r[0])
    avg_latency = sum(r[1] for r in results) / len(results)

    summary = {
        "mode": mode,
        "success": f"{success}/{TOTAL_REQUESTS}",
        "total_time": round(total_time, 2),
        "avg_latency": round(avg_latency, 4),
        "ram_idle_mb": round(ram_idle, 2),
        "ram_peak_mb": round(ram_peak, 2),
        "cpu_cores": round(cpu_avg, 4)
    }
    print(json.dumps(summary))