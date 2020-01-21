var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var db = require("./db/datastore")();

var usersRouter = require("./routes/users");
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
  res.render("mainlayout");
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

app.use("/users", usersRouter);

app.use("/find", (req, res) => {
  let predicate = Object.assign({}, req.query);

  //delete to and cc as we have to process them separately
  delete predicate["to"];
  delete predicate["cc"];

  if (req.query.cc) {
    predicate["cc.value"] = { $elemMatch: { address: req.query.cc } };
  }
  if (req.query.to) {
    predicate["to.value"] = { $elemMatch: { address: req.query.to } };
  }

  db.findEmail(predicate).exec((error, docs) => {
    res.json(docs);
  });
});

app.use("/mailbox", (req, response) => {
  db.getInbox().exec((error, docs) => {
    response.json(docs);
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

module.exports = app;
