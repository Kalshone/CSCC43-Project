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

// Set up session middleware
app.use(session({
  secret: 'your_secret_key',
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
        res.redirect(`/dashboard/{email}`);
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
        req.session.user = result.rows[0];
        res.redirect(`/dashboard/${email}`);
      }
    });
  });

  // dashboard page
  app.get("/dashboard/:email", (req, res) => {
    if (req.session.user && req.session.user.email === req.params.email) {
      res.sendFile(__dirname + '/dashboard.html');
    } else {
      res.status(401).send('Unauthorized');
    }
  });

  // see reviews
  app.get('/reviews', (req, res) => {
    const query = 'SELECT * FROM Reviews';
    client.query(query, (err, result) => {
      if (err) {
        console.error('Error executing query', err);
        res.status(500).send('Error getting reviews');
      } else {
        res.sendFile(path.join(__dirname, 'views', 'reviews.html'), { reviews: result.rows });
      }
    });
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
  
  //logout
  app.get('/logout', (req, res) => {
    res.redirect('/');
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
