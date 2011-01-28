/**
 * Server-side Backbone implementation for TileMill. This module should be
 * required instead of directly requiring Backbone.
 */
var _ = require('underscore')._,
    Backbone = require('../modules/backbone/backbone.js'),
    settings = require('settings'),
    rmrf = require('rm-rf'),
    fs = require('fs'),
    Step = require('step'),
    path = require('path'),
    cradle = require('cradle');

var connection = new(cradle.Connection)();
var db = connection.database(settings.couch_database);

var designDoc = {
    "types": {
        "map": "function(doc) {\n  if (doc.type) {\n    emit(doc.type, doc);\n  }\n}"
    }
}

db.exists(function(err, res) {
    if (!res) {
        db.create(function(err, res) {
            db.save('_design/types', designDoc);
        })
    }
});

/**
 * Override Backbone.sync() for the server-side context. Uses TileMill-specific
 * file storage methods for model CRUD operations.
 */
Backbone.sync = function(method, model, success, error) {
    switch (method) {
    case 'read':
        if (model.id) {
            load(model, function(err, model) {
                return err ? error(err) : success(model);
            });
        } else {
            loadAll(model, function(err, model) {
                return err ? error(err) : success(model);
            });
        }
        break;
    case 'create':
        create(model, function(err, model) {
            return err ? error(err) : success(model);
        });
        break;
    case 'update':
        update(model, function(err, model) {
            return err ? error(err) : success(model);
        });
        break;
    case 'delete':
        destroy(model, function(err, model) {
            return err ? error(err) : success(model);
        });
        break;
    }
};

/**
 * Load a single model. Requires that model.id be populated.
 */
function load(model, callback) {
    db.get(model.type + '-' + model.id, function(err, data) {
        if (err || !data) {
            return callback(new Error('Error reading model file.'));
        }
        callback(err, data);
    });
};

/**
 * Load an array of all models.
 */
function loadAll(model, callback) {
    db.view('types/types', {startkey: model.type, endkey: model.type}, function(err, data) {
        if (err) {
            return callback(new Error('Error reading models.'));
        }
        callback(null, _.pluck(data, 'value'));
    })
};

/**
 * Create a new model.
 * @TODO assign a model id if not present.
 */
function create(model, callback) {
    save(model, callback);
};

/**
 * Update an existing model.
 */
function update(model, callback) {
    save(model, callback);
};

/**
 * Destroy (delete, remove, etc.) a model.
 */
function destroy(model, callback) {
    load(model, function(err, oldModel) {
        db.remove(model.type + '-' + model.id, oldModel._rev, function(err) {
            if (err) {
                return callback(new Error('Error deleting model.'));
            }
            callback(null, model);
        });
    });
};

/**
 * Save a model. Called by create/update.
 */
function save(model, callback) {
    load(model, function(err, oldModel) {
        var doc = _.extend({type: model.type}, model.attributes);
        if (oldModel) {
            doc = _.extend(doc, {_rev: oldModel._rev});
        }
        db.save(model.type + '-' + model.id, doc, function(err, data) {
            callback(err, model);
        });
    });
}

module.exports = Backbone;

