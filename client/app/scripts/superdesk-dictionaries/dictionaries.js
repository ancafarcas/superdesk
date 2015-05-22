/**
 * This file is part of Superdesk.
 *
 * Copyright 2013, 2014 Sourcefabric z.u. and contributors.
 *
 * For the full copyright and license information, please see the
 * AUTHORS and LICENSE files distributed with this source code, or
 * at https://www.sourcefabric.org/superdesk/license
 */

(function() {
    'use strict';

    DictionaryService.$inject = ['api', 'urls', '$upload'];
    function DictionaryService(api, urls, $upload) {
        this.dictionaries = null;
        this.currDictionary = null;

        this.fetch = function fetch(success, error) {
            return api.dictionaries.query({projection: {content: 0}}).then(success, error);
        };

        this.open = function open(dictionary, success, error) {
            return api.find('dictionaries', dictionary._id).then(success, error);
        };

        this.upload = function create(dictionary, data, file, success, error, progress) {
            var hasId = _.has(dictionary, '_id') && dictionary._id !== null;
            var method = hasId ? 'PATCH' : 'POST';
            var headers = hasId ? {'If-Match': dictionary._etag} : {};
            var sendData = {};

            // pick own properties
            angular.forEach(data, function(val, key) {
                if (key !== 'content') {
                    sendData[key] = val;
                }
            });

            // send content as content_list which will accept string and will json.parse it later
            // (we send it as form data so each field is not parsed and it would fail list validation)
            if (data.hasOwnProperty('content')) {
                sendData.content_list = angular.toJson(data.content);
            }

            urls.resource('dictionaries').then(function(uploadURL) {
                if (hasId) {
                    uploadURL += '/' + dictionary._id;
                }
                return $upload.upload({
                    url: uploadURL,
                    method: method,
                    data: sendData,
                    file: file,
                    headers: headers
                }).then(success, error, progress);
            }, error);
        };

        this.update = function update(dictionary, data, success, error) {
            return api.save('dictionaries', dictionary, data).then(success, error);
        };

        this.remove = function remove(dictionary, success, error) {
            return api.remove(dictionary).then(success, error);
        };
    }

    DictionaryConfigController.$inject = ['$scope', 'dictionaries', 'gettext', 'modal', 'notify'];
    function DictionaryConfigController ($scope, dictionaries, gettext, modal, notify) {
        $scope.dictionaries = null;
        $scope.origDictionary = null;
        $scope.dictionary = null;

        $scope.fetchDictionaries = function() {
            dictionaries.fetch(function(result) {
                $scope.dictionaries = result;
            });
        };

        $scope.createDictionary = function() {
            $scope.dictionary = {};
            $scope.origDictionary = {};
        };

        $scope.openDictionary = function(dictionary) {
            dictionaries.open(dictionary, function(result) {
                $scope.origDictionary = result;
                $scope.dictionary = _.create(result);
                $scope.dictionary.content = _.create(result.content || {});
            });
        };

        $scope.closeDictionary = function() {
            $scope.dictionary = $scope.origDictionary = null;
        };

        $scope.remove = function(dictionary) {
            modal.confirm(gettext('Please confirm you want to delete dictionary.')).then(
                function runConfirmed() {
                    dictionaries.remove(dictionary, function() {
                        _.remove($scope.dictionaries._items, dictionary);
                        notify.success(gettext('Dictionary deleted.'), 3000);
                    });
                }
            );
        };

        $scope.fetchDictionaries();
    }

    DictionaryEditController.$inject = ['$scope', 'dictionaries', 'upload', 'gettext', 'notify', 'modal'];
    function DictionaryEditController ($scope, dictionaries, upload, gettext, notify, modal) {

        function onSuccess(result) {
            $scope.closeDictionary();
            $scope.fetchDictionaries();
            notify.success(gettext('Dictionary saved succesfully'));
            $scope.progress = null;
            return result;
        }

        function onError(response) {
            if (angular.isDefined(response.data._issues)) {
                if (angular.isDefined(response.data._issues['validator exception'])) {
                    notify.error(gettext('Error: ' + response.data._issues['validator exception']));
                } else if (angular.isDefined(response.data._issues.file)) {
                    notify.error(gettext('Error: Dictionary File is required.'));
                }

            } else {
                notify.error(gettext('Error. Dictionary not saved.'));
            }
            $scope.progress = null;
        }

        // listen for the file selected event
        $scope.$on('fileSelected', function (event, args) {
            $scope.$apply(function() {
                $scope.file = args.file;
            });
        });

        $scope.save = function() {
            $scope.progress = {width: 1};
            if ($scope.file) {
                dictionaries.upload($scope.origDictionary, $scope.dictionary, $scope.file, onSuccess, onError, function(update) {
                    $scope.progress.width = Math.round(update.loaded / update.total * 100.0);
                });
            } else {
                dictionaries.update($scope.origDictionary, $scope.dictionary, onSuccess, onError);
            }
        };

        $scope.cancel = function() {
            $scope.closeDictionary();
        };

        $scope.addWord = function(word) {
            if (!$scope.dictionary.content.hasOwnProperty(word)) {
                addWordToTrie(word);
            }

            $scope.dictionary.content[word] = 1;
            $scope.filterWords(word);
            $scope.wordsCount++;
        };

        $scope.removeWord = function(word, search) {
            $scope.dictionary.content[word] = 0;
            $scope.filterWords(search);
            $scope.wordsCount--;
        };

        function isPrefix(prefix, word) {
            return word.length >= prefix.length && word.substr(0, prefix.length) === prefix;
        }

        $scope.filterWords = function filterWords(search) {
            $scope.words = [];
            $scope.isNew = !!search;
            if (search && wordsTrie[search[0]]) {
                var searchWords = wordsTrie[search[0]],
                    length = searchWords.length,
                    words = [],
                    word;
                for (var i = 0; i < length; i++) {
                    word = searchWords[i];
                    if ($scope.dictionary.content[word] > 0 && isPrefix(search, word)) {
                        words.push(word);
                        if (word.length === search.length) {
                            $scope.isNew = false;
                        }
                    }
                }

                var LIMIT = 10;
                words.sort();
                words.splice(LIMIT, words.length - LIMIT);
                $scope.words = words;
            }
        };

        var wordsTrie = {};
        $scope.wordsCount = 0;

        function addWordToTrie(word) {
            if (wordsTrie.hasOwnProperty(word[0])) {
                wordsTrie[word[0]].push(word);
            } else {
                wordsTrie[word[0]] = [word];
            }
        }

        for (var word in $scope.dictionary.content) {
            if ($scope.dictionary.content.hasOwnProperty(word) || $scope.origDictionary.content.hasOwnProperty(word)) {
                addWordToTrie(word);
                $scope.wordsCount++;
            }
        }
    }

    var app = angular.module('superdesk.dictionaries', [
        'superdesk.activity',
        'superdesk.upload'
    ]);

    app
        .config(['superdeskProvider', function(superdesk) {
            superdesk
            .activity('/settings/dictionaries', {
                    label: gettext('Dictionaries'),
                    controller: DictionaryConfigController,
                    templateUrl: 'scripts/superdesk-dictionaries/views/settings.html',
                    category: superdesk.MENU_SETTINGS,
                    priority: -800,
                    privileges: {dictionaries: 1}
                });
        }])
        .config(['apiProvider', function(apiProvider) {
            apiProvider.api('dictionaries', {
                type: 'http',
                backend: {
                    rel: 'dictionaries'
                }
            });
        }])
        .service('dictionaries', DictionaryService)
        .controller('DictionaryEdit', DictionaryEditController)
        .directive('sdDictionaryConfig', function() {
            return {controller: DictionaryConfigController};
        })
        .directive('sdDictionaryConfigModal', function() {
            return {
                controller: 'DictionaryEdit',
                require: '^sdDictionaryConfig',
                templateUrl: 'scripts/superdesk-dictionaries/views/dictionary-config-modal.html'
            };
        }).directive('fileUpload', function () {
            return {
                scope: true,
                link: function (scope, element, attrs) {
                    element.bind('change', function (event) {
                        scope.$emit('fileSelected', {file: event.target.files[0]});
                    });
                }
            };
        });
})();
