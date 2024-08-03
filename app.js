const express = require("express");
const session = require("express-session");
const { Client } = require("pg");
const app = express();
const port = 3000;
const path = require('path');

// Create a new PostgreSQL client
const client = new Client({
  user: "postgres",
  host: "35.209.90.44",
  database: "mydb",
  password: "123",
  port: 5432,
});

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "your-secret-key", // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Connect to the database
client.connect((err) => {
  if (err) {
    console.error("Error connecting to the database", err);
    return;
  }
  console.log("Connected to the database successfully");

  // static files (HTML, CSS, JavaScript)
  app.use(express.static(__dirname));
  app.use(express.urlencoded({ extended: true }));

  // landing page
  app.get("/", (req, res) => {
    res.sendFile(__dirname + "/landing_page.html");
  });

  // signup page
  app.get("/signup", (req, res) => {
    res.sendFile(__dirname + "/signup.html");
  });

  // signup process
  app.post("/signup", (req, res) => {
    const { email, name, password } = req.body;
    const query =
      "INSERT INTO Users (email, name, password) VALUES ($1, $2, $3) RETURNING email";
    client.query(query, [email, name, password], (err, result) => {
      if (err) {
        console.error("Error executing query", err);
        res.status(500).send("Error signing up");
      } else {
        req.session.user = {
          email: result.rows[0].email,
        };
        res.redirect(`/dashboard`);
      }
    });
  });

  // login page
  app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/login.html");
  });

  // login process
  app.post("/login", (req, res) => {
    const { email, password } = req.body;
    const query = "SELECT * FROM Users WHERE email = $1 AND password = $2";
    client.query(query, [email, password], (err, result) => {
      if (err) {
        console.error("Error executing query", err);
        res.status(500).send("Error logging in");
      } else if (result.rows.length === 0) {
        res.status(401).send("Invalid email or password");
      } else {
        req.session.user = {
          email: result.rows[0].email,
        };
        res.redirect(`/dashboard`);
      }
    });
  });

  // dashboard page
  app.get("/dashboard/", (req, res) => {
    if (req.session.user) {
      res.sendFile(__dirname + "/dashboard.html");
    } else {
      res.redirect("/");
    }
  });

  app.get('/friends', (req, res) => {
    if (req.session.user) {
      const email = req.session.user;
      res.sendFile(__dirname + '/friends.html');
    } else {
      res.redirect('/');
    }
  });

  // portfolio page
  app.get("/portfolio-page", (req, res) => {
      res.sendFile(__dirname + '/portfolio-page.html');
  });

  // add portfolio page
  app.get("/add-portfolio-page", (req, res) => {
    res.sendFile(__dirname + '/add-portfolio-page.html');
  });

  // add portfolio process
app.post('/add-portfolio', (req, res) => {
  if (req.session.user) {
    const email = req.session.user.email;
    const portfolioName = req.body.portfolioName;
    const cashbalance = 0;
    const createStocklistQuery = 'INSERT INTO Stocklists (email, name, isPublic) VALUES ($1, $2, $3) RETURNING stocklistid';
    client.query(createStocklistQuery, [email, portfolioName, falfse], (err, result) => {
      if (err) {
        console.error('Error creating stocklist:', err);
        return res.status(500).send('Error creating stocklist');
      }

      const stocklistid = result.rows[0].stocklistid;
      const createPortfolioQuery = 'INSERT INTO Portfolios (email, stocklistid, name, cashbalance) VALUES ($1, $2, $3, $4) RETURNING portfolioid';
      client.query(createPortfolioQuery, [email, stocklistid, portfolioName, cashbalance], (err, result) => {
        if (err) {
          console.error('Error creating portfolio:', err);
          return res.status(500).send('Error creating portfolio');
        }

        const newPortfolio = result.rows[0];
        res.redirect(`/portfolio-page?id=${newPortfolio.portfolioid}`);
      });
    });
  } else {
    res.redirect('/');
  }
});

  // fetch portfolios for user
  app.get('/api/portfolios', (req, res) => {
    if (req.session.user) {
      const email = req.session.user.email;
      const query = 'SELECT * FROM Portfolios WHERE email = $1';
      client.query(query, [email], (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.status(500).send('Error fetching portfolios');
        } else {
          res.json(result.rows);
        }
      });
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  // fetch portfolio details by id
  app.get('/api/portfolio/:id', (req, res) => {
    const portfolioId = parseInt(req.params.id, 10);

    if (isNaN(portfolioId)) {
      return res.status(400).send('Invalid portfolio ID');
    }

    const query = 'SELECT * FROM Portfolios WHERE portfolioid = $1';
    client.query(query, [portfolioId], (err, result) => {
      if (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error fetching portfolio details');
      } else if (result.rows.length === 0) {
        res.status(404).send('Portfolio not found');
      } else {
        res.json(result.rows[0]);
      }
    });
  });

  // update cash balance
app.put('/api/portfolio/:id/add-cash', (req, res) => {
  const portfolioId = parseInt(req.params.id, 10);
  const { amount } = req.body;
  if (isNaN(portfolioId) || isNaN(amount) || amount <= 0) {
    return res.status(400).send('Invalid portfolio ID or amount');
  }
  const fetchQuery = 'SELECT cashbalance FROM Portfolios WHERE portfolioid = $1';
  client.query(fetchQuery, [portfolioId], (fetchErr, fetchResult) => {
    if (fetchErr) {
      console.error('Error fetching portfolio:', fetchErr);
      return res.status(500).send('Error fetching portfolio');
    }

    if (fetchResult.rows.length === 0) {
      return res.status(404).send('Portfolio not found');
    }
    const currentCashBalance = parseFloat(fetchResult.rows[0].cashbalance);
    const newCashBalance = currentCashBalance + parseFloat(amount);
    const updateQuery = 'UPDATE Portfolios SET cashbalance = $1 WHERE portfolioid = $2 RETURNING cashbalance';
    client.query(updateQuery, [newCashBalance, portfolioId], (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error updating cash balance:', updateErr);
        return res.status(500).send('Error updating cash balance');
      }
      res.json({ newCashBalance: updateResult.rows[0].cashbalance });
    });
  });
});

// withdraw cash
app.put('/api/portfolio/:id/withdraw-cash', (req, res) => {
  const portfolioId = parseInt(req.params.id, 10);
  const { amount } = req.body;
  if (isNaN(portfolioId) || isNaN(amount) || amount <= 0) {
    return res.status(400).send('Invalid portfolio ID or amount');
  }
  const fetchQuery = 'SELECT cashbalance FROM Portfolios WHERE portfolioid = $1';
  client.query(fetchQuery, [portfolioId], (fetchErr, fetchResult) => {
    if (fetchErr) {
      console.error('Error fetching portfolio:', fetchErr);
      return res.status(500).send('Error fetching portfolio');
    }

    if (fetchResult.rows.length === 0) {
      return res.status(404).send('Portfolio not found');
    }
    const currentCashBalance = parseFloat(fetchResult.rows[0].cashbalance);
    if (amount > currentCashBalance) {
      return res.status(400).send('Insufficient funds');
    }
    const newCashBalance = currentCashBalance - parseFloat(amount);
    const updateQuery = 'UPDATE Portfolios SET cashbalance = $1 WHERE portfolioid = $2 RETURNING cashbalance';
    client.query(updateQuery, [newCashBalance, portfolioId], (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error updating cash balance:', updateErr);
        return res.status(500).send('Error updating cash balance');
      }
      res.json({ newCashBalance: updateResult.rows[0].cashbalance });
    });
  });
});


