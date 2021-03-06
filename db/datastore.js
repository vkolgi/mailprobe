var Datastore = require("nedb");

module.exports = function DB() {
  var dbHandle = null;
  return {
    getStore(fileName) {
      if (dbHandle === null) {
        dbHandle = new Datastore({
          filename: fileName || "emailstore",
          autoload: true,
        });
      }
      return dbHandle;
    },

    insertEmail(doc) {
      if (dbHandle !== null) {
        if (!doc.date) {
          doc["date"] = { $$date: Date.now() };
        }
        return dbHandle.insert(doc);
      }
      return null;
    },

    findEmail(predicate) {
      return dbHandle.find(predicate);
    },

    purge(predicate) {
      value = dbHandle.remove(predicate, {});
      return value;
    },

    getInbox(predicate) {
      return dbHandle.find(predicate).sort({ date: -1 });
    },
  };
};
