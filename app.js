var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var mailstack = require("./routes/stack.js")();

var usersRouter = require("./routes/users");
var exphbs = require("express-handlebars");

const SMTPServer = require("smtp-server").SMTPServer;
const simpleParser = require("mailparser").simpleParser;

var Datastore = require('nedb');
var db = new Datastore();

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
      console.log(mail);
      mailstack.push(mail);
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

app.use("/mailbox", (req, response) => {
  let itemsList = [];
  console.log(mailstack);
  mailstack.stackArray.forEach(item => {
    itemsList.push(item);
  });
  response.json(itemsList);
});

app.use("/mailbox_fromdb", (req, response) => {
  db.insert(mailstack.stackArray, (err, doc) => {
    console.log({'Inserted':doc});
    response.json({'Inserted':doc});
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
