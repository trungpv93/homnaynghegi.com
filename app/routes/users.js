'use strict';

// 3rd
const Router = require('koa-router');
const debug = require('debug')('app:routes:users');
const bcrypt = require('bcryptjs');
// 1st
const db = require('../db');
const config = require('../config');
const pre = require('../presenters');
const paginate = require('../paginate');
const cache = require('../cache');
const belt = require('../belt');

// Every route in this router is only accessible to admins

const router = new Router();

router.use(function * (next) {
  this.assert(this.currUser && this.currUser.role === 'ADMIN', 404);
  yield * next;
});

// MIDDLEWARE

// expects /:uname param in url
// sets this.state.user
function loadUser () {
  return function * (next) {
    this.validateParam('uname');
    const user = yield db.getUserByUname(this.vals.uname);
    this.assert(user, 404);
    pre.presentUser(user);
    this.state.user = user;
    yield * next;
  };
}


////////////////////////////////////////////////////////////
// Routes

// Update user
//
// Body:
// - email: Optional String
// - role: Optional String
router.put('/users/:uname', loadUser(), function * () {
  const user = this.state.user;
  this.assertAuthorized(this.currUser, 'UPDATE_USER_*', user);
  // VALIDATION
  if (this.request.body.role) {
    this.assertAuthorized(this.currUser, 'UPDATE_USER_ROLE', user);
    this.validateBody('role')
    .isString()
    .isIn(['ADMIN', 'MOD', 'MEMBER', 'BANNED']);

    // UPDATE
    yield db.updateUser(user.id, {
      role: this.vals.role
    });
  }
  if (typeof this.request.body.email !== 'undefined' && typeof this.request.body.currentpassword !== 'undefined') {
    this.assertAuthorized(this.currUser, 'UPDATE_USER_SETTINGS', user);
    this.validateBody('email')
    .isString()
    .trim()
    .isEmail();

    this.validateBody('currentpassword')
    .isString()
    .trim()
    .checkPred(s => s.length > 0, 'Invalid Current Password!');


    this.check(yield belt.checkPassword(this.request.body.currentpassword, user.digest), 'Invalid Current Password!');

    // UPDATE Email
    yield db.updateUser(user.id, {
      email: this.vals.email
    });

    if(this.request.body.password1 !== '' || this.request.body.password2 !== ''){
      this.validateBody('password1')
      .isString('Password is required')
      .checkPred(s => s.length > 0, 'Password is required')
      .isLength(6, 100, 'Password must be 6-100 chars');

      this.validateBody('password2')
      .isString('Password confirmation is required')
      .checkPred(s => s.length > 0, 'Password confirmation is required')
      .eq(this.vals.password1, 'Password must match confirmation');

      const digest = yield belt.hashPassword(this.vals.password1);

      // UPDATE Password
      yield db.updateUser(user.id, {
        digest: digest
      });
    }
  }
  // RESPOND
  this.flash = { message: ['success', 'User updated']};
  this.redirect(`${user.url}/edit`);
});

////////////////////////////////////////////////////////////

// List all users
router.get('/users', function * () {
  this.validateQuery('page')
  .defaultTo(1)
  .toInt();
  const results = yield {
    users: db.getUsers(this.vals.page),
    count: cache.get('users-count')
  };
  const users = results.users.map(pre.presentUser);
  const paginator = paginate.makePaginator(this.vals.page, results.count);
  yield this.render('users/index', {
    ctx: this,
    users,
    paginator,
    usersCount: results.count,
    title: 'All Users',
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// Edit user page
router.get('/users/:uname/edit', loadUser(), function * () {
  const user = this.state.user;
  this.assertAuthorized(this.currUser, 'UPDATE_USER_*', user);
  yield this.render('users/edit', {
    ctx: this,
    user,
    title: `Edit ${user.uname}`,
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// Show user profile
router.get('/users/:uname', loadUser(), function*() {
  const user = this.state.user;
  const messages = yield db.getRecentMessagesForUserId(user.id);
  messages.forEach(pre.presentMessage);
  yield this.render('users/show', {
    ctx: this,
    user,
    messages,
    title: user.uname,
    appname: config.APP_NAME
  });
});

////////////////////////////////////////////////////////////

// Update user role
//
// Body:
// - role: String
router.put('/users/:uname/role', loadUser(), function * () {
  const user = this.state.user;
  // AUTHZ
  this.assertAuthorized(this.currUser, 'UPDATE_USER_ROLE', user);
  // VALIDATE
  this.validateBody('role')
  .required('Must provide a role')
  .isString()
  .trim()
  .checkPred(s => s.length > 0, 'Must provide a role')
  .isIn(['ADMIN', 'MOD', 'MEMBER', 'BANNED'], 'Invalid role');
  this.validateBody('redirectTo')
  .defaultTo('/')
  .isString()
  .checkPred(s => s.startsWith('/'));
  // UPDATE
  yield db.updateUser(user.id, { role: this.vals.role });
  // RESPOND
  this.flash = { message: ['success', 'Role updated'] };
  this.redirect(this.vals.redirectTo);
});


////////////////////////////////////////////////////////////

module.exports = router;
