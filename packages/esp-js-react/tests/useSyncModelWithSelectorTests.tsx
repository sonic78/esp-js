import 'jest';
import * as React from 'react';
import {act} from 'react';
import {EspModelContextProvider, EspRouterContextProvider, syncModelWithSelectorOptions, useSyncModelWithSelector} from '../src';
import {TestModel, TestModelImmutableState} from './testApi/testModel';
import {viewFactory, ViewMetadata} from './testApi/viewFactory';
import {routerAsserts} from './testApi/asserts';
import {testApi, TestApi} from './testApi/testApi';
import {TestPropStoreContext} from './testApi/useStoreReceivedProps';

type SelectedObject = { id: string, value: string };

describe('useSyncModelWithSelector', () => {
    let api: TestApi;

    beforeEach(() => {
        api = testApi();
    });

    describe('Default API case', () => {
        const modelId = 'modelId';

        const View = () => {
            const valuesObj = useSyncModelWithSelector<TestModelImmutableState, SelectedObject>(
                model => {
                    return {id: model.modelId, value: model.value};
                },
            );
            if (!valuesObj) {
                return;
            }
            return (
                <ViewMetadata modelId={valuesObj.id} modelValue={valuesObj.value} />
            );
        };

        beforeEach(() => {
           api.setupModelAndRender(modelId, View);
        });

        it('renders immutable model based on modelId found on context', () => {
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('initial-value');
        });

        it('updates are rendered', () => {
            act(() => {
                api.router.publishEvent(modelId, 'test-event', 'new-value');
            });
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('new-value');
        });
    });

    describe('modelId can be passed via selector', () => {
        const modelId = 'modelId';

        const View = () => {
            const values: string[] = useSyncModelWithSelector<TestModelImmutableState, string[]>(
                model => [model.modelId, model.value],
                syncModelWithSelectorOptions().setModelId(modelId)
            );
            if (!values) {
                return;
            }
            return (
                <ViewMetadata modelId={values[0]} modelValue={values[1]} />
            );
        };

        beforeEach(() => {
            api.setupTestModel(modelId);
            api.doRender(View, undefined);
        });

        it('renders correct model data', () => {
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('initial-value');
        });
    });

    describe('equalityFn is invoked to determine if changed should be propagated', () => {
        const modelId = 'modelId';

        const View = () => {
            const values = useSyncModelWithSelector<TestModelImmutableState, SelectedObject>(
                model => ({id: model.modelId, value: model.value}),
                syncModelWithSelectorOptions<SelectedObject>()
                    .setEqualityFn((a, b) => {
                        if (!a) {
                            return false; // first time
                        }
                        // delegate to model, set via the test, to see if we're 'equal'
                        // If this returns true, useSyncModelWithSelector internally assume the last snapshot is the same thus doesn't propagate the last snapshot.
                        return b.value === 'assume-no-change';
                    })
            );
            if (!values) {
                return;
            }
            return (
                <ViewMetadata modelId={values.id} modelValue={values.value} />
            );
        };

        beforeEach(() => {
           api.setupModelAndRender(modelId, View);
        });

        it('renders initial model data', () => {
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('initial-value');
        });

        it('updates are ignored due to equalityFn', () => {
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('initial-value');
            act(() => {
                api.router.publishEvent(modelId, 'test-event', 'assume-no-change');
            });
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('initial-value'); // event data WAS NOT propagated
            act(() => {
                api.router.publishEvent(modelId, 'test-event', 'do-change');
            });
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('do-change'); // event data WAS propagated
        });
    });

    describe('selector internal caching is based on modelId', () => {
        const modelId1 = 'modelId1';
        const modelId2 = 'modelId2';

        const View = (props: {modelId: string}) => {
            const values = useSyncModelWithSelector<TestModelImmutableState, SelectedObject>(
                model => ({id: model.modelId, value: model.value}),
                syncModelWithSelectorOptions().setModelId(props.modelId)
            );
            if (!values) {
                return;
            }
            return (
                <ViewMetadata modelId={values.id} modelValue={values.value} />
            );
        };

        beforeEach(() => {
            api.setupTestModel(modelId1);
            api.doRender(View, modelId1);
        });

        it('selector subscribed to Router', () => {
            routerAsserts(api.router).subscriberCountIs(modelId1, 1);
        });

        it('unsubscribes when modelId changes', () => {
            api.doReRender(View, undefined);
            api.asserts.router.subscriberCountIs(modelId1, 0);
        });

        it('resubscribes to new model when modelId changes', () => {
            api.asserts.view
                .modelIdIs(modelId1)
                .valueIs('initial-value');
            api.doReRender(View, undefined);
            api.asserts.view
                .modelIdIsNotInDom()
                .valueIsNotInDom();
            api.setupTestModel(modelId2);
            api.doReRender(View, modelId2);
            api.asserts.view
                .modelIdIs(modelId2)
                .valueIs('initial-value');
            act(() => {
                api.router.publishEvent(modelId2, 'test-event', 'updated');
            });
            api.asserts.view
                .modelIdIs(modelId2)
                .valueIs('updated');
        });
    });

    describe('non immutable model cases #1 - selector receives then maps model subset', () => {
        const modelId = 'modelId';

        const View = () => {
            const values: string[] = useSyncModelWithSelector<TestModel, string[]>(
                model => {
                    // here we're expecting to receive a TestModel, not testModelInstance[GetEspPolimerImmutableModelConsts.HandlerFunctionName]()
                    return [model.state.modelId, model.state.value];
                },
                syncModelWithSelectorOptions().setTryPreSelectPolimerImmutableModel(false)
            );
            if (!values) {
                return;
            }
            return (
                <ViewMetadata modelId={values[0]} modelValue={values[1]} />
            );
        };

        beforeEach(() => {
           api.setupModelAndRender(modelId, View);
        });

        it('selector passes router root model to selector', () => {
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('initial-value');
        });
    });

    describe('non immutable model cases - selector maps root model', () => {
        const modelId = 'modelId';

        const View = () => {
            const model: TestModel = useSyncModelWithSelector<TestModel, TestModel>(
                m => m,
                syncModelWithSelectorOptions().setTryPreSelectPolimerImmutableModel(false)
            );
            if (!model) {
                return;
            }
            return (
                <ViewMetadata modelId={model.state.modelId} modelValue={model.state.value} />
            );
        };

        beforeEach(() => {
           api.setupModelAndRender(modelId, View);
        });

        it('view renders correct data', () => {
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('initial-value');
        });

        it('Updates propagated', () => {
            act(() => {
                api.router.publishEvent(modelId, 'test-event', 'updated');
            });
            api.asserts.view
                .modelIdIs(modelId)
                .valueIs('updated');
        });
    });

    describe('noop argument edge cases', () => {
        const View = viewFactory('View1');

        it('falsey router', () => {
            api.doRender((
                <TestPropStoreContext.Provider value={api.propStore}>
                    <EspRouterContextProvider router={undefined}>
                        <EspModelContextProvider modelId={'some-modelId'}>
                            <View  />,
                        </EspModelContextProvider>
                    </EspRouterContextProvider>
                </TestPropStoreContext.Provider>
            ));
            api.asserts.props
                .receivedPropCountIs(1)
                .propAtIndexHasModelId(0, undefined)
                .propAtIndex(0, props => {
                    expect(props.modelId).not.toBeDefined();
                    expect(props.value).not.toBeDefined();
                });
        });

        it('falsey modelId', () => {
            api.doRender((
                <TestPropStoreContext.Provider value={api.propStore}>
                    <EspRouterContextProvider router={api.router}>
                        <EspModelContextProvider modelId={undefined}>
                            <View  />,
                        </EspModelContextProvider>
                    </EspRouterContextProvider>
                </TestPropStoreContext.Provider>
            ));
            api.asserts.props
                .receivedPropCountIs(1)
                .propAtIndexHasModelId(0, undefined)
                .propAtIndex(0, props => {
                    expect(props.modelId).not.toBeDefined();
                    expect(props.value).not.toBeDefined();
                });
        });
    });

    describe('argument checking', () => {
        it('throws if selector incorrect', () => {
            expect(() => {
                useSyncModelWithSelector(null, syncModelWithSelectorOptions());
            }).toThrow(new Error('You must pass a selector function to useSyncModelWithSelector'));
            expect(() => {
                useSyncModelWithSelector(undefined, syncModelWithSelectorOptions());
            }).toThrow(new Error('You must pass a selector function to useSyncModelWithSelector'));
            expect(() => {
                const x: any = {};
                useSyncModelWithSelector(x, syncModelWithSelectorOptions());
            }).toThrow(new Error('You must pass a selector function to useSyncModelWithSelector'));
        });
        it('throws if options incorrect', () => {
            expect(() => {
                useSyncModelWithSelector((m) => m, null);
            }).toThrow(new Error('You must provide options when using useSyncModelWithSelector'));
            expect(() => {
                useSyncModelWithSelector((m) => m, syncModelWithSelectorOptions().setEqualityFn(null));
            }).toThrow(new Error('You must provide an equalityFn when using useSyncModelWithSelector'));
            expect(() => {
                useSyncModelWithSelector(
                    (m) => m,
                    {
                        modelId: '',
                        equalityFn: null,
                        tryPreSelectPolimerImmutableModel: true
                 });
            }).toThrow(new Error('You must provide an equalityFn when using useSyncModelWithSelector'));
        });
    });
});