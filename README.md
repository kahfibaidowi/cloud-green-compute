# Green Cloud Computing — Resource Optimization & Benchmarking

Proyek eksperimen **Topik 7 — Green Cloud Computing** untuk mengukur, mengoptimasi, dan menganalisis efisiensi penggunaan sumber daya komputasi (CPU, RAM, dan *Storage*) pada layanan berbasis container Docker.

## Arsitektur & Alur Sistem

```
[ Workload Generator ] ---> [ Target App (green-app) ] <--- [ Docker Engine Socket / cAdvisor ] ---> [ Prometheus ]
 (benchmark/load_test.py)        (Flask + Gunicorn)                 (Metrics Collector)                 (Monitoring)

```

1. **Workload Baseline:** Menjalankan aplikasi web Python Flask (`app/app.py`) dengan beban komputasi *CPU-bound* (pencarian bilangan prima) menggunakan *base image* penuh tanpa batasan sumber daya.

2. **Measure Baseline:** Menembakkan 100 *request* serentak (`10 concurrent`) dan merekam penggunaan *Image Size*, *RAM Idle*, *RAM Peak*, *CPU Usage*, dan *Average Latency*.

3. **Optimize Container:** Mengganti *base image* ke `python:3.11-alpine`, menyesuaikan konfigurasi *worker/thread* Gunicorn, serta menerapkan batas sumber daya (`cpus: "0.50"`, `memory: 128M`).

4. **Measure Again & Compare:** Menjalankan beban kerja yang identik pada lingkungan *Optimized* untuk menghitung efisiensi sumber daya dan menganalisis *trade-off* performa.

## Struktur Proyek

```
.
├── app/
│   ├── app.py                      # Aplikasi web uji (Flask) dengan endpoint /work
│   ├── requirements.txt            # Dependensi Python (Flask & Gunicorn)
│   ├── Dockerfile.baseline         # Konfigurasi image sebelum optimasi (Debian full, 4 workers)
│   └── Dockerfile.optimized        # Konfigurasi image sesudah optimasi (Alpine, 2 workers/2 threads)
├── monitoring/
│   └── prometheus.yml              # Konfigurasi scrape interval Prometheus
├── benchmark/
│   └── load_test.py                # Skrip load testing & pengambil metrik Docker Engine API
├── docker-compose.yml              # Orkestrasi layanan skenario Baseline
├── docker-compose.optimized.yml    # Orkestrasi layanan skenario Optimized + Resource Limits
├── run_test.sh                     # Skrip otomatisasi pengujian Baseline vs Optimized
└── README.md

```

## Prasyarat

* **Docker** & **Docker Compose V2** (mendukung Windows Docker Desktop + Git Bash maupun Linux Ubuntu 24.04 LTS).

* **Git** dan **Bash**.

## Cara Menjalankan Pengujian Otomatis

Seluruh skenario pengujian (*Baseline* dan *Optimized*) telah diotomatisasi dalam satu skrip:

1. **Clone repositori dan masuk ke direktori proyek:**

   ```
   git clone <URL_REPO_GITHUB_ANDA>
   cd <NAMA_FOLDER_REPO>
   
   ```

2. **Jalankan skrip pengujian otomatis:**

   * **Di Windows (Git Bash):**

     ```
     bash run_test.sh
     
     ```

   * **Di Linux Ubuntu 24.04:**

     ```
     sudo bash run_test.sh
     
     ```

3. **Akses Dashboard Monitoring (Opsional):**

   * **Aplikasi Uji:** `http://localhost:5000` (atau `http://<IP_VPS>:5000`)

   * **Prometheus UI:** `http://localhost:9090` (atau `http://<IP_VPS>:9090`)

   * **cAdvisor UI:** `http://localhost:8080` (atau `http://<IP_VPS>:8080`)

## Parameter Pengujian & Tuning

Untuk mengeksplorasi berbagai skenario beban kerja dan titik keseimbangan (*right-sizing*), Anda dapat menyesuaikan parameter berikut:

