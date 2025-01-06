import 'jest';
import {App} from '../src/app';
import * as React from 'react';
import {render} from '@testing-library/react';
// provides a set of custom jest matchers that you can use to extend jest
// i.e. `.toBeVisible`
import '@testing-library/jest-dom';

describe('ShellBootstrapper Tests', () => {
    // This is a high level integration test to see if the example actually loads
    it('Catch all integration tests', () => {
        const appWrapper = render(<App />);
        let appRoot = appWrapper.getByRole('app-root');
        expect(appRoot).toBeInTheDocument();
    });
});