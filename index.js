import os, random, re, time
from flask import Flask, request, jsonify
from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

app = Flask(__name__)

# Formato env var WEBSHARE_PROXIES: "ip:port:user:pass,ip:port:user:pass,..." (10 proxies)
PROXIES = [p for p in os.environ.get("WEBSHARE_PROXIES", "").split(",") if p]


def get_driver():
    ip, port, user, pwd = random.choice(PROXIES).split(":")
    proxy_url = f"http://{user}:{pwd}@{ip}:{port}"
    sw_options = {"proxy": {"http": proxy_url, "https": proxy_url}}
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
    return webdriver.Chrome(seleniumwire_options=sw_options, options=opts)


@app.route("/scrape", methods=["POST"])
def scrape():
    data = request.get_json(force=True)
    nombre = data.get("nombre", "")
    municipio = data.get("municipio", "")
    query = f"{nombre} {municipio} clinica dental".strip().replace(" ", "+")

    driver = get_driver()
    try:
        driver.get(f"https://www.google.com/maps/search/{query}")
        time.sleep(random.uniform(3, 6))  # delay humano, no quitar

        rating, reviews, website = None, None, None
        try:
            el = driver.find_element(By.CSS_SELECTOR, 'span[aria-label*="estrellas"]')
            rating = float(re.search(r"[\d.]+", el.get_attribute("aria-label")).group())
        except Exception:
            pass
        try:
            el = driver.find_element(By.CSS_SELECTOR, 'span[aria-label*="reseñas"]')
            reviews = int(re.sub(r"[^\d]", "", el.text))
        except Exception:
            pass
        try:
            el = driver.find_element(By.CSS_SELECTOR, 'a[data-item-id="authority"]')
            website = el.get_attribute("href")
        except Exception:
            pass

        return jsonify({
            "rating": rating,
            "userRatingCount": reviews,
            "websiteUri": website,
            "mapsUrl": driver.current_url,
            "businessStatus": "OPERATIONAL" if rating is not None else "UNKNOWN",
        })
    finally:
        driver.quit()


@app.route("/health")
def health():
    return jsonify({"status": "ok", "proxies_loaded": len(PROXIES)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
