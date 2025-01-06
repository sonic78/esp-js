import {
    EspRouterContextProvider,
    EspModelContextProvider,
    useGetModelId,
    useGetModel,
    usePublishModelEvent,
    usePublishModelEventWithEntityKey
} from '../src';
import {testApi, TestApi} from './testApi/testApi';
import {renderHook} from '@testing-library/react';
import * as React from 'react';
import {Router} from 'esp-js';
import {TestModel} from './testApi/testModel';

describe('EspModelContextProviderTests tests', () => {
    let api: TestApi,
        testModel1: TestModel,
        testModel2: TestModel;

    beforeEach(() => {
        api = testApi();

        testModel1 = api.setupTestModel('model-id1');
        testModel2 = api.setupTestModel('model-id2');
    });

    // https://testing-library.com/docs/react-testing-library/api/#renderhook-options-initialprops
    const createEspRouterContextProviderWrapper = (
        router: Router,
        modelsForContextPerRender: TestModel[],
        modelIdForContextPerRender: string[]
    ) => {

        return ({children}: React.PropsWithChildren) => {
            // Each re-render we pop a model ID out of modelIdForContextPerRender for our context.
            // This is the only way to inject some re-render differences using RTL with renderHook
            let modelForContext = modelsForContextPerRender.length === 1
                ? modelsForContextPerRender[0]
                : modelsForContextPerRender.shift();
            let modelIdForContext = modelIdForContextPerRender.length === 1
                ? modelIdForContextPerRender[0]
                : modelIdForContextPerRender.shift();
            return (
                <EspRouterContextProvider router={router}>
                    <EspModelContextProvider modelId={modelIdForContext} model={modelForContext}>
                        {children},
                    </EspModelContextProvider>
                </EspRouterContextProvider>
            );
        };
    };

    it('useGetModelId returns new modelId and changes on re-render', () => {
        const {result, rerender} = renderHook(
            props => {
                return useGetModelId();
            },
            {
                wrapper: createEspRouterContextProviderWrapper(
                    api.router,
                    [testModel1, testModel2],
                    ['model-id1', 'model-id2']
                ),
            }
        );
        expect(result.current).toBe('model-id1');
        rerender();
        expect(result.current).toBe('model-id2');
    });

    it('useGetModel returns model and changes on re-render', () => {
        const {result, rerender} = renderHook(
            props => {
                return useGetModel<TestModel>();
            },
            {
                wrapper: createEspRouterContextProviderWrapper(
                    api.router,
                    [testModel1, testModel2],
                    ['model-id1', 'model-id2']
                ),
            }
        );
        expect(result.current).toBe(testModel1);
        rerender();
        expect(result.current).toBe(testModel2);
    });

    it('publishModelEvent publishes to correct model and changes on re-render', () => {
        const {result, rerender} = renderHook(
            props => {
                return usePublishModelEvent();
            },
            {
                wrapper: createEspRouterContextProviderWrapper(
                    api.router,
                    [testModel1, testModel2],
                    ['model-id1', 'model-id2']
                ),
            }
        );

        expect(testModel1.state.value).toBe('initial-value');
        result.current('test-event', 'updated');
        expect(testModel1.state.value).toBe('updated');

        rerender();

        expect(testModel2.state.value).toBe('initial-value');
        result.current('test-event', 'updated');
        expect(testModel2.state.value).toBe('updated');
    });

    it('publishModelEventWithEntityKey publishes to correct model and changes on re-render', () => {
        const {result, rerender} = renderHook(
            props => {
                return usePublishModelEventWithEntityKey();
            },
            {
                wrapper: createEspRouterContextProviderWrapper(
                    api.router,
                    [testModel1, testModel2],
                    ['model-id1', 'model-id2']
                ),
            }
        );

        expect(testModel1.state.value).toBe('initial-value');
        expect(testModel1.state.entityKey).toBe('');
        result.current('the-entity-key', 'test-event-with-entity-key', 'updated');
        expect(testModel1.state.value).toBe('updated');
        expect(testModel1.state.entityKey).toBe('the-entity-key');

        rerender();

        expect(testModel2.state.value).toBe('initial-value');
        expect(testModel2.state.entityKey).toBe('');
        result.current('the-entity-key', 'test-event-with-entity-key', 'updated');
        expect(testModel2.state.value).toBe('updated');
        expect(testModel2.state.entityKey).toBe('the-entity-key');
    });
});