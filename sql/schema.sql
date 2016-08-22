DROP SCHEMA PUBLIC CASCADE;


CREATE SCHEMA PUBLIC;

 ------------------------------------------------------------
------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('ADMIN', 'MOD', 'MEMBER', 'BANNED');


CREATE TABLE users (id serial PRIMARY KEY, uname text NOT NULL, ROLE user_role NOT NULL DEFAULT 'MEMBER', digest text NOT NULL, email text NULL, img text NULL, last_online_at timestamptz NOT NULL DEFAULT NOW(), created_at timestamptz NOT NULL DEFAULT NOW());

 -- Ensure unames are unique and speed up lower(uname) lookup

CREATE UNIQUE INDEX unique_uname ON users (lower(uname));

 -- Speed up lower(email) lookup

CREATE INDEX lower_email ON users (lower(email));

 ------------------------------------------------------------
------------------------------------------------------------

CREATE TABLE sessions (id uuid PRIMARY KEY, user_id int NOT NULL REFERENCES users(id), ip_address inet NOT NULL, user_agent text NULL, logged_out_at timestamptz NULL, expired_at timestamptz NOT NULL DEFAULT NOW() + INTERVAL '2 weeks', created_at timestamptz NOT NULL DEFAULT NOW());

 -- Speed up user_id FK joins

CREATE INDEX sessions__user_id ON sessions (user_id);


CREATE VIEW active_sessions AS
SELECT *
FROM sessions
WHERE expired_at > NOW()
    AND logged_out_at IS NULL ;

 ------------------------------------------------------------
------------------------------------------------------------

CREATE TABLE messages (id serial PRIMARY KEY, -- if null, then user is anonymous
 user_id int NULL REFERENCES users(id), markup text NOT NULL, is_hidden boolean NOT NULL DEFAULT FALSE, ip_address inet NOT NULL, user_agent text NULL, created_at timestamptz NOT NULL DEFAULT NOW());

 -- Speed up user_id FK joins

CREATE INDEX messages__user_id ON messages (user_id);

 ------------------------------------------------------------
------------------------------------------------------------

CREATE TABLE posts (id serial PRIMARY KEY, uid text NOT NULL, -- if null, then user is anonymous
 user_id int NULL REFERENCES users(id),
 host text NOT NULL DEFAULT '',
 title text NOT NULL DEFAULT '',
 content text NOT NULL DEFAULT '',
 shortlink text NOT NULL DEFAULT '',
 click int NOT NULL DEFAULT 0,
 view int NOT NULL DEFAULT 0,
 click_via_short_link int NOT NULL DEFAULT 0,
 vote int NOT NULL DEFAULT 0,
 type int NOT NULL DEFAULT 0,
 reshared int NOT NULL DEFAULT 0, --only for URL
 is_private boolean NOT NULL DEFAULT FALSE,
 ip_address inet NOT NULL,
 user_agent text NULL,
 created timestamptz NOT NULL DEFAULT NOW(),
 is_deleted boolean NOT NULL DEFAULT FALSE,
 deleted timestamptz NULL);

 -- Speed up user_id FK joins

CREATE INDEX urls__user_id ON posts (user_id);

 ------------------------------------------------------------
------------------------------------------------------------

CREATE TABLE post_meta (id serial PRIMARY KEY, post_id int NULL REFERENCES posts(id), KEY text NOT NULL, value text NOT NULL DEFAULT '');

 -- Speed up user_id FK joins

CREATE INDEX post_meta__post_id ON post_meta (post_id);

 ------------------------------------------------------------
------------------------------------------------------------

CREATE OR REPLACE FUNCTION ip_root(ip_address inet) RETURNS inet AS $$ DECLARE masklen int; BEGIN masklen := CASE family(ip_address)
                                                                                                                 WHEN 4 THEN 24
                                                                                                                 ELSE 48
                                                                                                             END; RETURN HOST(network(set_masklen(ip_address, masklen))); END; $$ LANGUAGE plpgsql IMMUTABLE;


CREATE TABLE ratelimits (id bigserial PRIMARY KEY, ip_address inet NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW());


CREATE INDEX ratelimits__ip_root ON ratelimits (ip_root(ip_address));
