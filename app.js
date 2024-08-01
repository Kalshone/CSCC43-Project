const express = require("express");
const session = require('express-session');
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
      const email = req.session.user;
      const stockListId = null;
      const name = req.body.name;
      const cashbalance = 0;
      const query = 'INSERT INTO PORTFOLIOS (email, stockListId, name, cashbalance) VALUES ($1, $2, $3, $4) RETURNING name';
      client.query(query, [email, stockListId, name, cashbalance], (err, result) => {
        if (err) {
          console.error('Error executing query', err);
          res.status(500).send('Error adding portfolio');
        // } else {
        //   res.redirect(`/portfolio-page`);
        }
      });
    } else {
      res.redirect('/');
    }
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
