'use strict';

// 3rd
const assert = require('better-assert');
const uuid = require('uuid');
const debug = require('debug')('app:db');
const knex = require('knex')({ client: 'pg' });
// 1st
const belt = require('../belt');
const config = require('../config');
const dbUtil = require('./util');

// This module is for general database queries that haven't
// yet been split off into more specific db submodules.

// RE-EXPORT SUBMODULES

exports.admin = require('./admin');
exports.ratelimits = require('./ratelimits');

// QUERY JUNK DRAWER

// UUID -> User | undefined
//
// Also bumps user's last_online_at column to NOW().
exports.getUserBySessionId = function * (sessionId) {
  assert(belt.isValidUuid(sessionId));
  return yield dbUtil.queryOne(`
    UPDATE users
    SET last_online_at = NOW()
    WHERE id = (
      SELECT u.id
      FROM users u
      WHERE u.id = (
        SELECT s.user_id
        FROM active_sessions s
        WHERE s.id = $1
      )
    )
    RETURNING *
  `, [sessionId]);
};

// Case-insensitive uname lookup
exports.getUserByUname = function * (uname) {
  assert(typeof uname === 'string');
  return yield dbUtil.queryOne(`
    SELECT *
    FROM users
    WHERE lower(uname) = lower($1)
  `, [uname]);
};

////////////////////////////////////////////////////////////

exports.getRecentMessages = function * () {
  return yield dbUtil.queryMany(`
    SELECT
      m.*,
      to_json(u.*) "user"
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.is_hidden = false
    ORDER BY m.id DESC
    LIMIT 25
  `);
};

exports.getRecentMessagesForUserId = function * (userId) {
  assert(Number.isInteger(userId));
  return yield dbUtil.queryMany(`
    SELECT
      m.*,
      to_json(u.*) "user"
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.is_hidden = false
      AND u.id = $1
    ORDER BY m.id DESC
    LIMIT 25
  `, [userId]);
};

exports.getRecentURLs = function * () {
  return yield dbUtil.queryMany(`
    SELECT
      m.*,
      to_json(u.*) "user"
    FROM urls m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.is_deleted = false
    ORDER BY m.id DESC
    LIMIT 25
  `);
};

exports.getRecentURLsForUserId = function * (userId) {
  assert(Number.isInteger(userId));
  return yield dbUtil.queryMany(`
    SELECT
      m.*,
      to_json(u.*) "user"
    FROM urls m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.is_deleted = false
      AND u.id = $1
    ORDER BY m.id DESC
    LIMIT 25
  `, [userId]);
};


////////////////////////////////////////////////////////////

// Returns inserted message
//
// data.user_id is optional int
// data.markup is string
// data.ip_address is string
// data.user_agent is optional string
exports.insertMessage = function * (data) {
  assert(typeof data.markup === 'string');
  assert(typeof data.ip_address === 'string');
  return yield dbUtil.queryOne(`
    INSERT INTO messages (user_id, markup, ip_address, user_agent)
    VALUES ($1, $2, $3::inet, $4)
    RETURNING *
  `, [data.user_id, data.markup, data.ip_address, data.user_agent]);
};

// Returns inserted URL
//
exports.insertURL = function * (data) {
  assert(typeof data.uid === 'string');
  assert(typeof data.url === 'string');
  assert(typeof data.shortlink === 'string');
  assert(typeof data.ip_address === 'string');
  return yield dbUtil.queryOne(`
    INSERT INTO urls (uid, user_id, host, url, title, text, shortlink, 
            ip_address, user_agent, is_private, url_author, url_date, url_description, url_image, url_publisher)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `, [data.uid, data.user_id, data.host, data.url, data.title, data.text, data.shortlink,  
            data.ip_address, data.user_agent, data.is_private, data.url_author, data.url_date, data.url_description, data.url_image, data.url_publisher]);
};

////////////////////////////////////////////////////////////

