import 'jest';
import {render} from '@testing-library/react';
import {AppShell} from '../src/shell/appShell';
import * as React from 'react';
// provides a set of custom jest matchers that you can use to extend jest
// i.e. `.toBeVisible`
import '@testing-library/jest-dom';
import {AppShellView} from '../src/shell/views/shell/shellView';

describe('ShellBootstrapper Tests', () => {
    // This is a high level integration test to see if the example actually loads
    it('Catch all integration tests', () => {
        let appShell = new AppShell();
        appShell.start();
        const renderResult = render(
            <AppShellView router={appShell.router} workspaceModelId={appShell.workspaceModelId} />
        );
        let appRoot = renderResult.getByRole('app-root');
        expect(appRoot).toBeInTheDocument();
    });
});