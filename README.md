# koa-skeleton



## Setup

You must have Postgres installed. https://www.linode.com/docs/databases/postgresql/use-postgresql-relational-databases-on-ubuntu-16-04

    createdb koa-skeleton
    git clone git@github.com:danneu/koa-skeleton.git
    cd koa-skeleton
    touch .env
    npm install
    npm run reset-db
    npm run start-dev

    > Server is listening on http://localhost:3000...

Create a `.env` file in the root directory which will let you set environment variables. `npm run start-dev` will read from it.

Example `.env`:

    DATABASE_URL=postgres://username:password@localhost:5432/my-database
    DEBUG=app:*
    RECAPTCHA_SITEKEY=''
    RECAPTCHA_SITESECRET=''

## Configuration (Environment Variables)

koa-skeleton is configured with environment variables.

You can set these by putting them in a `.env` file at the project root (good
for development) or by exporting them in the environment (good for production,
like on Heroku).

You can look at `app/config.js` to view these and their defaults.

| Evironment Variable | Type | Default | Description |
| --- | --- | --- | --- |
| <code>NODE_ENV</code> | String | "development" | Set to `"production"` on the production server to enable some optimizations and security checks that are turned off in development for convenience. |
| <code>PORT</code> | Integer | 3000 | Overriden by Heroku in production. |
| <code>DATABASE_URL</code> | String | "postgres://localhost:5432/koa-skeleton" | Overriden by Heroku in production if you use its Heroku Postgres addon. |
| <code>TRUST_PROXY</code> | Boolean | false | Set it to the string `"true"` to turn it on. Turn it on if you're behind a proxy like Cloudflare which means you can trust the IP address supplied in the `X-Forwarded-For` header. If so, then `this.request.ip` will use that header if it's set. |
| <code>HOSTNAME</code> | String | undefined | Set it to your hostname in production to enable basic CSRF protection. i.e. `example.com`, `subdomain.example.com`. If set, then any requests not one of `GET | HEAD | OPTIONS` must have a `Referer` header set that originates from the given HOSTNAME. The referer is always set for `<form>` submissions, for example. Very crude protection. |
| <code>RECAPTCHA_SITEKEY</code> | String | undefined | Must be set to enable the Recaptcha system. <https://www.google.com/recaptcha> |
| <code>RECAPTCHA_SITESECRET</code> | String | undefined | Must be set to enable the Recaptcha system. <https://www.google.com/recaptcha> |
| <code>MESSAGES_PER_PAGE</code> | Integer | 10 | Determines how many messages to show per page when viewing paginated lists |
| <code>USERS_PER_PAGE</code> | Integer | 10 | Determines how many users to show per page when viewing paginated lists |

Don't access `process.env.*` directly in the app.
Instead, require the `app/config.js` and access them there.


