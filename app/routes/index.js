'use strict';
// 3rd party
const assert = require('better-assert');
const router = require('koa-router')();
const debug = require('debug')('app:routes:index');
const Metascraper = require('metascraper');
const MetaInspector = require('node-metainspector');
const event = require('co-event');

// 1st party
const config = require('../config');
const db = require('../db');
const pre = require('../presenters');
const paginate = require('../paginate');
const cache = require('../cache');

//
// The index.js routes file is mostly a junk drawer for miscellaneous
// routes until it's accumulated enough routes to warrant a new
// routes/*.js module.
//

////////////////////////////////////////////////////////////

// Useful route for quickly testing something in development
// 404s in production
router.get('/test', function*() {
    this.assert((config.NODE_ENV === 'development'), 404);
    const url = 'http://codesamplez.com/programming/using-json-in-node-js-javascript';
    try {
      const metadata = yield Metascraper.scrapeUrl(url);
      this.body = metadata;
     } catch (err) {
       var client = new MetaInspector(url, { timeout: 5000 });

      client.fetch();

          var e;
          while (e = yield event(client)) {
              switch (e.type) {
                  case 'fetch':
                      if (!e.args[0]) return this.body = {};

                      return this.body = {
                          title: e.args[0].title || '',
                          url: e.args[0].url || '',
                          host: e.args[0].host || '',
                          meta: {
                              parsedUrl: e.args[0].parsedUrl || {},
                              author: e.args[0].author || '',
                              keywords: e.args[0].keywords || [],
                              description: e.args[0].description || '',
                              image: e.args[0].image || '',
                              ogTitle: e.args[0].ogTitle || '',
                              ogDescription: e.args[0].ogDescription || '',
                          }
                      };
                      break;

                  case 'error':
                  default:
                      return this.body = {};
                      break;
              }
          }
     }
});

////////////////////////////////////////////////////////////

// Show homepage
router.get('/', function*() {
    this.validateQuery('page')
        .defaultTo(1)
        .toInt();

    const results = yield {
        posts: db.getPosts(this.vals.page),
        count: cache.get('posts-count')
    };
    const posts = yield results.posts.map(pre.presentPost);
    const paginator = paginate.makePaginator(this.vals.page, results.count);
    yield this.render('index', {
        ctx: this,
        recaptchaSitekey: config.RECAPTCHA_SITEKEY,
        appname: config.APP_NAME,
        posts,
        paginator,
        postsCount: results.count,
    });
});

////////////////////////////////////////////////////////////

// Github Hunt
router.get('/github', function*() {
    yield this.render('github', {
        ctx: this,
        title: 'Github Hunt',
        githubAPIKey: config.GITHUB_API_KEY
    });
});

////////////////////////////////////////////////////////////

// Report Bug
router.get('/report', function*() {
    yield this.render('report_bug', {
        ctx: this,
        title: `Report Bug`,
        appname: config.APP_NAME
    });
});

////////////////////////////////////////////////////////////

// Report Blog
router.get('/blog', function*() {
    yield this.render('blog', {
        ctx: this,
        title: `Blog`,
        appname: config.APP_NAME
    });
});

////////////////////////////////////////////////////////////

// Report API
router.get('/api', function*() {
    yield this.render('api', {
        ctx: this,
        title: `API`,
        appname: config.APP_NAME
    });
});

////////////////////////////////////////////////////////////

// Report Support
router.get('/support', function*() {
    yield this.render('support', {
        ctx: this,
        title: `Support`,
        appname: config.APP_NAME
    });
});

////////////////////////////////////////////////////////////

// short link
router.get('/:id', function*(next) {
    const post = yield db.getPostByShortLink(this.params.id);
    if(post != null && post.id != null){
      const postMeta = yield db.getPostMetaByPost(post.id, 'url');
      if (postMeta != null && postMeta.value != null) {
          yield db.updateClickViaShortLink(this.params.id, (post.click_via_short_link + 1));
          this.redirect(postMeta.value);
      }
    }
    this.body = 'Not found.'
});

////////////////////////////////////////////////////////////

module.exports = router;
