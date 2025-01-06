import * as React from 'react';
import {ConnectableComponent} from 'esp-js-react';
import { Router } from 'esp-js';
import { Modal } from '../models/modal';

export interface ModalViewProps {
    model: Modal;
    router: Router;
}

export class ModalView extends React.Component<ModalViewProps, {}> {
    render() {
        let modal = this.props.model;
        if (!modal.modelIdToDisplay) {
            return null;
        }
        return (
            <div className='modal'>
                <div className='modal__content'>
                    <ConnectableComponent modelId={modal.modelIdToDisplay} viewContext={modal.modelViewContext}/>
                </div>
            </div>
        );
    }
}