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



  // stocklist page
    app.get("/stocklist-page", (req, res) => {
      res.sendFile(__dirname + '/stocklist-page.html');
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
  const stocklistId = parseInt(req.params.id, 10);
  const { isPublic } = req.body;
  if (isNaN(stocklistId)) {
    return res.status(400).send('Invalid stocklist ID');
  }
  const query = 'UPDATE Stocklists SET isPublic = $1 WHERE stocklistid = $2';
  client.query(query, [isPublic, stocklistId], (err, result) => {
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

  app.get("/reviews", (req, res) => {
    if (req.session.user) {
      res.sendFile(__dirname + "/reviews.html");
    } else {
      res.redirect("/");
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
      const { receiveemail } = req.body;
      const senderemail = req.session.user.email;
  
      const checkReciprocalQuery = `
        SELECT * FROM FriendRequests
        WHERE requestemail = $1 AND receiveemail = $2 AND status = 'Pending'
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
