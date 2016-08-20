'use strict';

// 3rd
const Router = require('koa-router');
const debug = require('debug')('app:routes:messages');

// 1st
const db = require('../db');
const config = require('../config');
const pre = require('../presenters');
const mw = require('../middleware');
const belt = require('../belt');
const paginate = require('../paginate');
const cache = require('../cache');

// Every route in this router is only accessible to admins
const router = new Router();

router.use(function * (next) {
  this.assert(this.currUser && this.currUser.role === 'ADMIN', 404);
  yield * next;
});

// MIDDLEWARE

// expects /:message_id param in url
// sets this.state.message
function loadMessage () {
  return function * (next) {
    this.validateParam('message_id');
    const message = yield db.getMessageById(this.vals.message_id);
    this.assert(message, 404);
    pre.presentMessage(message);
    this.state.message = message;
    yield * next;
  };
}

////////////////////////////////////////////////////////////
// Routes

// Create message
router.post('/messages', mw.ratelimit(), mw.ensureRecaptcha, function * () {
  // AUTHZ
  this.assertAuthorized(this.currUser, 'CREATE_MESSAGE');
  // VALIDATE
  this.validateBody('markup')
    .required('Must provide a message')
    .isString()
    .trim()
    .tap(belt.transformMarkup)
    .isLength(3, 300, 'Message must be 3-300 chars');
  // SAVE
  yield db.insertMessage({
    user_id: this.currUser && this.currUser.id,
    markup: this.vals.markup,
    ip_address: this.request.ip,
    user_agent: this.headers['user-agent']
  });
  // RESPOND
  this.flash = { message: ['success', 'Message created!'] };
  this.redirect('/messages');
});

////////////////////////////////////////////////////////////

// List all messages
router.get('/messages', function * () {
  const messages = yield db.getRecentMessages();
  messages.forEach(pre.presentMessage);
  yield this.render('messages/index', {
    ctx: this,
    messages,
    recaptchaSitekey: config.RECAPTCHA_SITEKEY,
    appname: config.APP_NAME,
    title: `Messages`,
  });
});

////////////////////////////////////////////////////////////

// List all messages
router.get('/messages/list', function * () {
  this.validateQuery('page')
    .defaultTo(1)
    .toInt();
  const results = yield {
    messages: db.getMessages(this.vals.page),
    count: cache.get('messages-count')
  };
  const messages = results.messages.map(pre.presentMessage);
  const paginator = paginate.makePaginator(this.vals.page, results.count);
  yield this.render('messages/list', {
    ctx: this,
    messages,
    paginator,
    messagesCount: results.count,
    title: `All Messages`,
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// Update message
//
// Body:
// - is_hidden: Optional String of 'true' | 'false'
// - markup: Optional String
// - redirectTo: Optional String
router.put('/messages/:message_id', loadMessage(), function * () {
  const message = this.state.message;
  // AUTHZ: Ensure user is authorized to make *any* update to message
  this.assertAuthorized(this.currUser, 'UPDATE_MESSAGE', message);
  if (this.request.body.is_hidden) {
    this.assertAuthorized(this.currUser, 'UPDATE_MESSAGE_STATE', message);
    this.validateBody('is_hidden')
      .isString()
      .tap(belt.parseBoolean);
  }
  if (this.request.body.markup) {
    this.assertAuthorized(this.currUser, 'UPDATE_MESSAGE_MARKUP', message);
    // FIXME: Extract markup validation into its own .isValidMarkup validator
    // and then reuse this here and in the insert-message route
    this.validateBody('markup')
      .isString()
      .trim()
      .tap(belt.transformMarkup)
      .isLength(3, 300, 'Message must be 3-300 chars');
  }
  this.validateBody('redirectTo')
    .defaultTo('/')
    .isString()
    .checkPred(s => s.startsWith('/'));
  // UPDATE
  yield db.updateMessage(message.id, {
    is_hidden: this.vals.is_hidden,
    markup: this.vals.markup
  });
  // RESPOND
  this.flash = { message: ['success', 'Message updated'] };
  this.redirect(this.vals.redirectTo);
});

////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////

module.exports = router;
