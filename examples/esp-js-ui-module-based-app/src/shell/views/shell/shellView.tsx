import {Router} from 'esp-js';
import {ConnectableComponent, EspRouterContextProvider} from 'esp-js-react';
import * as React from 'react';

export interface AppShellViewProps {
    workspaceModelId: string;
    router: Router;
}

export const AppShellView: React.FunctionComponent<AppShellViewProps> = ({router, workspaceModelId}: AppShellViewProps) => {
    return (
        <EspRouterContextProvider router={router}>
            <div role='app-root'>
                <ConnectableComponent modelId={workspaceModelId}/>
            </div>
        </EspRouterContextProvider>
    );
};