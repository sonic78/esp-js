// notice_start
/*
 * Copyright 2015 Dev Shop Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// notice_end

import * as React from 'react';
import {Guard} from 'esp-js';

export const DEFAULT_VIEW_KEY = 'default-view-key';

function getMetadata(target) {
    if (!target._viewMetadata) {
        target._viewMetadata = new ViewMetadata();
    }
    return target._viewMetadata;
}

/**
 * Tries to get a view for the given model.
 *
 * It does this using the following order:
 * 1) If a @viewBinding decorator was used and a display context was given, try get a view for that
 * 2) Else if a view was explicitly provided use that
 * 3) Else if a @viewBinding decorator was used and there is a view associated with the default display context, use that view
 * @param model
 * @param props
 * @param displayContext
 * @param view
 */
export function createViewForModel(model: any, props: object, displayContext: string, view: React.ComponentType) {
    let finalView: React.ComponentType = view; // default to that passed in, if any.

    // displayContext = displayContext || DEFAULT_VIEW_KEY;
    // the view decorator isn't on the instance, it's on the constructor function that created that instance
    if (model) {
        let constructorFunction = model.constructor;
        if (constructorFunction._viewMetadata) {
            let viewMetadata = constructorFunction._viewMetadata;
            if (displayContext && viewMetadata.hasRegisteredViewContext(displayContext)) {
                let viewMetadataRegistration = viewMetadata.viewRegistrations[displayContext];
                // we've found a view for the display context, use that
                finalView = viewMetadataRegistration.view;
            }

            // if we've not found a view yet, and one wasn't provided, is there a default one?
            if (!finalView && viewMetadata.hasRegisteredViewContext(DEFAULT_VIEW_KEY)) {
                let viewMetadataRegistration = viewMetadata.viewRegistrations[DEFAULT_VIEW_KEY];
                finalView = viewMetadataRegistration.view;
            }
        }
    }
    if (!finalView) {
        throw new Error(`No suitable view found for model id '${model.modelId}' using context '${displayContext}'`);
    }
    return React.createElement(finalView, props);
}

/**
 * An ES7 style decorator that associates a model with a view
 * @param view the react component that will be used to display this model
 * @param displayContext an optional context allowing for different views to display the same model
 * @returns {Function}
 */
export function viewBinding(view: any, displayContext: string = DEFAULT_VIEW_KEY) {
    Guard.isDefined(view, 'view must be defined');
    Guard.isString(displayContext, 'displayContext must be a string');
    return function (target: any) {
        let viewMetadata = getMetadata(target);
        if (viewMetadata.hasRegisteredViewContext(displayContext)) {
            throw new Error(`Context ${displayContext} already registered for view`);
        }
        viewMetadata.viewRegistrations[displayContext] = new ViewMetadataRegistration(view, displayContext);
    };
}

export class ViewMetadata {
    private _viewRegistrations = {};

    get viewRegistrations() {
        return this._viewRegistrations;
    }

    hasRegisteredViewContext(displayContext) {
        return typeof this._viewRegistrations[displayContext] !== 'undefined';
    }
}

export class ViewMetadataRegistration {

    constructor(private _view, private _displayContext) {
    }

    get view() {
        return this._view;
    }

    get displayContext() {
        return this._displayContext;
    }
}