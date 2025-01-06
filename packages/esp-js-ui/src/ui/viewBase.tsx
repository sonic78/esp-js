import * as React from 'react';
import {Router} from 'esp-js';

/**
 * @deprecated
 */
export interface ViewBaseProps<TModel> {
    model:TModel;
    router:Router;
}

/**
 * @deprecated
 */
export abstract class ViewBase<TComponent, TModel, TProps extends ViewBaseProps<TModel>>
    extends React.Component<TProps, any> {
    // This used to have all the model observation, that's now in esp-js-react's SmartComponent
    // This view is doing something by way of the generic constraint it's putting on the props, but that's not exactly code reuse.
    // Keeping this here for now, might delete at some point if we don't use it
}