import 'jest';
import * as React from 'react';
import {act} from 'react';
import {
    connect,
    ConnectableComponent,
    ConnectableComponentProps,
    PublishModelEventDelegate,
    viewBinding,
    MapModelToProps,
    CreatePublishEventProps,
} from '../src';
import {testApi, TestApi} from './testApi/testApi';
import {observeEvent} from 'esp-js';
import {viewFactory} from './testApi/viewFactory';

interface TestModelState {
    value: string;
    value2: string;
    value3: string;
    foo: string;
}

@viewBinding(viewFactory('View1'))
@viewBinding(viewFactory('View3'), 'alternative-view-context')
class TestModel {
    protected _state: TestModelState = {
        value: 'initial-value',
        value2: undefined,
        value3: undefined,
        foo: undefined
    };

    public get value(): string {
        return this._state.value;
    }

    @observeEvent('test-event')
    _onTestEvent(ev: string) {
        this._updateState({
            value: ev
        });
    }

    protected _updateState = (partialState: Partial<TestModelState>) => {
        this._state = {
            ...this._state,
            ...partialState
        };
    }
}

class TestModel2 extends TestModel {

    constructor() {
        super();
        this._updateState({
            value: this._state.value,
            value2: this._state.value,
            value3: 'value-3',
            foo: 'the-foo'
        });
    }

    // this isn't ideal, but here we're pretending to be a PolimerModel
    public getEspPolimerImmutableModel() {
        return this._state;
    }
}

interface ConnectedComponentElementCreationProperties {
    modelId: string;
    useConnectFunction?: boolean;
    useMapModelToProps?: boolean;
    useCreatePublishEventProps?: boolean;
    useAlternativeViewContext?: boolean;
    passOtherProps?: boolean;
    useImmutableModelSelectorDecorator?: boolean;
    useImmutableModelSelectorFunction?: boolean;
}

