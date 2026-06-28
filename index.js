import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.json());

const PROXIES = (process.env.WEBSHARE_PROXIES || "").split(",").filter(p => p);

async function getDriver() {
  const proxy = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  const [ip, port, user, pwd] = proxy.split(":");
  const proxyUrl = `http://${user}:${pwd}@${ip}:${port}`;
  
  return await puppeteer.launch({
    args: [
      `--proxy-server=${proxyUrl}`,
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ],
    headless: true
  });
}

app.post('/scrape', async (req, res) => {
  const { website } = req.body;
  if (!website) return res.status(400).json({ error: 'website required' });
  
  let browser;
  try {
    browser = await getDriver();
    const page = await browser.newPage();
    await page.goto(website, { waitUntil: 'networkidle2', timeout: 15000 });
    
    const title = await page.title();
    const content = await page.content();
    
    res.json({ title, contentLength: content.length, url: website });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', proxies: PROXIES.length });
});

const PORT = process.env.PORT || 3080;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
