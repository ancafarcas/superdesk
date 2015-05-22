'use strict';

describe('content', function() {
    var item = {_id: 1};

    beforeEach(module('templates'));
    beforeEach(module('superdesk.mocks'));
    beforeEach(module('superdesk.archive'));
    beforeEach(module('superdesk.workspace.content'));

    it('can spike items', inject(function(spike, api, $q) {
        spyOn(api, 'update').and.returnValue($q.when());
        spike.spike(item);
        expect(api.update).toHaveBeenCalledWith('archive_spike', item, {state: 'spiked'});
    }));

    it('can unspike items', inject(function(spike, api, $q) {
        spyOn(api, 'update').and.returnValue($q.when());
        spike.unspike(item);
        expect(api.update).toHaveBeenCalledWith('archive_unspike', item, {});
    }));

    describe('multi module', function() {
        it('can reset on route change', inject(function(multi, $rootScope) {
            multi.toggle({_id: 1});
            expect(multi.count).toBe(1);

            $rootScope.$broadcast('$routeChangeStart');
            $rootScope.$digest();

            expect(multi.count).toBe(0);
        }));
    });

    describe('media box directive', function() {
        it('can select item for multi editing', inject(function(multi, $rootScope, $compile) {
            var scope = $rootScope.$new();
            scope.item = item;

            $compile('<div sd-media-box></div>')(scope);
            scope.$digest();

            expect(scope.multi.selected).toBe(false);
            scope.toggleSelected();
            expect(scope.multi.selected).toBe(true);

            multi.reset();
            $rootScope.$digest();
            expect(scope.multi.selected).toBe(false);
        }));
    });

    describe('creating items', function() {
        beforeEach(module(function($provide) {
            $provide.service('api', function($q) {
                return function() {
                    return {
                        save: function(item) {
                            return $q.when();
                        }
                    };
                };
            });
        }));

        it('can create plain text items', inject(function(superdesk, $rootScope, ContentCtrl) {
            spyOn(superdesk, 'intent').and.returnValue(null);

            var content = new ContentCtrl();
            content.create();
            $rootScope.$digest();
            expect(superdesk.intent).toHaveBeenCalledWith('author', 'article', {type: 'text', version: 0});
        }));

        it('can create packages', inject(function(superdesk, ContentCtrl) {
            spyOn(superdesk, 'intent').and.returnValue(null);

            var content = new ContentCtrl();
            content.createPackage();
            expect(superdesk.intent).toHaveBeenCalledWith('create', 'package');
        }));

        it('can create packages from items', inject(function(superdesk, ContentCtrl) {
            spyOn(superdesk, 'intent').and.returnValue(null);

            var content = new ContentCtrl();
            content.createPackage({data: 123});
            expect(superdesk.intent).toHaveBeenCalledWith('create', 'package', {items: [{data: 123}]});
        }));

        it('can create items from template', inject(function(superdesk, $rootScope, ContentCtrl) {
            spyOn(superdesk, 'intent').and.returnValue(null);

            var content = new ContentCtrl();
            content.createFromTemplate({
                slugline: 'test_slugline',
                body_html: 'test_body_html',
                irrelevantData: 'yes'
            });
            $rootScope.$digest();
            expect(superdesk.intent).toHaveBeenCalledWith('author', 'article', {
                slugline: 'test_slugline',
                body_html: 'test_body_html'
            });
        }));
    });
});
