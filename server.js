// ========================================
// STOCK API - YAHOO FINANCE ONLY (RELIABLE)
// ========================================
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Cache
let stockCache = {
  data: [],
  lastUpdate: null
};

// ========================================
// ALL STOCKS FROM YAHOO FINANCE (RELIABLE)
// ========================================

class StockFetcher {
  constructor() {
    // Yahoo Finance symbols for ALL markets
    this.symbols = {
      // AFRICAN STOCKS (Yahoo Finance format)
      nigeria: [
        'DANGOTE.NG', 'MTNN.NG', 'ZENITHBANK.NG', 'GUARANTY.NG',
        'ACCESS.NG', 'FBNH.NG', 'UBA.NG', 'BUACEMENT.NG',
        'SEPLAT.NG', 'TOTAL.NG', 'NESTLE.NG', 'OKOMUOIL.NG',
        'NASCON.NG', 'WAPCO.NG', 'ETERNA.NG'
      ],
      kenya: [
        'EQTY.NBO', 'KCB.NBO', 'SCOM.NBO', 'SCBK.NBO',
        'BAMB.NBO', 'EABL.NBO', 'COOP.NBO', 'CFC.NBO',
        'JUB.NBO', 'NMG.NBO', 'UMME.NBO', 'DTK.NBO',
        'BBK.NBO', 'KNCH.NBO', 'ABSAB.NBO'
      ],
      // GLOBAL STOCKS
      usa: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'JNJ'],
      uk: ['BP.L', 'HSBA.L', 'BARC.L', 'VOD.L', 'LLOY.L'],
      canada: ['SHOP.TO', 'RY.TO', 'TD.TO', 'ENB.TO', 'CNR.TO']
    };
  }

  async fetchAllStocks() {
    console.log('📈 Fetching ALL stocks from Yahoo Finance...');
    
    const allStocks = [];
    const allPromises = [];
    
    // Create promises for ALL symbols
    Object.entries(this.symbols).forEach(([market, symbols]) => {
      symbols.forEach(symbol => {
        allPromises.push(this.fetchStock(symbol, market));
      });
    });
    
    // Execute all promises
    const results = await Promise.allSettled(allPromises);
    
    // Collect successful results
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        allStocks.push(result.value);
      }
    });
    
    console.log(`✅ Total: ${allStocks.length} REAL stocks`);
    
    // Group by market
    const marketCounts = {};
    allStocks.forEach(stock => {
      marketCounts[stock.market] = (marketCounts[stock.market] || 0) + 1;
    });
    
    Object.entries(marketCounts).forEach(([market, count]) => {
      console.log(`   ${market}: ${count} stocks`);
    });
    
    return allStocks;
  }

  async fetchStock(symbol, market) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 seconds max
      });
      
      const data = response.data;
      
      if (data.chart?.result?.[0]?.meta) {
        const meta = data.chart.result[0].meta;
        const price = meta.regularMarketPrice;
        
        if (price && price > 0) {
          const previousClose = meta.chartPreviousClose || price;
          const change = price - previousClose;
          const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
          
          // Clean symbol for display
          const displaySymbol = symbol
            .replace('.NG', '')
            .replace('.NBO', '')
            .replace('.L', '')
            .replace('.TO', '');
          
          return {
            symbol: displaySymbol,
            name: meta.shortName || displaySymbol,
            price: price.toFixed(2),
            change: change.toFixed(2),
            changePercent: changePercent.toFixed(2),
            volume: meta.regularMarketVolume?.toLocaleString() || '0',
            market: market,
            currency: this.getCurrency(market),
            type: market === 'usa' || market === 'uk' || market === 'canada' ? 'global' : 'african',
            timestamp: new Date().toISOString()
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.log(`⚠️  Skipped ${symbol}:`, error.message);
      return null;
    }
  }

  getCurrency(market) {
    const currencies = {
      nigeria: 'NGN',
      kenya: 'KES',
      usa: 'USD',
      uk: 'GBP',
      canada: 'CAD'
    };
    return currencies[market] || 'USD';
  }
}

// ========================================
// STOCK SERVICE
// ========================================

class StockService {
  constructor() {
    this.fetcher = new StockFetcher();
  }
  
  async refreshStocks() {
    console.log('\n🔄 Refreshing ALL stocks from Yahoo Finance...');
    const startTime = Date.now();
    
    try {
      const allStocks = await this.fetcher.fetchAllStocks();
      
      // Update cache
      stockCache = {
        data: allStocks,
        lastUpdate: new Date()
      };
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`🎉 Refresh completed in ${elapsed}s`);
      
      return {
        success: true,
        stats: {
          total: allStocks.length,
          african: allStocks.filter(s => s.type === 'african').length,
          global: allStocks.filter(s => s.type === 'global').length,
          markets: [...new Set(allStocks.map(s => s.market))]
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      return {
        success: false,
        error: error.message,
        stats: { total: 0, african: 0, global: 0 },
        timestamp: new Date().toISOString()
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
    service: 'Stock API - Yahoo Finance Data',
    version: '6.0.0',
    note: 'All data from Yahoo Finance API - Real stock prices',
    endpoints: {
      allStocks: '/api/stocks',
      refresh: '/api/refresh',
      health: '/api/health'
    },
    cache: {
      totalStocks: stockCache.data.length,
      lastUpdate: stockCache.lastUpdate
    }
  });
});

app.get('/api/stocks', (req, res) => {
  try {
    res.json({
      success: true,
      note: 'Real data from Yahoo Finance API',
      data: stockCache.data,
      stats: {
        total: stockCache.data.length,
        african: stockCache.data.filter(s => s.type === 'african').length,
        global: stockCache.data.filter(s => s.type === 'global').length,
        markets: [...new Set(stockCache.data.map(s => s.market))]
      },
      cache: {
        lastUpdate: stockCache.lastUpdate,
        isCached: true
      },
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
    console.log('🔄 Manual refresh triggered');
    const result = await stockService.refreshStocks();
    
    res.json({
      success: result.success,
      message: result.success ? 'Stocks refreshed successfully' : 'Refresh failed',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: {
      totalStocks: stockCache.data.length,
      lastUpdate: stockCache.lastUpdate
    }
  });
});

// ========================================
// SCHEDULED TASKS
// ========================================

// Refresh every hour
cron.schedule('0 * * * *', async () => {
  console.log('\n⏰ Scheduled refresh...');
  await stockService.refreshStocks();
});

// ========================================
// SERVER STARTUP
// ========================================

app.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 STOCK API - YAHOO FINANCE DATA');
  console.log('='.repeat(60));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\n📡 API Endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/stocks`);
  console.log(`   POST http://localhost:${PORT}/api/refresh`);
  console.log('='.repeat(60) + '\n');
  
  // Initial data load
  console.log('📥 Loading initial stock data...');
  try {
    await stockService.refreshStocks();
    console.log('✅ Initial data loaded!\n');
  } catch (error) {
    console.error('❌ Initial load failed\n');
  }
});

module.exports = app;
