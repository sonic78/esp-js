import * as React from 'react';
import {useRouter} from './espRouterContextProvider';
import {useMemo} from 'react';
import {Router} from 'esp-js';
import {EspModelContextProvider, useGetModelId} from './espModelContextProvider';
import {createViewForModel} from './viewBindingDecorator';
import {syncModelWithSelectorOptions, useSyncModelWithSelector} from './useSyncModelWithSelector';
import {PolimerModel} from 'esp-js-polimer';

export type CreatePublishEventProps<TPublishEventProps> = (publishModelEvent: (eventType: string, event: any) => void) => TPublishEventProps;

export type MapModelToProps<TModel, TModelMappedToProps, TPublishEventProps = {}> = (model: TModel, publishEventProps: TPublishEventProps) => TModelMappedToProps;

export interface ConnectableComponentProps<TModel = {}, TPublishEventProps = {}, TModelMappedToProps = {}> {
    modelId?: string;
    viewContext?: string;
    view?: React.ComponentType;
    createPublishEventProps?: CreatePublishEventProps<TPublishEventProps>;
    mapModelToProps?: MapModelToProps<TModel, TModelMappedToProps, TPublishEventProps>;
    [key: string]: any;  // ...rest props, including the result of mapPublish and mapPublish if 'connect' was used
}

export interface ConnectableComponentChildProps<TModel = object> {
    modelId: string;
    model: TModel;
    router: Router;
    [key: string]: any; // ...rest props
}

const getChildProps = <TModel, TModelMappedToProps, TPublishEventProps>(
    router: Router,
    modelId: string,
    restProps: object,
    initialModel: TModel,
    mapModelToProps: MapModelToProps<TModel, TModelMappedToProps, TPublishEventProps>,
    publishEventProps: TPublishEventProps
): ConnectableComponentChildProps<TModel> => {
    const model = PolimerModel.isPolimerModel(initialModel)
        ? initialModel.getEspPolimerImmutableModel()
        : initialModel;
    let childProps = {
        modelId,
        router: router,
        ...restProps,
        ...publishEventProps,
        model
    };
    if (mapModelToProps) {
        childProps = {
            ...childProps,
            ...(mapModelToProps(model, publishEventProps) as TModelMappedToProps)
        };
    }
    return childProps;
};

export const ConnectableComponent = <TModel = {}, TPublishEventProps = {}, TModelMappedToProps = {}>(
    {
        modelId,
        mapModelToProps,
        createPublishEventProps,
        view,
        viewContext,
        ...rest
    }: ConnectableComponentProps<TModel, TPublishEventProps, TModelMappedToProps>
) => {
    const router = useRouter();
    // Note: we always need to render the hooks else react will complain about a different count.
    let modelIdFromContext = useGetModelId();
    modelId = modelId || modelIdFromContext;
    const publishEventProps: TPublishEventProps = useMemo(
        () => {
            if (createPublishEventProps) {
                const publishModelEvent = (eventType: string, event: any) => {
                    router.publishEvent(modelId, eventType, event);
                };
                return createPublishEventProps(publishModelEvent);
            }
            return {} as TPublishEventProps;
        },
        [router, modelId]
    );
    const model = useSyncModelWithSelector<TModel, TModel>(
        m => m,
        syncModelWithSelectorOptions()
            .setModelId(modelId)
            .setTryPreSelectPolimerImmutableModel(false)
    );
    if (model == null) {
        return null;
    }
    let childProps = getChildProps(router, modelId, rest, model, mapModelToProps, publishEventProps);
    let viewElement = createViewForModel(model, childProps, viewContext, view);
    return (
        <EspModelContextProvider modelId={modelId} model={model} router={router} {...childProps}>
            {viewElement}
        </EspModelContextProvider>
    );
};