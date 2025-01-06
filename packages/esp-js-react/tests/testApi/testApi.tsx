import {TestModel} from './testModel';
import {RouterSpy} from './routerSpy';
import {render, RenderResult} from '@testing-library/react';
import * as React from 'react';
import {EspModelContextProvider, EspRouterContextProvider} from '../../src';
import {PropAsserts, propAsserts, RouterAsserts, routerAsserts, ViewAsserts, viewAsserts} from './asserts';
import {isValidElement, ReactElement} from 'react';
import {TestPropStore, TestPropStoreContext} from './useStoreReceivedProps';

export type TestApi = {
    router: RouterSpy;
    propStore: TestPropStore;
    asserts: {
        router: RouterAsserts,
        view: ViewAsserts,
        props: PropAsserts,
    };
    setupModel<TModel>(modelId: string, model: TModel): TModel;
    setupTestModel(modelId: string): TestModel;
    setupModelAndRender(modelId: string, Component: React.ComponentType): TestApi;
    doRender(Component: React.ComponentType, modelIdForContext?: string): TestApi
    doRender(Component: React.JSX.Element, modelIdForContext?: string): TestApi
    doReRender(Component: React.ComponentType, modelIdForContext?: string, nextProps?: any): TestApi;
    doReRender(Component: React.JSX.Element, modelIdForContext?: string, nextProps?: any): TestApi;
};

export const testApi = ()=> {
    let router: RouterSpy = new RouterSpy();
    let renderResult: RenderResult;
    let propStore = new TestPropStore();
    return {
        router,
        propStore,
        asserts: {
            get router() {
                return routerAsserts(router);
            },
            get view() {
                return viewAsserts(renderResult);
            },
            get props() {
                return propAsserts(propStore);
            }
        },
        setupModelAndRender(modelId: string, view: React.ComponentType) {
            this.setupTestModel(modelId);
            this.doRender(view, modelId);
            return this;
        },
        setupModel<TModel>(modelId: string, model: TModel): TModel {
            router.addModel(modelId, model);
            router.observeEventsOn(modelId, model);
            return model;
        },
        setupTestModel(modelId: string): TestModel {
            const testModel = new TestModel(modelId);
            router.addModel(modelId, testModel);
            router.observeEventsOn(modelId, testModel);
            return testModel;
        },
        doRender(ComponentOrElement: any, modelIdForContext?: string, nextProps?: any) {
            let element: React.JSX.Element;
            if (isValidElement(ComponentOrElement)) {
                element = ComponentOrElement;
            } else {
                element = <ComponentOrElement />;
            }
            let elementWithProps = React.cloneElement(element, nextProps);
            renderResult = render((
                <TestPropStoreContext.Provider value={propStore}>
                    <EspRouterContextProvider router={router}>
                        <EspModelContextProvider modelId={modelIdForContext}>
                            {elementWithProps},
                        </EspModelContextProvider>
                    </EspRouterContextProvider>
                </TestPropStoreContext.Provider>
            ));
            return this;
        },
        doReRender(ComponentOrElement: any, modelIdForContext?: string, nextProps?: any) {
            let element: React.JSX.Element;
            if (isValidElement(ComponentOrElement)) {
                element = ComponentOrElement;
            } else {
                element = <ComponentOrElement />;
            }
            let elementWithProps = React.cloneElement(element, nextProps);
            renderResult.rerender((
                <TestPropStoreContext.Provider value={propStore}>
                    <EspRouterContextProvider router={router}>
                        <EspModelContextProvider modelId={modelIdForContext}>
                            {elementWithProps},
                        </EspModelContextProvider>
                    </EspRouterContextProvider>
                </TestPropStoreContext.Provider>
            ));
            return this;
        }
    } as TestApi;
};