// buy stock
app.post('/api/buy-stock', (req, res) => {
  const { stockSymbol, numShares, portfolioId } = req.body;

  if (isNaN(numShares) || numShares <= 0) {
    return res.status(400).send({ success: false, message: 'Invalid number of shares' });
  }

  const getStockPriceQuery = `
    SELECT close
    FROM stockdata
    WHERE code = $1
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  const getPortfolioQuery = 'SELECT * FROM Portfolios WHERE portfolioid = $1';
  const createStockholdingQuery = 'INSERT INTO Stockholdings (stocksymbol, numshares) VALUES ($1, $2) RETURNING stockholdingid';
  const addStocklistHoldingQuery = 'INSERT INTO Stocklistholdings (stocklistid, stockholdingid) VALUES ($1, $2)';
  const updatePortfolioQuery = 'UPDATE Portfolios SET cashbalance = $1 WHERE portfolioid = $2';

  client.query(getStockPriceQuery, [stockSymbol], (err, stockResult) => {
    if (err) {
      console.error('Error fetching stock price:', err);
      return res.status(500).send({ success: false, message: 'Error fetching stock price' });
    }
    if (stockResult.rows.length === 0) {
      return res.status(404).send({ success: false, message: 'Stock not found' });
    }
    const stockPrice = stockResult.rows[0].close;
    const totalCost = stockPrice * numShares;
    client.query(getPortfolioQuery, [portfolioId], (err, portfolioResult) => {
      if (err) {
        console.error('Error fetching portfolio:', err);
        return res.status(500).send({ success: false, message: 'Error fetching portfolio' });
      }

      if (portfolioResult.rows.length === 0) {
        return res.status(404).send({ success: false, message: 'Portfolio not found' });
      }

      const portfolio = portfolioResult.rows[0];
      const newCashBalance = portfolio.cashbalance - totalCost;

      if (newCashBalance < 0) {
        return res.status(400).send({ success: false, message: 'Insufficient funds in portfolio' });
      }
      client.query(createStockholdingQuery, [stockSymbol, numShares], (err, stockholdingResult) => {
        if (err) {
          console.error('Error creating stockholding:', err);
          return res.status(500).send({ success: false, message: 'Error creating stockholding' });
        }

        const stockholdingId = stockholdingResult.rows[0].stockholdingid;
        client.query(addStocklistHoldingQuery, [portfolio.stocklistid, stockholdingId], (err) => {
          if (err) {
            console.error('Error adding stockholding to stocklist:', err);
            return res.status(500).send({ success: false, message: 'Error adding stockholding to stocklist' });
          }
          client.query(updatePortfolioQuery, [newCashBalance, portfolioId], (err) => {
            if (err) {
              console.error('Error updating portfolio cash balance:', err);
              return res.status(500).send({ success: false, message: 'Error updating portfolio cash balance' });
            }

            cache.del(`portfolio-stats-${portfolioId}`);
            fetchPortfolioStats(portfolioId).then(stats => {
              res.send({ success: true, newCashBalance, stats });
            }).catch(fetchError => {
              console.error('Error fetching portfolio stats:', fetchError);
              res.send({ success: true, newCashBalance });
            });
          });
        });
      });
    });
  });
});


// sell stocks
app.post('/api/sell-stock', (req, res) => {
  const { stockSymbol, numShares, portfolioId } = req.body;

  if (isNaN(numShares) || numShares <= 0) {
    return res.status(400).send({ success: false, message: 'Invalid number of shares' });
  }

  const getStockPriceQuery = `
    SELECT close
    FROM stockdata
    WHERE code = $1
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  const getPortfolioQuery = 'SELECT * FROM Portfolios WHERE portfolioid = $1';
  const updateStockholdingQuery = 'UPDATE Stockholdings SET numshares = numshares - $1 WHERE stocksymbol = $2 AND numshares >= $1 RETURNING stockholdingid, numshares';
  const deleteStocklistHoldingQuery = 'DELETE FROM Stocklistholdings WHERE stockholdingid = $1';
  const deleteStockholdingQuery = 'DELETE FROM Stockholdings WHERE stockholdingid = $1';
  const updatePortfolioQuery = 'UPDATE Portfolios SET cashbalance = $1 WHERE portfolioid = $2';

  client.query(getStockPriceQuery, [stockSymbol], (err, stockResult) => {
    if (err) {
      console.error('Error fetching stock price:', err);
      return res.status(500).send({ success: false, message: 'Error fetching stock price' });
    }

    if (stockResult.rows.length === 0) {
      return res.status(404).send({ success: false, message: 'Stock not found' });
    }

    const stockPrice = parseFloat(stockResult.rows[0].close);
    const totalRevenue = stockPrice * numShares;

    client.query(getPortfolioQuery, [portfolioId], (err, portfolioResult) => {
      if (err) {
        console.error('Error fetching portfolio:', err);
        return res.status(500).send({ success: false, message: 'Error fetching portfolio' });
      }

      if (portfolioResult.rows.length === 0) {
        return res.status(404).send({ success: false, message: 'Portfolio not found' });
      }

      const portfolio = portfolioResult.rows[0];
      const newCashBalance = parseFloat(portfolio.cashbalance) + totalRevenue;

      client.query(updateStockholdingQuery, [numShares, stockSymbol], (err, stockholdingResult) => {
        if (err) {
          console.error('Error updating stockholding:', err);
          return res.status(500).send({ success: false, message: 'Error updating stockholding' });
        }

        if (stockholdingResult.rows.length === 0) {
          return res.status(400).send({ success: false, message: 'Not enough shares to sell' });
        }

        const updatedStockholding = stockholdingResult.rows[0];

        if (updatedStockholding.numshares === 0) {
          client.query(deleteStocklistHoldingQuery, [updatedStockholding.stockholdingid], (err) => {
            if (err) {
              console.error('Error deleting stocklist holding:', err);
              return res.status(500).send({ success: false, message: 'Error deleting stocklist holding' });
            }

            client.query(deleteStockholdingQuery, [updatedStockholding.stockholdingid], (err) => {
              if (err) {
                console.error('Error deleting stockholding:', err);
                return res.status(500).send({ success: false, message: 'Error deleting stockholding' });
              }

              client.query(updatePortfolioQuery, [newCashBalance, portfolioId], (err) => {
                if (err) {
                  console.error('Error updating portfolio cash balance:', err);
                  return res.status(500).send({ success: false, message: 'Error updating portfolio cash balance' });
                }

                cache.del(`portfolio-stats-${portfolioId}`);
                fetchPortfolioStats(portfolioId).then(stats => {
                  res.send({ success: true, newCashBalance, stats });
                }).catch(fetchError => {
                  console.error('Error fetching portfolio stats:', fetchError);
                  res.send({ success: true, newCashBalance });
                });
              });
            });
          });
        } else {
          client.query(updatePortfolioQuery, [newCashBalance, portfolioId], (err) => {
            if (err) {
              console.error('Error updating portfolio cash balance:', err);
              return res.status(500).send({ success: false, message: 'Error updating portfolio cash balance' });
            }

            cache.del(`portfolio-stats-${portfolioId}`);
            fetchPortfolioStats(portfolioId).then(stats => {
              res.send({ success: true, newCashBalance, stats });
            }).catch(fetchError => {
              console.error('Error fetching portfolio stats:', fetchError);
              res.send({ success: true, newCashBalance });
            });
          });
        }
      });
    });
  });
});





  // stocklist page
  app.get("/stocklist-page", (req, res) => {
    if (req.session.user) {
      res.sendFile(__dirname + '/stocklist-page.html');
    } else {
      res.redirect('/');
    }
  });

  // add stocklist page
  app.get("/add-stocklist-page", (req, res) => {
    res.sendFile(__dirname + '/add-stocklist-page.html');
  });

