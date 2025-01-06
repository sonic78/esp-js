import * as React from 'react';
import * as classnames from 'classnames';
import {EventConst} from '../eventConst';
import {EpicLabel} from './epicLabel';
import {Epic} from '../models/epic';
import {Router} from 'esp-js';

export interface EpicListItemViewProps {
    epic: Epic;
    router: Router;
}

export class EpicListItemView extends React.Component<EpicListItemViewProps, {}> {
    render() {
        let epic = this.props.epic;
        let router = this.props.router;
        let className = classnames('epicListItem', {'selectedItem': epic.isSelected});
        return (
            <div className={className}
                 onClick={() => {
                     router.publishEvent(epic.modelId, EventConst.EPIC_SELECTED, {epic});
                 }}>
                <div>
                    <label>Epic:</label>
                    <input
                        type='text'
                        value={epic.name}
                        onChange={e => router.publishEvent(epic.modelId, EventConst.EPIC_NAME_CHANGED, {
                            name: e.target.value,
                            epic
                        })}/>
                </div>
                <input
                    type='button'
                    onClick={() => {
                        this.props.router.publishEvent(epic.modelId, EventConst.ADD_STORY, {epic});
                    }}
                    value='Add story'/>
                <EpicLabel colour={epic.colour} displayText={epic.epicId}/>
                {epic.stories.count() > 0 ?
                    <label>Done {epic.doneCount} of {epic.stories.count()} Stories</label> : null}
            </div>
        );
    }
}