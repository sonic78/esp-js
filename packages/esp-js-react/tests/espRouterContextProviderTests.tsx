import {
    EspRouterContextProvider,
    useRouter,
    usePublishEvent
} from '../src';
import {testApi, TestApi} from './testApi/testApi';
import {renderHook} from '@testing-library/react';
import {TestModel} from './testApi/testModel';
import * as React from 'react';
import {Router} from 'esp-js';

describe('EspRouterContextProvider tests', () => {
    let api: TestApi;

    beforeEach(() => {
        api = testApi();

        api.setupTestModel('model-id');
    });

    // https://testing-library.com/docs/react-testing-library/api/#renderhook-options-initialprops
    const createEspRouterContextProviderWrapper = (router: Router) => {
        return ({ children }: React.PropsWithChildren) => {
            return (<EspRouterContextProvider router={router}>{children}</EspRouterContextProvider>);
        };
    };

    it('useRouter returns Router', () => {
        const {result} =renderHook(
            props => {
                return useRouter();
            },
            {
                wrapper: createEspRouterContextProviderWrapper(api.router),
            }
        );
        expect(result.current).toBe(api.router);
    });

    it('usePublishEvent returns publishEvent delegate', () => {
        const {result} =renderHook(
            props => {
                return usePublishEvent();
            },
            {
                wrapper: createEspRouterContextProviderWrapper(api.router),
            }
        );
        let testModel = api.router.getModel<TestModel>('model-id');
        expect(testModel.state.value).toBe('initial-value');
        result.current('model-id', 'test-event', 'updated');
        expect(testModel.state.value).toBe('updated');
    });
});