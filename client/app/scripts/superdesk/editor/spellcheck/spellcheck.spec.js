
'use strict';

describe('spellcheck', function() {
    var DICT = {
            what: 1,
            foo: 1,
            bar: 1,
            f1: 1,
            '3d': 1,
            is: 1,
            and: 1
        },
        TEXT = 'wha is foo, f1, 4k and 3d?';

    beforeEach(module('superdesk.editor.spellcheck'));
    beforeEach(inject(function(dictionaries, $q) {
        spyOn(dictionaries, 'fetch').and.returnValue($q.when({_items: [{}]}));
        spyOn(dictionaries, 'open').and.returnValue($q.when({_id: 'foo', content: DICT}));
    }));

    it('can find errors in given text', inject(function(spellcheck, $rootScope) {
        var errors;
        spellcheck.errors(TEXT).then(function(_errors) {
            errors = _errors;
        });

        $rootScope.$digest();
        expect(errors).toEqual(['wha', '4k']);
    }));

    function createParagraph(text) {
        var p = document.createElement('p');
        p.contentEditable = 'true';
        p.innerHTML = text;
        document.body.appendChild(p);
        return p;
    }

    it('can render errors in given node', inject(function(spellcheck, $rootScope) {
        var p = createParagraph(TEXT);

        spellcheck.render(p);
        $rootScope.$digest();

        expect(p.innerHTML)
            .toBe('<span class="sderror">wha</span> is foo, f1, <span class="sderror">4k</span> and 3d?');

        expect(spellcheck.clean(p)).toBe(TEXT);
    }));

    it('can render errors at the end of text', inject(function(spellcheck, $rootScope) {
        var p = createParagraph('what is buz');

        spellcheck.render(p);
        $rootScope.$digest();

        expect(p.innerHTML)
            .toBe('what is <span class="sderror">buz</span>');
    }));

    it('can remove errors and keep the marker', inject(function(spellcheck, $rootScope) {
        var p = createParagraph('what is <span class="sderror">b<span class="mark"></span>uz</span>');
        expect(spellcheck.clean(p)).toBe('what is b<span class="mark"></span>uz');
    }));

    describe('spellcheck menu', function() {
        it('can toggle auto spellcheck', inject(function(editor, $controller, $rootScope) {
            var ctrl = $controller('SpellcheckMenu');
            expect(ctrl.isAuto).toBe(true);

            var scope = $rootScope.$new(),
                settingsHandle = jasmine.createSpy('handle');

            scope.$on('editor:settings', settingsHandle);

            ctrl.pushSettings();
            expect(settingsHandle).toHaveBeenCalled();
            expect(editor.settings.spellcheck).toBe(true);

            ctrl.isAuto = false;
            ctrl.pushSettings();
            expect(editor.settings.spellcheck).toBe(false);

            var spellcheckHandle = jasmine.createSpy('handle');
            scope.$on('spellcheck:run', spellcheckHandle);
            ctrl.spellcheck();
            expect(spellcheckHandle).toHaveBeenCalled();
        }));
    });
});
