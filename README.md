# Green Cloud Computing — Resource Optimization & Benchmark Studio

Proyek eksperimen **Topik 7 — Green Cloud Computing** untuk mengukur, mengoptimasi, dan menganalisis efisiensi penggunaan sumber daya komputasi (**CPU**, **RAM**, dan **Storage**) pada layanan berbasis container Docker, lengkap dengan antarmuka web interaktif (**React JS**) untuk pengujian *custom parameter* antara skenario **Unoptimized (Baseline)** dan **Optimized (Green Tuning)**.

## Arsitektur Sistem & Isolasi Container

Alur interaksi antar layanan dalam jaringan internal Docker (`cloud-green-computing_green-net`):

* **`green-frontend` (Port `3000`):** Antarmuka web berbasis React + Vite + Tailwind CSS untuk mengatur parameter pengujian secara kustom, memantau progres *real-time*, dan melihat tabel serta kartu perbandingan efisiensi.

* **`green-orchestrator` (Port `8000`):** Backend API Python Flask yang terhubung ke Docker Engine (`/var/run/docker.sock`) untuk membangun ulang container `green-app` secara dinamis (*Unoptimized* lalu *Optimized*), menembakkan *workload* paralel, dan merekam metrik konsumsi sumber daya.

* **`green-app` (Port `5000`):** Layanan target uji (Python Flask + Gunicorn) dengan *endpoint* komputasi bilangan prima (`/work?limit=...`) yang diisolasi sepenuhnya agar pengukuran CPU, RAM, dan ukuran *image* tidak tercampur dengan layanan monitoring maupun UI.

* **`green-cadvisor` (`:8080`) & `green-prometheus` (`:9090`):** Stack pemantauan metrik kontainer dan visualisasi grafik *time-series*.

## Struktur Proyek

* `app/app.py` — Aplikasi web uji (Flask) dengan parameter dinamis `?limit=`

* `app/requirements.txt` — Dependensi Python (Flask & Gunicorn)

* `app/Dockerfile.baseline` — Konfigurasi image Unoptimized (`python:3.11` Debian penuh)

* `app/Dockerfile.optimized` — Konfigurasi image Optimized (`python:3.11-alpine` ringan)

* `orchestrator/server.py` — Backend pengendali Docker & runner benchmark otomatis

* `orchestrator/requirements.txt` — Dependensi Orchestrator (Flask, Flask-CORS, Docker SDK)

* `orchestrator/Dockerfile` — Image Orchestrator

* `frontend/src/App.jsx` — Dashboard interaktif React JS

* `frontend/src/main.jsx` & `frontend/src/index.css` — Entry point dan styling Tailwind CSS

* `frontend/Dockerfile` — Image Frontend Node 20 Alpine

* `monitoring/prometheus.yml` — Konfigurasi scrape interval Prometheus (`5s`)

* `benchmark/load_test.py` — Skrip benchmark CLI standalone

* `docker-compose.yml` — Orkestrasi seluruh layanan (UI, Orchestrator, App, Monitoring)

* `docker-compose.optimized.yml` — Konfigurasi CLI mode Optimized

* `run_test.sh` — Skrip otomatisasi pengujian via terminal (CLI)

* `.gitignore` & `README.md` — Konfigurasi Git dan dokumentasi proyek

## Prasyarat

* **Docker** & **Docker Compose V2** (kompatibel di **Windows Docker Desktop + Git Bash** maupun **Linux Ubuntu 24.04 LTS**).

* **Git**.

## Cara Menjalankan Aplikasi

1. **Clone repositori dan masuk ke direktori proyek:**
   Jalankan perintah `git clone <URL_REPO_GITHUB_ANDA>` lalu masuk ke foldernya menggunakan `cd <NAMA_FOLDER_REPO>`.

2. **Nyalakan seluruh layanan dengan Docker Compose:**

   * **Di Windows (Git Bash):** jalankan `MSYS_NO_PATHCONV=1 docker compose up -d --build`

   * **Di Linux Ubuntu 24.04:** jalankan `sudo docker compose up -d --build`

3. **Akses Dashboard & Layanan:**

   * **Benchmark Studio UI (React):** `http://localhost:3000` (atau `http://<IP_VPS>:3000`)

   * **Orchestrator API:** `http://localhost:8000/api/status`

   * **Prometheus UI:** `http://localhost:9090`

   * **cAdvisor UI:** `http://localhost:8080`

> **Catatan VPS:** Jika dijalankan di VPS Linux Ubuntu 24.04, pastikan port `3000`, `8000`, `8080`, dan `9090` diizinkan pada firewall VPS (`ufw`).

## Parameter Pengujian yang Dapat Dikustomisasi (via React UI)