// Add stocklist process
app.post('/add-stocklist', (req, res) => {
  if (req.session.user) {
    const email = req.session.user.email;
    const name = req.body.stocklistName;
    const isPublic = req.body.stocklistVisibility === 'Public';
    const query = 'INSERT INTO Stocklists (email, name, isPublic) VALUES ($1, $2, $3) RETURNING stocklistid';
    client.query(query, [email, name, isPublic], (err, result) => {
      if (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error adding stocklist');
      } else {
        const newStocklist = result.rows[0];
        res.redirect(`/stocklist-page?id=${newStocklist.stocklistid}`);
      }
    });
  } else {
    res.redirect('/login');
  }
});

// update stocklist visibility
app.put('/api/stocklist/:id/visibility', (req, res) => {
  const stocklistid = parseInt(req.params.id, 10);
  const { isPublic } = req.body;
  if (isNaN(stocklistid)) {
    return res.status(400).send('Invalid stocklist ID');
  }
  const query = 'UPDATE Stocklists SET isPublic = $1 WHERE stocklistid = $2';
  client.query(query, [isPublic, stocklistid], (err, result) => {
    if (err) {
      console.error('Error executing query', err);
      res.status(500).send('Error updating stocklist visibility');
    } else if (result.rowCount === 0) {
      res.status(404).send('Stocklist not found');
    } else {
      res.json({ message: 'Stocklist visibility updated successfully' });
    }
  });
});

// fetch stocks in stocklist and most recent close price
app.get('/api/stocklist/:id/stocks', (req, res) => {
  const stocklistid = parseInt(req.params.id, 10);

  if (isNaN(stocklistid)) {
    return res.status(400).send('Invalid stocklist ID');
  }

  const query = `
    SELECT sh.stocksymbol, sh.numshares, sd.close
    FROM Stocklistholdings slh
    JOIN Stockholdings sh ON slh.stockholdingid = sh.stockholdingid
    LEFT JOIN LATERAL (
      SELECT close
      FROM stockdata sd
      WHERE sd.code = sh.stocksymbol
      ORDER BY sd.timestamp DESC
      LIMIT 1
    ) sd ON true
    WHERE slh.stocklistid = $1;
  `;

  client.query(query, [stocklistid], (err, result) => {
    if (err) {
      console.error('Error fetching stocklist stocks:', err);
      res.status(500).send('Error fetching stocklist stocks');
    } else {
      res.json(result.rows);
    }
  });
});


