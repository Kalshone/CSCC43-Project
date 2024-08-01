const express = require("express");
const session = require('express-session');
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

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key', // Replace with a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

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
  app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/signup.html');
  });

  // signup process
  app.post('/signup', (req, res) => {
    const {email, name, password } = req.body;
    const query = 'INSERT INTO Users (email, name, password) VALUES ($1, $2, $3) RETURNING email';
    client.query(query, [email, name, password], (err, result) => {
      if (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error signing up');
      } else {
        req.session.user = {
          email: result.rows[0].email,
        };
        res.redirect(`/dashboard`);
      }
    });
  });

  // login page
  app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
  });

  // login process
  app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const query = 'SELECT * FROM Users WHERE email = $1 AND password = $2';
    client.query(query, [email, password], (err, result) => {
      if (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error logging in');
      } else if (result.rows.length === 0) {
        res.status(401).send('Invalid email or password');
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
      res.sendFile(__dirname + '/dashboard.html');
    } else {
      res.redirect('/');
    }
  });

  // see reviews
  app.get('/reviews', (req, res) => {
    if (req.session.user) {
      const query = 'SELECT * FROM Reviews';
      client.query(query, (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.status(500).send('Error getting reviews');
        } else {
          res.json(result.rows);
        }
      });
    } else {
      res.redirect('/');
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
      const stockListId = null;
      const name = req.body.portfolioName;
      const cashbalance = 0;
      const query = 'INSERT INTO PORTFOLIOS (email, stockListId, name, cashbalance) VALUES ($1, $2, $3, $4) RETURNING portfolioid';
      client.query(query, [email, stockListId, name, cashbalance], (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.status(500).send('Error adding portfolio');
        } else {
          const newPortfolio = result.rows[0];
          res.redirect(`/portfolio-page?id=${newPortfolio.portfolioid}`);
        }
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


  // stocklist page
    app.get("/stocklist-page", (req, res) => {
      res.sendFile(__dirname + '/stocklist-page.html');
  });

  // add stocklist page
  app.get("/add-stocklist-page", (req, res) => {
    res.sendFile(__dirname + '/add-stocklist-page.html');
  });

// add stocklist process
app.post('/add-stocklist', (req, res) => {
  if (req.session.user) {
    const email = req.session.user.email;
    const name = req.body.stocklistName;
    const isPublic = false;
    
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
  const stocklistId = parseInt(req.params.id, 10);

  if (isNaN(stocklistId)) {
    return res.status(400).send('Invalid stocklist ID');
  }

  const query = 'SELECT * FROM Stocklists WHERE stocklistid = $1';
  client.query(query, [stocklistId], (err, result) => {
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

  
  //logout
  app.get('/logout', (req, res) => {
    res.redirect('/');
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