Setiap kali tombol **Jalankan Benchmark** ditekan di UI, sistem otomatis menjalankan pengujian **Unoptimized (Baseline)** terlebih dahulu lalu dilanjutkan dengan **Optimized (Green Tuning)** menggunakan parameter berikut:

| Kategori | Parameter | Rentang / Default | Fungsi & Dampak Pengujian | 
| ----- | ----- | ----- | ----- | 
| **Workload** | `Total Requests` | `20 – 1000` (Default: `100`) | Jumlah total permintaan HTTP yang ditembakkan ke `/work`. | 
| **Workload** | `Concurrency` | `1 – 50` (Default: `10`) | Jumlah pengguna simultan (*parallel threads*); makin tinggi, antrean CPU makin padat. | 
| **Workload** | `Prime Limit` | `5.000 – 40.000` (Default: `15.000`) | Batas atas pencarian bilangan prima per *request* untuk mengatur intensitas beban CPU. | 
| **Unoptimized** | `Gunicorn Workers (Baseline)` | `1 – 8` (Default: `4`) | Jumlah proses *worker* pada image Debian penuh tanpa pembatasan CPU & RAM. | 
| **Optimized** | `CPU Limit (Cores)` | `0.1 – 4.0` (Default: `0.5`) | Batas maksimal alokasi CPU core untuk container `green-app` mode *Optimized*. | 
| **Optimized** | `RAM Limit (MB)` | `64 – 2048` (Default: `128`) | Batas maksimal memori container sebelum terkena `OOMKilled`. | 
| **Optimized** | `Workers & Threads (Alpine)` | `2 workers / 2 threads` | Pengaturan proses dan utas paralel pada image `python:3.11-alpine`. | 

## Penjelasan Metrik Data Hasil Pengujian

Setiap pengujian menghasilkan beberapa metrik utama dari container `green-app` untuk mengevaluasi efisiensi sumber daya dan dampaknya terhadap performa aplikasi:

* **Docker Image Size (MB / GB):**
  Total ukuran ruang penyimpanan (*disk footprint*) yang dibutuhkan oleh *image* Docker setelah proses *build*. Metrik ini menunjukkan seberapa efisien pemilihan *base image* (misalnya membandingkan *image* Debian penuh dengan Alpine Linux) dalam menghemat kapasitas penyimpanan dan *bandwidth* jaringan saat proses distribusi container.

* **RAM Idle (MB):**
  Jumlah memori bersih (`memory_stats.usage - inactive_file`) yang dikonsumsi container `green-app` sesaat setelah dijalankan dan siap menerima trafik, sebelum ada permintaan masuk. Metrik ini mencerminkan beban memori dasar (*baseline footprint*) dari konfigurasi jumlah *worker* Gunicorn dan *runtime* sistem operasi di dalam container.

* **RAM Peak / RAM Usage (MB):**
  Konsumsi memori tertinggi yang tercatat selama simulasi beban kerja berlangsung (diukur melalui *sampling* berkala tiap `0,5 detik` via Docker Engine API). Metrik ini digunakan untuk memastikan alokasi memori aplikasi tetap aman di bawah batas `RAM Limit` tanpa memicu penghentian paksa oleh sistem (`OOMKilled`).

* **CPU Usage Rate / CPU Cores:**
  Rata-rata konsumsi kapasitas prosesor dalam satuan inti CPU (*cores*) selama proses eksekusi beban berlangsung, dihitung dari rasio selisih waktu CPU container terhadap waktu CPU sistem host (`(cpu_delta / system_delta) * online_cpus`). Metrik ini membuktikan efektivitas pembatasan `CPU Limit` dalam menekan konsumsi daya komputasi puncak serta mencegah satu container menguras sumber daya server (*noisy neighbor*).

* **Average Latency (detik):**
  Rata-rata waktu respons (*round-trip time*) yang dibutuhkan aplikasi untuk menyelesaikan satu permintaan dari awal dikirim hingga respons diterima kembali. Metrik ini berfungsi sebagai indikator *trade-off* performa—menunjukkan seberapa besar peningkatan waktu antrean ketika kapasitas CPU dan jumlah *worker* dibatasi demi penghematan energi.

* **Total Waktu Eksekusi (detik):**
  Total durasi keseluruhan yang diperlukan dari permintaan pertama dikirim hingga seluruh rangkaian *request* selesai diproses.

* **Tingkat Keberhasilan (*Success Rate*):**
  Perbandingan jumlah permintaan yang berhasil dijawab dengan status sukses (`HTTP 200 OK`) terhadap total permintaan yang dikirimkan. Metrik ini memvalidasi keandalan dan stabilitas sistem saat beroperasi dalam kondisi sumber daya yang terbatas.