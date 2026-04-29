const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cheerio = require("cheerio"); 

const app = express();
app.use(cors());

const PORT = 5000;

// You can change symbols here
const symbols = ["FFC", "HBL", "PSO"];

app.get("/api/stocks", async (req, res) => {
  try {
    let result = [];

    for (let sym of symbols) {
      const url = `https://dps.psx.com.pk/timeseries/int/${sym}`;

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      const trades = response.data.data;

      if (trades && trades.length > 0) {
        const latest = trades[0];

        result.push({
          symbol: sym,
          price: latest[1],
          volume: latest[2],
          time: new Date(latest[0] * 1000),
        });
      } else {
        result.push({
          symbol: sym,
          price: "N/A",
          volume: "N/A",
          time: "N/A",
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.log("ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});


app.get("/stock", async (req, res) => {
  try {
    // HARD CODED SYMBOLS (you asked for this)
    const symbols = ["FFC", "HBL", "PSO"];

    let allData = [];

    for (let symbol of symbols) {
      const url = `https://dps.psx.com.pk/company/${symbol}`;

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // ===== PRICE =====
      const price = $(".quote__close").first().text().trim();
      const change = $(".change__value").first().text().trim();
      const changePercent = $(".change__percent").first().text().trim();

      // ===== REG STATS =====
      const statsData = {};
      $(".tabs__panel[data-name='REG'] .stats_item").each((i, el) => {
        const label = $(el).find(".stats_label").text().trim();
        let value = $(el).find(".stats_value").text().trim();

        if (label && value) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          statsData[key] = value.replace(/,/g, "");
        }
      });

      // ===== EQUITY =====
      const equity = {};
      $("#equity .stats_item").each((i, el) => {
        let label = $(el).find(".stats_label").text().trim();
        let value = $(el).find(".stats_value").text().trim();

        if (label && value) {
          let key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");

          if (equity[key]) key = key + "_percent";

          equity[key] = value.replace(/,/g, "");
        }
      });

      // ===== RATIOS =====
      const ratios = {};
      $(".company__ratios tbody tr").each((i, row) => {
        const cols = $(row).find("td");

        const label = $(cols[0]).text().trim();
        const values = [];

        for (let i = 1; i < cols.length; i++) {
          values.push($(cols[i]).text().trim());
        }

        if (label) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          ratios[key] = values;
        }
      });

      // ===== PAYOUTS =====
      const payouts = [];
      $("#payouts tbody tr").each((i, row) => {
        const cols = $(row).find("td");

        payouts.push({
          date: $(cols[0]).text().trim(),
          result: $(cols[1]).text().trim(),
          details: $(cols[2]).text().trim(),
          book_closure: $(cols[3]).text().trim(),
        });
      });

      // ===== FINANCIALS =====
      const financials = {
        annual: {},
        quarterly: {},
      };

      // Annual
      $("#financialTab .tabs__panel[data-name='Annual'] tbody tr").each((i, row) => {
        const cols = $(row).find("td");

        const label = $(cols[0]).text().trim();
        const values = [];

        for (let i = 1; i < cols.length; i++) {
          values.push($(cols[i]).text().trim().replace(/,/g, ""));
        }

        if (label) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          financials.annual[key] = values;
        }
      });

      // Quarterly
      $("#financialTab .tabs__panel[data-name='Quarterly'] tbody tr").each((i, row) => {
        const cols = $(row).find("td");

        const label = $(cols[0]).text().trim();
        const values = [];

        for (let i = 1; i < cols.length; i++) {
          values.push($(cols[i]).text().trim().replace(/,/g, ""));
        }

        if (label) {
          const key = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          financials.quarterly[key] = values;
        }
      });

      // PUSH EACH STOCK DATA
      allData.push({
        symbol,
        price,
        change,
        changePercent,
        stats: statsData,
        equity,
        ratios,
        payouts,
        financials,
      });
    }

    // FINAL RESPONSE (ALL STOCKS)
    res.json(allData);

  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});