var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var db = require("./db/datastore")();

var exphbs = require("express-handlebars");

const SMTPServer = require("smtp-server").SMTPServer;
const simpleParser = require("mailparser").simpleParser;

var app = express();
// view engine setup
app.engine(
  "hbs",
  exphbs({
    extname: "hbs",
    defaultLayout: "mainlayout",
    layoutsDir: path.join(__dirname, "views")
  })
);

app.get("/", function(req, res) {
  res.render("mainlayout", { layout: false });
});

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Import data store and get handle to db
dbHandle = db.getStore("updated_emailstore");

// create mail server
const server = new SMTPServer({
  authOptional: true,
  allowInsecureAuth: true,
  maxAllowedUnauthenticatedCommands: 1000,
  onConnect(session, callback) {
    console.log("The session is connected");
    return callback();
  },
  onMailFrom(address, session, cb) {
    cb();
  },
  onData(stream, session, callback) {
    parseEmail(stream).then(mail => {
      db.insertEmail(mail);
      callback();
    }, callback);
  }
});

function parseEmail(stream) {
  return simpleParser(stream).then(email => {
    return email;
  });
}

server.listen(465);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function buildPredicate(query) {
  let predicate = Object.assign({}, query);

  //delete to and cc as we have to process them separately
  delete predicate["to"];
  delete predicate["cc"];

  if (query.cc) {
    predicate["cc.value"] = { $elemMatch: { address: query.cc } };
  }
  if (query.to) {
    predicate["to.value"] = { $elemMatch: { address: query.to } };
  }
  return predicate;
}

// API Handlers
app.use("/api/find", (req, res) => {
  let predicate = buildPredicate(req.query);
  db.findEmail(predicate).exec((error, docs) => {
    res.json(docs);
  });
});

app.use("/api/inbox", (req, response) => {
  db.getInbox().exec((error, docs) => {
    response.json(docs);
  });
});

app.use("/api/purge", (req, response) => {
  let predicate = buildPredicate(req.query);
  dbHandle.remove(predicate, { multi: true }, (err, numRemoved) => {
    console.log(numRemoved);
    if (!err) {
      response.json({ rows_removed: numRemoved });
    } else {
      response.json({ error: err });
    }
  });
});

//UI Handlers
app.use("/inbox", (req, response) => {
  db.getInbox().exec((error, docs) => {
    response.render("mailbox", { layout: "mainlayout", docs: docs });
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

module.exports = app;
