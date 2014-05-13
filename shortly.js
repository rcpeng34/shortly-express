var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var sqlite3 = require('sqlite3');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var SQLiteStore = require('connect-sqlite3')(express);

var app = express();
app.use(cookieParser());




app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.json());
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
  app.use(cookieParser());
  app.use(session({
    secret: 'itsasecret',
    key: 'sid',
    store: new SQLiteStore,
    cookie: {
      maxAge: 60000
    }
  }));
});

// app.get('/', function(req, res) {
//   res.render('index');
// });

app.get('/', function(req, res){
  res.render('login');
});

app.get('/create', function(req, res) {
  res.render('index');
});

app.get('/links', function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/signup', function(req, res){
  var user = req.body.username;
  var pass = req.body.password;
  console.log('session loggin', req.session);
  db.knex('users').where('username','=',user)
  .then(function(resp){
    console.log(resp, 'resp');
    if (resp.length) { // length >0 implies user eixsts
      res.render('userexists');
    } else {
      console.log('user does not exist');
      db.knex('users').insert({
        username: user,
        password: pass,
        updated_at: new Date().getTime(),
        created_at: new Date().getTime()
      })
      .then(function(){
        res.render('login');
        console.log('successful insert');
      });
    }
  });
});

app.post('/login', function(req, res){
  var user = req.body.username;
  var pass = req.body.password;
  // console.log('login post req', req.session);
  // console.log('login cookie', req.cookie);
  db.knex('users').where('username', '=', user)
  .then(function(resp){
    if(!resp.length || resp[0].password !== pass){
    // if resp length = 0, username doesn't exist
      res.render('loginfail');
    } else if (resp[0].password === pass) {
      res.cookie('sessionID', 'trolololololo');
      res.cookie('sid', 'resetSIDviahack');
      // console.log(typeof res.cookie());
      // console.log('keys', Object.keys(res.cookie()));
      console.log('res cookie', res.cookie().req.sessionID);
      res.render('index');
    }
  });
});


app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  console.log(req.url);
  console.log('req cookies|', req.cookies);
  console.log('req cookie|', req.sessionID);
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
