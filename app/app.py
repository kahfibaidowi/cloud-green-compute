import os
import time
from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({
        "status": "ok",
        "mode": os.getenv("APP_MODE", "baseline")
    })

@app.route("/work")
def work():
    start = time.time()
    primes = []
    for num in range(2, 15000):
        if all(num % i != 0 for i in range(2, int(num ** 0.5) + 1)):
            primes.append(num)
    duration = round(time.time() - start, 4)
    return jsonify({
        "primes_found": len(primes),
        "duration_sec": duration,
        "mode": os.getenv("APP_MODE", "baseline")
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)