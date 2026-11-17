import json
import os
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import docker
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

client = docker.from_env()

state = {
    "status": "idle",  # idle | running | completed | error
    "step": "",
    "progress": 0,
    "error": None,
    "result": None
}


def format_bytes(size):
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"


def get_container_stats(container):
    data = container.stats(stream=False)
    mem_usage = data.get("memory_stats", {}).get("usage", 0)
    mem_cache = data.get("memory_stats", {}).get("stats", {}).get("inactive_file", 0)
    ram_mb = max(0, mem_usage - mem_cache) / (1024 * 1024)

    cpu_stats = data.get("cpu_stats", {})
    precpu_stats = data.get("precpu_stats", {})
    cpu_delta = cpu_stats.get("cpu_usage", {}).get("total_usage", 0) - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
    system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)
    online_cpus = cpu_stats.get("online_cpus") or len(cpu_stats.get("cpu_usage", {}).get("percpu_usage", [1]))

    cpu_cores = 0.0
    if system_delta > 0 and cpu_delta > 0:
        cpu_cores = (cpu_delta / system_delta) * online_cpus

    return round(ram_mb, 2), round(cpu_cores, 4)


def run_single_scenario(mode, params):
    project_net = os.getenv("DOCKER_NETWORK", "cloud-green-computing_green-net")
    app_context = "/workspace/app"

    dockerfile = "Dockerfile.baseline" if mode == "baseline" else "Dockerfile.optimized"
    image_tag = f"green-app-{mode}:latest"

    state["step"] = f"[{mode.upper()}] Building Docker image ({dockerfile})..."
    image, _ = client.images.build(path=app_context, dockerfile=dockerfile, tag=image_tag, rm=True)
    image_size_bytes = image.attrs.get("Size", 0)

    # Hapus container green-app lama jika ada
    try:
        old = client.containers.get("green-app")
        old.remove(force=True)
    except docker.errors.NotFound:
        pass

    # Konfigurasi resource limits & gunicorn command
    if mode == "baseline":
        workers = int(params.get("base_workers", 4))
        cmd = ["gunicorn", "-w", str(workers), "-b", "0.0.0.0:5000", "app:app"]
        nano_cpus = None
        mem_limit = None
    else:
        workers = int(params.get("opt_workers", 2))
        threads = int(params.get("opt_threads", 2))
        cpu_limit = float(params.get("cpu_limit", 0.5))
        ram_limit = int(params.get("ram_limit_mb", 128))
        cmd = ["gunicorn", "-w", str(workers), "--threads", str(threads), "-b", "0.0.0.0:5000", "app:app"]
        nano_cpus = int(cpu_limit * 1e9)
        mem_limit = f"{ram_limit}m"

    state["step"] = f"[{mode.upper()}] Menjalankan container green-app..."
    container = client.containers.run(
        image_tag,
        name="green-app",
        detach=True,
        network=project_net,
        ports={"5000/tcp": 5000},
        command=cmd,
        nano_cpus=nano_cpus,
        mem_limit=mem_limit,
        environment={"APP_MODE": mode}
    )

    time.sleep(3)
    container.reload()
    ram_idle, _ = get_container_stats(container)

    total_requests = int(params.get("total_requests", 100))
    concurrency = int(params.get("concurrency", 10))
    prime_limit = int(params.get("prime_limit", 15000))
    target_url = f"http://green-app:5000/work?limit={prime_limit}"

    samples_ram = [ram_idle]
    samples_cpu = []
    stop_sampling = False

    def sampler():
        while not stop_sampling:
            try:
                r, c = get_container_stats(container)
                samples_ram.append(r)
                if c > 0:
                    samples_cpu.append(c)
            except Exception:
                pass
            time.sleep(0.5)

    t_sampler = threading.Thread(target=sampler, daemon=True)
    t_sampler.start()

    state["step"] = f"[{mode.upper()}] Menembakkan {total_requests} requests ({concurrency} concurrent)..."

    def hit(_):
        t_start = time.time()
        try:
            with urllib.request.urlopen(target_url, timeout=60) as res:
                res.read()
                return True, time.time() - t_start
        except Exception:
            return False, time.time() - t_start

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        results = list(ex.map(hit, range(total_requests)))
    total_time = time.time() - t0

    stop_sampling = True
    t_sampler.join(timeout=2)

    success = sum(1 for r in results if r[0])
    avg_latency = sum(r[1] for r in results) / len(results) if results else 0

    return {
        "mode": mode,
        "image_size_bytes": image_size_bytes,
        "image_size_label": format_bytes(image_size_bytes),
        "ram_idle_mb": round(ram_idle, 2),
        "ram_peak_mb": round(max(samples_ram), 2),
        "cpu_cores": round(sum(samples_cpu) / len(samples_cpu), 4) if samples_cpu else 0.0,
        "avg_latency": round(avg_latency, 4),
        "total_time": round(total_time, 2),
        "success": success,
        "total_requests": total_requests
    }


def benchmark_worker(params):
    try:
        state["status"] = "running"
        state["error"] = None
        state["progress"] = 10

        base_res = run_single_scenario("baseline", params)
        state["progress"] = 55

        opt_res = run_single_scenario("optimized", params)
        state["progress"] = 100

        def calc_saving(b_val, o_val):
            if not b_val:
                return 0.0
            return round(((b_val - o_val) / b_val) * 100, 2)

        state["result"] = {
            "params": params,
            "baseline": base_res,
            "optimized": opt_res,
            "savings": {
                "image_size_pct": calc_saving(base_res["image_size_bytes"], opt_res["image_size_bytes"]),
                "ram_idle_pct": calc_saving(base_res["ram_idle_mb"], opt_res["ram_idle_mb"]),
                "ram_peak_pct": calc_saving(base_res["ram_peak_mb"], opt_res["ram_peak_mb"]),
                "cpu_pct": calc_saving(base_res["cpu_cores"], opt_res["cpu_cores"]),
                "latency_diff_pct": calc_saving(base_res["avg_latency"], opt_res["avg_latency"]),
            }
        }
        state["step"] = "Pengujian selesai!"
        state["status"] = "completed"
    except Exception as e:
        state["status"] = "error"
        state["error"] = str(e)
        state["step"] = f"Error: {str(e)}"


@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify(state)


@app.route("/api/run", methods=["POST"])
def start_benchmark():
    if state["status"] == "running":
        return jsonify({"message": "Pengujian sedang berjalan"}), 409

    params = request.json or {}
    thread = threading.Thread(target=benchmark_worker, args=(params,), daemon=True)
    thread.start()
    return jsonify({"message": "Pengujian dimulai", "status": "running"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)