import * as React from 'react';
import {DefaultModelAddress} from 'esp-js';
import {useContext, useCallback, createContext, PropsWithChildren} from 'react';
import {useRouter} from './espRouterContextProvider';

export const GetModelIdContext = createContext<string>(null);
/**
 * Returns a function to get the ID of the model connected at a higher point in the V-DOM.
 *
 * To use this, please ensure your V-DOM has the EspModelContextProvider at a higher node.
 */
export const useGetModelId = () => useContext(GetModelIdContext);

export const GetModelContext = createContext<object>(null);
/**
 * Returns a function which will return the model connected at a higher point in the V-DOM.
 *
 * To use this, please ensure your V-DOM has the EspModelContextProvider at a higher node.
 */
export const useGetModel = <TModel,>() => useContext(GetModelContext) as TModel;

export type PublishModelEventDelegate = (eventType: string, event: any) => void;
export const PublishModelEventContext = createContext<PublishModelEventDelegate>(null);
/**
 * Returns a function which can be used to publish an event to the model connected at a higher point in the V-DOM.
 *
 * Effectively, this is a version of usePublishEvent() which closes over the relevant modelId.
 *
 * To use this, please ensure your V-DOM has the EspModelContextProvider at a higher node.
 */
export const usePublishModelEvent = () => useContext(PublishModelEventContext);

export type PublishModelEventWithEntityKeyDelegate = (entityKey: string, eventType: string, event: any) => void;
export const PublishModelEventWithEntityKeyContext = createContext<PublishModelEventWithEntityKeyDelegate>(null);
/**
 * Returns a function which can be used to publish an event to the model connected at a higher point in the V-DOM, allows an entityKey to be specified.
 *
 * Effectively, this is a version of usePublishEvent() which closes over the modelId.
 *
 * To use this, please ensure your V-DOM has the EspModelContextProvider at a higher node.
 */
export const usePublishModelEventWithEntityKey = () => useContext(PublishModelEventWithEntityKeyContext);

export interface EspModelContextProviderProps {
    modelId: string;
    model?: any;
}

/**
 * Sets up various ESP context so ESP hooks are available below this point in the V-DOM
 *
 * To use this, please ensure your V-DOM has the EspRouterContextProvider at a higher node.
 * @param modelId
 * @param children
 * @param model
 * @constructor
 */
export const EspModelContextProvider = ({modelId, children, model}: PropsWithChildren<EspModelContextProviderProps>) => {
    const router = useRouter();
    // modelId may have been set by a higher level version of this component, so we try and get it from context if it's not set by props.
    let modelIdFromContext = useGetModelId();
    modelId = modelId || modelIdFromContext;
    const publishModelEvent: PublishModelEventDelegate = useCallback((eventType: string, event: any) => {
        router.publishEvent(modelId, eventType, event);
    }, [router, modelId]);
    const publishModelEventWithEntityKey: PublishModelEventWithEntityKeyDelegate = useCallback((entityKey: string, eventType: string, event: any) => {
        router.publishEvent(new DefaultModelAddress(modelId, entityKey), eventType, event);
    }, [router, modelId]);
    return (
        <GetModelIdContext.Provider value={modelId}>
            <PublishModelEventContext.Provider value={publishModelEvent}>
                <PublishModelEventWithEntityKeyContext.Provider value={publishModelEventWithEntityKey}>
                    <GetModelContext.Provider value={model}>
                        {children}
                    </GetModelContext.Provider>
                </PublishModelEventWithEntityKeyContext.Provider>
            </PublishModelEventContext.Provider>
        </GetModelIdContext.Provider>
    );
};