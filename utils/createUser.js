var crypto = require('crypto');
var db = require('../db/authdb');
const readline = require("readline");

var salt = crypto.randomBytes(16);

var username = null;
var password = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Read Username and password from console
rl.question(`Enter the user name: `, function(name) {
  username = name;
  rl.question(`Enter the password: `, function(password) {    
    rl.close();
    crypto.pbkdf2(password, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      if (err) { console.log(err) };
      db.run('INSERT INTO users (username, hashed_password, salt, name) VALUES (?, ?, ?, ?)', [
        username,
        hashedPassword,
        salt,
        "webuser"
      ], function(err) {
        if (err) { 
          console.log(err) 
        }
        else {
          console.log("User is created");
        }
      });
    });
  });
});


