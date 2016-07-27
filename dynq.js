/**
 * Copyright © 2016 STRG.AT GmbH, Vienna, Austria
 *
 * This file is part of the The SCORE Framework.
 *
 * The SCORE Framework and all its parts are free software: you can redistribute
 * them and/or modify them under the terms of the GNU Lesser General Public
 * License version 3 as published by the Free Software Foundation which is in the
 * file named COPYING.LESSER.txt.
 *
 * The SCORE Framework and all its parts are distributed without any WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. For more details see the GNU Lesser General Public
 * License.
 *
 * If you have not received a copy of the GNU Lesser General Public License see
 * http://www.gnu.org/licenses/.
 *
 * The License-Agreement realised between you as Licensee and STRG.AT GmbH as
 * Licenser including the issue of its valid conclusion and its pre- and
 * post-contractual effects is governed by the laws of Austria. Any disputes
 * concerning this License-Agreement including the issue of its valid conclusion
 * and its pre- and post-contractual effects are exclusively decided by the
 * competent court, in whose district STRG.AT GmbH has its registered seat, at
 * the discretion of STRG.AT GmbH also the competent court, in whose district the
 * Licensee has his registered seat, an establishment or assets.
 */

// Universal Module Loader
// https://github.com/umdjs/umd
// https://github.com/umdjs/umd/blob/v1.0.0/returnExports.js
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['blubird', 'score.init', 'score.oop'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('bluebird'), require('score.init'), require('score.oop'));
    } else {
        // Browser globals (root is window)
        factory(Promise, root.score);
    }
}(this, function(BPromise, score) {

    score.extend('dynq', ['oop'], function() {

        var Query = score.oop.Class({
            __name__: 'Query',

            __events__: ['result-invalidated', 'result-updated'],

            __init__: function(self, source, query, autoupdate) {
                self.source = source;
                self.query = query;
                self.autoupdate = autoupdate;
                self.mtime = 0;
                self.isUpToDate = false;
                self.currentItems = null;
            },

            _resultChanged: function(self, result) {
                if (typeof result !== 'object') {
                    self.isUpToDate = false;
                    self.trigger('result-invalidated');
                    return;
                }
                // make sure we fire the `result-invalidated` event first
                self._resultChanged();
                self.mtime = result.mtime;
                self.isUpToDate = true;
                var oldItems = self.currentItems;
                self.currentItems = result.items;
                self.trigger('result-updated', result, oldItems);
            },

            loadItems: function(self) {
                if (self.isUpToDate) {
                    return BPromise.resolve(self.currentItems);
                }
                var promise = new BPromise(function(resolve, reject) {
                    var callback = function(oldItems, newItems) {
                        self.off('result-updated', callback);
                        resolve(newItems);
                    };
                    self.on('result-updated', callback);
                });
                self.source.loadResult(self);
                return promise;
            },

            close: function(self) {
                self.source._closeQuery(self);
            }

        });

        var DataSource = score.oop.Class({
            __name__: 'DataSource',

            queries: [],

            __init__: function(self, name) {
                self.name = name;
            },

            query: function(self, query, autoupdate) {
                if (typeof autoupdate == 'undefined') {
                    autoupdate = true;
                }
                self.queries.push(new Query(self, query, autoupdate));
            },

            loadResult: function(self, query) {
                throw new Error('Abstract function ' + self.__class__.__name__ + '::loadResult() called');
            },

            _closeQuery: function(self, query) {
                var idx = self.queries.indexOf(query);
                if (idx >= 0) {
                    self.queries.splice(idx, 1);
                }
            }

        });

        var PollingDataSource = score.oop.Class({
            __name__: 'PollingDataSource',

            __static__: {

                POLL_INTERVAL: 60

            },

            _nextPollTime: 0,

            queriesToUpdate: [],

            register: function(self, query, callback) {
                self.__super__(query, callback);
                self._queuePoll(0);
            },

            _closeQuery: function(self, query) {
                self.__super__(query);
                var idx = self.queriesToUpdate.indexOf(query);
                if (idx >= 0) {
                    self.queriesToUpdate.splice(idx, 1);
                }
            },

            loadResult: function(self, query) {
                self.queriesToUpdate.push(query);
                self._queuePoll(0);
            },

            _queuePoll: function(self, timeout) {
                if (typeof timeout == 'undefined') {
                    timeout = self.POLL_INTERVAL;
                }
                timeout *= 1000;
                if (!self._nextPollTime) {
                    self._pollTimeout = window.setTimeout(self.__poll, timeout);
                    self._nextPollTime = new Date().getTime() + timeout;
                } else if (self._nextPollTime > new Date().getTime() + timeout) {
                    window.clearTimeout(self._pollTimeout);
                    self._pollTimeout = window.setTimeout(self.__poll, timeout);
                }
            },

            __poll: function(self) {
                var queries = [];
                var queriesToUpdate = self.queriesToUpdate;
                self.queriesToUpdate = [];
                for (var i = 0; i < self.queries.length; i++) {
                    var query = self.queries[i];
                    if (!query.isUpToDate && queriesToUpdate.indexOf(query) < 0) {
                        // we know the result of this query is not up-to-date,
                        // but we do not need the new result, either.
                        continue;
                    }
                    queries.push(query);
                }
                // FIXME: the next line of code is actually a hack, the right
                //   solution would be to store the poll promise as a member
                //   and prevent polling as long as this variable is set.
                //   otherwise, an immediate poll request while another poll
                //   request is running will be delayed until the next natural
                //   poll time arrives.  no time to implement the right thing
                //   now, though.
                // set _nextPollTime to a very low value to prevent multiple
                // polls running in parallell.
                self._nextPollTime = 1;
                self._poll(queries).then(function(result) {
                    for (var i = 0; i < result.length; i++) {
                        if (!result) {
                            continue;
                        }
                        queries[i]._resultChanged(result[i]);
                    }
                }).finally(function() {
                    self._nextPollTime = new Date().getTime() + self.POLL_INTERVAL * 10000;
                    self._queuePoll();
                });
            },

            _poll: function(self, queries) {
                throw new Error('Abstract function ' + self.__class__.__name__ + '::_poll() called');
            }

        });

        var Module = new score.oop.Class({
            __name__: 'DynqModule',

            sources: [],

            register: function(self, source) {
                self.sources[name] = source.name;
            },

            getDataSource: function(self, name) {
                if (name in self.sources) {
                    return self.sources[name];
                }
                throw new Error('Could not load the data source "' + name + '"');
            },

            query: function(self, sourceName, query, autoupdate) {
                return self.getDataSource(sourceName).query(query, autoupdate);
            }

        });

        var module = new Module();

        module.DataSource = DataSource;

        module.PollingDataSource = PollingDataSource;

        return module;

    });

}));
