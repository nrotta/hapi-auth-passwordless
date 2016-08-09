'use strict';


// Load modules

const Hapi = require('hapi');
const Path = require('path');


const tokens = {};

const users = {
    'nicolasrotta@gmail.com': {
        name: 'Nicolas Rotta'
    }
};


const server = new Hapi.Server();
server.connection({
    port: 8080
});


server.register([require('vision'), require('hapi-auth-cookie'), require('../lib')], (err) => {

    if (err) {
        throw err;
    }

    server.views({
        engines: {
            hbs: require('handlebars')
        },
        path: Path.join(__dirname, 'templates'),
        layout: true
    });

    server.auth.strategy('session', 'cookie', {
        password: 'MyCookiePasswordMustBeReallyLong',
        redirectTo: '/login',
        isSecure: false
    });

    server.auth.strategy('hapi-auth-passwordless', 'hapi-auth-passwordless', {
        requestTokenFunc: (request, reply, token) => {

            // store token-to-email mapping on the server for future reference
            // a good option is to use redis with a small expiration
            // using local memory for quick example
            tokens[token] = request.payload.email;

            // send link by email
            // here showing in console for quick example
            console.log(`http://localhost:8080/token/${token}`);

            return reply.view('login', { message: 'Your temporary password was emailed to you' } );
        },
        validateTokenFunc: (request, token, next) => {

            // get email mapped to token and then use to locate user
            const email = tokens[token];
            const user = users[email];

            // in real apps, user lookup could fail; in that case return next(err);

            if (user) {
                return next(null, true, { user: user });
            }

            return next(null, false);
        }
    });

    server.route([{
        method: 'GET',
        path: '/',
        config: {
            auth: 'session',
            handler: {
                view: 'index'
            }
        }
    }, {
        method: 'GET',
        path: '/login',
        handler: {
            view: 'login'
        }
    }, {
        method: 'GET',
        path: '/token/{token}',
        config: {
            auth: 'hapi-auth-passwordless',
            handler: (request, reply) => {
                // user is authenticated; create session for user and redirect
                request.cookieAuth.set(request.auth.credentials);
                return reply.redirect('/');
            }
        }
    }]);

    server.start(() => {

        console.info(`Server running at: ${server.info.uri}`);
    });
});
