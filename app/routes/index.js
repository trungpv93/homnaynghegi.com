'use strict';
// 3rd party
const assert = require('better-assert');
const router = require('koa-router')();
const debug = require('debug')('app:routes:index');

// 1st party
const config = require('../config');
const db = require('../db');
const pre = require('../presenters');

//
// The index.js routes file is mostly a junk drawer for miscellaneous
// routes until it's accumulated enough routes to warrant a new
// routes/*.js module.
//

////////////////////////////////////////////////////////////

// Useful route for quickly testing something in development
// 404s in production
router.get('/test', function * () {
  this.assert((config.NODE_ENV === 'development'), 404);
  this.body = this.headers['user-agent'];
});

////////////////////////////////////////////////////////////

// Show homepage
router.get('/', function * () {
  const urls = yield db.getRecentURLs();
  yield this.render('index', {
    ctx: this,
    recaptchaSitekey: config.RECAPTCHA_SITEKEY,
    appname: config.APP_NAME,
    urls
  });
});

////////////////////////////////////////////////////////////

// Github Hunt
router.get('/github', function * () {
  yield this.render('github', {
    ctx: this,
    title: 'Github Hunt'
  });
});

////////////////////////////////////////////////////////////

// Report Bug
router.get('/report', function * () {
  yield this.render('report_bug', {
    ctx: this,
    title: `Report Bug`,
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// Report Blog
router.get('/blog', function * () {
  yield this.render('blog', {
    ctx: this,
    title: `Blog`,
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// Report API
router.get('/api', function * () {
  yield this.render('api', {
    ctx: this,
    title: `API`,
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// Report Support
router.get('/support', function * () {
  yield this.render('support', {
    ctx: this,
    title: `Support`,
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// short link
router.get('/:id', function * (next) {
  const url = yield db.getURLByShortLink(this.params.id);
  if(url != null && url.url != null){
    yield db.updateClickViaShortLink(this.params.id, (url.click_via_short_link + 1));
    this.redirect(url.url);
  }
  this.body = 'Not found.'
});

////////////////////////////////////////////////////////////

module.exports = router;
