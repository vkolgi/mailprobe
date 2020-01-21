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
dbHandle = db.getStore();

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
    console.log(address, session);
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
  db.findEmail(req.query).exec((error, docs) => {
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

//// error handler
//app.use(function(err, req, res, next) {
//// set locals, only providing error in development
//res.locals.message = err.message;
//res.locals.error = req.app.get("env") === "development" ? err : {};

//// render the error page
//res.status(err.status || 500);
//res.json({ name: "Eror", error: err.message });
//});

module.exports = app;
