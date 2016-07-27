.. image:: https://raw.githubusercontent.com/score-framework/py.doc/master/docs/score-banner.png
    :target: http://score-framework.org

`The SCORE Framework`_ is a collection of harmonized python and javascript
libraries for the development of large scale web projects. Powered by strg.at_.

.. _The SCORE Framework: http://score-framework.org
.. _strg.at: http://strg.at


**********
score.dynq
**********

.. _js_dynq:

A generic library for streaming objects from a remote location. 

This module is a work in progress.

Usually, a web application is merely a UI for a database: each page displays
parts of the data to an end user. If the view on that data needs to be updated
dynamically, you can make use of this module to place a query on a data source
and get notified, whenever the result of your query changes.

Quickstart
==========

Let's assume, we want a facility, that gives the 5 newest comments to an
article in the database. We also want this view to be live, i.e. whenever a new
comment is posted, it should be inserted as the first item, dropping the oldest
of the previous five out of the list::

    # oldest comment        # comment 4
    # comment 4             # comment 3
    # comment 3        =>   # comment 2
    # comment 2             # newest comment
    # newest comment        # newer-than-newest comment

We should first create a DataSource, that will fetch us the comment objects
from the database:

.. code-block:: javascript

    var CommentsList = score.oop.Class({
        __name__: 'CommentsList',
        __parent__: score.dynq.PollingDataSource,

        __init__: function(self, name, articleId) {
            self.__super__(name);
            self.articleId = articleId;
        },

        _poll: function(self, queries) {
            // fetch the results to the given Query objects
            // at this point and return them
        }

    });


You will also need a factory, that can create a CommentsList on demand and
register it with the module:

.. code-block:: javascript

    var CommentsFactory = score.oop.Class({
        __name__: 'CommentsFactory',
        __parent__: score.dynq.Factory,

        regex: /comments-for-article-(\d+)/,

        _create: function(self, name, matches) {
            return new CommentsList(matches[1]);
        }

    });

    score.dynq.registerFactory(new CommentsFactory());

Now you can access data source of this type through the module itself, create
queries and get notified whenever the result changes:

.. code-block:: javascript

    var source = score.dynq.getDataSource('comments-for-article-14')
    var query = source.query('0-5');
    query.on('result-updated', function(result) {
        // result is a list of whatever the CommentsList object returned.
    });


License
=======

Copyright © 2016 STRG.AT GmbH, Vienna, Austria

All files in and beneath this directory are part of The SCORE Framework.
The SCORE Framework and all its parts are free software: you can redistribute
them and/or modify them under the terms of the GNU Lesser General Public
License version 3 as published by the Free Software Foundation which is in the
file named COPYING.LESSER.txt.

The SCORE Framework and all its parts are distributed without any WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. For more details see the GNU Lesser General Public License.

If you have not received a copy of the GNU Lesser General Public License see
http://www.gnu.org/licenses/.

The License-Agreement realised between you as Licensee and STRG.AT GmbH as
Licenser including the issue of its valid conclusion and its pre- and
post-contractual effects is governed by the laws of Austria. Any disputes
concerning this License-Agreement including the issue of its valid conclusion
and its pre- and post-contractual effects are exclusively decided by the
competent court, in whose district STRG.AT GmbH has its registered seat, at the
discretion of STRG.AT GmbH also the competent court, in whose district the
Licensee has his registered seat, an establishment or assets.
