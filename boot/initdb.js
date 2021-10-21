var db = require('../db/authdb');

module.exports = function() {
  db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS users ( \
      id INTEGER PRIMARY KEY AUTOINCREMENT, \
      username TEXT UNIQUE, \
      hashed_password BLOB, \
      salt BLOB, \
      name TEXT, \
      accessToken TEXT \
    )");
  });
};