// Returns created user record
//
// email is optional
exports.insertUser = function * (uname, password, email) {
  assert(typeof uname === 'string');
  assert(typeof password === 'string');
  const digest = yield belt.hashPassword(password);
  return yield dbUtil.queryOne(`
    INSERT INTO users (uname, email, digest)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [uname, email, digest]);
};

// userAgent is optional string
exports.insertSession = function * (userId, ipAddress, userAgent, interval) {
  assert(Number.isInteger(userId));
  assert(typeof ipAddress === 'string');
  assert(typeof interval === 'string');
  return yield dbUtil.queryOne(`
    INSERT INTO sessions (id, user_id, ip_address, user_agent, expired_at)
    VALUES ($1, $2, $3::inet, $4, NOW() + $5::interval)
    RETURNING *
  `, [
    uuid.v4(), userId, ipAddress, userAgent, interval
  ]);
};

exports.logoutSession = function * (userId, sessionId) {
  assert(Number.isInteger(userId));
  assert(typeof sessionId === 'string');
  return yield dbUtil.query(`
    UPDATE sessions
    SET logged_out_at = NOW()
    WHERE user_id = $1
      AND id = $2
  `, [userId, sessionId]);
};

exports.hideMessage = function * (messageId) {
  assert(messageId);
  return yield dbUtil.query(`
    UPDATE messages
    SET is_hidden = true
    WHERE id = $1
  `, [messageId]);
};

exports.hideURL = function * (URLId) {
  assert(URLId);
  return yield dbUtil.query(`
    UPDATE urls
    SET is_deleted = true
    WHERE id = $1
  `, [URLId]);
};

exports.getMessageById = function * (messageId) {
  assert(messageId);
  return yield dbUtil.queryOne(`
    SELECT *
    FROM messages
    WHERE id = $1
  `, [messageId]);
};

exports.getURLById = function * (URLId) {
  assert(URLId);
  return yield dbUtil.queryOne(`
    SELECT *
    FROM urls
    WHERE id = $1
  `, [URLId]);
};

////////////////////////////////////////////////////////////

exports.updateUser = function * (userId, fields) {
  assert(Number.isInteger(userId));
  const WHITELIST = ['email', 'role', 'digest'];
  assert(Object.keys(fields).every((key) => WHITELIST.indexOf(key) > -1));
  const sql = knex('users')
    .where({ id: userId })
    .update(fields)
    .returning('*')
    .toString();
  return yield dbUtil.queryOne(sql);
};

////////////////////////////////////////////////////////////

exports.updateMessage = function * (messageId, fields) {
  assert(Number.isInteger(messageId));
  const WHITELIST = ['is_hidden', 'markup'];
  assert(Object.keys(fields).every((key) => WHITELIST.indexOf(key) > -1));
  const sql = knex('messages')
    .where({ id: messageId })
    .update(fields)
    .returning('*')
    .toString();
  return yield dbUtil.queryOne(sql);
};

exports.updateURL = function * (URLId, fields) {
  assert(Number.isInteger(URLId));
  const WHITELIST = ['is_deleted', 'url'];
  assert(Object.keys(fields).every((key) => WHITELIST.indexOf(key) > -1));
  const sql = knex('urls')
    .where({ id: URLId })
    .update(fields)
    .returning('*')
    .toString();
  return yield dbUtil.queryOne(sql);
};

////////////////////////////////////////////////////////////

exports.getMessages = function * (page) {
  page = page || 1;
  assert(Number.isInteger(page));
  const perPage = config.URLS_PER_PAGE;
  const offset = (page - 1) * perPage;
  const limit = perPage;
  return yield dbUtil.queryMany(`
    SELECT
      m.*,
      to_json(u.*) AS "user"
    FROM messages m
    LEFT OUTER JOIN users u ON m.user_id = u.id
    ORDER BY m.id DESC
    OFFSET $1
    LIMIT $2
  `, [offset, limit]);
};

exports.getURLs = function * (page) {
  page = page || 1;
  assert(Number.isInteger(page));
  const perPage = config.MESSAGES_PER_PAGE;
  const offset = (page - 1) * perPage;
  const limit = perPage;
  return yield dbUtil.queryMany(`
    SELECT
      m.*,
      to_json(u.*) AS "user"
    FROM urls m
    LEFT OUTER JOIN users u ON m.user_id = u.id
    ORDER BY m.id DESC
    OFFSET $1
    LIMIT $2
  `, [offset, limit]);
};

////////////////////////////////////////////////////////////

// Returns Int
exports.getMessagesCount = function * () {
  const row = yield dbUtil.queryOne(`
    SELECT COUNT(*) AS "count"
    FROM messages
    WHERE is_hidden = false
  `);
  return row.count;
};

// Returns Int
exports.getURLsCount = function * () {
  const row = yield dbUtil.queryOne(`
    SELECT COUNT(*) AS "count"
    FROM urls
    WHERE is_deleted = false
  `);
  return row.count;
};

////////////////////////////////////////////////////////////

// Returns Int
exports.getUsersCount = function * () {
  const row = yield dbUtil.queryOne(`
    SELECT COUNT(*) AS "count"
    FROM users
  `);
  return row.count;
};

////////////////////////////////////////////////////////////

// TODO: user.messages_count counter cache
// TODO: idx for is_hidden
exports.getUsers = function * (page) {
  page = page || 1;
  assert(Number.isInteger(page));
  const perPage = config.USERS_PER_PAGE;
  const offset = (page - 1) * perPage;
  const limit = perPage;
  return yield dbUtil.queryMany(`
    SELECT
      u.*,
      (
        SELECT COUNT(*)
        FROM messages
        WHERE user_id = u.id AND is_hidden = false
      ) AS messages_count
    FROM users u
    ORDER BY u.id DESC
    OFFSET $1
    LIMIT $2
  `, [offset, limit]);
};

////////////////////////////////////////////////////////////

//get URL by Short Link
exports.getURLByShortLink = function * (shortlink) {
  assert(typeof shortlink === 'string');
  return yield dbUtil.queryOne(`
    SELECT *
    FROM urls
    WHERE shortlink = $1
  `, [shortlink]);
};

////////////////////////////////////////////////////////////

//Update count click_via_short_link
exports.updateClickViaShortLink = function * (shortlink, count) {
  assert(typeof shortlink === 'string');
  yield dbUtil.queryOne(`
    UPDATE urls 
    SET click_via_short_link = $2
    WHERE shortlink = $1
  `, [shortlink, count]);
};

////////////////////////////////////////////////////////////