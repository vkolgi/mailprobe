var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var passport = require("passport");
var ensureLoggedIn = require("connect-ensure-login").ensureLoggedIn;
var flash = require("connect-flash");
var apiRouter = express.Router();
var uiRouter = express.Router();
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
const e = require("connect-flash");
var AUTH_ENABLED = false

authdb.all("SELECT * FROM users", (error, rows) => {
    // If there are users provisioned, then enable authentication.
    AUTH_ENABLED = rows.length > 0 ? true : false;
});

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

function showControls(req) {
  return AUTH_ENABLED ? (req.user ? true: false) : true;
}

//UI Handlers
uiRouter.use(validateLogin("/login"));

uiRouter.get("/", function (req, res) {
  res.render("mainlayout", { layout: false, showControls: showControls(req), user: req.user});
});

uiRouter.use("/inbox/", (req, response) => {
  let predicate = buildPredicate(req.query);
  db.getInbox(predicate).exec((error, docs) => {
    response.render("mailbox", { layout: "mainlayout", docs: docs, showControls: showControls(req), user: req.user });
  });
});

uiRouter.use("/details/:id", (req, response) => {
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

uiRouter.use("/user/preferences", (req, response) => {
  authdb.serialize(function() {
    authdb.get('SELECT * FROM users WHERE id = ?', [ req.user.id ], function(err, row) {
      response.render("preferences", { layout: "mainlayout", user: req.user, accessToken: row.accessToken, showControls: showControls(req) });
    });
  });
});

uiRouter.use("/user/generatetoken", (req, response) => {
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
app.use('/', uiRouter);

function validateLogin(options) {
    if (typeof options == 'string') {
      options = { redirectTo: options }
    }
    options = options || {};
    
    var url = options.redirectTo || '/login';
    var setReturnTo = (options.setReturnTo === undefined) ? true : options.setReturnTo;
    
    return function(req, res, next) {
      if (AUTH_ENABLED) {
        if (!req.isAuthenticated || !req.isAuthenticated()) {
          if (setReturnTo && req.session) {
            req.session.returnTo = req.originalUrl || req.url;
          }
          return res.redirect(url);
        }
        next();
      }
      else{
        next();
      }
    }
}

function verifyToken(req, res, next) {
  if (AUTH_ENABLED) {
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
  else {
    next();
  }
}

module.exports = app;
