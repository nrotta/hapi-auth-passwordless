'use strict';


// Load modules

const Boom = require('boom');
const Hoek = require('hoek');
const Joi = require('joi');
const Cryptiles = require('cryptiles');


// Declare internals

const internals = {};


exports.register = (server, options, next) => {

    server.auth.scheme('hapi-auth-passwordless', internals.implementation);
    next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};


internals.schema = Joi.object({
    requestTokenFunc: Joi.func(),
    requestTokenPath: Joi.string().default('/requesttoken'),
    validateTokenFunc: Joi.func(),
    tokenLenght: Joi.number().default(64)
}).required();


internals.implementation = (server, options) => {

    const results = Joi.validate(options, internals.schema);
    Hoek.assert(!results.error, results.error);

    const settings = results.value;

    const requestTokenHandler = (request, reply) => {

        const token = Cryptiles.randomString(results.value.tokenLenght);
        settings.requestTokenFunc(request, reply, token);
    };

    server.route({
        method: 'POST',
        path: settings.requestTokenPath,
        config: {
            auth: false,
            validate: {
                payload: {
                    email: Joi.string().email().required()
                }
            }
        },
        handler: requestTokenHandler
    });

    const scheme = {
        authenticate: (request, reply) => {

            settings.validateTokenFunc(request, request.params.token, (err, isValid, credentials) => {

                if (err) {

                    return reply(Boom.unauthorized('Unkown error'), 'hapi-auth-passwordless');
                }

                if (!isValid) {

                    return reply(Boom.unauthorized('Invalid or expired token'), 'hapi-auth-passwordless', { credentials: credentials });
                }

                return reply.continue({ credentials: credentials });
            });
        }
    };

    return scheme;
};
