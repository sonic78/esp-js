import {Logger} from '../../system/logging/logger';

// Redux Dev Tools API Docs:
// https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Methods.md

export const logger = Logger.create('EspDevToolsConnector');

const devToolsExtension = (<any>window).__REDUX_DEVTOOLS_EXTENSION__; //tslint:disable-line

const _reduxDevToolsDetectedAndEnabledInEsp = (() => {
    try {
        if (devToolsExtension == null) {
            return false;
        }
        const url = new URL(window.location.href);
        if (url.searchParams.has('espReduxDevToolsEnabled')) {
            let espReduxDevToolsEnabled = url.searchParams.get('espReduxDevToolsEnabled').toLowerCase().trim();
            if (espReduxDevToolsEnabled === '' || espReduxDevToolsEnabled === 'true') {
                return true;
            }
        }
    } catch(e: any) { }
    return false;
})();

/**
 * This is an internal ESP API for Redux Dev Tools Connectivity
 */
export const reduxDevToolsDetectedAndEnabledInEsp = () => {
    return _reduxDevToolsDetectedAndEnabledInEsp;
};

/**
 * This is an internal ESP API for Redux Dev Tools Connectivity
 */
export const connectReduxDevTools = (instanceId: string) => {
    if (_reduxDevToolsDetectedAndEnabledInEsp) {
        const options: any = {name: instanceId, instanceId};
        const instance = devToolsExtension.connect(options);
        const unsubscribe = instance.subscribe(
            (message: any) => {
                if (message.type === 'DISPATCH') {
                    logger.warn(`ESP Redux DevTools is read-only. Message from the dev tools monitor will be ignored. Received message: [${JSON.stringify(message)}].`);
                }
            }
        );
        // This will unsubscribe the listener from dev tools, however, the state will still appear in dev tools.
        // That appears to be by design.
        // There is a devToolsExtension.disconnect(), but that un-wires all connected instances.
        return unsubscribe;
    }
    return () => {
    };
};

// Conforms to the Redux update format
type Update = {
    type: string;
    payload: any
};

const MAX_EVENT_NODE_SIZE = 50;
// This isn't a great 'size' check, but it's at least some protection against sending huge objects to dev tools
const EVENT_TO_LARGE_CONST = 'EventToBigToSend_MoreThan' + MAX_EVENT_NODE_SIZE + 'Nodes';

const _countObjectKeys = (obj: any, stopAt: number, lastCount = 0) => {
    if (typeof obj !== 'object' || obj === null) {
        return 0;
    }
    const keys = Object.keys(obj);
    let count = lastCount + keys.length;
    if (count >= stopAt) {
        return count;
    }
    for (const key of keys) {
        count += _countObjectKeys(obj[key], stopAt, count);
    }
    return count;
};

/**
 * This is an internal ESP API for Redux Dev Tools Connectivity
 */
export const sendUpdateToReduxDevTools = (event: { eventType: string, event: any }, state: any, instanceId: string) => {
    if (_reduxDevToolsDetectedAndEnabledInEsp) {
        const options = {name: instanceId};
        const eventToForward = _countObjectKeys(event.event, MAX_EVENT_NODE_SIZE) >= MAX_EVENT_NODE_SIZE
            ? EVENT_TO_LARGE_CONST
            : event.event;
        const update: Update = {type: event.eventType, payload: eventToForward};
        devToolsExtension.send(update, state, options, instanceId);
    }
};