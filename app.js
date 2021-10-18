var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var passport = require("passport");
var ensureLoggedIn = require("connect-ensure-login").ensureLoggedIn;
var flash = require("connect-flash");
var apiRouter = express.Router();
const { nanoid } = require('nanoid');
const KEYLENGTH = 20;

const expressSession = require('express-session')({
  secret: 'secret',
  resave: false,
  saveUninitialized: false
});

var authRouter = require("./routes/auth")
var db = require("./db/datastore")();

var exphbs = require("express-handlebars");

require('./boot/auth')();
require('./boot/initdb')();

const SMTPServer = require("smtp-server").SMTPServer;
const simpleParser = require("mailparser").simpleParser;
const authdb = require("./db/authdb");
const auth = require("./boot/auth");

var app = express();
// view engine setup
app.engine(
  "hbs",
  exphbs({
    extname: "hbs",
    defaultLayout: "mainlayout",
    layoutsDir: path.join(__dirname, "views"),
  })
);

app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get("/", ensureLoggedIn('/login'), function (req, res) {
  res.render("mainlayout", { layout: false, user: req.user });
});

app.use(function(req, res, next) {
  var msgs = req.session.messages || [];
  res.locals.messages = msgs;
  res.locals.hasMessages = !! msgs.length;
  req.session.messages = [];
  next();
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
    return callback();
  },
  onMailFrom(address, session, cb) {
    cb();
  },
  onData(stream, session, callback) {
    parseEmail(stream).then((mail) => {
      db.insertEmail(mail);
      callback();
    }, callback);
  },
});

function parseEmail(stream) {
  return simpleParser(stream).then((email) => {
    return email;
  });
}

server.listen(25);

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

// Define API middleware 
apiRouter.use(verifyToken);

// API Handlers starts with /api
apiRouter.use("/find", (req, res) => {
  let predicate = buildPredicate(req.query);
  db.findEmail(predicate).exec((error, docs) => {
    res.json(docs);
  });
});

apiRouter.use("/inbox", (req, response) => {
  db.getInbox().exec((error, docs) => {
    response.json(docs);
  });
});

apiRouter.use("/purge", (req, response) => {
  let predicate = buildPredicate(req.query);
  dbHandle.remove(predicate, { multi: true }, (err, numRemoved) => {
    if (!err) {
      response.json({ rows_removed: numRemoved });
    } else {
      response.json({ error: err });
    }
  });
});

//UI Handlers
app.use("/inbox/", ensureLoggedIn('/login'), (req, response) => {
  let predicate = buildPredicate(req.query);
  db.getInbox(predicate).exec((error, docs) => {
    response.render("mailbox", { layout: "mainlayout", docs: docs, user: req.user });
  });
});

app.use("/details/:id", ensureLoggedIn('/login'), (req, response) => {
  db.getInbox().exec((error, docs) => {
    db.findEmail({ _id: req.params.id }).exec((err, result) => {
      if (result[0].html) {
        response.write(result[0].html);
      } else {
        response.write(
          "<html><body>" + result[0].textAsHtml + "</body></html>"
        );
      }
      response.end();
    });
  });
});

app.use("/user/preferences", ensureLoggedIn('/login'), (req, response) => {
  authdb.serialize(function() {
    authdb.get('SELECT * FROM users WHERE id = ?', [ req.user.id ], function(err, row) {
      response.render("preferences", { layout: "mainlayout", user: req.user, accessToken: row.accessToken });
    });
  });
});

app.use("/user/generatetoken", ensureLoggedIn('/login'), (req, response) => {
  var accessToken = nanoid(KEYLENGTH);
  authdb.serialize(() => {
    authdb.run('UPDATE users SET accessToken = ? WHERE id = ?', [
      accessToken,
      req.user.id
    ], function(err) {
      if (err) { console.log(err) };
    });
  });
  response.json({accessToken: accessToken, userId: req.user.id});
});

app.use('/', authRouter);
app.use('/api', apiRouter);

function verifyToken(req, res, next) {
  //If APIs are protected, enable authentication via token
  const bearerHeader = req.headers['authorization'];
  if (typeof bearerHeader !== 'undefined') {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];

    authdb.serialize(function() {
      authdb.get('SELECT * FROM users WHERE accessToken = ?', [ bearerToken ], function(err, row) {
        if (row) {
          req.token = bearerToken;
          next();
        }
        else{
          res.sendStatus(403);
        }
      });
    });
  }
  else {
    res.sendStatus(403);
  }
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

module.exports = app;
