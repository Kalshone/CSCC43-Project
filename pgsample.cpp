#include <iostream>
#include <pqxx/pqxx>

int main() {
    try {
	//
        // Connect to the database
	//
	//

        pqxx::connection C("dbname=mydb user=postgres password=123 hostaddr=35.209.90.44 port=5432");
        if (C.is_open()) {
            std::cout << "Opened database successfully: " << C.dbname() << std::endl;
        } else {
            std::cout << "Can't open database" << std::endl;
            return 1;
        }

	//
        // Create a transactional object
	//
	//
        pqxx::work W(C);

	//
        // Create SQL statement
	//
	//
        std::string sql = "INSERT INTO testtbl(name, value) VALUES ('world', 1024);";

	// 
        // Execute SQL query
	//
	//
        W.exec(sql);
        W.commit();
        std::cout << "Tuple inserted successfully" << std::endl;


	//
	// Create a non-transactional object to query the database
	//
	//
        pqxx::nontransaction N(C);

	//
	// Create SQL statement to query all tuples
	//
	//
        std::string sqlSelect = "SELECT name, value FROM testtbl;";

	//
        // Execute SQL query to select all tuples
	//
	//
        pqxx::result R(N.exec(sqlSelect));

	//
        // Print the queried tuples
	//
	//
        std::cout << "Table testtbl contains the following tuples:\nname \tvalue" << std::endl;
        for (auto row : R) {
            std::cout << row["name"].as<std::string>() << " \t" << row["value"].as<int>() << std::endl;
        }

	//
        // Close the database connection
	//
	//
        C.close();

	std::cout << "Disconnected from the database" << std::endl;
    } catch (const std::exception &e) {
        std::cerr << e.what() << std::endl;
        return 1;
    }

    return 0;
}







// #include <iostream>
// #include <pqxx/pqxx>
// #include <string>

// void registerUser(pqxx::work& W, const std::string& name, const std::string& password) {
//     std::string sql = "INSERT INTO User(name, password) VALUES ('" + W.esc(name) + "', '" + W.esc(password) + "');";
//     W.exec(sql);
//     W.commit();
//     std::cout << "User registered successfully" << std::endl;
// }

// void loginUser(pqxx::nontransaction& N, const std::string& name, const std::string& password) {
//     std::string sql = "SELECT userID FROM User WHERE name = '" + N.esc(name) + "' AND password = '" + N.esc(password) + "';";
//     pqxx::result R(N.exec(sql));

//     if (R.empty()) {
//         std::cout << "Invalid username or password" << std::endl;
//     } else {
//         std::cout << "Login successful. UserID: " << R[0]["userID"].as<int>() << std::endl;
//     }
// }

// void accessPortfolios(pqxx::nontransaction& N, int userID) {
//     std::string sql = "SELECT * FROM Portfolio WHERE userID = " + std::to_string(userID) + ";";
//     pqxx::result R(N.exec(sql));

//     std::cout << "User's portfolios:\n";
//     for (auto row : R) {
//         std::cout << "PortfolioID: " << row["portfolioID"].as<int>() << ", Name: " << row["name"].as<std::string>() << ", Cash Balance: " << row["cashBalance"].as<double>() << std::endl;
//     }
// }

// // Additional functions for managing stock lists, tracking portfolios, analyzing stocks, etc.

// int main() {
//     try {
//         pqxx::connection C("dbname=mydb user=postgres password=123 hostaddr=35.209.90.44 port=5432");
//         if (C.is_open()) {
//             std::cout << "Opened database successfully: " << C.dbname() << std::endl;
//         } else {
//             std::cout << "Can't open database" << std::endl;
//             return 1;
//         }

//         // Register and login user
//         pqxx::work W(C);
//         registerUser(W, "username", "password");
//         W.commit();

//         pqxx::nontransaction N(C);
//         loginUser(N, "username", "password");

//         // Access portfolios
//         int userID = 1; // Assume userID = 1 for demonstration purposes
//         accessPortfolios(N, userID);

//         // Other functionalities like managing stock lists, tracking portfolios, analyzing stocks, etc.

//         C.close();
//         std::cout << "Disconnected from the database" << std::endl;
//     } catch (const std::exception &e) {
//         std::cerr << e.what() << std::endl;
//         return 1;
//     }

//     return 0;
// }
