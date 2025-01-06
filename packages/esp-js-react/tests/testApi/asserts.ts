import {RenderResult} from '@testing-library/react';
// import for extra asserts
import '@testing-library/jest-dom';
import {RouterSpy} from './routerSpy';
import {TestPropStore} from './useStoreReceivedProps';

export type ViewAsserts = {
    modelIdIs(expected: string): ViewAsserts
    modelIdIsNotInDom(): ViewAsserts
    valueIs(expected: string): ViewAsserts;
    valueIsNotInDom(): ViewAsserts;
    propIs(propName: string, expected: string): ViewAsserts
    viewNameElementTextIs(viewName: string);
    htmlElementInnerTextIs(elementsTestId: string, expectedText: string): ViewAsserts
};

export const viewAsserts = (renderResult: RenderResult) => {
    return {
        modelIdIs(expected: string) {
            let idElement = renderResult.getByTestId('modelIdDisplay');
            expect(idElement).toHaveTextContent(expected);
            return this;
        },
        modelIdIsNotInDom() {
            let idElement = renderResult.queryByTestId('modelIdDisplay');
            expect(idElement).not.toBeInTheDocument();
            return this;
        },
        valueIs(expected: string) {
            let valueElement = renderResult.getByTestId('valueDisplay');
            expect(valueElement).toHaveTextContent(expected);
            return this;
        },
        valueIsNotInDom() {
            let idElement = renderResult.queryByTestId('valueDisplay');
            expect(idElement).not.toBeInTheDocument();
            return this;
        },
        propIs(propName: string, expected: string) {
            let span = renderResult.getByTestId('span-with-props-as-attributes');
            let attributeName = `data-${propName}`;
            if (!span.hasAttribute(attributeName)) {
                let error = `Span doesn't have attribute '${attributeName}'. Has ${JSON.stringify(span.attributes)}`;
                fail(error);
            }
            expect(span.getAttribute(attributeName)).toBe(expected);
            return this;
        },
        viewNameElementTextIs(viewName: string) {
            let span = renderResult.getByTestId('view-name');
            expect(span).toHaveTextContent(viewName);
            return this;
        },
        htmlElementInnerTextIs(elementsTestId: string, expectedText: string) {
            let span = renderResult.getByTestId(elementsTestId);
            expect(span).toHaveTextContent(expectedText);
            return this;
        }

    } as ViewAsserts;
};

export type RouterAsserts = {
    subscriberCountIs(modelId: string, expectedCount: number): RouterAsserts
};

export const routerAsserts = (routerSpy: RouterSpy) => {
    return {
        subscriberCountIs(modelId: string, expectedCount: number) {
            if (expectedCount === 0) {
                let modelNotSubscribed = routerSpy.getSubscriberCount(modelId) === undefined || routerSpy.getSubscriberCount(modelId) === 0;
                expect(modelNotSubscribed).toBeTruthy();
            } else {
                expect(routerSpy.getSubscriberCount(modelId)).toEqual(expectedCount);
            }
            return this;
        },
    } as RouterAsserts;
};

export type PropAsserts = {
    receivedPropCountIs(expectedCount: number): PropAsserts;
    propAtIndex(index: number, asserter: (props) => void): PropAsserts
    propAtIndexHasModelId(index: number, expectedModelId: string): PropAsserts
};

export const propAsserts = (testPropStore: TestPropStore) => {
    return {
        receivedPropCountIs(expectedCount: number) {
            expect(testPropStore.receivedProps.length).toEqual(expectedCount);
            return this;
        },
        propAtIndex(index: number, asserter: (props) => void): PropAsserts {
            asserter(testPropStore.receivedProps[index]);
            return this;
        },
        propAtIndexHasModelId(index: number, expectedModelId: string): PropAsserts {
            expect(testPropStore.receivedProps[index].modelId).toBe(expectedModelId);
            return this;
        },
    } as PropAsserts;
};