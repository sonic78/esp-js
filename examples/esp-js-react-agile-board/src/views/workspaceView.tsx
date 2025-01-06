import * as React from 'react';
import * as classnames from 'classnames';
import { EventConst } from '../eventConst';
import { EpicListItemView } from './epicListItemView';
import { StoryListItemView } from './storyListItemView';
import { StoryDetailsView } from './storyDetailsView';
import { Router } from 'esp-js';
import { Workspace } from '../models/workspace';

export interface WorkspaceViewProps {
    model?: Workspace;
    router?: Router;
}

export class WorkspaceView extends React.Component<WorkspaceViewProps, {}> {
    render() {
        let workspace = this.props.model;
        let router = this.props.router;
        let epics = workspace.epics.map(epic => {
            return (<EpicListItemView key={epic.epicId} epic={epic} router={router}/>);
        });
        let showAllClassName = classnames({'hide': !workspace.showAllStoriesButton});
        let displayedStories = workspace.displayedStories.map(story => {
            return (<StoryListItemView key={story.storyId} story={story} router={router}/>);
        });
        let storyDetailsView = workspace.selectedStory
            ? (<StoryDetailsView story={workspace.selectedStory} router={router}/>)
            : null;
        return (
            <div className='workspace'>
                <h1>Scrum Task Board (esp-js-react demo)</h1>
                <input
                    type='button'
                    onClick={() => {this.props.router.publishEvent(workspace.modelId, EventConst.ADD_EPIC, {}); }}
                    value='Add Epic'/>
                <input
                    type='button'
                    className={showAllClassName}
                    onClick={() => {this.props.router.publishEvent(workspace.modelId, EventConst.SHOW_ALL_STORIES, {}); }}
                    value='Show All Stories'/>
                <div className='workspace__main-content'>
                    <div className='workspace__epic-list'>
                        <h3>Epics</h3>
                        {epics}
                    </div>
                    <div className='workspace__story-list'>
                        <h3>Stories</h3>
                        {displayedStories}
                    </div>
                    <div className='workspace__story-details'>
                        <h3>Story Details</h3>
                        {storyDetailsView}
                    </div>
                </div>
            </div>
        );
    }
}