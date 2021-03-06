'use strict';

// 3rd party
// Load env vars from .env, always run this early
require('dotenv').config({
    silent: true
});
const koa = require('koa');
const bouncer = require('koa-bouncer');
const nunjucksRender = require('koa-nunjucks-render');
const debug = require('debug')('app:index');
// 1st party
const config = require('./app/config');
const mw = require('./app/middleware');
const belt = require('./app/belt');
const cancan = require('./app/cancan');

////////////////////////////////////////////////////////////

const app = koa();
app.poweredBy = false;
app.proxy = config.TRUST_PROXY;

////////////////////////////////////////////////////////////
// Configure view-layer (nunjucks)
//
// We can override options send directly to nunjucks.
// https://mozilla.github.io/nunjucks/api.html#configure
////////////////////////////////////////////////////////////

const nunjucksOptions = {
    // `yield this.render('show_user')` will assume that a show_user.html exists
    ext: '.html',
    noCache: config.NODE_ENV === 'development',
    // don't throw template errors in development if we try to render
    // a null/undefined like {{ x }}. in theory, setting it to true prevents
    // bugs and forces you to be explicit about {{ x or '' }}, but in reality,
    // often more annoying than it's worth.
    throwOnUndefined: false,
    // globals are bindings we want to expose to all templates
    globals: {
        // let us use `can(USER, ACTION, TARGET)` authorization-checks in templates
        can: cancan.can,
        config
    },
    // filters are functions that we can pipe values to from nunjucks templates.
    // e.g. {{ user.uname | md5 | toAvatarUrl }}
    filters: {
        json: x => JSON.stringify(x, null, '  '),
        formatDate: belt.formatDate,
        nl2br: belt.nl2br,
        md5: belt.md5,
        toAvatarUrl: belt.toAvatarUrl,
        autolink: belt.autolink,
    },
};

////////////////////////////////////////////////////////////
// Middleware
////////////////////////////////////////////////////////////

app.use(mw.ensureReferer());
app.use(require('koa-helmet')());
app.use(require('koa-compress')());
app.use(require('koa-better-static')('./app/public'));
// Don't show logger in test mode
if (config.NODE_ENV !== 'test') {
    app.use(require('koa-logger')());
}
app.use(require('koa-body')({
    multipart: true
}));
app.use(mw.methodOverride()); // Must come after body parser
app.use(mw.removeTrailingSlash());
app.use(mw.wrapCurrUser());
app.use(mw.wrapFlash('flash'));
app.use(bouncer.middleware());
app.use(mw.handleBouncerValidationError()); // Must come after bouncer.middleware()
app.use(nunjucksRender('./app/views', nunjucksOptions));

// Provide a convience function for protecting our routes behind
// our authorization rules. If authorization check fails, 404 response.
//
// Usage:
//
//    router.get('/topics/:id', function*() {
//      const topic = yield db.getTopicById(this.params.id);
//      this.assertAuthorized(this.currUser, 'READ_TOPIC', topic);
//      ...
//    });
app.use(function*(next) {
    this.assertAuthorized = (user, action, target) => {
        const isAuthorized = cancan.can(user, action, target);
        const uname = (user && user.uname) || '<Guest>';
        debug('[assertAuthorized] Can %s %s: %s', uname, action, isAuthorized);
        this.assert(isAuthorized, 404);
    };
    yield * next;
});

////////////////////////////////////////////////////////////
// Routes
////////////////////////////////////////////////////////////

app.use(require('./app/routes/authentication').routes());
app.use(require('./app/routes/admin').routes());
app.use(require('./app/routes/users').routes());
app.use(require('./app/routes/messages').routes());
app.use(require('./app/routes/posts').routes());
app.use(require('./app/routes').routes());

////////////////////////////////////////////////////////////

// If we run this file directly (npm start, npm run start-dev, node src/index.js)
// then start the server. Else, if we require() this file (like from
// our tests), then don't start the server and instead just export the app.
if (require.main === module) {
    app.listen(config.PORT, function() {
        console.log('Listening on port', config.PORT);
    });
} else {
    module.exports = app;
}