// add stocks to stocklist (create stockholding if not exists)
app.post('/api/add-to-stocklist', (req, res) => {
  const { stockSymbol, numShares, stocklistid } = req.body;

  const checkStockholdingQuery = 'SELECT stockholdingid FROM Stockholdings WHERE stocksymbol = $1 AND numshares = $2';
  client.query(checkStockholdingQuery, [stockSymbol, numShares], (err, result) => {
    if (err) {
      console.error('Error checking stockholding:', err);
      return res.status(500).send({ success: false, message: 'Error checking stockholding' });
    }

    if (result.rows.length > 0) {
      const stockholdingId = result.rows[0].stockholdingid;

      const checkStocklistHoldingQuery = 'SELECT * FROM Stocklistholdings WHERE stocklistid = $1 AND stockholdingid = $2';
      client.query(checkStocklistHoldingQuery, [stocklistid, stockholdingId], (err, result) => {
        if (err) {
          console.error('Error checking stocklistholding:', err);
          return res.status(500).send({ success: false, message: 'Error checking stocklistholding' });
        }

        if (result.rows.length > 0) {
          return res.status(400).send({ success: false, message: 'Stockholding already exists in the stocklist' });
        } else {
          
          const addStocklistHoldingQuery = 'INSERT INTO Stocklistholdings (stocklistid, stockholdingid) VALUES ($1, $2)';
          client.query(addStocklistHoldingQuery, [stocklistid, stockholdingId], (err, result) => {
            if (err) {
              console.error('Error adding stockholding to stocklist:', err);
              return res.status(500).send({ success: false, message: 'Error adding stockholding to stocklist' });
            }

            return res.send({ success: true });
          });
        }
      });
    } else {
      
      const createStockholdingQuery = 'INSERT INTO Stockholdings (stocksymbol, numshares) VALUES ($1, $2) RETURNING stockholdingid';
      client.query(createStockholdingQuery, [stockSymbol, numShares], (err, result) => {
        if (err) {
          console.error('Error creating stockholding:', err);
          return res.status(500).send({ success: false, message: 'Error creating stockholding' });
        }

        const stockholdingId = result.rows[0].stockholdingid;
        const addStocklistHoldingQuery = 'INSERT INTO Stocklistholdings (stocklistid, stockholdingid) VALUES ($1, $2)';
        client.query(addStocklistHoldingQuery, [stocklistid, stockholdingId], (err, result) => {
          if (err) {
            console.error('Error adding stockholding to stocklist:', err);
            return res.status(500).send({ success: false, message: 'Error adding stockholding to stocklist' });
          }

          return res.send({ success: true });
        });
      });
    }
  });
});


  // fetch user's stocklists
  app.get('/api/stocklists', (req, res) => {
    if (req.session.user) {
      const email = req.session.user.email;
      const query = 'SELECT * FROM Stocklists WHERE email = $1';
      client.query(query, [email], (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.status(500).send('Error fetching stocklists');
        } else {
          res.json(result.rows);
        }
      });
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  // fetch stocklist details by id
  app.get('/api/stocklist/:id', (req, res) => {
    const stocklistid = parseInt(req.params.id, 10);

    if (isNaN(stocklistid)) {
      return res.status(400).send('Invalid stocklist ID');
    }

  const query = 'SELECT stocklistid, name, email AS owner, isPublic FROM Stocklists WHERE stocklistid = $1';
  client.query(query, [stocklistid], (err, result) => {
    if (err) {
      console.error('Error executing query', err);
      res.status(500).send('Error fetching stocklist details');
    } else if (result.rows.length === 0) {
      res.status(404).send('Stocklist not found');
    } else {
      res.json(result.rows[0]);
    }
  });
});

  // stocklist explore page
  app.get("/stocklists-explore", (req, res) => {
    res.sendFile(__dirname + '/stocklists-explore.html');
  });

  // Fetch all public stocklists
app.get('/api/public-stocklists', (req, res) => {
  const query = 'SELECT stocklistid, name FROM Stocklists WHERE isPublic = true';
  
  client.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching public stocklists:', err);
      res.status(500).send('Error fetching public stocklists');
    } else {
      res.json(result.rows);
    }
  });
});


  app.get("/reviews", (req, res) => {
    if (req.session.user) {
      res.sendFile(__dirname + "/reviews.html");
    } else {
      res.redirect("/");
    }
  });

  // get my reviews:
  app.get("/api/my-reviews", (req, res) => {
    if (req.session.user) {
      const email = req.session.user.email;
      const query = `
        SELECT r.reviewID, r.reviewText, r.stocklistid, Users.name 
        FROM Reviews r
        JOIN StockLists ON r.stocklistid = StockLists.stocklistid 
        JOIN Users ON StockLists.email = Users.email 
        WHERE r.email = $1
      `;
      client.query(query, [email], (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.status(500).send('Error fetching reviews');
        } else {
          res.json(result.rows);
        }
      });
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  app.put('/api/reviews/:reviewId', (req, res) => {
    if (!req.session.user) {
      return res.status(401).send('Unauthorized');
    }
  
    const reviewId = req.params.reviewId;
    const { reviewText } = req.body;
    const email = req.session.user.email;
  
    const query = `
      UPDATE Reviews
      SET reviewText = $1
      WHERE reviewID = $2 AND email = $3
      RETURNING *
    `;
  
    client.query(query, [reviewText, reviewId, email], (err, result) => {
      if (err) {
        console.error('Error executing query', err);
        return res.status(500).send('Error updating review');
      }
  
      if (result.rowCount === 0) {
        return res.status(404).send('Review not found or not owned by user');
      }
  
      res.json(result.rows[0]);
    });
  });

  app.delete('/api/reviews/:reviewId', (req, res) => {
    if (!req.session.user) {
      return res.status(401).send('Unauthorized');
    }
  
    const reviewId = req.params.reviewId;
    const email = req.session.user.email;
  
    const query = `
      DELETE FROM Reviews
      WHERE reviewID = $1 AND email = $2
      RETURNING *
    `;
  
    client.query(query, [reviewId, email], (err, result) => {
      if (err) {
        console.error('Error executing query', err);
        return res.status(500).send('Error deleting review');
      }
  
      if (result.rowCount === 0) {
        return res.status(404).send('Review not found or not owned by user');
      }
  
      res.json(result.rows[0]);
    });
  });

  app.post("/api/request-review", (req, res) => {
    if (req.session.user) {
      const { email, stocklistid, reviewText } = req.body;
  
      // First, check if there is already a pending review request
      const checkQuery = `
        SELECT * FROM Reviews
        WHERE email = $1 AND stocklistid = $2 AND reviewText = ''
      `;
  
      client.query(checkQuery, [email, stocklistid], (err, result) => {
        if (err) {
          console.error("Error executing query", err);
          res.status(500).send("Error checking existing review request");
        } else if (result.rows.length > 0) { 
          return res.status(200).json({ err: "Review request already exists" }); // Send JSON response
        } else {
          // If no existing request, insert the new review request
          const insertQuery = `
            INSERT INTO Reviews (email, stocklistid, reviewText)
            VALUES ($1, $2, $3)
            RETURNING *
          `;
  
          client.query(insertQuery, [email, stocklistid, reviewText], (err, result) => {
            if (err) {
              console.error("Error executing query", err);
              res.status(500).send("Error requesting review");
            } else {
              res.json(result.rows[0]);
            }
          });
        }
      });
    } else {
      res.status(401).send("Unauthorized");
    }
  });

  // app.get("/api/reviews/", (req, res) => {
  //   const stocklistid = req.query.stocklistid;
  
  //   const query = `
  //     SELECT Reviews.reviewID, Reviews.reviewText, Users.name
  //     FROM Reviews
  //     JOIN Users ON Reviews.email = Users.email
  //     WHERE Reviews.stocklistid = $1
  //   `;
  
  //   client.query(query, [stocklistid], (err, result) => {
  //     if (err) {
  //       console.error("Error executing query", err);
  //       res.status(500).send("Error fetching reviews");
  //     } else {
  //       res.json(result.rows);
  //     }
  //   });
  // });

  // add a review
  app.post("/api/add-review", (req, res) => {
    if (req.session.user) {
      const email = req.session.user.email;
      const { stocklistid, reviewtext } = req.body;
  
      // First, check if there is a pending review
      const checkQuery = `
        SELECT * FROM Reviews
        WHERE email = $1 AND stocklistid = $2 AND reviewtext = '';
      `;
  
      client.query(checkQuery, [email, stocklistid], (err, result) => {
        if (err) {
          console.error("Error executing query", err);
          res.status(500).send("Error checking for pending review");
        } else if (result.rows.length > 0) {
          // If a pending review exists, update it
          const updateQuery = `
            UPDATE Reviews
            SET reviewtext = $3
            WHERE email = $1 AND stocklistid = $2 AND reviewtext = ''
            RETURNING *;
          `;
  
          client.query(updateQuery, [email, stocklistid, reviewtext], (err, result) => {
            if (err) {
              console.error("Error executing query", err);
              res.status(500).send("Error updating review");
            } else {
              res.json(result.rows[0]);
            }
          });
        } else {
          // If no pending review exists, insert a new review
          const insertQuery = `
            INSERT INTO Reviews (email, stocklistid, reviewtext)
            VALUES ($1, $2, $3)
            RETURNING *;
          `;
  
          client.query(insertQuery, [email, stocklistid, reviewtext], (err, result) => {
            if (err) {
              console.error("Error executing query", err);
              res.status(500).send("Error adding review");
            } else {
              res.json(result.rows[0]);
            }
          });
        }
      });
    } else {
      res.status(401).send("Unauthorized");
    }
  });
  
  app.post("/api/stocklist-reviews", (req, res) => {
    if (req.session.user) {
      const { stocklistid } = req.body;
  
      const query = `
        SELECT r.reviewtext, u.name AS name
        FROM Reviews r
        JOIN Users u ON r.email = u.email
        WHERE r.stocklistid = $1;
      `;
  
      client.query(query, [stocklistid], (err, results) => {
        if (err) {
          console.error("Error fetching stocklist reviews:", err);
          res.status(500).send("Internal Server Error");
        } else {
          res.json({
            reviews: results.rows,
          });
        }
      });
    } else {
      res.status(401).send("Unauthorized");
    }
  });



  //see stocks
  app.get("/stocks", (req, res) => {
    if (req.session.user) {
      res.sendFile(__dirname + "/stocks.html");
    } else {
      res.redirect("/");
    }
  });

// fetch stocks and most recent close price
app.get('/api/stocks', (req, res) => {
  const query = `
    SELECT DISTINCT ON (code) code, close
    FROM stockdata
    ORDER BY code, timestamp DESC;
  `;

  client.query(query, (err, result) => {
    if (err) {
      console.error('Error executing query', err);
      res.status(500).send('Error fetching stock data');
    } else {
      res.json(result.rows);
    }
  });
});

// fetch stock detail by code
app.get('/api/stock-detail/:code', (req, res) => {
  const stockCode = req.params.code;

  const query = 'SELECT * FROM stockdata WHERE code = $1 ORDER BY timestamp DESC';
  client.query(query, [stockCode], (err, result) => {
    if (err) {
      console.error('Error fetching stock detail:', err);
      res.status(500).send('Error fetching stock detail');
    } else {
      res.json(result.rows);
    }
  });
});

// add stock data
app.post('/api/add-stock-data', (req, res) => {
  const { code, timestamp, open, high, low, close, volume } = req.body;

  const query = `
    INSERT INTO stockdata (code, timestamp, open, high, low, close, volume)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;

  client.query(query, [code, timestamp, open, high, low, close, volume], (err, result) => {
    if (err) {
      console.error('Error adding stock data:', err);
      res.status(500).json({ success: false, message: 'Error adding stock data' });
    } else {
      res.json({ success: true });
    }
  });
});

  app.get("/friends", (req, res) => {
    if (req.session.user) {
      res.sendFile(__dirname + "/friends.html");
    } else {
      res.redirect("/");
    }
  });

  app.post('/api/delete-friend', (req, res) => {
    if (req.session.user) {
      const email = req.session.user.email;
      const friendEmail = req.body.friendEmail;
      const query = `
        DELETE FROM Friends
        WHERE (email1 = $1 AND email2 = $2) OR (email1 = $2 AND email2 = $1)
      `;
      client.query(query, [email, friendEmail], (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.status(500).send('Error deleting friend');
        } else {
          const insertDeclinedRequestQuery = `
            INSERT INTO FriendRequests (requestemail, receiveemail, status, timestamp)
            VALUES ($1, $2, 'declined', CURRENT_TIMESTAMP)
          `;
          client.query(insertDeclinedRequestQuery, [friendEmail, email], (err, result) => {
            if (err) {
              console.error('Error executing insert query', err);
              res.status(500).send('Error adding declined friend request');
            } else {
              res.json({ message: 'Friend deleted and declined friend request added successfully' });
            }
          });
          
          // res.json({ message: 'Friend deleted successfully' });
        }
      });
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  app.get("/api/friends-list", (req, res) => {
    if (req.session.user) {
      const email = req.session.user.email;

      const query = `
        SELECT u.name, f.friendEmail
        FROM (
          SELECT email1 AS friendemail FROM Friends WHERE email2 = $1
          UNION
          SELECT email2 AS friendemail FROM Friends WHERE email1 = $1
        ) f
        JOIN Users u ON f.friendemail = u.email
      `;

      client.query(query, [email], (err, results) => {
        if (err) {
          console.error("Error fetching friends:", err);
          res.status(500).send("Internal Server Error");
        } else {
          res.json({
            friends: results.rows,
          });
        }
      });
    } else {
      res.status(401).send("Unauthorized");
    }
  });

  app.post('/api/friend-request', (req, res) => {
    if (req.session.user) {
      const { receiveemail } = req.body;
      const senderemail = req.session.user.email;

      if (receiveemail  === senderemail) {  
        return res.status(200).json({ error: 'You cannot send a friend request to yourself' });
      }

      // Validate the request body
      if (!receiveemail) {
        return res.status(400).json({ error: 'receiveemail is required' });
      }
  
      const checkReciprocalQuery = `
        SELECT * FROM FriendRequests
        WHERE requestemail = $1 AND receiveemail = $2 AND (status = 'Pending' OR )
      `;
  
      client.query(checkReciprocalQuery, [receiveemail, senderemail], (err, result) => {
        if (err) {
          console.error('Error checking reciprocal friend request:', err);
          res.status(500).send('Internal Server Error');
        } else if (result.rows.length > 0) {
          // Reciprocal friend request exists
          const addFriendsQuery = `
            INSERT INTO Friends (email1, email2)
            VALUES ($1, $2)
          `;
  
          const deleteRequestsQuery = `
            DELETE FROM FriendRequests
            WHERE (requestemail = $1 AND receiveemail = $2) OR (requestemail = $2 AND receiveemail = $1)
          `;
  
          client.query(addFriendsQuery, [senderemail, receiveemail], (err) => {
            if (err) {
              console.error('Error adding friends:', err);
              res.status(500).send('Internal Server Error');
            } else {
              client.query(deleteRequestsQuery, [senderemail, receiveemail], (err) => {
                if (err) {
                  console.error('Error deleting friend requests:', err);
                  res.status(500).send('Internal Server Error');
                } else {
                  res.json({ message: 'Friend request accepted and both users added as friends' });
                }
              });
            }
          });
        } else {
          // Check if there is a declined friend request
          const checkDeclinedRequestQuery = `
          SELECT timestamp
          FROM FriendRequests
          WHERE requestemail = $1 AND receiveemail = $2 AND status = 'declined'
          `;

          client.query(checkDeclinedRequestQuery, [senderemail, receiveemail], (err, result) => {
          if (err) {
            console.error('Error checking declined friend request:', err);
            res.status(500).send('Internal Server Error');
          } else if (result.rows.length > 0) {
            const declinedTimestamp = new Date(result.rows[0].timestamp);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            if (declinedTimestamp > fiveMinutesAgo) {
              res.status(200).json({ error: 'This user declined your friend request or unfriended you less than 5 minutes ago.' });
            } else {
              // Update the status to 'Pending'
              const updateRequestQuery = `
                UPDATE FriendRequests
                SET status = 'Pending', timestamp = CURRENT_TIMESTAMP
                WHERE requestemail = $1 AND receiveemail = $2
              `;

              client.query(updateRequestQuery, [senderemail, receiveemail], (err) => {
                if (err) {
                  console.error('Error updating friend request:', err);
                  res.status(500).json({ error: 'Internal Server Error' });
                } else {
                  res.json({ message: 'Friend request sent' });
                }
              });
            }
          } else {
            // No reciprocal friend request, insert new friend request
            const insertRequestQuery = `
              INSERT INTO FriendRequests (requestemail, receiveemail, status)
              VALUES ($1, $2, 'Pending')
              ON CONFLICT (requestemail, receiveemail) DO NOTHING
            `;

            client.query(insertRequestQuery, [senderemail, receiveemail], (err) => {
              if (err) {
                console.error('Error sending friend request:', err);
                res.status(500).send('Internal Server Error');
              } else {
                res.json({ message: 'Friend request sent' });
              }
            });
          }
          });
        }
      });
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  app.get("/api/pending-requests", (req, res) => {
    if (req.session.user) {
      const email = req.session.user.email;
  
      const query = `
        SELECT requestEmail, Users.name AS requesterName
        FROM FriendRequests
        JOIN Users ON FriendRequests.requestEmail = Users.email
        WHERE FriendRequests.receiveEmail = $1 AND FriendRequests.status = 'Pending'
      `;

      client.query(query, [email], (err, results) => {
        if (err) {
          console.error("Error fetching pending requests:", err);
          res.status(500).send("Internal Server Error");
        } else {
          res.json({
            requests: results.rows,
          });
        }
      });
    } else {
      res.status(401).send("Unauthorized");
    }
  });
  
  app.post("/api/accept-request", (req, res) => {
    if (req.session.user) {
      const { requestEmail } = req.body;
      const receiverEmail = req.session.user.email;
      
      // Delete the friend request from FriendRequests
      const deleteQuery = `
        DELETE FROM FriendRequests
        WHERE requestEmail = $1 AND receiveEmail = $2
      `;
      
      // Insert the emails into the Friends table
      const insertQuery = `
        INSERT INTO Friends (email1, email2)
        VALUES ($1, $2)
      `;
      
      client.query(deleteQuery, [requestEmail, receiverEmail], (err, results) => {
        if (err) {
          console.error("Error deleting friend request:", err);
          res.status(500).send("Internal Server Error");
        } else {
          client.query(insertQuery, [requestEmail, receiverEmail], (err, results) => {
            if (err) {
              console.error("Error inserting into Friends table:", err);
              res.status(500).send("Internal Server Error");
            } else {
              res.json({ message: "Friend request accepted and added to Friends list" });
            }
          });
        }
      });

    } else {
      res.status(401).send("Unauthorized");
    }
  });
  
  app.post("/api/decline-request", (req, res) => {
    if (req.session.user) {
      const { requestEmail } = req.body;
      const receiverEmail = req.session.user.email;
  
      const query = `
        UPDATE FriendRequests
        SET status = 'declined', timestamp = CURRENT_TIMESTAMP
        WHERE requestEmail = $1 AND receiveEmail = $2
      `;
  
      client.query(query, [requestEmail, receiverEmail], (err, results) => {
        if (err) {
          console.error("Error declining friend request:", err);
          res.status(500).send("Internal Server Error");
        } else {
          res.json({ message: "Friend request declined" });
        }
      });
    } else {
      res.status(401).send("Unauthorized");
    }
  });

  // // friends page
  // app.get('/friends', (req, res) => {
  //   res.sendFile(__dirname + '/friends.html');
  // });

  app.get('/friends', (req, res) => {
    if (req.session.user) {
      res.sendFile(path.join(__dirname, 'public', 'friends.html'));
    } else {
      res.status(401).send('Unauthorized');
    }
  });

// stock stats
app.get('/api/stock-stats/:code', async (req, res) => {
  const stockCode = req.params.code;
  const cacheKey = `stock-stats-${stockCode}`;

  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const stockQuery = 'SELECT * FROM stockdata WHERE code = $1 ORDER BY timestamp ASC';
  const allStocksQuery = 'SELECT code, timestamp, close FROM stockdata ORDER BY timestamp ASC';

  try {
    const stockResult = await client.query(stockQuery, [stockCode]);
    const allStocksResult = await client.query(allStocksQuery);

    if (stockResult.rows.length === 0) {
      return res.status(404).send('No stock data found for the given code');
    }

    const stockPrices = stockResult.rows.map(row => parseFloat(row.close));
    const stockReturns = [];
    for (let i = 1; i < stockPrices.length; i++) {
      const stockDailyReturn = (stockPrices[i] - stockPrices[i - 1]) / stockPrices[i - 1];
      stockReturns.push(stockDailyReturn);
    }

    const averageReturn = stockReturns.reduce((acc, curr) => acc + curr, 0) / stockReturns.length;
    const variance = stockReturns.reduce((acc, curr) => acc + Math.pow(curr - averageReturn, 2), 0) / (stockReturns.length - 1);
    const stddev = Math.sqrt(variance);
    const cov = stddev / averageReturn;

    const marketReturns = {};
    allStocksResult.rows.forEach(row => {
      const date = new Date(row.timestamp).toISOString().split('T')[0];
      if (!marketReturns[date]) {
        marketReturns[date] = [];
      }
      marketReturns[date].push(parseFloat(row.close));
    });

    const marketDailyReturns = [];
    const timestamps = Object.keys(marketReturns).sort();
    for (let i = 1; i < timestamps.length; i++) {
      const prevAvgClose = marketReturns[timestamps[i - 1]].reduce((acc, curr) => acc + curr, 0) / marketReturns[timestamps[i - 1]].length;
      const currAvgClose = marketReturns[timestamps[i]].reduce((acc, curr) => acc + curr, 0) / marketReturns[timestamps[i]].length;
      const marketDailyReturn = (currAvgClose - prevAvgClose) / prevAvgClose;
      marketDailyReturns.push(marketDailyReturn);
    }

    if (marketDailyReturns.length < stockReturns.length) {
      stockReturns.length = marketDailyReturns.length;
    } else {
      marketDailyReturns.length = stockReturns.length;
    }

    const marketMean = marketDailyReturns.reduce((acc, curr) => acc + curr, 0) / marketDailyReturns.length;
    const covariance = stockReturns.reduce((acc, curr, idx) => {
      return acc + ((curr - averageReturn) * (marketDailyReturns[idx] - marketMean));
    }, 0) / (stockReturns.length - 1);
    const marketVariance = marketDailyReturns.reduce((acc, curr) => acc + Math.pow(curr - marketMean, 2), 0) / (marketDailyReturns.length - 1);
    const beta = covariance / marketVariance;

    const stats = {
      averageReturn,
      variance,
      stddev,
      cov,
      beta
    };

    cache.set(cacheKey, stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    res.status(500).send('Error fetching stock data');
  }
});


const fetchPortfolioStats = async (portfolioId) => {
  const portfolioQuery = `
    SELECT sh.stocksymbol, sh.numshares, sd.close, sd.open
    FROM Stocklistholdings slh
    JOIN Stockholdings sh ON slh.stockholdingid = sh.stockholdingid
    LEFT JOIN LATERAL (
      SELECT close, open
      FROM stockdata sd
      WHERE sd.code = sh.stocksymbol
      ORDER BY sd.timestamp DESC
      LIMIT 1
    ) sd ON true
    WHERE slh.stocklistid = (
      SELECT stocklistid FROM Portfolios WHERE portfolioid = $1
    );
  `;
  const allStocksQuery = 'SELECT code, timestamp, close FROM stockdata ORDER BY timestamp ASC';

  const portfolioResult = await client.query(portfolioQuery, [portfolioId]);
  const allStocksResult = await client.query(allStocksQuery);

  const stocks = portfolioResult.rows;
  if (stocks.length === 0) {
    throw new Error('Portfolio not found or empty');
  }

  const returns = stocks.map(stock => (parseFloat(stock.close) - parseFloat(stock.open)) / parseFloat(stock.open));
  const averageReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - averageReturn, 2), 0) / returns.length;
  const stddev = Math.sqrt(variance);
  const cov = stddev / averageReturn;

  const marketReturns = {};
  allStocksResult.rows.forEach(row => {
    const date = new Date(row.timestamp).toISOString().split('T')[0];
    if (!marketReturns[date]) {
      marketReturns[date] = [];
    }
    marketReturns[date].push(parseFloat(row.close));
  });

  const marketDailyReturns = [];
  const timestamps = Object.keys(marketReturns).sort();
  for (let i = 1; i < timestamps.length; i++) {
    const prevAvgClose = marketReturns[timestamps[i - 1]].reduce((acc, curr) => acc + curr, 0) / marketReturns[timestamps[i - 1]].length;
    const currAvgClose = marketReturns[timestamps[i]].reduce((acc, curr) => acc + curr, 0) / marketReturns[timestamps[i]].length;
    const marketDailyReturn = (currAvgClose - prevAvgClose) / prevAvgClose;
    marketDailyReturns.push(marketDailyReturn);
  }

  if (marketDailyReturns.length < returns.length) {
    returns.length = marketDailyReturns.length;
  } else {
    marketDailyReturns.length = returns.length;
  }

  const marketMean = marketDailyReturns.reduce((acc, curr) => acc + curr, 0) / marketDailyReturns.length;
  const covariance = returns.reduce((acc, curr, idx) => {
    return acc + ((curr - averageReturn) * (marketDailyReturns[idx] - marketMean));
  }, 0) / (returns.length - 1);
  const marketVariance = marketDailyReturns.reduce((acc, curr) => acc + Math.pow(curr - marketMean, 2), 0) / (marketDailyReturns.length - 1);
  const beta = covariance / marketVariance;

  return {
    averageReturn,
    variance,
    stddev,
    cov,
    beta
  };
};


// fetch portfolio stats
app.get('/api/portfolio-stats/:id', async (req, res) => {
  const portfolioId = parseInt(req.params.id, 10);
  const cacheKey = `portfolio-stats-${portfolioId}`;

  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const portfolioQuery = `
    SELECT sh.stocksymbol, sh.numshares, sd.close, sd.open
    FROM Stocklistholdings slh
    JOIN Stockholdings sh ON slh.stockholdingid = sh.stockholdingid
    LEFT JOIN LATERAL (
      SELECT close, open
      FROM stockdata sd
      WHERE sd.code = sh.stocksymbol
      ORDER BY sd.timestamp DESC
      LIMIT 1
    ) sd ON true
    WHERE slh.stocklistid = (
      SELECT stocklistid FROM Portfolios WHERE portfolioid = $1
    );
  `;
  const allStocksQuery = 'SELECT code, timestamp, close FROM stockdata ORDER BY timestamp ASC';

  try {
    const portfolioResult = await client.query(portfolioQuery, [portfolioId]);
    const allStocksResult = await client.query(allStocksQuery);

    const stocks = portfolioResult.rows;
    if (stocks.length === 0) {
      return res.status(404).send('Portfolio not found or empty');
    }

    const returns = stocks.map(stock => (parseFloat(stock.close) - parseFloat(stock.open)) / parseFloat(stock.open));
    const averageReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + Math.pow(value - averageReturn, 2), 0) / returns.length;
    const stddev = Math.sqrt(variance);
    const cov = stddev / averageReturn;

    const marketReturns = {};
    allStocksResult.rows.forEach(row => {
      const date = new Date(row.timestamp).toISOString().split('T')[0];
      if (!marketReturns[date]) {
        marketReturns[date] = [];
      }
      marketReturns[date].push(parseFloat(row.close));
    });

    const marketDailyReturns = [];
    const timestamps = Object.keys(marketReturns).sort();
    for (let i = 1; i < timestamps.length; i++) {
      const prevAvgClose = marketReturns[timestamps[i - 1]].reduce((acc, curr) => acc + curr, 0) / marketReturns[timestamps[i - 1]].length;
      const currAvgClose = marketReturns[timestamps[i]].reduce((acc, curr) => acc + curr, 0) / marketReturns[timestamps[i]].length;
      const marketDailyReturn = (currAvgClose - prevAvgClose) / prevAvgClose;
      marketDailyReturns.push(marketDailyReturn);
    }

    if (marketDailyReturns.length < returns.length) {
      returns.length = marketDailyReturns.length;
    } else {
      marketDailyReturns.length = returns.length;
    }

    const marketMean = marketDailyReturns.reduce((acc, curr) => acc + curr, 0) / marketDailyReturns.length;
    const covariance = returns.reduce((acc, curr, idx) => {
      return acc + ((curr - averageReturn) * (marketDailyReturns[idx] - marketMean));
    }, 0) / (returns.length - 1);
    const marketVariance = marketDailyReturns.reduce((acc, curr) => acc + Math.pow(curr - marketMean, 2), 0) / (marketDailyReturns.length - 1);
    const beta = covariance / marketVariance;

    const stats = {
      averageReturn,
      variance,
      stddev,
      cov,
      beta
    };

    cache.set(cacheKey, stats);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching portfolio stats:', err);
    res.status(500).send('Error fetching portfolio stats');
  }
});

// compare stocks correlation and covariation
app.get('/api/compare-stocks/:stock1/:stock2', (req, res) => {
  const stock1 = req.params.stock1;
  const stock2 = req.params.stock2;
  const cacheKey = `compare-stocks-${stock1}-${stock2}`;

  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  if (!stock1 || !stock2 || stock1 === stock2) {
    return res.status(400).send({ success: false, message: 'Invalid stock selection' });
  }

  const query = `
    SELECT timestamp::date as date, code, close
    FROM stockdata
    WHERE code = $1 OR code = $2
    ORDER BY date ASC
  `;

  client.query(query, [stock1, stock2], (err, result) => {
    if (err) {
      console.error('Error fetching stock data:', err);
      return res.status(500).send({ success: false, message: 'Error fetching stock data' });
    }

    const stock1Data = {};
    const stock2Data = {};

    result.rows.forEach(row => {
      if (row.code === stock1) {
        stock1Data[row.date] = parseFloat(row.close);
      } else if (row.code === stock2) {
        stock2Data[row.date] = parseFloat(row.close);
      }
    });

    const sharedDates = Object.keys(stock1Data).filter(date => date in stock2Data);
    const stock1Prices = sharedDates.map(date => stock1Data[date]);
    const stock2Prices = sharedDates.map(date => stock2Data[date]);

    if (stock1Prices.length === 0 || stock2Prices.length === 0) {
      return res.status(404).send({ success: false, message: 'Not enough shared data points for comparison' });
    }

    const mean1 = stock1Prices.reduce((acc, val) => acc + val, 0) / stock1Prices.length;
    const mean2 = stock2Prices.reduce((acc, val) => acc + val, 0) / stock2Prices.length;

    const covariation = stock1Prices.reduce((acc, val, idx) => acc + ((val - mean1) * (stock2Prices[idx] - mean2)), 0) / (stock1Prices.length - 1);
    const stddev1 = Math.sqrt(stock1Prices.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0) / (stock1Prices.length - 1));
    const stddev2 = Math.sqrt(stock2Prices.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0) / (stock2Prices.length - 1));
    const correlation = covariation / (stddev1 * stddev2);

    const comparison = {
      success: true,
      covariation,
      correlation
    };

    cache.set(cacheKey, comparison);
    res.json(comparison);
  });
});

// portfolio covariance matrix
app.get('/api/portfolio/:id/covariance-matrix', async (req, res) => {
  const portfolioId = parseInt(req.params.id, 10);

  if (isNaN(portfolioId)) {
    return res.status(400).send('Invalid portfolio ID');
  }

  const portfolioQuery = `
    SELECT sh.stocksymbol, sd.close
    FROM Stocklistholdings slh
    JOIN Stockholdings sh ON slh.stockholdingid = sh.stockholdingid
    JOIN stockdata sd ON sd.code = sh.stocksymbol
    WHERE slh.stocklistid = (
      SELECT stocklistid FROM Portfolios WHERE portfolioid = $1
    )
    ORDER BY sd.timestamp ASC;
  `;

  try {
    const portfolioResult = await client.query(portfolioQuery, [portfolioId]);
    const stocks = portfolioResult.rows;
    if (stocks.length === 0) {
      return res.status(404).send('Portfolio not found or empty');
    }

    const stockSymbols = [...new Set(stocks.map(stock => stock.stocksymbol))];
    const stockPrices = stockSymbols.map(symbol =>
      stocks.filter(stock => stock.stocksymbol === symbol).map(stock => parseFloat(stock.close))
    );

    const calculateCovariance = (arr1, arr2) => {
      const mean1 = arr1.reduce((acc, val) => acc + val, 0) / arr1.length;
      const mean2 = arr2.reduce((acc, val) => acc + val, 0) / arr2.length;
      return arr1.reduce((acc, val, idx) => acc + ((val - mean1) * (arr2[idx] - mean2)), 0) / (arr1.length - 1);
    };

    const covarianceMatrix = {};
    stockSymbols.forEach((symbol1, idx1) => {
      covarianceMatrix[symbol1] = {};
      stockSymbols.forEach((symbol2, idx2) => {
        const cov = calculateCovariance(stockPrices[idx1], stockPrices[idx2]);
        covarianceMatrix[symbol1][symbol2] = cov;
        covarianceMatrix[symbol2] = covarianceMatrix[symbol2] || {};
        covarianceMatrix[symbol2][symbol1] = cov;
      });
    });

    res.json(covarianceMatrix);
  } catch (err) {
    console.error('Error fetching covariance matrix:', err);
    res.status(500).send('Error fetching covariance matrix');
  }
});


  
  //logout
  app.get("/logout", (req, res) => {
    res.redirect("/");
  });

  // API endpoint to get session data
  app.get("/api/session", (req, res) => {
    if (req.session.user) {
      res.json({ user: req.session.user });
    } else {
      res.status(401).send("Unauthorized");
    }
  });
  
  // API endpoint to get session data
  app.get('/api/session', (req, res) => {
    if (req.session.user) {
      res.json({ user: req.session.user });
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
