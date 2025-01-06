import * as React from 'react';
import {Router} from 'esp-js';
import {ConnectableComponent, EspRouterContextProvider} from 'esp-js-react';
import {Workspace} from './models/workspace';
import {Modal} from './models/modal';

export class App extends React.PureComponent {
    private readonly router: Router;
    private readonly workspaceModelId: string;
    private readonly modalModelId: string;

    constructor(props) {
        super(props);
        // create an app wide router
        this.router = new Router();

        // create a model responsible for displaying app wide modal windows
        let modal = new Modal(this.router);
        modal.observeEvents();
        this.modalModelId = modal.modelId;

        // create the main model
        let workspace = new Workspace(this.router, modal);
        this.workspaceModelId = workspace.modelId;
        workspace.observeEvents();
    }

    render() {
        return (
            <EspRouterContextProvider router={this.router}>
                <div role='app-root'>
                    <ConnectableComponent modelId={this.workspaceModelId}/>
                    <ConnectableComponent modelId={this.modalModelId}/>
                </div>
            </EspRouterContextProvider>
        );
    }
}