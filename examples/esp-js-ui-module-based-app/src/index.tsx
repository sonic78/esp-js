import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {AppShell} from './shell/appShell';
import './css/espdemo.css';
import {AppShellView} from './shell/views/shell/shellView';

let appShell = new AppShell();
appShell.start();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<AppShellView router={appShell.router} workspaceModelId={appShell.workspaceModelId} />);