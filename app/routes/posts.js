'use strict';

// 3rd
const Router = require('koa-router');
const debug = require('debug')('app:routes:posts');
const uuid = require('uuid');
const shortid = require('shortid');
const Metascraper = require('metascraper');
const urlRegex = require('url-regex');
const url = require('url');

// 1st
const db = require('../db');
const mw = require('../middleware');
const belt = require('../belt');

// Every route in this router is only accessible to admins
const router = new Router();

//-------------------------------------------------------------//

// Routes

// Create post
router.post('/post', mw.ratelimit(), mw.ensureRecaptcha, function * () {
  // AUTHZ
  this.assertAuthorized(this.currUser, 'CREATE_POST');
  // VALIDATE
  var $errURL = 'Must provide a url';
  this.validateBody('url')
    .required($errURL)
    .isString()
    .trim()
    .check(urlRegex({exact: true}).test(this.request.body.url), $errURL);

	const metadata = yield Metascraper.scrapeUrl(this.vals.url);
  // SAVE Post
  const post = yield db.insertPost({
    user_id: this.currUser && this.currUser.id,
    uid: uuid.v4(),
    shortlink: shortid.generate(),
    ip_address: this.request.ip,
    user_agent: this.headers['user-agent'],
  	host: url.parse(this.vals.url).hostname,
  	title: (metadata.title === null) ? '' : metadata.title,
  	content: (metadata.description === null) ? '' : metadata.description,
  	is_private: false,
  });
  //Save URL user input
  yield db.insertPostMeta(post.id, 'userURL', this.vals.url);

  //Save metadata
  for(var meta in metadata){
    yield db.insertPostMeta(post.id, meta, (metadata[meta] === null) ? '' : metadata[meta]);
  }

  // RESPOND
  this.flash = { message: ['success', 'URL Created!'] };
  this.redirect('/');
});


//-------------------------------------------------------------//

module.exports = router;