describe('ConnectableComponentTests', () => {
    let api: TestApi,
        testModel: TestModel,
        testModel2: TestModel2;

    beforeEach(() => {
        api = testApi();
        testModel = new TestModel();
        testModel2 = new TestModel2();
        api.setupModel('model-id1', testModel);
        api.setupModel('model-id2', testModel2);
    });

    const createConnectedComponentElement = (options: ConnectedComponentElementCreationProperties): React.JSX.Element => {
        // Refactor note:
        // These tests were ported from some very old Enzime based tests.
        // They have been cleaned up quite a bit.
        // The next step in the cleanup would be to largely eliminate the option parameter.
        // It makes sense to have a function that returns the thing to render,
        // however, having an 'options' object just binds/funnels all the tests into one confusing API.
        // It'd be best to take a Partial<ConnectableComponentProps> and have more localized `beforeEach` calls invoke function this using new structure.
        let connectableComponentProps: ConnectableComponentProps<TestModel> = {
            modelId: options.modelId
        };
        let mapModelToProps: MapModelToProps<any, any, any>;
        let createPublishEventProps: CreatePublishEventProps<any>;
        const otherProps = {other1: 'other-value'};
        let publishEventProps: { publishEvent1: () => void };
        let userAlternativeViewContext: string;
        if (options.useMapModelToProps) {
            mapModelToProps = (model: TestModel | TestModelState, publishEventProps2: any) => {
                return {
                    foo: model.value,
                    publishEventPropsPassedMapModelToProps: publishEventProps2 && typeof publishEventProps2.publishEvent1 === 'function',
                    ...model
                };
            };
        }
        if (options.useCreatePublishEventProps) {
            publishEventProps = {
                publishEvent1: () => {
                }
            };
            createPublishEventProps = (publishEvent: PublishModelEventDelegate) => publishEventProps;
        }
        if (options.useAlternativeViewContext) {
            userAlternativeViewContext = 'alternative-view-context';
        }
        let viewElement: React.JSX.Element;
        if (options.useConnectFunction) {
            const TestModelView2ConnectedComponent = connect(
                mapModelToProps,
                createPublishEventProps
            )(viewFactory('View2'));
            viewElement = (<TestModelView2ConnectedComponent {...otherProps} {...connectableComponentProps}/>);
        } else {
            viewElement = (
                <ConnectableComponent
                    {...connectableComponentProps}
                    mapModelToProps={mapModelToProps}
                    viewContext={userAlternativeViewContext}
                    {...otherProps}
                />
            );
        }
        return viewElement;
    };

    const publishTestEvent = (modelId: string, eventData: string) => {
        act(() => {
            api.router.publishEvent(modelId, 'test-event', eventData);
        });
    };

    describe('ConnectableComponent via connect()', () => {
        beforeEach(() => {
            let elementCreationProperties: ConnectedComponentElementCreationProperties = {
                modelId: 'model-id1',
                useConnectFunction: true,
                useMapModelToProps: true,
                useCreatePublishEventProps: true
            };
            api.doRender(
                createConnectedComponentElement(elementCreationProperties),
                elementCreationProperties.modelId
            );
        });

        it('Renders the view provided to connect', () => {
            api.asserts.view.viewNameElementTextIs('View2');
        });

        describe('Child view props', () => {

            it('renders only once', () => {
                api.asserts.props
                    .receivedPropCountIs(1);
            });

            it('passes mapped props', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.foo).toBe('initial-value');
                        }
                    );
            });

            it('passes results of publishEventProps to mapModelToProps', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.publishEventPropsPassedMapModelToProps).toBeTruthy();
                        }
                    );
            });

            it('passes model', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.model).toBeDefined();
                            expect(props.model instanceof TestModel).toBeTruthy();
                        }
                    );
            });

            it('flattens and passes results of createPublishEventProps', () => {
                api.asserts.props
                    .receivedPropCountIs(1)
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.publishEvent1).toBeDefined();
                            expect(typeof props.publishEvent1).toBe('function');
                        }
                    );
            });

            it('passes other props', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.other1).toBeDefined();
                            expect(props.other1).toBe('other-value');
                        }
                    );
            });
        });
    });

    describe('ConnectableComponent directly', () => {

        describe('Child view props', () => {
            beforeEach(() => {
                let elementCreationProperties: ConnectedComponentElementCreationProperties = {
                    modelId: 'model-id1',
                    useConnectFunction: false
                };
                api.doRender(
                    createConnectedComponentElement(elementCreationProperties),
                    elementCreationProperties.modelId
                );
            });

            it('passes modelId', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.modelId).toBe('model-id1');
                        }
                    );
            });

            it('passes router', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.router).toBe(api.router);
                        }
                    );
            });

            it('passes model', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.model).toBeDefined();
                            expect(props.model instanceof TestModel).toBeTruthy();
                        }
                    );
            });

            it('passes other props', () => {
                api.asserts.props
                    .propAtIndex(
                        0,
                        props => {
                            expect(props.other1).toBeDefined();
                            expect(props.other1).toBe('other-value');
                        }
                    );
            });
        });

        it('arbitrary props are passed down to the child', () => {
            api.doRender(
                (
                    <ConnectableComponent className={'foo-bar'} />
                ),
                'model-id1'
            );
            api.asserts.props
                .receivedPropCountIs(1)
                .propAtIndex(0, props => {
                    expect(props.className).toBe('foo-bar');
                });
        });

        describe('Re-renders', () => {
            beforeEach(() => {
                let elementCreationProperties: ConnectedComponentElementCreationProperties = {
                    modelId: 'model-id1',
                    useConnectFunction: false,
                };
                api.doRender(
                    createConnectedComponentElement(elementCreationProperties),
                    elementCreationProperties.modelId
                );
            });

            it('Re-renders when model updates', () => {
                publishTestEvent( 'model-id1', 'the-event-value');
                api.asserts.props
                    .receivedPropCountIs(2)
                    .propAtIndex(
                        1,
                        props => {
                            expect(props.model).toBeDefined();
                            expect(props.model.value).toBe('the-event-value');
                        }
                    );
            });
        });

        describe('Model Subscription - modelId source', () => {
            it('subscribes to modelId via props', () => {
                api.doRender(
                    (
                        <ConnectableComponent modelId={'model-id1'} />
                    )
                );
                api.asserts.props
                    .receivedPropCountIs(1)
                    .propAtIndexHasModelId(0, 'model-id1');
            });

            it('subscribes to modelId via context', () => {
                api.doRender(
                    (
                        <ConnectableComponent />
                    ),
                    'model-id1'
                );
                api.asserts.props
                    .receivedPropCountIs(1)
                    .propAtIndexHasModelId(0, 'model-id1');
            });
        });

        describe('Model Subscription - when modelId changes', () => {
            beforeEach(() => {
                let elementCreationProperties: ConnectedComponentElementCreationProperties = {
                    modelId: 'model-id1',
                    useConnectFunction: false,
                    useMapModelToProps: true
                };
                api.doRender(
                    createConnectedComponentElement(elementCreationProperties),
                    elementCreationProperties.modelId
                );
            });

            it('Re-subscribes to new model when modelId changes', () => {
                api.asserts.props
                    .receivedPropCountIs(1)
                    .propAtIndexHasModelId(0,'model-id1');
                const element = createConnectedComponentElement({modelId: 'model-id2', useConnectFunction: false, useMapModelToProps: true});
                api.doReRender(element, 'model-id2');
                api.asserts.props
                    .receivedPropCountIs(2)
                    .propAtIndexHasModelId(1,'model-id2');
                publishTestEvent( 'model-id2', 'the-event-value2');
                api.asserts.props
                    .receivedPropCountIs(3)
                    .propAtIndexHasModelId(2,'model-id2')
                    .propAtIndex(
                        2,
                        props => {
                            expect(props.model.value).toBe('the-event-value2');
                        }
                    );
            });
        });

        describe('View rendering', () => {
            it('Renders the view found via @viewBinding', () => {
                let elementCreationProperties: ConnectedComponentElementCreationProperties = {
                    modelId: 'model-id1',
                    useConnectFunction: false,
                };
                api.doRender(
                    createConnectedComponentElement(elementCreationProperties),
                    elementCreationProperties.modelId
                );
                api.asserts.view.viewNameElementTextIs('View1');
            });

            it('Renders alternative view found via @viewBinding', () => {
                let elementCreationProperties: ConnectedComponentElementCreationProperties = {
                    modelId: 'model-id1',
                    useConnectFunction: false,
                    useAlternativeViewContext: true
                };
                api.doRender(
                    createConnectedComponentElement(elementCreationProperties),
                    elementCreationProperties.modelId
                );
                api.asserts.view.viewNameElementTextIs('View3');
            });

            it('re-renders the view when the model changes', () => {
                api.doRender(
                    (
                        <ConnectableComponent />
                    ),
                    'model-id1'
                );
                api.asserts.view.viewNameElementTextIs('View1');
                api.asserts.props.receivedPropCountIs(1);
                act(() => {
                    api.router.publishEvent('model-id1', 'test-event', 'changed-value');
                });
                api.asserts.props
                    .receivedPropCountIs(2)
                    .propAtIndex(1, props => {
                        expect(props.model.value).toBe('changed-value');
                    });
            });

            it('can pass view via prop', () => {
                const View = viewFactory('MyPropView');
                api.doRender(
                    (
                        <ConnectableComponent view={View} />
                    ),
                    'model-id1'
                );
                api.asserts.view.viewNameElementTextIs('MyPropView');
            });
        });

        describe('Overriding model/state selector with @getEspPolimerImmutableModel', () => {
            it('will select esp-js-polimer model based on const', () => {
                api.doRender(
                    (
                        <ConnectableComponent />
                    ),
                    'model-id2'
                );
                api.asserts.props
                    .receivedPropCountIs(1)
                    .propAtIndex(0, props => {
                        expect(props.model.value).toBe('initial-value');
                        expect(props.model.foo).toBe('the-foo');
                    });
                act(() => {
                    api.router.publishEvent('model-id2', 'test-event', 'changed-value');
                });
                api.asserts.props
                    .receivedPropCountIs(2)
                    .propAtIndex(1, props => {
                        expect(props.model.value).toBe('changed-value');
                        expect(props.model.foo).toBe('the-foo');
                    });
            });
        });
    });
});