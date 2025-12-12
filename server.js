// ========================================
// STOCK API - REAL DATA ONLY VERSION
// ========================================
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Cache
let stockCache = {
  african: { data: [], lastUpdate: null },
  global: { data: [], lastUpdate: null },
  combined: { data: [], lastUpdate: null }
};

// ========================================
// AFRICAN STOCK SCRAPERS (REAL DATA - KEEP THESE)
// ========================================

class NigeriaScraper {
  async scrapeStocks() {
    try {
      console.log('📊 Scraping Nigerian stocks...');
      const response = await axios.get('https://afx.kwayisi.org/ngx/', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
      });
      
      const $ = cheerio.load(response.data);
      const stocks = [];
      
      $('table tbody tr').each((index, element) => {
        if (stocks.length >= 15) return false;
        
        const cells = $(element).find('td');
        if (cells.length >= 5) {
          const symbol = $(cells[0]).text().trim();
          const priceText = $(cells[1]).text().trim();
          const changeText = $(cells[2]).text().trim();
          const changePercentText = $(cells[3]).text().trim();
          const volumeText = $(cells[4]).text().trim();
          
          if (symbol && symbol.length > 0) {
            const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
            const change = parseFloat(changeText.replace(/[^\d.-]/g, '')) || 0;
            const changePercent = parseFloat(changePercentText.replace(/[^\d.-]/g, '')) || 0;
            
            if (price > 0) { // Only include if we got real price
              stocks.push({
                symbol,
                name: symbol,
                price: price.toFixed(2),
                change: change.toFixed(2),
                changePercent: changePercent.toFixed(2),
                volume: volumeText.replace(/,/g, ''),
                market: 'nigeria',
                currency: 'NGN',
                type: 'african',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      });
      
      console.log(`✅ Nigeria: ${stocks.length} REAL stocks`);
      return stocks;
      
    } catch (error) {
      console.error('❌ Nigeria error:', error.message);
      return []; // Return EMPTY array, not fake data
    }
  }
}

class KenyaScraper {
  async scrapeStocks() {
    try {
      console.log('📊 Scraping Kenyan stocks...');
      const response = await axios.get('https://afx.kwayisi.org/nse/', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
      });
      
      const $ = cheerio.load(response.data);
      const stocks = [];
      
      $('table tbody tr').each((index, element) => {
        if (stocks.length >= 15) return false;
        
        const cells = $(element).find('td');
        if (cells.length >= 5) {
          const symbol = $(cells[0]).text().trim();
          const priceText = $(cells[1]).text().trim();
          const changeText = $(cells[2]).text().trim();
          const changePercentText = $(cells[3]).text().trim();
          const volumeText = $(cells[4]).text().trim();
          
          if (symbol && symbol.length > 0) {
            const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
            const change = parseFloat(changeText.replace(/[^\d.-]/g, '')) || 0;
            const changePercent = parseFloat(changePercentText.replace(/[^\d.-]/g, '')) || 0;
            
            if (price > 0) {
              stocks.push({
                symbol,
                name: symbol,
                price: price.toFixed(2),
                change: change.toFixed(2),
                changePercent: changePercent.toFixed(2),
                volume: volumeText.replace(/,/g, ''),
                market: 'kenya',
                currency: 'KES',
                type: 'african',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      });
      
      console.log(`✅ Kenya: ${stocks.length} REAL stocks`);
      return stocks;
      
    } catch (error) {
      console.error('❌ Kenya error:', error.message);
      return []; // Return EMPTY array, not fake data
    }
  }
}

class RwandaScraper {
  async scrapeStocks() {
    // Rwanda has no reliable public API - return empty
    console.log('⚠️ Rwanda: No reliable public API available');
    return [];
  }
}

// ========================================
// GLOBAL STOCKS USING YAHOO FINANCE (REAL DATA)
// ========================================

class GlobalStockFetcher {
  constructor() {
    // Reduced list to ensure we get real data
    this.symbols = {
      usa: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
      uk: ['BP.L', 'HSBA.L', 'BARC.L', 'VOD.L'],
      canada: ['SHOP.TO', 'RY.TO', 'TD.TO', 'ENB.TO']
    };
  }

  async fetchGlobalStocks() {
    console.log('🌍 Fetching global stocks from Yahoo Finance...');
    
    const allStocks = [];
    
    try {
      // Try Yahoo Finance v8 API
      const yahooPromises = [];
      
      // Create promises for all symbols
      Object.entries(this.symbols).forEach(([market, symbols]) => {
        symbols.forEach(symbol => {
          yahooPromises.push(this.fetchYahooStock(symbol, market));
        });
      });
      
      // Execute all promises
      const results = await Promise.allSettled(yahooPromises);
      
      // Filter successful results
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allStocks.push(result.value);
        }
      });
      
    } catch (error) {
      console.error('❌ Yahoo Finance error:', error.message);
    }
    
    console.log(`✅ Global: ${allStocks.length} REAL stocks`);
    return allStocks;
  }

  async fetchYahooStock(symbol, market) {
    try {
      // Yahoo Finance v8 API endpoint
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      const data = response.data;
      
      if (data.chart?.result?.[0]?.meta) {
        const meta = data.chart.result[0].meta;
        const price = meta.regularMarketPrice;
        
        if (price && price > 0) {
          const previousClose = meta.chartPreviousClose || price;
          const change = price - previousClose;
          const changePercent = (change / previousClose) * 100;
          
          return {
            symbol: symbol.replace('.L', '').replace('.TO', ''),
            name: meta.shortName || symbol,
            price: price.toFixed(2),
            change: change.toFixed(2),
            changePercent: changePercent.toFixed(2),
            volume: meta.regularMarketVolume?.toLocaleString() || '0',
            market: market,
            currency: this.getCurrency(market),
            type: 'global',
            timestamp: new Date().toISOString()
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.log(`⚠️  Failed ${symbol}:`, error.message);
      return null;
    }
  }

  getCurrency(market) {
    return {
      usa: 'USD',
      uk: 'GBP',
      canada: 'CAD'
    }[market] || 'USD';
  }
}

// ========================================
// STOCK SERVICE
// ========================================

class StockService {
  constructor() {
    this.nigeria = new NigeriaScraper();
    this.kenya = new KenyaScraper();
    this.rwanda = new RwandaScraper();
    this.globalFetcher = new GlobalStockFetcher();
  }
  
  async scrapeAllStocks() {
    console.log('\n🔄 Starting REAL data refresh...');
    const startTime = Date.now();
    
    try {
      // Fetch ALL markets in parallel
      const [nigeriaStocks, kenyaStocks, rwandaStocks, globalStocks] = await Promise.all([
        this.nigeria.scrapeStocks(),
        this.kenya.scrapeStocks(),
        this.rwanda.scrapeStocks(),
        this.globalFetcher.fetchGlobalStocks()
      ]);
      
      // Update caches
      const africanStocks = [...nigeriaStocks, ...kenyaStocks, ...rwandaStocks];
      stockCache.african = { data: africanStocks, lastUpdate: new Date() };
      stockCache.global = { data: globalStocks, lastUpdate: new Date() };
      
      // Combine all stocks
      const combinedStocks = [...africanStocks, ...globalStocks];
      stockCache.combined = { data: combinedStocks, lastUpdate: new Date() };
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`🎉 Refresh completed in ${elapsed}s`);
      console.log(`📊 REAL DATA ONLY: ${combinedStocks.length} stocks`);
      console.log(`   African: ${africanStocks.length} (Nigeria: ${nigeriaStocks.length}, Kenya: ${kenyaStocks.length}, Rwanda: ${rwandaStocks.length})`);
      console.log(`   Global: ${globalStocks.length} stocks`);
      
      return {
        success: true,
        stats: {
          total: combinedStocks.length,
          african: africanStocks.length,
          global: globalStocks.length,
          nigeria: nigeriaStocks.length,
          kenya: kenyaStocks.length,
          rwanda: rwandaStocks.length
        },
        timestamp: new Date().toISOString(),
        note: 'REAL DATA ONLY - No fake data included'
      };
      
    } catch (error) {
      console.error('❌ Error refreshing stocks:', error.message);
      
      // Clear cache on error
      stockCache.combined = { data: [], lastUpdate: new Date() };
      
      return {
        success: false,
        error: error.message,
        stats: { total: 0, african: 0, global: 0 },
        timestamp: new Date().toISOString(),
        note: 'Failed to fetch real data'
      };
    }
  }
}

// Initialize service
const stockService = new StockService();

// ========================================
// API ROUTES
// ========================================

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'African & Global Stock API - REAL DATA ONLY',
    version: '5.0.0',
    note: 'This API returns ONLY real stock data. No fake/made-up data.',
    endpoints: {
      allStocks: '/api/stocks',
      africanStocks: '/api/stocks/african',
      globalStocks: '/api/stocks/global',
      refresh: '/api/refresh',
      health: '/api/health'
    },
    cacheStatus: {
      totalRealStocks: stockCache.combined.data.length,
      lastUpdate: stockCache.combined.lastUpdate
    }
  });
});

app.get('/api/stocks', (req, res) => {
  try {
    const allStocks = stockCache.combined.data;
    
    res.json({
      success: true,
      note: 'REAL DATA ONLY - No fake/made-up data included',
      data: allStocks,
      stats: {
        total: allStocks.length,
        african: allStocks.filter(s => s.type === 'african').length,
        global: allStocks.filter(s => s.type === 'global').length,
        markets: [...new Set(allStocks.map(s => s.market))]
      },
      cache: {
        lastUpdate: stockCache.combined.lastUpdate,
        isCached: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Error fetching real data'
    });
  }
});

app.get('/api/stocks/african', (req, res) => {
  try {
    const africanStocks = stockCache.african.data;
    
    res.json({
      success: true,
      note: 'African stocks - REAL DATA ONLY',
      data: africanStocks,
      total: africanStocks.length,
      markets: ['nigeria', 'kenya', 'rwanda'].filter(market => 
        africanStocks.some(stock => stock.market === market)
      ),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/stocks/global', (req, res) => {
  try {
    const globalStocks = stockCache.global.data;
    
    res.json({
      success: true,
      note: 'Global stocks - REAL DATA ONLY',
      data: globalStocks,
      total: globalStocks.length,
      markets: ['usa', 'uk', 'canada'].filter(market => 
        globalStocks.some(stock => stock.market === market)
      ),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual refresh triggered - REAL DATA ONLY');
    const result = await stockService.scrapeAllStocks();
    
    res.json({
      success: result.success,
      message: result.success ? 'Real stock data refreshed successfully' : 'Failed to fetch real data',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      note: 'Failed to fetch real data'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: {
      totalRealStocks: stockCache.combined.data.length,
      lastUpdate: stockCache.combined.lastUpdate
    },
    note: 'API returns REAL DATA ONLY'
  });
});

// ========================================
// SCHEDULED TASKS
// ========================================

// Refresh every 2 hours
cron.schedule('0 */2 * * *', async () => {
  console.log('\n⏰ Scheduled refresh starting (REAL DATA ONLY)...');
  await stockService.scrapeAllStocks();
});

// ========================================
// SERVER STARTUP
// ========================================

app.listen(PORT, async () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 AFRICAN & GLOBAL STOCK API - REAL DATA ONLY');
  console.log('='.repeat(70));
  console.log('📌 IMPORTANT: This API returns ONLY real stock data.');
  console.log('📌 No fake, simulated, or made-up data will be included.');
  console.log('='.repeat(70));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\n📡 API Endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/stocks`);
  console.log(`   POST http://localhost:${PORT}/api/refresh`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log('='.repeat(70) + '\n');
  
  // Initial data load
  console.log('📥 Loading initial stock data (REAL DATA ONLY)...');
  try {
    await stockService.scrapeAllStocks();
    console.log('✅ Initial REAL data loaded!\n');
  } catch (error) {
    console.error('❌ Initial load failed - API will return empty until data is available\n');
  }
});

module.exports = app;
