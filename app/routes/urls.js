'use strict';

// 3rd
const Router = require('koa-router');
const debug = require('debug')('app:routes:urls');
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

// Create url
router.post('/urls', mw.ratelimit(), mw.ensureRecaptcha, function * () {
  // AUTHZ
  this.assertAuthorized(this.currUser, 'CREATE_URL');
  // VALIDATE
  var $errURL = 'Must provide a url';
  this.validateBody('url')
    .required($errURL)
    .isString()
    .trim()
    .check(urlRegex({exact: true}).test(this.request.body.url), $errURL);

	const metadata = yield Metascraper.scrapeUrl(this.vals.url);
  // SAVE
  yield db.insertURL({
    user_id: this.currUser && this.currUser.id,
    uid: uuid.v4(),
    url: this.vals.url,
    shortlink: shortid.generate(),	
    ip_address: this.request.ip,
    user_agent: this.headers['user-agent'],
  	host: url.parse(this.vals.url).hostname,
  	title: (metadata.title === null) ? '' : metadata.title,
  	url_author: (metadata.author === null) ? '' : metadata.author,
  	url_date: (metadata.date === null) ? null : metadata.date,
  	url_description: (metadata.description === null) ? '' : metadata.description,
  	url_image: (metadata.image === null) ? '' : metadata.image,
  	url_publisher: (metadata.publisher === null) ? '' : metadata.publisher,
  	text: (metadata.description === null) ? '' : metadata.description,
  	is_private: false,
  });
  // RESPOND
  this.flash = { message: ['success', 'URL Created!'] };
  this.redirect('/');
});


//-------------------------------------------------------------//

module.exports = router;