import {
    viewBinding,
    ViewBinder,
} from '../src';
import {testApi, TestApi} from './testApi/testApi';
import * as React from 'react';
import {viewFactory} from './testApi/viewFactory';

@viewBinding(viewFactory('ViewBinder1'))
@viewBinding(viewFactory('ViewBinder2'), 'alternative-view-context')
class TestModel {
    public value: string;

    constructor() {
        this.value = 'initial-value';
    }
}

describe('ViewBinder tests', () => {
    let api: TestApi,
        testModel1: TestModel;

    beforeEach(() => {
        api = testApi();
        testModel1 = new TestModel();
        api.setupModel('model-id', testModel1);
    });

    it('creates view using the view found on decorator', () => {
        api.doRender(
            (
                <ViewBinder model={testModel1} />
            ),
            'model-id'
        );
        api.asserts.view.viewNameElementTextIs('ViewBinder1');
    });

    it('creates view using the view found on decorator with specific context', () => {
        api.doRender(
            (
                <ViewBinder model={testModel1} viewContext={'alternative-view-context'} />
            ),
            'model-id'
        );
        api.asserts.view.viewNameElementTextIs('ViewBinder2');
    });

    it('arbitrary props are passed down to the child', () => {
        api.doRender(
            (
                <ViewBinder model={testModel1} className={'foo-bar'} />
            ),
            'model-id1'
        );
        api.asserts.props
            .propAtIndex(0, props => {
                expect(props.className).toBe('foo-bar');
            });
    });
});