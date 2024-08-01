const express = require("express");
const session = require("express-session");
const { Client } = require("pg");
const app = express();
const port = 3000;

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

  // see reviews
  app.get("/reviews", (req, res) => {
    if (req.session.user) {
      const query = "SELECT * FROM Reviews";
      client.query(query, (err, result) => {
        if (err) {
          console.error("Error executing query", err);
          res.status(500).send("Error getting reviews");
        } else {
          res.json(result.rows);
        }
      });
    } else {
      res.redirect("/");
    }
  });

  app.get("/friends", (req, res) => {
    if (req.session.user) {
      res.sendFile(__dirname + "/friends.html");
    } else {
      res.redirect("/");
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
      const { receiverEmail } = req.body;
      const senderEmail = req.session.user.email;

      const query = `
        INSERT INTO FriendRequests (requestEmail, receiveEmail, status)
        VALUES ($1, $2, 'Pending')
        ON CONFLICT (requestemail, receiveemail) DO NOTHING
      `;

      client.query(query, [senderEmail, receiverEmail], (err, result) => {
        if (err) {
          console.error('Error sending friend request:', err);
          res.status(500).send('Internal Server Error');
        } else {
          res.json({ message: 'Friend request sent' });
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
          console.log("Pending requests fetched:", results.rows);
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
        SET status = 'declined'
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

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
