
const express = require('express');
const app = express();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require("axios");
app.use(express.json());
require('dotenv').config();


const PORT = 3000;

puppeteer.use(StealthPlugin());

let scrapedData = {};

const scrapeData = async (companySymbol) => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36");

    await page.goto(`https://www.screener.in/company/${companySymbol}/consolidated/`, {
        waitUntil: 'networkidle2'
    });

    await page.waitForSelector("#quarters table.data-table");


    const extractTableForYrs = async (selector) => {
        return await page.evaluate((selector) => {
            const table = document.querySelector(selector);
            if (!table) return {};  
    
            let formattedData = {};
            const rows = table.querySelectorAll("tr");
    
            if (rows.length === 0) return {};  
    
            const headers = Array.from(rows[0].querySelectorAll("th"))
                .slice(1)  
                .map(th => th.innerText.trim());
    
            rows.forEach((row, index) => {
                if (index === 0) return;  
    
                const cells = row.querySelectorAll("td, th");
                if (cells.length === 0) return;
    
                const metricName = cells[0]?.innerText.trim(); 
                if (!metricName) return;
    
                cells.forEach((cell, i) => {
                    if (i === 0) return;  
                    const year = headers[i - 1];  
                    if (!year) return;
    
                    if (!formattedData[year]) formattedData[year] = {};
                    formattedData[year][metricName] = cell.innerText.trim();  
                });
            });
    
            return formattedData;
        }, selector);
    };
    
    const extractTable = async (selector) => {
        return await page.evaluate((selector) => {
            const rows = document.querySelectorAll(selector);
            if (rows.length === 0) return {};
    
            const headers = Array.from(rows[0].querySelectorAll("th")).slice(1).map(th => th.innerText.trim()); // Extract quarter names
            let formattedData = {};
    
            rows.forEach((row, index) => {
                if (index === 0) return; 
    
                const cells = Array.from(row.querySelectorAll("td"));
                const metric = cells[0]?.innerText.trim(); 
    
                if (metric) {
                    cells.slice(1).forEach((cell, i) => {
                        const quarter = headers[i]; 
                        if (!formattedData[quarter]) formattedData[quarter] = {};
                        formattedData[quarter][metric] = cell.innerText.trim();
                    });
                }
            });
    
            return formattedData;
        }, selector);
    };
    const extractList = async (selector) => {
        return await page.evaluate((selector) => {
            const items = document.querySelectorAll(selector + " li");
            return Array.from(items).map(item => item.innerText.trim());
        }, selector);
    };

    const extractKeyValuePairs = async () => {
        return await page.evaluate(() => {
            let data = {};
            const elements = document.querySelectorAll(".company-ratios li");
    
            elements.forEach(element => {
                try {
                    const key = element.querySelector("span.name")?.innerText.trim() || "Unknown"; 
    
                    const valueElements = element.querySelectorAll("span.nowrap.value span.number");
                    let value = Array.from(valueElements).map(el => el.innerText.trim()).join(" / ");
    
                    const extraText = element.querySelector("span.nowrap.value")?.innerText.replace(/[\d,\/]/g, "").trim();
                    
                    if (extraText) {
                        if (extraText.includes("₹")) {
                            value = `₹ ${value} ${extraText.replace("₹", "").trim()}`; 
                        } else {
                            value = `${value} ${extraText}`;
                        }
                    }
    
                    if (key && value) {
                        data[key] = value.trim();
                    }
                } catch (error) {
                    console.error("Error extracting data:", error);
                }
            });
    
            return data;
        });
    };
    

    const extractText = async (selector) => {
        return await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            return element ? element.innerText.trim() : "";
        }, selector);
    };

    const extractDividendHistory = async (selector) => {
        return await page.evaluate((selector) => {
            const items = document.querySelectorAll(selector + " li, " + selector + " div, " + selector + " span"); 
            return Array.from(items).map(item => item.innerText.trim()).filter(text => text.length > 0);
        }, selector);
    };
    

    const extractHistoricalStockPrices = async () => {
        return await page.evaluate(() => {
            let stockData = [];
            const chart = document.querySelector('.chart-container svg');
    
            if (chart) {
                const points = chart.querySelectorAll('circle'); 
    
                points.forEach((point, index) => {
                    const tooltip = point.getAttribute('data-original-title') || 
                                    point.getAttribute('aria-label') || 
                                    point.getAttribute('title'); 
    
                    if (tooltip) {
                        stockData.push({ index, value: tooltip.trim() });
                    }
                });
            }
            return stockData;
        });
    };
    

    const extractCompetitors = async () => {
        return await page.evaluate(() => {
            const competitors = [];
            const rows = document.querySelectorAll("#peers-table-placeholder tbody tr");
    
            rows.forEach(row => {
                const columns = row.querySelectorAll("td");
                if (columns.length > 4) {
                    competitors.push({
                        name: columns[1]?.querySelector("a")?.innerText.trim(),  // Company Name
                        price: columns[2]?.innerText.trim(),  // Stock Price
                        peRatio: columns[3]?.innerText.trim(),  // PE Ratio
                        marketCap: columns[4]?.innerText.trim()  // Market Cap
                    });
                }
            });
            return competitors;
        });
    };
    

    const extractShareholdingBreakdown = async () => {
        return await page.evaluate(() => {
            let data = {};
            const table = document.querySelector("#shareholding table");
            if (!table) return {};
    
            const headers = Array.from(table.querySelectorAll("thead tr th"))
                .map(th => th.innerText.trim())
                .slice(1); 
    
            const rows = table.querySelectorAll("tbody tr");
    
            headers.forEach((quarter) => {
                data[quarter] = {}; 
            });
    
            rows.forEach(row => {
                const category = row.querySelector("td:first-child")?.innerText.trim();
                if (!category) return;
    
                const values = Array.from(row.querySelectorAll("td:not(:first-child)"))
                    .map(td => td.innerText.trim());
    
                headers.forEach((quarter, index) => {
                    data[quarter][category] = values[index] || "N/A";
                });
            });
    
            return data;
        });
    };
    

    // Extracted Data
    scrapedData = {
        companyOverview: await extractKeyValuePairs(".company-ratios span"),
        quarterlyResults: await extractTable("#quarters table.data-table tr"),
        profitAndLoss: await extractTableForYrs("#profit-loss table"),
        balanceSheet: await extractTableForYrs("#balance-sheet table"),
        cashFlow: await extractTableForYrs("#cash-flow table"),
        shareholding: await extractTableForYrs("#shareholding table"),
        shareholdingBreakdown: await extractShareholdingBreakdown(),
        keyMetrics: await extractTable(".company-ratios table "),
        pros: await extractList(".pros ul"),
        cons: await extractList(".cons ul"),
        stockPrice: await extractText(".sub.text"),
        marketCap: await extractText(".company-profile strong"),
        description: await extractText(".company-profile div p"),
        historicalStockPrices: await extractHistoricalStockPrices(),
        competitors: await extractCompetitors(),
        dividendHistory: await extractDividendHistory(".dividends ul"),
        debtAndCreditRatings: await extractKeyValuePairs(".credit-rating span"),
        earningsCalls: await extractText(".earnings-summary"),
    };

    console.log(JSON.stringify(scrapedData, null, 2));
    await browser.close();
    return scrapedData;
}
    async function getSymbolFromStockName(stockName) {
        try {
            const response = await axios.get(`https://query2.finance.yahoo.com/v1/finance/search`, {
                params: { q: stockName, lang: "en-US", region: "US" }
            });
    
            if (!response.data.quotes || response.data.quotes.length === 0) {
                throw new Error(`No results found for ${stockName}`);
            }
    
            return response.data.quotes[0].symbol;
                
    
        } catch (error) {
            console.error(`Error fetching stock symbol for ${stockName}:`, error.message);
            return null;
        }
    }
  
  
  app.post("/get-symbol", async (req, res) => {
    const stockName = req.body.stockName;
  
    try {
        console.log("Received request body:", req.body);
      const ticker = await getSymbolFromStockName(stockName);
      res.json({ stockName, ticker });
    } catch (error) {
      console.error("Error fetching stock data:", error);
      res.json( { stockName, ticker: null, error: "Failed to fetch data." });
    }
  });

  
  
app.post("/scraped-data", async (req, res) => { // /:companySymbol
    
    try {
        const { companySymbol } = req.body;
        if (!companySymbol) {
            return res.status(400).json({ error: "Company symbol is required" });
        }

        console.log(`Scraping data for: ${companySymbol}`);
        const data = await scrapeData(companySymbol);
        res.json(data);
    } catch (error) {
        console.error("Error during scraping:", error);
        res.status(500).json({ error: "Failed to scrape data" });
    }
});

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
