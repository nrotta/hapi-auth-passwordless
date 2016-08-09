'use strict';


// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');


// Declare internals

const internals = {};

internals.tokens = {};

internals.users = {
    'nicolasrotta@gmail.com': {
        name: 'Nicolas Rotta'
    }
};

internals.routes = {
    method: 'GET',
    path: '/token/{token}',
    config: {
        auth: 'hapi-auth-passwordless',
        handler: (request, reply) => {

            reply('ok');
        }
    }
};

// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;
const before = lab.before;


describe('scheme', () => {

    it('fails with no plugin options', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.register(require('../lib'), (err) => {

            expect(err).to.not.exist();

            expect(() => {

                server.auth.strategy('hapi-auth-passwordless', 'hapi-auth-passwordless');
            }).to.throw(Error);

            done();
        });
    });

    it('fails if requestTokenFunc and validateTokenFunc are not a functions', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.register(require('../lib'), (err) => {

            expect(err).to.not.exist();

            expect(() => {

                server.auth.strategy('hapi-auth-passwordless', 'hapi-auth-passwordless', { requestTokenFunc: 'not a func', validateTokenFunc: 'not a func' });
            }).to.throw(Error);

            done();
        });
    });

    it('works with the required options configured', (done) => {

        const dummyFunc = () => { };

        const server = new Hapi.Server();
        server.connection();
        server.register(require('../lib'), (err) => {

            expect(err).to.not.exist();

            expect(() => {

                server.auth.strategy('hapi-auth-passwordless', 'hapi-auth-passwordless', { requestTokenFunc: dummyFunc, validateTokenFunc: dummyFunc });
            }).to.not.throw();

            done();
        });
    });
});


describe('implementation', () => {

    let server;

    before((done) => {

        server = new Hapi.Server();
        server.connection();

        server.register(require('../lib'), (err) => {

            expect(err).to.not.exist();

            server.auth.strategy('hapi-auth-passwordless', 'hapi-auth-passwordless', {
                requestTokenFunc: (request, reply, token) => {

                    internals.tokens[token] = request.payload.email;
                    reply('login');
                },
                validateTokenFunc: (request, token, next) => {

                    const email = internals.tokens[token];
                    const user = internals.users[email];

                    if (user) {
                        return next(null, true, { user: user });
                    }

                    // emulates an error being thrown by the user lookup function
                    if (token === 'mustthrow') {
                        return next(true);
                    }

                    return next(null, false);
                }
            });

            server.route(internals.routes);

            done();
        });
    });

    it('requests the token with a valid email', (done) => {

        const email = Object.keys(internals.users)[0];

        server.inject({ method: 'POST', url: '/requesttoken', payload: { email: email } }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('login');
            done();
        });
    });

    it('fails when requesting the token with an invalid email', (done) => {

        const email = 'invalid.email';

        server.inject({ method: 'POST', url: '/requesttoken', payload: { email: email } }, (res) => {

            expect(res.statusCode).to.equal(400);
            done();
        });
    });

    it('verifies the token successfully', (done) => {

        const token = Object.keys(internals.tokens)[0];

        server.inject({ method: 'GET', url: `/token/${token}` }, (res) => {

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal('ok');
            done();
        });
    });

    it('fails verification with an incorrect token', (done) => {

        const token = 'incorrecttoken';

        server.inject({ method: 'GET', url: `/token/${token}` }, (res) => {

            expect(res.statusCode).to.equal(401);
            expect(res.result.message).to.equal('Invalid or expired token');
            done();
        });
    });

    it('fails verification when looking for the token throws', (done) => {

        const token = 'mustthrow';

        server.inject({ method: 'GET', url: `/token/${token}` }, (res) => {

            expect(res.statusCode).to.equal(401);
            expect(res.result.message).to.equal('Unkown error');
            done();
        });
    });
});
