var Datastore = require("nedb");

module.exports = function DB() {
  var dbHandle = null;
  return {
    getStore(fileName) {
      if (dbHandle === null) {
        dbHandle = new Datastore({
          filename: fileName || "emailstore",
          autoload: true
        });
      }
      return dbHandle;
    },

    insertEmail(doc) {
      if (dbHandle !== null) {
        return dbHandle.insert(doc);
      }
      return null;
    },

    findEmail(predicate) {
      console.log(predicate);
      return dbHandle.find(predicate);
    },

    getInbox() {
      return dbHandle.find({});
    }
  };
};
