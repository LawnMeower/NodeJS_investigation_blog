const express = require('express'),
    path = require('path'),
    passport = require('passport');

require('./config/passport')(passport);

const routes = require('./routes/routes')(passport),
    configAuth = require('./config/auth'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session');

const app = express();

// App configuration
app.set('port', (process.env.PORT || 3000));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// App middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(session({secret: 'keyboard cat', resave: true, saveUninitialized: true, cookie: {}}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/', routes)
// define if we want run unit tests by URL with ?test=1
app.use(function(req, res, next) {
    res.locals.runUnitTests = (req.query.test === '1');
    next();
});

module.exports = app;