| Kategori Parameter | Parameter | Lokasi File | Default | Efek Jika Diubah |
| :--- | :--- | :--- | :--- | :--- |
| **Beban Trafik** | `TOTAL_REQUESTS` | `benchmark/load_test.py` (baris 12) | `100` | Mengatur jumlah total permintaan uji yang dikirimkan. |
| | `CONCURRENCY` | `benchmark/load_test.py` (baris 13) | `10` | Mengatur jumlah permintaan serentak; makin tinggi nilainya, antrean CPU dan *latency* makin naik. |
| **Resource Limits** | `cpus` (limits) | `docker-compose.optimized.yml` (baris 12) | `"0.50"` | Mengatur batas maksimal jatah CPU core (misal `"0.25"`, `"0.50"`, `"1.0"`). |
| | `memory` (limits) | `docker-compose.optimized.yml` (baris 13) | `128M` | Mengatur batas maksimal RAM container. Jika terlalu kecil (misal `32M`), container berisiko mengalami `OOMKilled`. |
| **Konfigurasi Server** | `-w` (Workers) | `app/Dockerfile.baseline` & `Dockerfile.optimized` | `4` / `2` | Mengatur jumlah proses Gunicorn. Makin banyak *worker*, konsumsi RAM *idle* makin tinggi namun pemrosesan paralel lebih cepat. |
| | `--threads` | `app/Dockerfile.optimized` | `2` | Mengatur jumlah *thread* per *worker* untuk menangani antrean tanpa memakan banyak RAM tambahan. |
| **Intensitas Beban** | `range(2, 15000)` | `app/app.py` (baris 18) | `15000` | Mengatur batas pencarian bilangan prima untuk memperberat atau memperingan beban CPU per *request*. |
| **Resolusi Metrik** | `scrape_interval` | `monitoring/prometheus.yml` (baris 2) | `5s` | Mengatur frekuensi Prometheus menarik metrik dari cAdvisor. |
| | `time.sleep(0.5)` | `benchmark/load_test.py` (baris 78) | `0.5s` | Mengatur interval pengambilan sampel RAM dan CPU langsung dari Docker socket selama pengujian. |

> **Catatan:** Setelah mengubah parameter di atas, cukup jalankan ulang `bash run_test.sh` (atau `sudo bash run_test.sh` di Ubuntu). Skrip akan otomatis menerapkan perubahan konfigurasi dan membangun ulang *image* jika terdapat perubahan pada folder `app/`.

## Hasil Eksperimen (Baseline vs. Optimized)

Pengujian dilakukan menggunakan beban `100 requests` (`10 concurrent`) pada endpoint komputasi `/work`:

| Metrik Evaluasi | Baseline (`python:3.11`, 4 workers, tanpa limit) | Optimized (`python:3.11-alpine`, 2 workers/2 threads, limit 0.5 CPU / 128MB) | Perubahan / Efisiensi | 
| ----- | ----- | ----- | ----- | 
| **Ukuran Docker Image** | `1.62 GB` | `109 MB` | **Hemat 93.27%** | 
| **RAM Idle** | `75.12 MB` | `44.41 MB` | **Hemat 40.88%** | 
| **RAM Peak (Saat Beban)** | `78.56 MB` | `46.89 MB` | **Hemat 40.31%** | 
| **CPU Usage Rate** | `2.4755 cores` | `0.4972 cores` | **Hemat 79.92%** | 
| **Average Latency** | `0.2468 detik` | `1.3625 detik` | **Naik 452.07%** *(Trade-off)* | 
| **Tingkat Keberhasilan** | `100 / 100` (100%) | `100 / 100` (100%) | **100% Stabil** | 

## Analisis Efisiensi & Trade-Off

* **Efisiensi Sumber Daya (*Green Impact*):** Penggunaan *base image* `Alpine` memangkas kapasitas *storage* dan kebutuhan *bandwidth* distribusi *image* hingga **93.27%**. Penyetelan ulang *worker/thread* Gunicorn menurunkan konsumsi RAM hingga **~40.3%**, sementara pembatasan `cpus: "0.50"` menekan konsumsi daya puncak CPU hingga **79.92%** dan mencegah efek *noisy neighbor* pada server.

* **Trade-Off Performa:** Pembatasan kapasitas CPU menjadi `0.50 core` menyebabkan antrean pemrosesan saat terjadi lonjakan trafik paralel, sehingga *average latency* meningkat dari `0.2468s` menjadi `1.3625s`. Meskipun demikian, sistem tetap mampu melayani **100% permintaan tanpa kegagalan** (*zero error / no OOMKilled*).