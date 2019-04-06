import * as React from 'react';
import * as PropTypes from 'prop-types';
import  { Disposable, Router, EspDecoratorUtil, utils } from 'esp-js';
import {createViewForModel } from './viewBindingDecorator';
import {StateToRenderSelectorConsts, StateToRenderSelectorMetadata} from './stateToRenderSelector';

export type PublishEvent = (eventType: string, event: any) => void;

export type CreatePublishEventProps<TPublishEventProps> = (publishEvent: PublishEvent) => TPublishEventProps;

export type MapModelToProps<TModel, TModelMappedToProps> = (model: TModel) => TModelMappedToProps;

export interface ConnectableComponentProps<TModel, TPublishEventProps = {}, TModelMappedToProps = {}> {
    modelId?: string;
    viewContext?: string;
    view?: React.ComponentClass | React.SFC;
    createPublishEventProps?: CreatePublishEventProps<TPublishEventProps>;
    mapModelToProps?: MapModelToProps<TModel, TModelMappedToProps>;
    [key: string]: any;  // ...rest props, including the result of mapPublish and mapPublish if 'connect' was used
}

export interface ConnectableComponentChildProps<TModel> {
    modelId: string;
    model: TModel;
    router: Router;
    [key: string]: any; // ...rest props, including the result of mapPublish and mapPublish if 'connect' was used
}

export interface State {
    model?: any;
    publishProps?: any;
}

interface ConnectableComponentContext {
    router: Router;
    modelId: string;
}

export class ConnectableComponent<TModel, TPublishEventProps = {}, TModelMappedToProps = {}> extends React.Component<ConnectableComponentProps<TModel, TPublishEventProps, TModelMappedToProps>, State> {
    private _observationSubscription: Disposable = null;
    context: ConnectableComponentContext;

    static contextTypes = {
        router: PropTypes.instanceOf(Router).isRequired,
        modelId: PropTypes.string
    };

    constructor(props: ConnectableComponentProps<TModel, TPublishEventProps, TModelMappedToProps>, context: ConnectableComponentContext) {
        super(props, context);
        this.state = {model: null};
    }

    componentWillReceiveProps(nextProps: ConnectableComponentProps<TModel, TPublishEventProps, TModelMappedToProps>, nextContext: ConnectableComponentContext) {
        const modelId = nextProps.modelId || nextContext.modelId;
        const oldModelId = this._getModelId();

        if (modelId === oldModelId) {
            return;
        }
        
        if(nextProps.modelId === oldModelId) {
            return;
        }

        this._tryObserveModel(modelId);
    }

    componentDidMount() {
        this._tryObserveModel(this._getModelId());
    }

    componentWillUnmount() {
        this._tryDisposeModelSubscription();
    }

    private _getModelId(): string {
        // props override context
        return this.props.modelId || this.context.modelId;
    }

    private _tryObserveModel(modelId: string): void {
        this._tryDisposeModelSubscription();

        if (!modelId) {
            return;
        }

        // We only map the publish props once, as for well behaving components these callbacks should never change
        if(this.props.createPublishEventProps) {
            const publishProps = this.props.createPublishEventProps(this._publishEvent(this.context.router, modelId));
            this.setState({publishProps});
        }

        this._observationSubscription = this.context.router
            .getModelObservable(modelId)
            .subscribe(model => this.setState({model}));
    }

    private _tryDisposeModelSubscription() {
        if(this._observationSubscription) {
            this.setState({model: null});
            this._observationSubscription.dispose();
        }
    }

    private _publishEvent = (router: Router, modelId: string) => (eventType: string, event: any) => router.publishEvent(modelId, eventType, event);

    public render() {
        if(this.state.model == null) {
            return null;
        }
        let childProps = this._getChildProps();
        return createViewForModel(this.state.model, childProps, this.props.viewContext, this.props.view);
    }

    private _getChildProps(): ConnectableComponentChildProps<TModel> {
        const {children, createPublishEventProps, modelId, mapModelToProps, view, viewContext, ...rest} = this.props;
        const outerProps = {
            ...rest,
            ...this.state.publishProps
        };
        // first see if there is a selector associated with our model, if so we'll call that as a first pass
        // this may replace the type of the model
        const model = this._getStateToRender(this.state.model);
        // next we try create secondary model which we'll spread down to our nested component in addition to the entire model
        const modelMappedToProps = this.props.mapModelToProps
            ? this.props.mapModelToProps(model)
            : {};
        return {
            modelId: this._getModelId(),
            model,
            router: this.context.router,
            ...modelMappedToProps,
            ...outerProps
        };
    }

    /**
     * Sees if there is a special selector function which can be invoked to return the state to render, else returns the given model
     */
    private _getStateToRender(model: any) {
        // does the given model have a decorated function we can invoke to get a different model to render?
        if (EspDecoratorUtil.hasMetadata(model)) {
            let metadata: StateToRenderSelectorMetadata = EspDecoratorUtil.getCustomData(model, StateToRenderSelectorConsts.CustomDataKey);
            if (metadata) {
                return model[metadata.functionName]();
            }
        }
        // else see if there is a function with name RenderStateSelectorConsts.HandlerFunctionName we can invoke to get a different model to render?
        let stateSaveHandlerFunction = model[StateToRenderSelectorConsts.HandlerFunctionName];
        if (stateSaveHandlerFunction && utils.isFunction(stateSaveHandlerFunction)) {
            return stateSaveHandlerFunction.call(model);
        }
        return model;
    }
}

// Lifting 'ConnectableView' into it's own type so it can be exported, else tsc doesn't correctly generated declaration files
export type ConnectableView = React.ComponentClass | React.SFC;

export const connect = function<TModel, TPublishEventProps, TModelMappedToProps = {}>(
    mapModelToProps?: MapModelToProps<TModel, TModelMappedToProps>,
    createPublishEventProps?: CreatePublishEventProps<TPublishEventProps>
): (view: ConnectableView) => (props: ConnectableComponentProps<TModel, TPublishEventProps, TModelMappedToProps>) => JSX.Element {
    return function(view: ConnectableView) {
        return function(props: ConnectableComponentProps<TModel, TPublishEventProps, TModelMappedToProps>) {
            const {modelId, viewContext, ...rest} = props;
            return <ConnectableComponent
                modelId={modelId}
                view={view}
                viewContext={viewContext}
                createPublishEventProps={createPublishEventProps}
                mapModelToProps={mapModelToProps}
                {...rest}
            />;
        };
    };
};